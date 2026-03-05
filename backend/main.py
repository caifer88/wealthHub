"""
WealthHub Backend API
Main FastAPI application with endpoints for fetching asset prices
"""

import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import requests

from config import settings
from models import (
    Asset, PriceData, FetchMonthResponse, HealthResponse,
    HistoryEntry
)
from utils import (
    get_last_business_day, validate_month, format_date,
    format_datetime_iso, merge_price_updates
)
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services.gas_service import load_assets_from_gas, persist_prices_to_gas, load_data_from_gas

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
        # Get last business day of the month
        last_business_day = get_last_business_day(year, month)
        logger.info(f"📅 Last business day: {format_date(last_business_day)}")
        
        # Load assets from GAS (required - no sample fallback)
        assets = await load_assets_from_gas()
        if not assets:
            logger.error("❌ No assets loaded from GAS - GAS_URL may not be configured")
            return FetchMonthResponse(
                success=False,
                message="Could not load assets. Ensure GAS_URL is configured and accessible.",
                year=year,
                month=month,
                lastBusinessDay=format_date(last_business_day),
                prices=[],
                errors=["No assets available from GAS"]
            )
        
        logger.info(f"📦 Loaded {len(assets)} assets")
        
        # Filter only non-archived assets with price identifiers
        active_assets = [a for a in assets if not a.get("archived", False)]
        
        # Debug: Log categories found
        categories = set(a.get("category") for a in active_assets if a.get("category"))
        logger.info(f"📋 Categories found in assets: {categories}")
        for asset in active_assets:
            logger.debug(f"  - {asset.get('name')}: category={asset.get('category')}, ticker={asset.get('ticker')}, isin={asset.get('isin')}, componentTickers={asset.get('componentTickers')}")
        
        # Organize assets by type
        crypto_assets = [a for a in active_assets if a.get("category") == "Crypto" and "BTC" in str(a.get("ticker", "")).upper()]
        fund_assets = [a for a in active_assets if a.get("category") == "Fund"]
        
        # Build broker_assets from stockTransactions grouped by broker
        # Load full data to get stockTransactions
        full_data = await load_data_from_gas()
        logger.info(f"📥 Full data keys from GAS: {list(full_data.keys())}")
        
        stock_transactions = full_data.get("stockTransactions", [])
        logger.info(f"📋 Found {len(stock_transactions)} stockTransactions")
        
        broker_assets_dict = {}  # broker_name -> asset object with tickers
        
        if stock_transactions:
            # Check if transactions have broker field
            has_broker_field = stock_transactions[0].get("broker") is not None if stock_transactions else False
            logger.info(f"📊 StockTransactions have broker field: {has_broker_field}")
            
            if has_broker_field:
                # Strategy 1: Group by broker field and calculate holdings
                broker_holdings = {}
                for tx in stock_transactions:
                    broker = tx.get("broker")
                    ticker = tx.get("ticker")
                    
                    # Extraer el número de acciones. 
                    # IMPORTANTE: Revisa si en tu base de datos (GAS) lo llamas 'shares', 'participations' o 'quantity'
                    shares = float(tx.get("shares", tx.get("participations", tx.get("quantity", 0))))
                    
                    # Restar las acciones si es una venta
                    tx_type = tx.get("type", "BUY").upper()
                    if tx_type == "SELL":
                        shares = -shares
                        
                    if broker and ticker:
                        if broker not in broker_holdings:
                            broker_holdings[broker] = {}
                        if ticker not in broker_holdings[broker]:
                            broker_holdings[broker][ticker] = 0.0
                        broker_holdings[broker][ticker] += shares
                
                # Create broker_assets from grouped holdings
                for broker_name, holdings in broker_holdings.items():
                    # Filtrar acciones que actualmente posees (cantidad mayor que 0)
                    active_tickers = {t: s for t, s in holdings.items() if s > 0.0001}
                    
                    if active_tickers:
                        # --- NUEVO: Buscar el ID real del activo en la base de datos ---
                        # Buscamos en los activos activos uno que se llame exactamente igual que el broker
                        matching_assets = [a for a in active_assets if a.get("name") == broker_name]
                        real_asset_id = matching_assets[0].get("id") if matching_assets else f"broker-{broker_name.lower()}"
                        
                        broker_assets_dict[broker_name] = {
                            "name": broker_name,
                            "id": real_asset_id,  # <-- Usamos el ID real que conectará con el frontend
                            "category": "Broker",
                            "componentTickers": list(active_tickers.keys()),
                            "holdings": active_tickers  # Guardamos el recuento de acciones aquí
                        }
                
                logger.info(f"📊 Brokers consolidados: {list(broker_assets_dict.keys())}")
            else:
                # Strategy 2: Fallback - assign all tickers to existing Stocks assets
                logger.warning("⚠️ StockTransactions missing 'broker' field - using fallback strategy")
                
                all_tickers = set()
                for tx in stock_transactions:
                    ticker = tx.get("ticker")
                    if ticker:
                        all_tickers.add(ticker)
                
                logger.info(f"📊 Extracted tickers from stockTransactions: {all_tickers}")
                
                # Find assets with category "Stocks" (brokers) and assign all tickers to them
                stocks_assets = [a for a in active_assets if a.get("category") == "Stocks"]
                logger.info(f"📊 Found {len(stocks_assets)} Stocks assets (brokers): {[a.get('name') for a in stocks_assets]}")
                
                for broker_asset in stocks_assets:
                    broker_assets_dict[broker_asset.get("name")] = {
                        "name": broker_asset.get("name"),
                        "id": broker_asset["id"],
                        "category": "Broker",
                        "componentTickers": list(all_tickers)
                    }
                    logger.info(f"  ✅ Assigned {len(all_tickers)} tickers to {broker_asset.get('name')}: {all_tickers}")
        else:
            logger.warning("⚠️ No stockTransactions found in GAS data")
        
        broker_assets = list(broker_assets_dict.values())
        
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
                    return ("broker", broker, [aggregated_price])
                    
                return ("broker", broker, [])
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
        
        # Only persist to GAS if we actually fetched prices
        if prices and settings.VITE_GAS_URL:
            await persist_prices_to_gas(prices, year, month, last_business_day)
        
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


@app.post("/update-prices")
async def update_prices(price_data: List[PriceData]):
    """
    Manually update prices in the history.
    Used when prices are fetched directly from frontend.
    
    Request body:
    - List of PriceData objects with prices to update
    
    Returns:
    - success: Whether the update was successful
    - message: Status message
    """
    try:
        logger.info(f"📝 Updating {len(price_data)} prices")
        
        # Persist to GAS
        if settings.VITE_GAS_URL:
            await persist_prices_to_gas(price_data)
        
        return {
            "success": True,
            "message": f"Updated {len(price_data)} prices",
            "prices": price_data
        }
        
    except Exception as e:
        logger.error(f"❌ Error updating prices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating prices: {str(e)}"
        )


@app.get("/assets")
async def get_assets():
    """Get list of all assets from GAS"""
    try:
        assets = await load_assets_from_gas()
        return {
            "success": True,
            "assets": assets
        }
    except Exception as e:
        logger.error(f"❌ Error loading assets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading assets: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
