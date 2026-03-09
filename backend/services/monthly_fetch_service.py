import logging
import asyncio
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
import uuid

from fastapi import HTTPException, status
from sqlmodel import Session

from models import PriceData, FetchMonthResponse, HistoryEntry
from utils import get_last_business_day, validate_month, format_date, format_datetime_iso
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services import db_service

logger = logging.getLogger(__name__)

async def process_monthly_prices(year: int, month: int, session: Session) -> FetchMonthResponse:
    """
    Fetch prices for all assets for the given month.
    """

    logger.info(f"📊 Fetch-month request: {year}-{month:02d}")

    if not validate_month(year, month):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid month: {year}-{month:02d}"
        )

    errors: List[str] = []
    prices: List[PriceData] = []

    try:
        last_business_day = get_last_business_day(year, month)
        logger.info(f"📅 Last business day: {format_date(last_business_day)}")

        db_assets = db_service.get_all_assets(session)
        if not db_assets:
            return FetchMonthResponse(
                success=False,
                message="No assets available in the database.",
                year=year,
                month=month,
                lastBusinessDay=format_date(last_business_day),
                prices=[],
                errors=["No assets available"]
            )

        assets = [asset.model_dump() for asset in db_assets]
        active_assets = [a for a in assets if not a.get("is_archived", False)]

        crypto_assets = [a for a in active_assets if a.get("category") == "Crypto" and ("BTC" in str(a.get("ticker", "")).upper() or "BITCOIN" in str(a.get("name", "")).upper())]
        fund_assets = [a for a in active_assets if a.get("category") == "Fund"]

        broker_assets_dict = {}
        stocks_assets = [a for a in active_assets if a.get("category") == "Stocks"]

        for broker_asset in stocks_assets:
             broker_id = broker_asset.get("id")
             # Calculate holdings for this broker using the database aggregation
             active_tickers = db_service.get_asset_holdings(session, broker_id)

             broker_assets_dict[broker_asset.get("name")] = {
                 "name": broker_asset.get("name"),
                 "id": broker_id,
                 "category": "Broker",
                 "componentTickers": list(active_tickers.keys()),
                 "holdings": active_tickers
             }

        broker_assets = list(broker_assets_dict.values())

        tasks = []

        def fetch_btc():
            if crypto_assets:
                btc_asset = crypto_assets[0]
                return ("btc", btc_asset, PriceFetcher.fetch_bitcoin_price(
                    date=last_business_day,
                    asset_id=btc_asset["id"],
                    asset_name=btc_asset["name"]
                ))
            return ("btc", None, None)

        if crypto_assets:
            tasks.append(asyncio.to_thread(fetch_btc))

        def make_fund_fetcher(fund):
            def fetch():
                return ("fund", fund, FundScraper.fetch_fund_price(
                    isin=fund["isin"],
                    asset_name=fund["name"],
                    asset_id=fund["id"]
                ))
            return fetch

        for fund in fund_assets:
            if not fund.get("isin"):
                continue
            tasks.append(asyncio.to_thread(make_fund_fetcher(fund)))

        def make_broker_fetcher(broker):
            def fetch():
                component_tickers = broker.get("componentTickers", [])
                holdings = broker.get("holdings", {})

                if not component_tickers:
                    return ("broker", broker, [])

                tickers_map = {
                    ticker: (f"{broker.get('name')} - {ticker}", broker["id"])
                    for ticker in component_tickers
                }

                individual_prices = PriceFetcher.fetch_multiple_stocks(tickers_map, last_business_day)

                total_broker_value = 0.0
                for p in individual_prices:
                    shares = holdings.get(p.ticker, 0.0)
                    total_broker_value += float(p.price) * shares
                    p.assetId = f"ticker-{p.ticker}"
                    p.assetName = f"Stock {p.ticker}"

                if total_broker_value > 0:
                    aggregated_price = PriceData(
                        assetId=broker["id"],
                        assetName=broker["name"],
                        ticker=None,
                        price=round(total_broker_value, 2),
                        currency="EUR",
                        fetchedAt=format_datetime_iso(datetime.now()),
                        source="yfinance_aggregated"
                    )
                    return ("broker", broker, [aggregated_price] + individual_prices)

                return ("broker", broker, individual_prices)
            return fetch

        for broker in broker_assets:
            if broker.get("componentTickers"):
                tasks.append(asyncio.to_thread(make_broker_fetcher(broker)))

        results = await asyncio.gather(*tasks)

        # To keep track of nav mapping
        nav_mapping = {}

        for result in results:
            type_ = result[0]
            if type_ == "btc":
                _, asset, btc_data = result
                if btc_data:
                    prices.append(btc_data)
                    nav_mapping[btc_data.assetId] = btc_data.price # Just storing price
                else: errors.append("Failed to fetch Bitcoin price")
            elif type_ == "fund":
                _, fund, price_data = result
                if price_data:
                    prices.append(price_data)
                    nav_mapping[price_data.assetId] = price_data.price
                else: errors.append(f"Failed to fetch price for {fund.get('name')}")
            elif type_ == "broker":
                _, broker, broker_prices = result
                prices.extend(broker_prices)
                for p in broker_prices:
                    if p.ticker is None: # The aggregated one
                         nav_mapping[p.assetId] = p.price

        logger.info(f"✅ Fetched {len(prices)} prices successfully")

        if len(prices) == 0:
            return FetchMonthResponse(
                success=False,
                message="No prices fetched",
                year=year,
                month=month,
                lastBusinessDay=format_date(last_business_day),
                prices=[],
                errors=errors
            )

        saved_count = 0
        month_str = f"{year}-{month:02d}-01"
        date_obj = datetime.strptime(month_str, "%Y-%m-%d").date()

        # We only want to save HistoryEntry for actual assets (not individual tickers inside a broker)
        # So we look at the original active_assets and the nav_mapping

        for asset in active_assets:
             asset_id = asset["id"]
             if asset_id in nav_mapping:
                 val = nav_mapping[asset_id]

                 # Recuperar historial anterior para mantener datos (aportaciones, coste medio...)
                 prev_history_all = db_service.get_history_by_asset(session, asset_id)
                 # Evitamos coger datos del propio mes si se está recalculando
                 prev_history = [h for h in prev_history_all if h.snapshot_date < date_obj]

                 participations = (prev_history[0].participations
                                if prev_history and prev_history[0].participations is not None
                                else Decimal("0.0"))

                 contribution = (prev_history[0].contribution
                                if prev_history and prev_history[0].contribution is not None
                                else Decimal("0.0"))

                 mean_cost = (prev_history[0].mean_cost
                            if prev_history and prev_history[0].mean_cost is not None
                            else Decimal("0.0"))

                 # Detectar si el activo es Bitcoin
                 is_btc = asset.get("category") == "Crypto" and ("BTC" in str(asset.get("ticker", "")).upper() or "BITCOIN" in str(asset.get("name", "")).upper())

                 if is_btc:
                     # La verdad: Calcular participaciones reales desde transacciones (vía DB aggregation)
                     btc_holdings = db_service.get_total_btc_holdings(session, asset_id)

                     participations = Decimal(str(round(btc_holdings, 8)))
                     nav_val = Decimal(str(round(float(val) * btc_holdings, 2)))
                     liquid_nav = Decimal(str(val))

                 elif asset.get("category") == "Stocks":
                     nav_val = Decimal(str(val))
                     liquid_nav = Decimal("1.0") if float(val) > 0 else Decimal("0.0")

                 else:
                     # Fondos indexados y resto de activos
                     nav_val = Decimal(str(round(float(val) * float(participations), 2)))
                     liquid_nav = Decimal(str(val))

                 history_entry = HistoryEntry(
                     id=str(uuid.uuid4()),
                     asset_id=asset_id,
                     snapshot_date=date_obj,
                     liquid_nav_value=liquid_nav,
                     nav=nav_val,
                     contribution=contribution,
                     participations=participations,
                     mean_cost=mean_cost
                 )
                 db_service.create_history_entry(session, history_entry)
                 saved_count += 1

        logger.info(f"💾 Saved {saved_count} history entries to database")

        return FetchMonthResponse(
            success=True,
            message=f"Successfully fetched and saved {len(prices)} prices",
            year=year,
            month=month,
            lastBusinessDay=format_date(last_business_day),
            prices=prices,
            errors=errors
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in fetch-month: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching prices: {str(e)}")
