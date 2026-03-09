"""
WealthHub Backend API
Main FastAPI application with endpoints for fetching asset prices and managing data
"""

import logging
import asyncio
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, create_engine, SQLModel

from config import settings
from models import (
    Asset, PriceData, FetchMonthResponse, HealthResponse,
    HistoryEntry, Transaction, PortfolioSummaryResponse,
    PortfolioAllocationResponse, AssetMetricsResponse
)
from utils import (
    get_last_business_day, validate_month, format_date,
    format_datetime_iso
)
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services import db_service
from services.monthly_fetch_service import process_monthly_prices
from cachetools import cached, TTLCache
import yfinance as yf

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def scheduled_update_nav():
    logger.info("⏰ Running daily NAV update cron job...")
    now = datetime.now()
    
    with Session(engine) as session:
        try:
            await fetch_month_prices(year=now.year, month=now.month, session=session)
            logger.info("✅ NAV update cron job completed successfully.")
        except Exception as e:
            logger.error(f"❌ Error in NAV cron job: {e}")

engine = create_engine(settings.DATABASE_URL or "sqlite:///./wealthhub.db", echo=settings.DEBUG)

def get_session():
    with Session(engine) as session:
        yield session

app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Backend API for WealthHub wealth management application"
)

frontend_urls = [
    url.strip() for url in settings.FRONTEND_URL.split(',') if url.strip()
]

frontend_urls.append("http://localhost:8787")

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_urls,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"🔧 CORS configured for: {', '.join(frontend_urls)}")

@app.on_event("startup")
async def on_startup():
    SQLModel.metadata.create_all(engine)
    logger.info("📦 Database tables created or verified")
    
    scheduler.add_job(scheduled_update_nav, 'cron', hour=9, minute=00)
    scheduler.start()
    logger.info("🕒 Scheduler started. NAV update scheduled at 9:00 AM.")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="WealthHub Backend is running",
        version=settings.API_VERSION
    )

@app.get("/api/assets", response_model=List[Asset])
def get_assets(session: Session = Depends(get_session)):
    return db_service.get_all_assets(session)

@app.post("/api/assets", response_model=Asset, status_code=status.HTTP_201_CREATED)
def create_asset(asset: Asset, session: Session = Depends(get_session)):
    if db_service.get_asset_by_id(session, asset.id):
        raise HTTPException(status_code=400, detail="Asset ID already exists")
    return db_service.create_asset(session, asset)

@app.put("/api/assets/{asset_id}", response_model=Asset)
def update_asset(asset_id: str, asset: Asset, session: Session = Depends(get_session)):
    updated = db_service.update_asset(session, asset_id, asset)
    if not updated:
        raise HTTPException(status_code=404, detail="Asset not found")
    return updated

