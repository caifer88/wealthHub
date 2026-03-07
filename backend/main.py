"""
WealthHub Backend API
Main FastAPI application with endpoints for fetching asset prices and managing data
"""

import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, create_engine, SQLModel

from config import settings
from models import (
    Asset, PriceData, FetchMonthResponse, HealthResponse,
    HistoryEntry, Transaction
)
from utils import (
    get_last_business_day, validate_month, format_date,
    format_datetime_iso, merge_price_updates
)
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services import db_service
import db_models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Database engine
engine = create_engine(settings.DATABASE_URL or "sqlite:///./wealthhub.db", echo=settings.DEBUG)

def get_session():
    with Session(engine) as session:
        yield session

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

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    logger.info("📦 Database tables created or verified")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="WealthHub Backend is running",
        version=settings.API_VERSION
    )

# --- Asset Endpoints ---

@app.get("/api/assets", response_model=List[Asset])
def get_assets(session: Session = Depends(get_session)):
    """Get all assets"""
    assets = db_service.get_all_assets(session)
    # Map DB models to Pydantic models (we're using same names mostly, simple dict mapping works)
    return [Asset(**asset.model_dump()) for asset in assets]

@app.get("/api/assets/{asset_id}", response_model=Asset)
def get_asset(asset_id: str, session: Session = Depends(get_session)):
    """Get an asset by ID"""
    asset = db_service.get_asset_by_id(session, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return Asset(**asset.model_dump())

@app.post("/api/assets", response_model=Asset, status_code=status.HTTP_201_CREATED)
def create_asset(asset: Asset, session: Session = Depends(get_session)):
    """Create a new asset"""
    # Check if ID already exists
    if db_service.get_asset_by_id(session, asset.id):
        raise HTTPException(status_code=400, detail="Asset ID already exists")
    created = db_service.create_asset(session, asset)
    return Asset(**created.model_dump())

@app.put("/api/assets/{asset_id}", response_model=Asset)
def update_asset(asset_id: str, asset: Asset, session: Session = Depends(get_session)):
    """Update an existing asset"""
    updated = db_service.update_asset(session, asset_id, asset)
    if not updated:
        raise HTTPException(status_code=404, detail="Asset not found")
    return Asset(**updated.model_dump())

@app.delete("/api/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, session: Session = Depends(get_session)):
    """Delete an asset"""
    if not db_service.delete_asset(session, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")

# --- History Endpoints ---

@app.get("/api/history", response_model=List[HistoryEntry])
def get_history(session: Session = Depends(get_session)):
    """Get all history entries"""
    history = db_service.get_all_history(session)
    return [HistoryEntry(**entry.model_dump()) for entry in history]

@app.get("/api/history/asset/{asset_id}", response_model=List[HistoryEntry])
def get_asset_history(asset_id: str, session: Session = Depends(get_session)):
    """Get history for a specific asset"""
    history = db_service.get_history_by_asset(session, asset_id)
    return [HistoryEntry(**entry.model_dump()) for entry in history]

@app.post("/api/history", response_model=HistoryEntry, status_code=status.HTTP_201_CREATED)
def create_history(entry: HistoryEntry, session: Session = Depends(get_session)):
    """Create a new history entry"""
    created = db_service.create_history_entry(session, entry)
    return HistoryEntry(**created.model_dump())

@app.put("/api/history/{history_id}", response_model=HistoryEntry)
def update_history(history_id: str, entry: HistoryEntry, session: Session = Depends(get_session)):
    """Update an existing history entry"""
    updated = db_service.update_history_entry(session, history_id, entry)
    if not updated:
        raise HTTPException(status_code=404, detail="History entry not found")
    return HistoryEntry(**updated.model_dump())

@app.delete("/api/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history(history_id: str, session: Session = Depends(get_session)):
    """Delete a history entry"""
    if not db_service.delete_history_entry(session, history_id):
        raise HTTPException(status_code=404, detail="History entry not found")

# --- Transaction Endpoints ---

@app.get("/api/transactions", response_model=List[Transaction])
def get_transactions(session: Session = Depends(get_session)):
    """Get all transactions"""
    transactions = db_service.get_all_transactions(session)
    return [Transaction(**tx.model_dump()) for tx in transactions]

@app.get("/api/transactions/asset/{asset_id}", response_model=List[Transaction])
def get_asset_transactions(asset_id: str, session: Session = Depends(get_session)):
    """Get transactions for a specific asset"""
    transactions = db_service.get_transactions_by_asset(session, asset_id)
    return [Transaction(**tx.model_dump()) for tx in transactions]

@app.post("/api/transactions", response_model=Transaction, status_code=status.HTTP_201_CREATED)
def create_transaction(transaction: Transaction, session: Session = Depends(get_session)):
    """Create a new transaction"""
    created = db_service.create_transaction(session, transaction)
    return Transaction(**created.model_dump())

@app.put("/api/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: str, transaction: Transaction, session: Session = Depends(get_session)):
    """Update an existing transaction"""
    updated = db_service.update_transaction(session, transaction_id, transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return Transaction(**updated.model_dump())

@app.delete("/api/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: str, session: Session = Depends(get_session)):
    """Delete a transaction"""
    if not db_service.delete_transaction(session, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

@app.get("/fetch-month", response_model=FetchMonthResponse)
async def fetch_month_prices(
    year: int = Query(..., ge=2020, le=2099, description="Year (e.g., 2024)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    session: Session = Depends(get_session)
):
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
        
        crypto_assets = [a for a in active_assets if a.get("category") == "Crypto" and "Bitcoin" in str(a.get("ticker", "")).upper()]
        fund_assets = [a for a in active_assets if a.get("category") == "Fund"]
        
        db_transactions = db_service.get_all_transactions(session)
        stock_transactions = [tx.model_dump() for tx in db_transactions if tx.get("asset_id") in [a["id"] for a in active_assets if a.get("category") == "Stocks"]]
        
        broker_assets_dict = {}
        stocks_assets = [a for a in active_assets if a.get("category") == "Stocks"]
        
        for broker_asset in stocks_assets:
             broker_id = broker_asset.get("id")
             # Calculate holdings for this broker
             holdings = {}
             for tx in stock_transactions:
                 if tx.get("asset_id") == broker_id and tx.get("ticker"):
                     ticker = tx.get("ticker")
                     quantity = float(tx.get("quantity", 0))
                     tx_type = tx.get("type", "BUY").upper()
                     if tx_type == "SELL":
                         quantity = -quantity
                     holdings[ticker] = holdings.get(ticker, 0.0) + quantity

             active_tickers = {t: q for t, q in holdings.items() if q > 0.0001}

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
        
        from decimal import Decimal
        import uuid

        saved_count = 0
        month_str = f"{year}-{month:02d}-01"
        date_obj = datetime.strptime(month_str, "%Y-%m-%d").date()

        # We only want to save HistoryEntry for actual assets (not individual tickers inside a broker)
        # So we look at the original active_assets and the nav_mapping

        for asset in active_assets:
             asset_id = asset["id"]
             # Check if we fetched a price/nav for this asset
             if asset_id in nav_mapping:
                 val = nav_mapping[asset_id]
                 history_entry = HistoryEntry(
                     id=str(uuid.uuid4()),
                     asset_id=asset_id,
                     snapshot_date=date_obj,
                     liquid_nav_value=Decimal(str(val)),
                     nav=Decimal(str(val)), # Set nav to the total value or price
                     contribution=Decimal("0.0"),
                     participations=Decimal("0.0"),
                     mean_cost=Decimal("0.0")
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
