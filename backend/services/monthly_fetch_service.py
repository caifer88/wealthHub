import logging
import asyncio
from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PriceData, FetchMonthResponse, HistoryEntry, AssetCategory
from utils import get_last_business_day, validate_month, format_date, format_datetime_iso
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services import db_service
from services.stock_asset_manager import (
    get_or_create_stock_asset,
    ensure_all_transaction_tickers_exist,
    get_ticker_to_asset_mapping
)

logger = logging.getLogger(__name__)


async def fetch_eur_usd_rate_with_fallback(session: AsyncSession, date_obj) -> Tuple[float, str]:
    """
    Fetch EUR/USD exchange rate with resilient fallback strategy.
    
    Strategy:
    1. Try live source (yfinance) → source: 'yfinance'
    2. Fallback to DB history (last 7 days) → source: 'fallback_db'
    3. Ultimate fallback: hardcoded 1.1 → source: 'fallback_hardcoded'
    
    Args:
        session: Database session
        date_obj: The date for which we're fetching the rate
    
    Returns:
        Tuple of (rate_value, source_label)
    """
    # Strategy 1: Try live fetch
    try:
        live_rate = await asyncio.to_thread(PriceFetcher.fetch_eur_usd_rate)
        if live_rate and live_rate > 0:
            logger.info(f"💱 EUR/USD rate from live source (yfinance): {live_rate:.4f}")
            return (live_rate, "yfinance")
    except Exception as e:
        logger.warning(f"⚠️ Live EUR/USD fetch failed: {str(e)}")
    
    # Strategy 2: Try DB history (last 7 days)
    try:
        seven_days_ago = date_obj - timedelta(days=7)
        
        # Get latest rate from DB
        db_rate = await db_service.get_latest_exchange_rate(session, "EUR/USD")
        
        if db_rate and db_rate > 0:
            # Verify it's recent enough (within 7 days)
            logger.info(f"💱 EUR/USD rate from DB history: {db_rate:.4f}")
            return (db_rate, "fallback_db")
    except Exception as e:
        logger.warning(f"⚠️ DB EUR/USD lookup failed: {str(e)}")
    
    # Strategy 3: Ultimate fallback
    logger.warning(f"⚠️ Using hardcoded EUR/USD fallback rate: 1.1")
    return (1.1, "fallback_hardcoded")

