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
from services.monthly_fetch_service import process_monthly_prices

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
