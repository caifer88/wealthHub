import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
import yfinance as yf
from cachetools import cached, TTLCache
from typing import List

from database import get_session
from models import BitcoinTransaction, BitcoinTransactionDTO
from services import db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/bitcoin", tags=["Bitcoin"])

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

@router.get("/historical-prices")
async def get_bitcoin_historical_prices():
    try:
        return await asyncio.to_thread(fetch_btc_history) 
    except Exception as e:
        logger.error(f"Error fetching historical BTC prices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Bitcoin Transaction CRUD Endpoints =====

@router.get("/transactions", response_model=List[BitcoinTransactionDTO])
async def get_all_bitcoin_transactions(session: AsyncSession = Depends(get_session)):
    return await db_service.get_all_bitcoin_transactions(session)

@router.get("/transactions/{transaction_id}", response_model=BitcoinTransactionDTO)
async def get_bitcoin_transaction(transaction_id: str, session: AsyncSession = Depends(get_session)):
    """Get a specific Bitcoin transaction by ID"""
    transaction = await db_service.get_bitcoin_transaction_by_id(session, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Bitcoin transaction not found")
    return transaction

@router.post("/transactions", response_model=BitcoinTransactionDTO, status_code=status.HTTP_201_CREATED)
async def create_bitcoin_transaction(transaction: BitcoinTransactionDTO, session: AsyncSession = Depends(get_session)):
    try:
        # Transformamos el DTO de entrada (camelCase del front) a un modelo de Base de Datos
        db_transaction = BitcoinTransaction(**transaction.model_dump(exclude_unset=True))
        result = await db_service.create_bitcoin_transaction(session, db_transaction)
        return result
    except Exception as e:
        logger.error(f"Error creating Bitcoin transaction: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/transactions/{transaction_id}", response_model=BitcoinTransactionDTO)
async def update_bitcoin_transaction(transaction_id: str, transaction: BitcoinTransactionDTO, session: AsyncSession = Depends(get_session)):
    # Transformamos de nuevo al modelo de SQLModel
    db_transaction = BitcoinTransaction(**transaction.model_dump(exclude_unset=True))
    result = await db_service.update_bitcoin_transaction(session, transaction_id, db_transaction)
    if not result:
        raise HTTPException(status_code=404, detail="Bitcoin transaction not found")
    return result

@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bitcoin_transaction(transaction_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a Bitcoin transaction"""
    success = await db_service.delete_bitcoin_transaction(session, transaction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Bitcoin transaction not found")
    return None

