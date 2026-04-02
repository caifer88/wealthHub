from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from database import get_session
from datetime import datetime
from models import (
    PortfolioSummaryResponse, 
    PortfolioAllocationResponse, 
    FetchMonthResponse
)
from services import portfolio_service
from services.monthly_fetch_service import process_monthly_prices, fetch_eur_usd_rate_with_fallback

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])

@router.get("/summary", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(session: AsyncSession = Depends(get_session)):
    return await portfolio_service.get_portfolio_summary(session)

@router.get("/allocation", response_model=PortfolioAllocationResponse)
async def get_portfolio_allocation(session: AsyncSession = Depends(get_session)):
    return await portfolio_service.get_portfolio_allocation(session)

@router.post("/sync-month", response_model=FetchMonthResponse)
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


@router.get("/exchange-rate")
async def get_exchange_rate(session: AsyncSession = Depends(get_session)):
    """
    Get the latest EUR/USD exchange rate with fallback strategy.
    Tries: Live → DB history (7 days) → hardcoded 1.1
    """
    import asyncio
    from datetime import date
    
    try:
        # Use the resilient fallback method from monthly_fetch_service
        rate, source = await fetch_eur_usd_rate_with_fallback(session, date.today())
        return {"pair": "EUR/USD", "rate": rate, "source": source}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching exchange rate: {str(e)}")
        # Ultimate fallback
        return {"pair": "EUR/USD", "rate": 1.1, "source": "fallback_hardcoded"}