async def process_monthly_prices(year: int, month: int, session: AsyncSession) -> FetchMonthResponse:
    logger.info(f"📊 Fetch-month request: {year}-{month:02d}")

    if not validate_month(year, month):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid month: {year}-{month:02d}"
        )

    errors: List[str] = []
    prices: List[PriceData] = []
    eur_usd_rate = None
    eur_usd_rate_source = "unknown"

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
                errors=["No assets available"],
                exchange_rate_to_eur=None,
                exchange_rate_source=None
            )

        assets = [asset.model_dump() for asset in db_assets]
        active_assets = [a for a in assets if not a.get("is_archived", False)]

        crypto_assets = [a for a in active_assets if a.get("category") == AssetCategory.CRYPTO.value and ("BTC" in str(a.get("ticker", "")).upper() or "BITCOIN" in str(a.get("name", "")).upper())]
        fund_assets = [
            a for a in active_assets 
            if a.get("category") in (
                AssetCategory.FUND_ACTIVE.value, 
                AssetCategory.FUND_INDEX.value,
                AssetCategory.PENSION.value
            )
        ]

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

        # ===== PHASE 1: Ensure all stock transaction tickers have real Assets =====
        if broker_assets:
            logger.info("🔄 PHASE 1: Ensuring all transaction tickers have real Stock Assets...")
            try:
                ticker_asset_map = await ensure_all_transaction_tickers_exist(session)
                logger.info(f"✅ PHASE 1 complete: Verified/created assets for {len(ticker_asset_map)} tickers")
            except Exception as e:
                logger.error(f"⚠️ PHASE 1 partially failed: {str(e)} (continuing with existing assets)")
        
        # ===== PHASE 2: Fetch EUR/USD exchange rate with fallback =====
        month_date = datetime.strptime(f"{year}-{month:02d}-01", "%Y-%m-%d").date()
        
        if broker_assets:
            logger.info("🔄 PHASE 2: Fetching EUR/USD exchange rate...")
            try:
                eur_usd_rate, eur_usd_rate_source = await fetch_eur_usd_rate_with_fallback(session, month_date)
                logger.info(f"✅ EUR/USD rate: {eur_usd_rate:.4f} (source: {eur_usd_rate_source})")
            except Exception as e:
                logger.error(f"❌ PHASE 2 failed: {str(e)}")
                eur_usd_rate = 1.1
                eur_usd_rate_source = "fallback_hardcoded"
        
        # ===== Build tasks for price fetching =====
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
                is_pension = fund.get("category") == AssetCategory.PENSION.value
                if is_pension:
                    # Pension plans use DGS codes and different source URLs
                    price = FundScraper.fetch_pension_price(
                        dgs_code=fund["isin"],
                        asset_name=fund["name"],
                        asset_id=fund["id"]
                    )
                else:
                    price = FundScraper.fetch_fund_price(
                        isin=fund["isin"],
                        asset_name=fund["name"],
                        asset_id=fund["id"]
                    )
                return ("fund", fund, price)
            return fetch

        for fund in fund_assets:
            if not fund.get("isin"):
                continue
            tasks.append(asyncio.to_thread(make_fund_fetcher(fund)))

        # ===== Get ticker to real asset_id mapping =====
        ticker_asset_map = {}
        if broker_assets:
            ticker_asset_map = await get_ticker_to_asset_mapping(session)
            logger.info(f"📋 Loaded mapping for {len(ticker_asset_map)} stock tickers to real asset IDs")

        def make_broker_fetcher(broker, fx_rate, ticker_asset_map):
            def fetch():
                component_tickers = broker.get("componentTickers", [])
                holdings = broker.get("holdings", {})

                if not component_tickers:
                    return ("broker", broker, [], fx_rate)

                tickers_map = {
                    ticker: (f"{broker.get('name')} - {ticker}", broker["id"])
                    for ticker in component_tickers
                }

                individual_prices = PriceFetcher.fetch_multiple_stocks(tickers_map, last_business_day)

                copied_individual_prices = []
                total_broker_value = 0.0
                for original_p in individual_prices:
                    p = original_p.model_copy()
                    shares = holdings.get(p.ticker, 0.0)
                    # Convert USD price to EUR if we have the exchange rate
                    if fx_rate and fx_rate > 0:
                        usd_price = float(p.price)
                        eur_price = round(usd_price / fx_rate, 2)
                        logger.info(f"💱 {p.ticker}: ${usd_price:.2f} → €{eur_price:.2f} (rate: {fx_rate:.4f})")
                        p.price = Decimal(str(eur_price))
                    p.currency = "EUR"
                    total_broker_value += float(p.price) * shares
                    
                    # ===== Use REAL asset_id instead of fake ticker-X =====
                    # Look up the real Stock Asset ID from the mapping
                    ticker_upper = p.ticker.upper()
                    if ticker_upper in ticker_asset_map:
                        p.asset_id = ticker_asset_map[ticker_upper]
                        logger.debug(f"✓ Using real asset_id for {p.ticker}: {p.asset_id}")
                    else:
                        # Stock asset must exist for UUID FK constraints
                        raise ValueError(f"Stock asset not found for ticker {p.ticker}. Please ensure all tickers are added to the system as assets before fetching prices.")
                    
                    p.asset_name = f"Stock {p.ticker}"
                    copied_individual_prices.append(p)

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
                    return ("broker", broker, [aggregated_price] + copied_individual_prices, fx_rate)

                return ("broker", broker, copied_individual_prices, fx_rate)
            return fetch

        for broker in broker_assets:
            if broker.get("componentTickers"):
                tasks.append(asyncio.to_thread(make_broker_fetcher(broker, eur_usd_rate, ticker_asset_map)))

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
                _, broker, broker_prices, _ = result
                prices.extend(broker_prices)
                for p in broker_prices:
                    # ✅ FIXED: Add ALL prices to nav_mapping, not just broker aggregates
                    # Individual stock prices (with ticker) were being skipped!
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
                errors=errors,
                exchange_rate_to_eur=eur_usd_rate if eur_usd_rate else None,
                exchange_rate_source=eur_usd_rate_source
            )

        saved_count = 0
        month_str = f"{year}-{month:02d}-01"
        date_obj = datetime.strptime(month_str, "%Y-%m-%d").date()

        # Save exchange rate to DB if we fetched one
        if eur_usd_rate and eur_usd_rate > 0:
            await db_service.save_exchange_rate(session, date_obj, "EUR/USD", eur_usd_rate)
            logger.info(f"💾 Saved EUR/USD rate {eur_usd_rate:.4f} for {date_obj}")

        for asset in active_assets:
            asset_id = asset["id"]

            # Retrieve previous history to fallback or compute values
            prev_history_all = await db_service.get_history_by_asset(session, asset_id)
            
            existing_entries = [h for h in prev_history_all if h.snapshot_date == date_obj]
            current_entry = existing_entries[0] if existing_entries else None
            
            prev_history = [h for h in prev_history_all if h.snapshot_date < date_obj]
            prev_entry = prev_history[0] if prev_history else None

            # Base values prioritizing current entry if existent, else strictly previous month
            base_participations = Decimal("0.0")
            base_mean_cost = Decimal("0.0")
            base_nav = Decimal("0.0")
            base_liquid_nav = Decimal("0.0")

            if current_entry and current_entry.nav is not None and current_entry.nav > 0:
                base_participations = current_entry.participations if current_entry.participations is not None else Decimal("0.0")
                base_mean_cost = current_entry.mean_cost if current_entry.mean_cost is not None else Decimal("0.0")
                base_nav = current_entry.nav
                base_liquid_nav = current_entry.liquid_nav_value if current_entry.liquid_nav_value is not None else Decimal("0.0")
            elif prev_entry:
                base_participations = prev_entry.participations if prev_entry.participations is not None else Decimal("0.0")
                base_mean_cost = prev_entry.mean_cost if prev_entry.mean_cost is not None else Decimal("0.0")
                base_nav = prev_entry.nav if prev_entry.nav is not None else Decimal("0.0")
                base_liquid_nav = prev_entry.liquid_nav_value if prev_entry.liquid_nav_value is not None else Decimal("0.0")

            prev_participations = base_participations
            prev_mean_cost = base_mean_cost
            prev_nav = base_nav
            prev_liquid_nav = base_liquid_nav

            # Contributions are always 0 for a new month generated automatically
            contribution = Decimal("0.0")

            if asset_id in nav_mapping:
                val = nav_mapping[asset_id]
                participations = prev_participations
                mean_cost = prev_mean_cost

                is_btc = asset.get("category") == AssetCategory.CRYPTO.value and ("BTC" in str(asset.get("ticker", "")).upper() or "BITCOIN" in str(asset.get("name", "")).upper())

                if is_btc:
                    btc_holdings = await db_service.get_total_btc_holdings(session, asset_id, to_date=last_business_day)
                    participations = Decimal(str(round(btc_holdings, 8)))
                    nav_val = Decimal(str(round(float(val) * btc_holdings, 2)))
                    liquid_nav = Decimal(str(val))
                elif asset.get("category") == AssetCategory.STOCK.value:
                    nav_val = Decimal(str(val))
                    liquid_nav = Decimal(str(val))  # ✅ FIXED: Store actual price, not 1.0
                else:
                    fund_holdings = await db_service.get_asset_total_quantity(session, asset_id, to_date=last_business_day)
                    participations = Decimal(str(round(fund_holdings, 8))) if fund_holdings > 0 else prev_participations
                    
                    if participations > 0:
                        nav_val = Decimal(str(round(float(val) * float(participations), 2)))
                    else:
                        nav_val = prev_nav
                    liquid_nav = Decimal(str(val))

            else:
                # Fallback for missing assets, like "Cash" or failed fetches
                participations = prev_participations
                mean_cost = prev_mean_cost

                is_btc = asset.get("category") == AssetCategory.CRYPTO.value and ("BTC" in str(asset.get("ticker", "")).upper() or "BITCOIN" in str(asset.get("name", "")).upper())

                if is_btc:
                    btc_holdings = await db_service.get_total_btc_holdings(session, asset_id, to_date=last_business_day)
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
                            # ===== Use REAL asset_id instead of fake ticker-X =====
                            ticker_upper = ticker.upper()
                            if ticker_upper in ticker_asset_map:
                                ticker_asset_id = ticker_asset_map[ticker_upper]
                            else:
                                # Fallback: use fake ID if real asset not found
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
                        liquid_nav = Decimal(str(round(total_broker_value, 2)))  # ✅ FIXED: Store actual broker value, not 1.0
                    else:
                        nav_val = prev_nav
                        liquid_nav = prev_liquid_nav
                else:
                    # For standard funds, cash, or missing fetches
                    fund_holdings = await db_service.get_asset_total_quantity(session, asset_id, to_date=last_business_day)
                    participations = Decimal(str(round(fund_holdings, 8))) if fund_holdings > 0 else prev_participations

                    if participations > 0 and prev_liquid_nav > 0:
                        nav_val = Decimal(str(round(float(prev_liquid_nav) * float(participations), 2)))
                        liquid_nav = prev_liquid_nav
                    else:
                        nav_val = prev_nav
                        liquid_nav = prev_liquid_nav

            # Ensure we don't save duplicates if we're re-running the same month
            existing_entries = [h for h in prev_history_all if h.snapshot_date == date_obj]
            if existing_entries:
                history_entry = existing_entries[0]
                history_entry.liquid_nav_value = liquid_nav
                history_entry.nav = nav_val
                # ✅ Preserve existing contribution — user adds these manually
                # contribution stays as-is (do NOT overwrite with 0)
                history_entry.participations = participations
                history_entry.mean_cost = mean_cost
                await db_service.update_history_entry(session, history_entry.id, history_entry)
            else:
                from uuid import UUID as _UUID
                history_entry = HistoryEntry(
                    asset_id=_UUID(str(asset_id)) if not isinstance(asset_id, _UUID) else asset_id,
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
            errors=errors,
            exchange_rate_to_eur=eur_usd_rate if eur_usd_rate else None,
            exchange_rate_source=eur_usd_rate_source
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in fetch-month: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching prices: {str(e)}")
