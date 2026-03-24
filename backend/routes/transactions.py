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
    if isinstance(transaction.transaction_date, str):
        from datetime import datetime
        transaction.transaction_date = datetime.strptime(transaction.transaction_date, "%Y-%m-%d").date()
    result = await db_service.create_transaction(session, transaction)
    # Auto-update history for the month of this transaction
    if result.asset_id and result.transaction_date:
        from datetime import date
        month_date = date(result.transaction_date.year, result.transaction_date.month, 1)
        await db_service.upsert_history_from_transactions(session, result.asset_id, month_date)
    return result

@router.put("/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, transaction: Transaction, session: AsyncSession = Depends(get_session)):
    if isinstance(transaction.transaction_date, str):
        from datetime import datetime
        transaction.transaction_date = datetime.strptime(transaction.transaction_date, "%Y-%m-%d").date()
    updated = await db_service.update_transaction(session, transaction_id, transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    # Auto-update history for the month of this transaction
    if updated.asset_id and updated.transaction_date:
        from datetime import date
        month_date = date(updated.transaction_date.year, updated.transaction_date.month, 1)
        await db_service.upsert_history_from_transactions(session, updated.asset_id, month_date)
    return updated

@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(transaction_id: str, session: AsyncSession = Depends(get_session)):
    # Load transaction before deleting to get its asset_id and date for history update
    from sqlmodel import select
    from models import Transaction as TxModel
    tx = (await session.exec(select(TxModel).where(TxModel.id == transaction_id))).first()
    asset_id_to_update = tx.asset_id if tx else None
    month_date_to_update = None
    if tx and tx.transaction_date:
        from datetime import date
        month_date_to_update = date(tx.transaction_date.year, tx.transaction_date.month, 1)
    if not await db_service.delete_transaction(session, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")
    # Auto-update history after deletion
    if asset_id_to_update and month_date_to_update:
        await db_service.upsert_history_from_transactions(session, asset_id_to_update, month_date_to_update)
