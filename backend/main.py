"""
WealthHub Backend API
Main FastAPI application with endpoints for fetching asset prices and managing data
"""

import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from config import settings
from database import engine
from models import HealthResponse
from services.monthly_fetch_service import process_monthly_prices

# Routers
from routes import assets, history, transactions, portfolio, metrics, bitcoin

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

# Include routers
app.include_router(assets.router)
app.include_router(history.router)
app.include_router(transactions.router)
app.include_router(portfolio.router)
app.include_router(metrics.router)
app.include_router(bitcoin.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
