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
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine

from config import settings
from models import (
    Asset, PriceData, FetchMonthResponse, HealthResponse,
    HistoryEntry, Transaction, PortfolioSummaryResponse,
    PortfolioAllocationResponse, AssetMetricsResponse,
    HistoryResponseDTO, TransactionResponseDTO
)
from utils import (
    get_last_business_day, validate_month, format_date,
    format_datetime_iso
)
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services import db_service, portfolio_service, metrics_service
from services.monthly_fetch_service import process_monthly_prices
from cachetools import cached, TTLCache
import yfinance as yf

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def scheduled_update_nav():
    logger.info("⏰ Executing daily NAV update cron job...")
    now = datetime.now()
    
    async with AsyncSession(engine) as session:
        try:
            await process_monthly_prices(year=now.year, month=now.month, session=session)
            logger.info("✅ NAV update cron job completed successfully.")
        except Exception as e:
            logger.error(f"❌ Error in NAV cron job: {e}")

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)

async def get_session():
    async with AsyncSession(engine) as session:
        yield session

app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Backend API for WealthHub wealth management application"
)

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

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    logger.info("📦 Database tables created or verified")
    
    scheduler.add_job(scheduled_update_nav, 'cron', hour=9, minute=00)
    scheduler.start()
    logger.info("🕒 Scheduler started. NAV update scheduled at 9:00 AM.")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        message="WealthHub Backend is running",
        version=settings.API_VERSION
    )

@app.get("/api/assets", response_model=List[Asset])
async def get_assets(session: AsyncSession = Depends(get_session)):
    return await db_service.get_all_assets(session)

@app.post("/api/assets", response_model=Asset, status_code=status.HTTP_201_CREATED)
async def create_asset(asset: Asset, session: AsyncSession = Depends(get_session)):
    if await db_service.get_asset_by_id(session, asset.id):
        raise HTTPException(status_code=400, detail="Asset ID already exists")
    return await db_service.create_asset(session, asset)

@app.put("/api/assets/{asset_id}", response_model=Asset)
async def update_asset(asset_id: str, asset: Asset, session: AsyncSession = Depends(get_session)):
    updated = await db_service.update_asset(session, asset_id, asset)
    if not updated:
        raise HTTPException(status_code=404, detail="Asset not found")
    return updated

@app.delete("/api/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: str, session: AsyncSession = Depends(get_session)):
    if not await db_service.delete_asset(session, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")

@app.get("/api/history", response_model=List[HistoryResponseDTO])
async def get_history(session: AsyncSession = Depends(get_session)):
    return await db_service.get_all_history(session)

@app.get("/api/history/asset/{asset_id}", response_model=List[HistoryEntry])
async def get_asset_history(asset_id: str, session: AsyncSession = Depends(get_session)):
    return await db_service.get_history_by_asset(session, asset_id)

@app.post("/api/history", response_model=HistoryEntry, status_code=status.HTTP_201_CREATED)
async def create_history(entry: HistoryEntry, session: AsyncSession = Depends(get_session)):
    return await db_service.create_history_entry(session, entry)

@app.put("/api/history/{history_id}", response_model=HistoryEntry)
async def update_history(history_id: str, entry: HistoryEntry, session: AsyncSession = Depends(get_session)):
    updated = await db_service.update_history_entry(session, history_id, entry)
    if not updated:
        raise HTTPException(status_code=404, detail="History entry not found")
    return updated

@app.delete("/api/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history(history_id: str, session: AsyncSession = Depends(get_session)):
    if not await db_service.delete_history_entry(session, history_id):
        raise HTTPException(status_code=404, detail="History entry not found")

@app.get("/api/transactions", response_model=List[TransactionResponseDTO])
async def get_transactions(session: AsyncSession = Depends(get_session)):
    return await db_service.get_all_transactions(session)

@app.get("/api/transactions/asset/{asset_id}", response_model=List[Transaction])
async def get_asset_transactions(asset_id: str, session: AsyncSession = Depends(get_session)):
    return await db_service.get_transactions_by_asset(session, asset_id)

@app.post("/api/transactions", response_model=Transaction, status_code=status.HTTP_201_CREATED)
async def create_transaction(transaction: Transaction, session: AsyncSession = Depends(get_session)):
    return await db_service.create_transaction(session, transaction)

@app.put("/api/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, transaction: Transaction, session: AsyncSession = Depends(get_session)):
    updated = await db_service.update_transaction(session, transaction_id, transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return updated

@app.delete("/api/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(transaction_id: str, session: AsyncSession = Depends(get_session)):
    if not await db_service.delete_transaction(session, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")

@app.get("/api/portfolio/summary", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(session: AsyncSession = Depends(get_session)):
    return await portfolio_service.get_portfolio_summary(session)

@app.get("/api/portfolio/allocation", response_model=PortfolioAllocationResponse)
async def get_portfolio_allocation(session: AsyncSession = Depends(get_session)):
    return await portfolio_service.get_portfolio_allocation(session)

@app.get("/api/assets/{asset_id}/metrics", response_model=AssetMetricsResponse)
async def get_asset_metrics(asset_id: str, session: AsyncSession = Depends(get_session)):
    return await metrics_service.get_asset_metrics(asset_id, session)

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
async def get_bitcoin_historical_prices(): # <-- Hazla async
    try:
        # Ejecuta la función síncrona en un thread pool
        return await asyncio.to_thread(fetch_btc_history) 
    except Exception as e:
        logger.error(f"Error fetching historical BTC prices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/portfolio/sync-month", response_model=FetchMonthResponse)
async def sync_month_prices(
    year: int = Query(None, ge=2020, le=2099, description="Year (e.g., 2024)"),
    month: int = Query(None, ge=1, le=12, description="Month (1-12)"),
    session: AsyncSession = Depends(get_session)
):
    now = datetime.now()
    if year is None:
        year = now.year
    if month is None:
        month = now.month
    return await process_monthly_prices(year, month, session)
