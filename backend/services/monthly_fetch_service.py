import logging
import asyncio
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
import uuid

from fastapi import HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PriceData, FetchMonthResponse, HistoryEntry, AssetCategory
from utils import get_last_business_day, validate_month, format_date, format_datetime_iso
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services import db_service

logger = logging.getLogger(__name__)

async def process_monthly_prices(year: int, month: int, session: AsyncSession) -> FetchMonthResponse:
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

        db_assets = await db_service.get_all_assets(session)
        if not db_assets:
            return FetchMonthResponse(
                success=False,
                message="No assets available in the database.",
                year=year,
                month=month,
                last_business_day=format_date(last_business_day), 
                prices=[],
                errors=["No assets available"]
            )

        assets = [asset.model_dump() for asset in db_assets]
        active_assets = [a for a in assets if not a.get("is_archived", False)]

        crypto_assets = [a for a in active_assets if a.get("category") == AssetCategory.CRYPTO.value and ("BTC" in str(a.get("ticker", "")).upper() or "BITCOIN" in str(a.get("name", "")).upper())]
        fund_assets = [a for a in active_assets if a.get("category") == AssetCategory.FUND.value]

        broker_assets_dict = {}
        stocks_assets = [a for a in active_assets if a.get("category") == AssetCategory.STOCK.value]

        for broker_asset in stocks_assets:
             broker_id = broker_asset.get("id")
             active_tickers = await db_service.get_asset_holdings(session, broker_id)

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
                    p.asset_id = f"ticker-{p.ticker}"
                    p.asset_name = f"Stock {p.ticker}"

                if total_broker_value > 0:
                    aggregated_price = PriceData(
                        asset_id=broker["id"],
                        asset_name=broker["name"],
                        ticker=None,
                        price=round(total_broker_value, 2),
                        currency="EUR",
                        fetched_at=format_datetime_iso(datetime.now()),
                        source="yfinance_aggregated"
                    )
                    return ("broker", broker, [aggregated_price] + individual_prices)

                return ("broker", broker, individual_prices)
            return fetch

        for broker in broker_assets:
            if broker.get("componentTickers"):
                tasks.append(asyncio.to_thread(make_broker_fetcher(broker)))

        results = await asyncio.gather(*tasks)

        nav_mapping = {}

        for result in results:
            type_ = result[0]
            if type_ == "btc":
                _, asset, btc_data = result
                if btc_data and float(btc_data.price) > 0:
                    prices.append(btc_data)
                    nav_mapping[btc_data.asset_id] = btc_data.price
                else: errors.append("Failed to fetch Bitcoin price")
            elif type_ == "fund":
                _, fund, price_data = result
                if price_data and float(price_data.price) > 0:
                    prices.append(price_data)
                    nav_mapping[price_data.asset_id] = price_data.price
                else: errors.append(f"Failed to fetch price for {fund.get('name')}")
            elif type_ == "broker":
                _, broker, broker_prices = result
                prices.extend(broker_prices)
                for p in broker_prices:
                    if p.ticker is None:
                         nav_mapping[p.asset_id] = p.price

        logger.info(f"✅ Fetched {len(prices)} prices successfully")

        if len(prices) == 0:
            return FetchMonthResponse(
                success=False,
                message="No prices fetched",
                year=year,
                month=month,
                last_business_day=format_date(last_business_day),
                prices=[],
                errors=errors
            )

        saved_count = 0
        month_str = f"{year}-{month:02d}-01"
        date_obj = datetime.strptime(month_str, "%Y-%m-%d").date()

        for asset in active_assets:
            asset_id = asset["id"]

            # Retrieve previous history to fallback or compute values
            prev_history_all = await db_service.get_history_by_asset(session, asset_id)
            prev_history = [h for h in prev_history_all if h.snapshot_date < date_obj]

            # Default previous values
            prev_participations = Decimal("0.0")
            prev_mean_cost = Decimal("0.0")
            prev_nav = Decimal("0.0")
            prev_liquid_nav = Decimal("0.0")

            if prev_history:
                prev_entry = prev_history[0]
                prev_participations = prev_entry.participations if prev_entry.participations is not None else Decimal("0.0")
                prev_mean_cost = prev_entry.mean_cost if prev_entry.mean_cost is not None else Decimal("0.0")
                prev_nav = prev_entry.nav if prev_entry.nav is not None else Decimal("0.0")
                prev_liquid_nav = prev_entry.liquid_nav_value if prev_entry.liquid_nav_value is not None else Decimal("0.0")

            # Contributions are always 0 for a new month generated automatically
            contribution = Decimal("0.0")

            if asset_id in nav_mapping:
                val = nav_mapping[asset_id]
                participations = prev_participations
                mean_cost = prev_mean_cost

                is_btc = asset.get("category") == AssetCategory.CRYPTO.value and ("BTC" in str(asset.get("ticker", "")).upper() or "BITCOIN" in str(asset.get("name", "")).upper())

                if is_btc:
                    btc_holdings = await db_service.get_total_btc_holdings(session, asset_id)
                    participations = Decimal(str(round(btc_holdings, 8)))
                    nav_val = Decimal(str(round(float(val) * btc_holdings, 2)))
                    liquid_nav = Decimal(str(val))
                elif asset.get("category") == AssetCategory.STOCK.value:
                    nav_val = Decimal(str(val))
                    liquid_nav = Decimal("1.0") if float(val) > 0 else Decimal("0.0")
                else:
                    nav_val = Decimal(str(round(float(val) * float(participations), 2)))
                    liquid_nav = Decimal(str(val))

            else:
                # Fallback for missing assets, like "Cash" or failed fetches
                participations = prev_participations
                mean_cost = prev_mean_cost

                is_btc = asset.get("category") == AssetCategory.CRYPTO.value and ("BTC" in str(asset.get("ticker", "")).upper() or "BITCOIN" in str(asset.get("name", "")).upper())

                if is_btc:
                    btc_holdings = await db_service.get_total_btc_holdings(session, asset_id)
                    participations = Decimal(str(round(btc_holdings, 8)))

                    if prev_participations > 0 and prev_liquid_nav > 0:
                        val = prev_liquid_nav
                        nav_val = Decimal(str(round(float(val) * float(participations), 2)))
                        liquid_nav = val
                    else:
                        nav_val = Decimal("0.0")
                        liquid_nav = Decimal("0.0")
                elif asset.get("category") == AssetCategory.STOCK.value:
                    # For stocks that were not fetched (maybe fetch failed or API error),
                    # we should calculate the value based on currently open holdings
                    # multiplied by their last known individual prices.
                    active_tickers = await db_service.get_asset_holdings(session, asset_id)
                    total_broker_value = 0.0

                    for ticker, shares in active_tickers.items():
                        if shares > 0:
                            ticker_asset_id = f"ticker-{ticker}"
                            ticker_val = 0.0

                            # First check if we managed to fetch THIS specific ticker's price
                            if ticker_asset_id in nav_mapping:
                                ticker_val = float(nav_mapping[ticker_asset_id])
                            else:
                                # Look up the last known price for this ticker
                                ticker_prev_history = await db_service.get_history_by_asset(session, ticker_asset_id)
                                valid_prev = [h for h in ticker_prev_history if h.snapshot_date < date_obj]
                                if valid_prev and valid_prev[0].liquid_nav_value is not None and valid_prev[0].liquid_nav_value > 0:
                                    ticker_val = float(valid_prev[0].liquid_nav_value)
                                elif valid_prev and valid_prev[0].mean_cost is not None and valid_prev[0].mean_cost > 0:
                                    ticker_val = float(valid_prev[0].mean_cost)

                            total_broker_value += ticker_val * shares

                    if active_tickers:
                        nav_val = Decimal(str(round(total_broker_value, 2)))
                        liquid_nav = Decimal("1.0") if total_broker_value > 0 else Decimal("0.0")
                    else:
                        nav_val = prev_nav
                        liquid_nav = prev_liquid_nav
                else:
                    # For standard funds, cash, or missing fetches
                    nav_val = prev_nav
                    liquid_nav = prev_liquid_nav

            # Ensure we don't save duplicates if we're re-running the same month
            existing_entries = [h for h in prev_history_all if h.snapshot_date == date_obj]
            if existing_entries:
                history_entry = existing_entries[0]
                history_entry.liquid_nav_value = liquid_nav
                history_entry.nav = nav_val
                history_entry.contribution = contribution
                history_entry.participations = participations
                history_entry.mean_cost = mean_cost
                await db_service.update_history_entry(session, history_entry.id, history_entry)
            else:
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
                await db_service.create_history_entry(session, history_entry)
            saved_count += 1

        # Also, create entries for the individual stock tickers under broker assets
        # that were fetched and placed in nav_mapping.
        # Note: They have asset_id like "ticker-AAPL" in nav_mapping but they might not be in active_assets.
        for asset_id, val in nav_mapping.items():
            if asset_id.startswith("ticker-"):
                prev_history_all = await db_service.get_history_by_asset(session, asset_id)
                prev_history = [h for h in prev_history_all if h.snapshot_date < date_obj]

                prev_mean_cost = Decimal("0.0")
                if prev_history and prev_history[0].mean_cost is not None:
                    prev_mean_cost = prev_history[0].mean_cost

                nav_val = Decimal(str(val))
                liquid_nav = Decimal(str(val))
                participations = Decimal("1.0")
                contribution = Decimal("0.0")
                mean_cost = prev_mean_cost

                existing_entries = [h for h in prev_history_all if h.snapshot_date == date_obj]
                if existing_entries:
                    history_entry = existing_entries[0]
                    history_entry.liquid_nav_value = liquid_nav
                    history_entry.nav = nav_val
                    history_entry.contribution = contribution
                    history_entry.participations = participations
                    history_entry.mean_cost = mean_cost
                    await db_service.update_history_entry(session, history_entry.id, history_entry)
                else:
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
                    await db_service.create_history_entry(session, history_entry)
                saved_count += 1

        logger.info(f"💾 Saved {saved_count} history entries to database")

        return FetchMonthResponse(
            success=True,
            message=f"Successfully fetched and saved {len(prices)} prices",
            year=year,
            month=month,
            last_business_day=format_date(last_business_day),
            prices=prices,
            errors=errors
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in fetch-month: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching prices: {str(e)}")
