"""
WealthHub Backend API
Main FastAPI application with endpoints for fetching asset prices
"""

import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import requests
from sqlmodel import Session

from config import settings
from models import (
    Asset, PriceData, FetchMonthResponse, HealthResponse,
    HistoryEntry, FullState
)
from utils import (
    get_last_business_day, validate_month, format_date,
    format_datetime_iso, merge_price_updates
)
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services.db_service import get_session, load_assets_from_db, load_history_from_db, load_transactions_from_db, save_full_data_to_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Backend API for WealthHub wealth management application"
)

# Configure CORS
# Parse multiple frontend URLs
frontend_urls = [
    url.strip() for url in settings.FRONTEND_URL.split(',') if url.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"🔧 CORS configured for: {', '.join(frontend_urls)}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="WealthHub Backend is running",
        version=settings.API_VERSION
    )


@app.get("/fetch-month", response_model=FetchMonthResponse)
async def fetch_month_prices(
    year: int = Query(..., ge=2020, le=2099, description="Year (e.g., 2024)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)")
):
    """
    Fetch prices for all assets for the given month.
    
    - Automatically determines the last business day of the month
    - Fetches prices from appropriate sources (yfinance, Morningstar, etc.)
    - Returns prices and optionally persists to Google Apps Script
    
    Query Parameters:
    - year: Year to fetch (e.g., 2024)
    - month: Month to fetch (1-12)
    
    Returns:
    - success: Whether the fetch was successful
    - year, month: Requested period
    - lastBusinessDay: The date prices were fetched for
    - prices: List of PriceData objects with fetched prices
    - errors: List of any errors encountered
    """
    
    logger.info(f"📊 Fetch-month request: {year}-{month:02d}")
    
    # Validate input
    if not validate_month(year, month):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid month: {year}-{month:02d}"
        )
    
    errors: List[str] = []
    prices: List[PriceData] = []
    
    try:
        from sqlmodel import Session
        from services.db_service import engine
        
        with Session(engine) as session:
            # Get last business day of the month
            last_business_day = get_last_business_day(year, month)
            logger.info(f"📅 Last business day: {format_date(last_business_day)}")
            
            # Load assets from DB
            assets = load_assets_from_db(session)
            if not assets:
                logger.error("❌ No assets loaded from DB")
                return FetchMonthResponse(
                    success=False,
                    message="Could not load assets from DB.",
                    year=year,
                    month=month,
                    lastBusinessDay=format_date(last_business_day),
                    prices=[],
                    errors=["No assets available"]
                )

            logger.info(f"📦 Loaded {len(assets)} assets")

            # Filter only non-archived assets with price identifiers
            active_assets = [a for a in assets if not a.get("archived", False)]

            # Organize assets by type
            crypto_assets = [a for a in active_assets if a.get("category") == "Crypto" and "Bitcoin" in str(a.get("ticker", "")).upper()]
            fund_assets = [a for a in active_assets if a.get("category") == "Fund"]

            # Load transactions to build broker holdings
            transactions = load_transactions_from_db(session)

            # Filter only transactions for assets that are Stocks/Brokers
            broker_asset_ids = {a.get("id"): a.get("name") for a in active_assets if a.get("category") == "Stocks"}

            broker_assets_dict = {}
            for asset_id, broker_name in broker_asset_ids.items():
                broker_assets_dict[broker_name] = {
                    "name": broker_name,
                    "id": asset_id,
                    "category": "Broker",
                    "componentTickers": [],
                    "holdings": {}
                }

            # Calculate holdings based on transactions mapped to those brokers
            for tx in transactions:
                asset_id = tx.get("assetId")
                ticker = tx.get("ticker")
                if asset_id in broker_asset_ids and ticker:
                    broker_name = broker_asset_ids[asset_id]
                    quantity = tx.get("quantity", 0)
                    tx_type = tx.get("type", "BUY").upper()
                    if tx_type == "SELL":
                        quantity = -quantity
                    
                    broker_data = broker_assets_dict[broker_name]
                    if ticker not in broker_data["holdings"]:
                        broker_data["holdings"][ticker] = 0.0
                    broker_data["holdings"][ticker] += quantity

            # Cleanup inactive tickers
            for broker_name, broker_data in broker_assets_dict.items():
                active_tickers = {t: q for t, q in broker_data["holdings"].items() if q > 0.0001}
                broker_data["holdings"] = active_tickers
                broker_data["componentTickers"] = list(active_tickers.keys())
                
            broker_assets = [b for b in broker_assets_dict.values() if b.get("componentTickers")]
        
        logger.info(f"🔍 Found: {len(crypto_assets)} crypto, {len(fund_assets)} funds, {len(broker_assets)} broker assets")
        
        # --- CONCURRENT FETCHING ---
        tasks = []
        
        # 1. Bitcoin Task
        def fetch_btc():
            if crypto_assets:
                btc_asset = crypto_assets[0]
                return ("btc", PriceFetcher.fetch_bitcoin_price(
                    date=last_business_day,
                    asset_id=btc_asset["id"],
                    asset_name=btc_asset["name"]
                ))
            return ("btc", None)

        if crypto_assets:
            tasks.append(asyncio.to_thread(fetch_btc))

        # 2. Fund Tasks
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
                logger.warning(f"Fund {fund.get('name')} has no ISIN")
                continue
            tasks.append(asyncio.to_thread(make_fund_fetcher(fund)))

        # 3. Broker/Stock Tasks
        def make_broker_fetcher(broker):
            def fetch():
                component_tickers = broker.get("componentTickers", [])
                holdings = broker.get("holdings", {}) # Recuperamos las acciones que calculamos arriba
                
                if not component_tickers:
                    return ("broker", broker, [])

                logger.info(f"📦 Fetching component tickers for {broker.get('name')}: {component_tickers}")
                tickers_map = {
                    ticker: (f"{broker.get('name')} - {ticker}", broker["id"])
                    for ticker in component_tickers
                }
                
                # Obtenemos los precios unitarios (ej. precio de AMD, precio de MSTR)
                individual_prices = PriceFetcher.fetch_multiple_stocks(tickers_map, last_business_day)
                
                total_broker_value = 0.0
                
                # Multiplicamos el precio por el número de acciones y lo sumamos al total del broker
                for p in individual_prices:
                    shares = holdings.get(p.ticker, 0.0)
                    total_broker_value += float(p.price) * shares
                    logger.info(f"  - {p.ticker}: {shares} acciones x {p.price} EUR = {shares * float(p.price)} EUR")
                    
                    # ASIGNAR UN ID ÚNICO PARA QUE EL FRONTEND PUEDA GUARDAR EL HISTORIAL INDIVIDUAL
                    p.assetId = f"ticker-{p.ticker}"
                    p.assetName = f"Stock {p.ticker}"
                
                # Si el broker tiene un valor total, devolvemos un ÚNICO objeto PriceData para todo el broker
                if total_broker_value > 0:
                    logger.info(f"💰 Valor total calculado para {broker.get('name')}: {total_broker_value} EUR")
                    aggregated_price = PriceData(
                        assetId=broker["id"],
                        assetName=broker["name"],
                        ticker=None,  # Como es un conjunto, quitamos el ticker individual
                        price=round(total_broker_value, 2),
                        currency="EUR",
                        fetchedAt=format_datetime_iso(datetime.now()),
                        source="yfinance_aggregated"
                    )
                    # DEVOLVEMOS EL AGREGADO + LOS INDIVIDUALES
                    return ("broker", broker, [aggregated_price] + individual_prices)
                    
                return ("broker", broker, individual_prices)
            return fetch

        for broker in broker_assets:
            if broker.get("componentTickers"):
                tasks.append(asyncio.to_thread(make_broker_fetcher(broker)))

        # Run all tasks concurrently
        results = await asyncio.gather(*tasks)

        # Process results
        for result in results:
            type_ = result[0]
            if type_ == "btc":
                btc_data = result[1]
                if btc_data:
                    prices.append(btc_data)
                else:
                    errors.append("Failed to fetch Bitcoin price")
            elif type_ == "fund":
                _, fund, price_data = result
                if price_data:
                    prices.append(price_data)
                else:
                    errors.append(f"Failed to fetch price for {fund.get('name')} ({fund.get('isin')})")
            elif type_ == "broker":
                _, broker, broker_prices = result
                prices.extend(broker_prices)
                
                # Si hemos devuelto un precio consolidado del broker (ticker=None), saltamos la comprobación de errores
                if broker_prices and any(p.ticker is None for p in broker_prices):
                    continue
                    
                fetched_tickers = {p.ticker for p in broker_prices if p.ticker}
                missing = set(broker.get("componentTickers", [])) - fetched_tickers
                if missing:
                    errors.extend([f"Failed to fetch {broker.get('name')} component {t}" for t in missing])
        
        logger.info(f"✅ Fetched {len(prices)} prices successfully")
        
        # Return error if no prices fetched
        if len(prices) == 0:
            logger.error("❌ No prices could be fetched from any source")
            return FetchMonthResponse(
                success=False,
                message="No se pudieron obtener precios de ninguna fuente",
                year=year,
                month=month,
                lastBusinessDay=format_date(last_business_day),
                prices=[],
                errors=errors if errors else ["No assets with ticker/ISIN found or all fetch attempts failed"]
            )
        
        # DB persistence happens on the frontend /data POST
        # so we don't save to DB here.
        
        return FetchMonthResponse(
            success=len(prices) > 0,
            message=f"Successfully fetched {len(prices)} prices" if len(prices) > 0 else "No prices were fetched",
            year=year,
            month=month,
            lastBusinessDay=format_date(last_business_day),
            prices=prices,
            errors=errors
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (for explicit error responses)
        raise
    except Exception as e:
        error_msg = str(e) if str(e) else type(e).__name__
        logger.error(f"❌ Error in fetch-month: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching prices: {error_msg}"
        )


@app.get("/data")
async def get_data(session: Session = Depends(get_session)):
    """Get full state from database"""
    try:
        assets = load_assets_from_db(session)
        history = load_history_from_db(session)
        transactions = load_transactions_from_db(session)
        
        return {
            "success": True,
            "data": {
                "assets": assets,
                "history": history,
                "transactions": transactions,
                "lastUpdated": format_datetime_iso(datetime.now())
            }
        }
    except Exception as e:
        logger.error(f"❌ Error loading data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading data: {str(e)}"
        )

@app.post("/data")
async def save_data(data: FullState, session: Session = Depends(get_session)):
    """Save full state to database"""
    try:
        logger.info(f"📝 Saving data: {len(data.assets)} assets, {len(data.history)} history entries, {len(data.transactions)} txs")
        save_full_data_to_db(session, data.dict())
        return {
            "success": True,
            "message": "Data saved successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error saving data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving data: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
