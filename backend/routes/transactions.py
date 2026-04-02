from typing import List
from fastapi import APIRouter, Depends, HTTPException,status
from sqlmodel.ext.asyncio.session import AsyncSession
from database import get_session
from models import Transaction, TransactionResponseDTO
from services import db_service
from services.stock_asset_manager import get_or_create_stock_asset
import json

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=List[TransactionResponseDTO])
async def get_transactions(session: AsyncSession = Depends(get_session)):
    """
    DEPRECATED: Get all transactions (Bitcoin + Stock combined).
    Use GET /api/bitcoin/transactions or GET /api/stocks/transactions instead.
    """
    # Merge results from both new tables for backward compatibility
    bitcoin_txns = await db_service.get_all_bitcoin_transactions(session)
    stock_txns = await db_service.get_all_stock_transactions(session)
    
    # Convert both to Transaction-like format for response
    all_txns = []
    for btx in bitcoin_txns:
        # Convert BitcoinTransaction to Transaction format
        tx = Transaction(
            id=btx.id,
            asset_id=btx.asset_id,
            transaction_date=btx.transaction_date,
            type=btx.type,
            ticker="BTC",
            currency="EUR",
            quantity=btx.amount_btc,
            price_per_unit=btx.price_eur_per_btc,
            fees=btx.fees_eur,
            total_amount=btx.total_amount_eur,
            exchange_rate=btx.exchange_rate_usd_eur
        )
        all_txns.append(tx)
    
    for stx in stock_txns:
        # Convert StockTransaction to Transaction format
        all_txns.append(stx)
    
    # Sort by date descending
    all_txns.sort(key=lambda t: t.transaction_date, reverse=True)
    return all_txns

@router.post("", status_code=308)
async def create_transaction_deprecated():
    """
    DEPRECATED: Use POST /api/bitcoin/transactions or POST /api/stocks/transactions instead.
    """
    raise HTTPException(
        status_code=308,
        detail="DEPRECATED: Use POST /api/bitcoin/transactions for Bitcoin or POST /api/stocks/transactions for Stocks"
    )

@router.put("/{transaction_id}", status_code=308)
async def update_transaction_deprecated(transaction_id: str):
    """
    DEPRECATED: Use PUT /api/bitcoin/transactions/{id} or PUT /api/stocks/transactions/{id} instead.
    """
    raise HTTPException(
        status_code=308,
        detail="DEPRECATED: Use PUT /api/bitcoin/transactions/{id} for Bitcoin or PUT /api/stocks/transactions/{id} for Stocks"
    )

@router.delete("/{transaction_id}", status_code=308)
async def delete_transaction_deprecated(transaction_id: str):
    """
    DEPRECATED: Use DELETE /api/bitcoin/transactions/{id} or DELETE /api/stocks/transactions/{id} instead.
    """
    raise HTTPException(
        status_code=308,
        detail="DEPRECATED: Use DELETE /api/bitcoin/transactions/{id} for Bitcoin or DELETE /api/stocks/transactions/{id} for Stocks"
    )
