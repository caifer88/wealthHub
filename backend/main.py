"""
WealthHub Backend API
Main FastAPI application with endpoints for fetching asset prices
"""

import logging
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
    allow_origins=frontend_urls,
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
        assets = await _load_assets_from_gas()
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
        
        # Organize assets by type
        crypto_assets = [a for a in active_assets if a.get("ticker") and "BTC" in str(a.get("ticker", "")).upper()]
        fund_assets = [a for a in active_assets if a.get("isin") and a.get("category") == "Fund"]
        stock_assets = [a for a in active_assets if a.get("ticker") and "BTC" not in str(a.get("ticker", "")).upper() and a.get("category") in ["Stock", "Stocks"]]
        broker_assets = [a for a in active_assets if a.get("componentTickers") and a.get("category") == "Broker"]
        
        logger.info(f"🔍 Found: {len(crypto_assets)} crypto, {len(fund_assets)} funds, {len(stock_assets)} stocks, {len(broker_assets)} broker assets")
        
        # Fetch Bitcoin price
        if crypto_assets:
            btc_asset = crypto_assets[0]  # Get the first BTC asset
            btc_data = PriceFetcher.fetch_bitcoin_price(
                date=last_business_day,
                asset_id=btc_asset["id"],
                asset_name=btc_asset["name"]
            )
            if btc_data:
                prices.append(btc_data)
            else:
                errors.append("Failed to fetch Bitcoin price")
        
        # Fetch fund prices
        for fund in fund_assets:
            if not fund.get("isin"):
                logger.warning(f"Fund {fund.get('name')} has no ISIN")
                continue
            
            price_data = FundScraper.fetch_fund_price(
                isin=fund["isin"],
                asset_name=fund["name"],
                asset_id=fund["id"]
            )
            
            if price_data:
                prices.append(price_data)
            else:
                errors.append(f"Failed to fetch price for {fund.get('name')} ({fund.get('isin')})")
        
        # Fetch stock prices
        if stock_assets:
            tickers_map = {
                a["ticker"]: (a["name"], a["id"])
                for a in stock_assets if a.get("ticker")
            }
            
            if tickers_map:
                stock_prices = PriceFetcher.fetch_multiple_stocks(tickers_map, last_business_day)
                prices.extend(stock_prices)
                
                # Log missing stocks
                fetched_tickers = {p.ticker for p in stock_prices if p.ticker}
                missing = set(tickers_map.keys()) - fetched_tickers
                if missing:
                    errors.extend([f"Failed to fetch price for {t}" for t in missing])
        
        # Fetch broker/composite asset prices (multiple component tickers)
        for broker in broker_assets:
            component_tickers = broker.get("componentTickers", [])
            if not component_tickers:
                logger.warning(f"Broker {broker.get('name')} has no component tickers")
                continue
            
            logger.info(f"📦 Fetching component tickers for {broker.get('name')}: {component_tickers}")
            
            # Create tickers map for broker components
            tickers_map = {
                ticker: (f"{broker.get('name')} - {ticker}", broker["id"])
                for ticker in component_tickers
            }
            
            broker_prices = PriceFetcher.fetch_multiple_stocks(tickers_map, last_business_day)
            prices.extend(broker_prices)
            
            # Log missing component tickers
            fetched_tickers = {p.ticker for p in broker_prices if p.ticker}
            missing = set(component_tickers) - fetched_tickers
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
            await _persist_prices_to_gas(prices, year, month, last_business_day)
        
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
            await _persist_prices_to_gas(price_data)
        
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
        assets = await _load_assets_from_gas()
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


# Helper functions

async def _load_assets_from_gas() -> List[dict]:
    """
    Load assets from Google Apps Script.
    No fallback to sample data - requires real assets from GAS.
    """
    if not settings.VITE_GAS_URL:
        logger.error("❌ GAS_URL not configured - cannot load assets")
        return []
    
    try:
        response = requests.get(settings.VITE_GAS_URL, timeout=settings.TIMEOUT)
        response.raise_for_status()
        
        data = response.json()
        if data.get("success") and data.get("data"):
            assets = data["data"].get("assets", [])
            logger.info(f"✅ Loaded {len(assets)} assets from GAS")
            return assets
        else:
            logger.error("❌ Invalid response from GAS")
            return []
            
    except Exception as e:
        logger.error(f"❌ Error loading from GAS: {str(e)}")
        return []


async def _persist_prices_to_gas(
    prices: List[PriceData],
    year: Optional[int] = None,
    month: Optional[int] = None,
    fetch_date: Optional[datetime] = None
) -> bool:
    """
    Persist prices to Google Apps Script in data.json.
    Updates existing entries or adds new ones.
    """
    if not settings.VITE_GAS_URL:
        logger.warning("⚠️ GAS URL not configured, cannot persist prices")
        return False
    
    try:
        logger.info(f"📤 Persisting {len(prices)} prices to GAS")
        
        # Format prices for persistence
        month_str = f"{year:04d}-{month:02d}" if year and month else datetime.now().strftime("%Y-%m")
        
        history_entries = []
        for price in prices:
            entry = {
                "month": month_str,
                "assetId": price.assetId,
                "nav": price.price,
                "contribution": price.price,  # Will be updated by frontend if needed
                "source": price.source,
                "date": price.fetchedAt
            }
            history_entries.append(entry)
        
        # Load current data from GAS
        current_data = await _load_data_from_gas()
        
        # Merge with existing history
        if current_data:
            existing_history = current_data.get("history", [])
            history_entries = merge_price_updates(existing_history, history_entries)
        
        # Prepare payload
        payload = {
            "action": "updateHistory",
            "history": history_entries,
            "timestamp": format_datetime_iso(datetime.now())
        }
        
        # Send to GAS
        response = requests.post(
            settings.VITE_GAS_URL,
            json=payload,
            timeout=settings.TIMEOUT
        )
        response.raise_for_status()
        
        logger.info("✅ Prices persisted to GAS")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error persisting prices to GAS: {str(e)}")
        return False


async def _load_data_from_gas() -> dict:
    """Load full data structure from GAS"""
    if not settings.VITE_GAS_URL:
        return {}
    
    try:
        response = requests.get(settings.VITE_GAS_URL, timeout=settings.TIMEOUT)
        response.raise_for_status()
        data = response.json()
        return data.get("data", {}) if data.get("success") else {}
    except Exception as e:
        logger.error(f"Error loading data from GAS: {str(e)}")
        return {}


def _get_sample_assets() -> List[dict]:
    """DEPRECATED: This function should not be used. Use real assets from GAS instead."""
    return []


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