@app.delete("/api/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, session: Session = Depends(get_session)):
    if not db_service.delete_asset(session, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")

@app.get("/api/history")
def get_history(session: Session = Depends(get_session)):
    history = db_service.get_all_history(session)
    return [{
        "id": h.id,
        "asset_id": h.asset_id,
        "month": h.snapshot_date.strftime("%Y-%m"),
        "nav": float(h.nav) if h.nav else 0,
        "contribution": float(h.contribution) if h.contribution else 0,
        "participations": float(h.participations) if h.participations is not None else None,
        "liquidNavValue": float(h.liquid_nav_value) if h.liquid_nav_value is not None else None,
        "meanCost": float(h.mean_cost) if h.mean_cost is not None else None
    } for h in history]

@app.get("/api/history/asset/{asset_id}", response_model=List[HistoryEntry])
def get_asset_history(asset_id: str, session: Session = Depends(get_session)):
    return db_service.get_history_by_asset(session, asset_id)

@app.post("/api/history", response_model=HistoryEntry, status_code=status.HTTP_201_CREATED)
def create_history(entry: HistoryEntry, session: Session = Depends(get_session)):
    return db_service.create_history_entry(session, entry)

@app.put("/api/history/{history_id}", response_model=HistoryEntry)
def update_history(history_id: str, entry: HistoryEntry, session: Session = Depends(get_session)):
    updated = db_service.update_history_entry(session, history_id, entry)
    if not updated:
        raise HTTPException(status_code=404, detail="History entry not found")
    return updated

@app.delete("/api/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history(history_id: str, session: Session = Depends(get_session)):
    if not db_service.delete_history_entry(session, history_id):
        raise HTTPException(status_code=404, detail="History entry not found")

@app.get("/api/transactions")
def get_transactions(session: Session = Depends(get_session)):
    transactions = db_service.get_all_transactions(session)
    return [{
        "id": t.id,
        "asset_id": t.asset_id,
        "date": t.transaction_date.strftime("%Y-%m-%d"),
        "type": t.type,
        "ticker": t.ticker,
        "quantity": float(t.quantity) if t.quantity is not None else 0,
        "pricePerUnit": float(t.price_per_unit) if t.price_per_unit is not None else 0,
        "fees": float(t.fees) if t.fees is not None else 0,
        "totalAmount": float(t.total_amount) if t.total_amount is not None else 0
    } for t in transactions]

@app.get("/api/transactions/asset/{asset_id}", response_model=List[Transaction])
def get_asset_transactions(asset_id: str, session: Session = Depends(get_session)):
    return db_service.get_transactions_by_asset(session, asset_id)

@app.post("/api/transactions", response_model=Transaction, status_code=status.HTTP_201_CREATED)
def create_transaction(transaction: Transaction, session: Session = Depends(get_session)):
    return db_service.create_transaction(session, transaction)

@app.put("/api/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: str, transaction: Transaction, session: Session = Depends(get_session)):
    updated = db_service.update_transaction(session, transaction_id, transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return updated

@app.delete("/api/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: str, session: Session = Depends(get_session)):
    if not db_service.delete_transaction(session, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")

@app.get("/api/portfolio/summary", response_model=PortfolioSummaryResponse)
def get_portfolio_summary(session: Session = Depends(get_session)):
    latest_history = db_service.get_latest_portfolio_history(session)
    all_assets = db_service.get_all_assets(session)
    active_assets_dict = {a.id: a for a in all_assets if not a.is_archived}

    total_value = 0.0
    total_invested = 0.0
    cash_value = 0.0

    # Avoid double counting: exclude stocks if we already have the 'Interactive Brokers' container
    ib_tickers = set()
    ib_asset = next((a for a in active_assets_dict.values() if a.name == 'Interactive Brokers'), None)
    if ib_asset:
        ib_txs = db_service.get_transactions_by_asset(session, ib_asset.id)
        ib_tickers = {tx.ticker for tx in ib_txs if tx.ticker}

    # Pre-fetch all history to avoid N+1 queries
    all_history = db_service.get_all_history(session)
    history_by_asset = {}
    for h in all_history:
        if h.asset_id not in history_by_asset:
            history_by_asset[h.asset_id] = []
        history_by_asset[h.asset_id].append(h)

    for history in latest_history:
        if history.asset_id in active_assets_dict:
            asset = active_assets_dict[history.asset_id]
            nav = float(history.nav) if history.nav else 0.0

            if asset.name == 'Cash':
                cash_value = nav
                continue

            # Skip individual stocks that are already accounted for in Interactive Brokers
            if ib_asset and asset.ticker and asset.ticker in ib_tickers:
                continue

            # Check if it's a sub-component (e.g., Basalto within Fondo Basalto)
            is_component = False
            for parent_id, parent in active_assets_dict.items():
                if parent.name and asset.name and len(parent.name) > len(asset.name) and asset.name in parent.name and parent.id != asset.id:
                    is_component = True
                    break

            if is_component:
                continue

            # We calculate total invested as the sum of all historical contributions
            asset_history_entries = history_by_asset.get(asset.id, [])
            invested = sum([float(h.contribution) if h.contribution else 0.0 for h in asset_history_entries])

            total_value += nav
            total_invested += invested

    absolute_roi = total_value - total_invested
    percentage_roi = (absolute_roi / total_invested * 100) if total_invested > 0 else 0.0

    return PortfolioSummaryResponse(
        total_value=total_value,
        total_invested=total_invested,
        absolute_roi=absolute_roi,
        percentage_roi=percentage_roi,
        cash_value=cash_value
    )

@app.get("/api/portfolio/allocation", response_model=PortfolioAllocationResponse)
def get_portfolio_allocation(session: Session = Depends(get_session)):
    latest_history = db_service.get_latest_portfolio_history(session)
    assets = db_service.get_all_assets(session)

    asset_dict = {a.id: a for a in assets if not a.is_archived}

    total_value = 0.0
    allocations = {}

    for history in latest_history:
        if history.asset_id in asset_dict:
            asset = asset_dict[history.asset_id]
            nav = float(history.nav) if history.nav else 0.0

            total_value += nav
            if asset.category not in allocations:
                allocations[asset.category] = 0.0
            allocations[asset.category] += nav

    if total_value > 0:
        for cat in allocations:
            allocations[cat] = (allocations[cat] / total_value) * 100

    return PortfolioAllocationResponse(allocations=allocations)

@app.get("/api/assets/{asset_id}/metrics", response_model=AssetMetricsResponse)
def get_asset_metrics(asset_id: str, session: Session = Depends(get_session)):
    asset = db_service.get_asset_by_id(session, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    history = db_service.get_history_by_asset(session, asset_id)
    if not history:
        return AssetMetricsResponse(
            asset_id=asset_id,
            total_contributed=0.0,
            current_value=0.0,
            absolute_return=0.0,
            percentage_return=0.0,
            twr=0.0
        )

    # History is sorted by snapshot_date desc, we need asc for TWR
    history_asc = list(reversed(history))

    latest = history_asc[-1]

    current_value = float(latest.nav) if latest.nav else 0.0
    mean_cost = float(latest.mean_cost) if latest.mean_cost else 0.0
    participations = float(latest.participations) if latest.participations else 0.0

    if participations > 0 and mean_cost > 0:
        total_contributed = mean_cost * participations
    else:
        total_contributed = float(latest.contribution) if latest.contribution else 0.0

    absolute_return = current_value - total_contributed
    percentage_return = (absolute_return / total_contributed * 100) if total_contributed > 0 else 0.0

    # Calculate Time-Weighted Return (TWR)
    # TWR = [(1 + RN) * (1 + RN+1) ... ] - 1
    # Rn = (V_end - (V_begin + CF)) / (V_begin + CF)

    twr_multiplier = 1.0
    previous_nav = 0.0
    previous_contribution = 0.0

    for i, entry in enumerate(history_asc):
        nav = float(entry.nav) if entry.nav else 0.0

        # Contribution at this period.
        # Since 'contribution' usually tracks running total, the cash flow is the diff
        curr_total_contrib = 0.0
        if entry.participations and entry.mean_cost and float(entry.participations) > 0:
             curr_total_contrib = float(entry.participations) * float(entry.mean_cost)
        else:
             curr_total_contrib = float(entry.contribution) if entry.contribution else 0.0

        cash_flow = curr_total_contrib - previous_contribution

        # We only calculate return if there was an initial value or a cashflow
        base_value = previous_nav + cash_flow
        if base_value > 0:
             period_return = (nav - base_value) / base_value
             twr_multiplier *= (1 + period_return)

        previous_nav = nav
        previous_contribution = curr_total_contrib

    twr = (twr_multiplier - 1.0) * 100

    return AssetMetricsResponse(
        asset_id=asset_id,
        total_contributed=total_contributed,
        current_value=current_value,
        absolute_return=absolute_return,
        percentage_return=percentage_return,
        twr=twr
    )

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

@cached(cache=TTLCache(maxsize=1, ttl=86400))
def fetch_btc_history():
    ticker = yf.Ticker("BTC-EUR")
    hist = ticker.history(period="5y", interval="1wk")
    result = []
    for index, row in hist.iterrows():
        if str(row['Close']) != 'nan':
            result.append({
                "date": index.strftime("%Y-%m-%d"),
                "price": round(float(row['Close']), 2)
            })
    return result

@app.get("/api/bitcoin/historical-prices")
def get_bitcoin_historical_prices():
    try:
        return fetch_btc_history()
    except Exception as e:
        logger.error(f"Error fetching historical BTC prices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fetch-month", response_model=FetchMonthResponse)
async def fetch_month_prices(
    year: int = Query(..., ge=2020, le=2099, description="Year (e.g., 2024)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    session: Session = Depends(get_session)
):
    return await process_monthly_prices(year, month, session)
