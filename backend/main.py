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
from services import db_service, portfolio_service, metrics_service
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
    """Tarea que se ejecutará automáticamente"""
    logger.info("⏰ Ejecutando cron job diario de actualización de NAV...")
    now = datetime.now()
    
    # Abrimos una sesión de base de datos específica para esta tarea en segundo plano
    with Session(engine) as session:
        try:
            # Reutilizamos la lógica de tu endpoint pasándole el mes y año actual
            await fetch_month_prices(year=now.year, month=now.month, session=session)
            logger.info("✅ Cron job de actualización completado con éxito.")
        except Exception as e:
            logger.error(f"❌ Error en el cron job de NAV: {e}")

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
    
    # Programar la actualización para que corra todos los días a las 09:00
    scheduler.add_job(scheduled_update_nav, 'cron', hour=9, minute=00)
    scheduler.start()
    logger.info("🕒 Scheduler iniciado. Actualización de NAV programada a las 9:00 AM.")

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
    """Get all assets mapped for Frontend"""
    return db_service.get_all_assets(session)

@app.post("/api/assets", response_model=Asset, status_code=status.HTTP_201_CREATED)
def create_asset(asset: Asset, session: Session = Depends(get_session)):
    """Create a new asset"""
    # Check if ID already exists
    if db_service.get_asset_by_id(session, asset.id):
        raise HTTPException(status_code=400, detail="Asset ID already exists")
    return db_service.create_asset(session, asset)

@app.put("/api/assets/{asset_id}", response_model=Asset)
def update_asset(asset_id: str, asset: Asset, session: Session = Depends(get_session)):
    """Update an existing asset"""
    updated = db_service.update_asset(session, asset_id, asset)
    if not updated:
        raise HTTPException(status_code=404, detail="Asset not found")
    return updated

@app.delete("/api/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, session: Session = Depends(get_session)):
    """Delete an asset"""
    if not db_service.delete_asset(session, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")

# --- History Endpoints ---

@app.get("/api/history")
def get_history(session: Session = Depends(get_session)):
    """Get all history mapped for Frontend"""
    history = db_service.get_all_history(session)
    return [{
        "id": h.id,
        "asset_id": h.asset_id,
        "month": h.snapshot_date.strftime("%Y-%m"), # Convertimos 2020-01-01 a "2020-01"
        "nav": float(h.nav) if h.nav else 0,
        "contribution": float(h.contribution) if h.contribution else 0,
        "participations": float(h.participations) if h.participations is not None else None,
        "liquidNavValue": float(h.liquid_nav_value) if h.liquid_nav_value is not None else None,
        "meanCost": float(h.mean_cost) if h.mean_cost is not None else None
    } for h in history]

@app.get("/api/history/asset/{asset_id}", response_model=List[HistoryEntry])
def get_asset_history(asset_id: str, session: Session = Depends(get_session)):
    """Get history for a specific asset"""
    return db_service.get_history_by_asset(session, asset_id)

@app.post("/api/history", response_model=HistoryEntry, status_code=status.HTTP_201_CREATED)
def create_history(entry: HistoryEntry, session: Session = Depends(get_session)):
    """Create a new history entry"""
    return db_service.create_history_entry(session, entry)

@app.put("/api/history/{history_id}", response_model=HistoryEntry)
def update_history(history_id: str, entry: HistoryEntry, session: Session = Depends(get_session)):
    """Update an existing history entry"""
    updated = db_service.update_history_entry(session, history_id, entry)
    if not updated:
        raise HTTPException(status_code=404, detail="History entry not found")
    return updated

@app.delete("/api/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history(history_id: str, session: Session = Depends(get_session)):
    """Delete a history entry"""
    if not db_service.delete_history_entry(session, history_id):
        raise HTTPException(status_code=404, detail="History entry not found")

# --- Transaction Endpoints ---

@app.get("/api/transactions")
def get_transactions(session: Session = Depends(get_session)):
    """Get all transactions mapped for Frontend"""
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
    """Get transactions for a specific asset"""
    return db_service.get_transactions_by_asset(session, asset_id)

@app.post("/api/transactions", response_model=Transaction, status_code=status.HTTP_201_CREATED)
def create_transaction(transaction: Transaction, session: Session = Depends(get_session)):
    """Create a new transaction"""
    return db_service.create_transaction(session, transaction)

@app.put("/api/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: str, transaction: Transaction, session: Session = Depends(get_session)):
    """Update an existing transaction"""
    updated = db_service.update_transaction(session, transaction_id, transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return updated

@app.delete("/api/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: str, session: Session = Depends(get_session)):
    """Delete a transaction"""
    if not db_service.delete_transaction(session, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")

# --- Analytics Endpoints ---

@app.get("/api/portfolio/summary", response_model=PortfolioSummaryResponse)
def get_portfolio_summary(session: Session = Depends(get_session)):
    """Get the latest portfolio summary"""
    return portfolio_service.get_portfolio_summary(session)

@app.get("/api/portfolio/allocation", response_model=PortfolioAllocationResponse)
def get_portfolio_allocation(session: Session = Depends(get_session)):
    """Get the portfolio allocation by category"""
    return portfolio_service.get_portfolio_allocation(session)

@app.get("/api/assets/{asset_id}/metrics", response_model=AssetMetricsResponse)
def get_asset_metrics(asset_id: str, session: Session = Depends(get_session)):
    """Get metrics for a specific asset"""
    return metrics_service.get_asset_metrics(asset_id, session)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

# Caché de 24 horas (86400 segundos) para no saturar la API
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
    """Get historical weekly prices for Bitcoin"""
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
    """
    Fetch prices for all assets for the given month.
    """
    return await process_monthly_prices(year, month, session)
