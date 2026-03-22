from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from database import get_session
from models import Transaction, TransactionResponseDTO
from services import db_service

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=List[TransactionResponseDTO])
async def get_transactions(session: AsyncSession = Depends(get_session)):
    return await db_service.get_all_transactions(session)

@router.get("/asset/{asset_id}", response_model=List[Transaction])
async def get_asset_transactions(asset_id: str, session: AsyncSession = Depends(get_session)):
    return await db_service.get_transactions_by_asset(session, asset_id)

@router.post("", response_model=Transaction, status_code=status.HTTP_201_CREATED)
async def create_transaction(transaction: Transaction, session: AsyncSession = Depends(get_session)):
    return await db_service.create_transaction(session, transaction)

@router.put("/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, transaction: Transaction, session: AsyncSession = Depends(get_session)):
    updated = await db_service.update_transaction(session, transaction_id, transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return updated

@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(transaction_id: str, session: AsyncSession = Depends(get_session)):
    if not await db_service.delete_transaction(session, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")
