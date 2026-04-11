"""
Stock Routes
API endpoints for stock portfolio management
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List
from database import get_session
from models import StockPortfolioSummaryDTO, StockTransaction, StockTransactionDTO
from services import db_service
from services.stock_portfolio_service import (
    get_stock_portfolio_summary,
    get_stock_allocation
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stocks", tags=["Stocks"])


@router.get("/portfolio", response_model=StockPortfolioSummaryDTO)
async def get_portfolio(session: AsyncSession = Depends(get_session)):
    """
    Get consolidated stock portfolio summary.
    
    This is the single source of truth for all portfolio metrics:
    - Total value in EUR
    - Total invested (cost basis) in EUR  
    - Unrealized gains in EUR and percentage
    - Per-ticker holdingsand metrics
    - Exchange rate used for conversions
    
    Returns:
        StockPortfolioSummaryDTO with complete portfolio overview
        
    Example response:
    ```json
    {
      "totalValueEur": 50000.50,
      "totalInvestedEur": 42000.00,
      "totalUnrealizedGainEur": 8000.50,
      "totalUnrealizedGainPercent": 19.05,
      "exchangeRateEurUsd": 1.1234,
      "lastUpdate": "2026-04-02T15:30:45.123456",
      "numberOfTickers": 5,
      "tickers": [
        {
          "ticker": "AAPL",
          "shares": 10.0,
          "costBasisEur": 15000.00,
          "costBasisUsd": 16500.00,
          "averagePriceUsd": 150.00,
          "currentPriceUsd": 175.00,
          "currentPriceEur": 155.60,
          "currentValueEur": 1556.00,
          "unrealizedGainEur": 250.00,
          "unrealizedGainUsd": 275.00,
          "unrealizedGainPercent": 1.67,
          "lastPriceUpdate": "2026-04-02T00:00:00"
        }
      ]
    }
    ```
    """
    try:
        logger.info("📊 GET /api/stocks/portfolio")
        portfolio = await get_stock_portfolio_summary(session)
        return portfolio
        
    except Exception as e:
        logger.error(f"❌ Error getting portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating portfolio: {str(e)}"
        )


@router.get("/allocation")
async def get_allocation(session: AsyncSession = Depends(get_session)):
    """
    Get asset allocation percentages by ticker.
    
    Returns:
        Dict mapping ticker → allocation_percentage
        
    Example response:
    ```json
    {
      "AAPL": 31.12,
      "GOOGL": 28.45,
      "MSFT": 25.60,
      "AMZN": 10.83,
      "TSLA": 4.00
    }
    ```
    """
    try:
        logger.info("📊 GET /api/stocks/allocation")
        allocation = await get_stock_allocation(session)
        return allocation
        
    except Exception as e:
        logger.error(f"❌ Error calculating allocation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating allocation: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Simple health check for stocks API"""
    return {"status": "healthy", "message": "Stocks API is running"}


# ===== Stock Transaction CRUD Endpoints =====

@router.get("/transactions", response_model=List[StockTransactionDTO])
async def get_all_stock_transactions(session: AsyncSession = Depends(get_session)):
    """Get all Stock transactions ordered by date (descending)"""
    return await db_service.get_all_stock_transactions(session)

@router.get("/transactions/{transaction_id}", response_model=StockTransactionDTO)
async def get_stock_transaction_by_id(transaction_id: str, session: AsyncSession = Depends(get_session)):
    """Get a specific Stock transaction by ID"""
    transaction = await db_service.get_stock_transaction_by_id(session, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Stock transaction not found")
    return transaction

@router.post("/transactions", response_model=StockTransactionDTO, status_code=status.HTTP_201_CREATED)
async def create_stock_transaction(transaction: StockTransactionDTO, session: AsyncSession = Depends(get_session)):
    try:
        db_transaction = StockTransaction(**transaction.model_dump(exclude_unset=True))
        
        # Auto-fetch exchange rate for transaction date if not provided
        if not db_transaction.exchange_rate_to_eur or db_transaction.exchange_rate_to_eur <= 0:
            rate = await db_service.get_exchange_rate_for_date(
                session, "EUR/USD", db_transaction.transaction_date
            )
            if rate:
                db_transaction.exchange_rate_to_eur = rate
                logger.info(f"✅ Auto-fetched EUR/USD rate {rate} for {db_transaction.transaction_date}")
            else:
                logger.warning(f"⚠️ No rate found, using fallback 1.15")
                db_transaction.exchange_rate_to_eur = 1.15
        
        result = await db_service.create_stock_transaction(session, db_transaction)
        return result
    except Exception as e:
        logger.error(f"Error creating Stock transaction: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/transactions/{transaction_id}", response_model=StockTransactionDTO)
async def update_stock_transaction(transaction_id: str, transaction: StockTransactionDTO, session: AsyncSession = Depends(get_session)):
    db_transaction = StockTransaction(**transaction.model_dump(exclude_unset=True))
    
    # Auto-fetch exchange rate for transaction date if not provided or is default
    if not db_transaction.exchange_rate_to_eur or db_transaction.exchange_rate_to_eur <= 0:
        rate = await db_service.get_exchange_rate_for_date(
            session, "EUR/USD", db_transaction.transaction_date
        )
        if rate:
            db_transaction.exchange_rate_to_eur = rate
            logger.info(f"✅ Auto-fetched EUR/USD rate {rate} for {db_transaction.transaction_date}")
        else:
            logger.warning(f"⚠️ No rate found, using fallback 1.15")
            db_transaction.exchange_rate_to_eur = 1.15
    
    result = await db_service.update_stock_transaction(session, transaction_id, db_transaction)
    if not result:
        raise HTTPException(status_code=404, detail="Stock transaction not found")
    return result

@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock_transaction(transaction_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a Stock transaction"""
    success = await db_service.delete_stock_transaction(session, transaction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Stock transaction not found")
    return None

