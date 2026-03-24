"""
Database repository for WealthHub Backend
"""

from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import func, case
from typing import List, Optional
import logging

from models import Asset, HistoryEntry as AssetHistory, Transaction, TransactionType

logger = logging.getLogger(__name__)

async def get_all_assets(session: AsyncSession) -> List[Asset]:
    statement = select(Asset)
    results = await session.exec(statement)
    return results.all()

async def get_asset_by_id(session: AsyncSession, asset_id: str) -> Optional[Asset]:
    return await session.get(Asset, asset_id)

async def create_asset(session: AsyncSession, asset: Asset) -> Asset:
    session.add(asset)
    await session.commit()
    await session.refresh(asset)
    return asset

async def update_asset(session: AsyncSession, asset_id: str, asset_data: Asset) -> Optional[Asset]:
    asset = await session.get(Asset, asset_id)
    if not asset:
        return None

    update_data = asset_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(asset, key, value)

    session.add(asset)
    await session.commit()
    await session.refresh(asset)
    return asset

async def delete_asset(session: AsyncSession, asset_id: str) -> bool:
    asset = await session.get(Asset, asset_id)
    if not asset:
        return False
    await session.delete(asset)
    await session.commit()
    return True


async def get_all_history(session: AsyncSession) -> List[AssetHistory]:
    statement = select(AssetHistory).order_by(AssetHistory.snapshot_date.desc())
    results = await session.exec(statement)
    return results.all()

async def get_history_by_asset(session: AsyncSession, asset_id: str) -> List[AssetHistory]:
    statement = select(AssetHistory).where(AssetHistory.asset_id == asset_id).order_by(AssetHistory.snapshot_date.desc())
    results = await session.exec(statement)
    return results.all()

async def create_history_entry(session: AsyncSession, entry: AssetHistory) -> AssetHistory:
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry

async def update_history_entry(session: AsyncSession, history_id: str, history_data: AssetHistory) -> Optional[AssetHistory]:
    entry = await session.get(AssetHistory, history_id)
    if not entry:
        return None

    update_data = history_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)

    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry

async def delete_history_entry(session: AsyncSession, history_id: str) -> bool:
    entry = await session.get(AssetHistory, history_id)
    if not entry:
        return False
    await session.delete(entry)
    await session.commit()
    return True

async def get_latest_portfolio_history(session: AsyncSession) -> List[AssetHistory]:
    subq = select(
        AssetHistory.asset_id,
        func.max(AssetHistory.snapshot_date).label('max_date')
    ).group_by(AssetHistory.asset_id).subquery()

    statement = select(AssetHistory).join(
        subq,
        (AssetHistory.asset_id == subq.c.asset_id) & (AssetHistory.snapshot_date == subq.c.max_date)
    )
    return (await session.exec(statement)).all()


async def get_all_transactions(session: AsyncSession) -> List[Transaction]:
    statement = select(Transaction).order_by(Transaction.transaction_date.desc())
    results = await session.exec(statement)
    return results.all()

async def get_transactions_by_asset(session: AsyncSession, asset_id: str) -> List[Transaction]:
    statement = select(Transaction).where(Transaction.asset_id == asset_id).order_by(Transaction.transaction_date.desc())
    results = await session.exec(statement)
    return results.all()

async def get_asset_holdings(session: AsyncSession, asset_id: str) -> dict:
    statement = select(
        Transaction.ticker,
        func.sum(
            case(
                (Transaction.type == TransactionType.BUY, Transaction.quantity),
                (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                else_=0
            )
        ).label('total_quantity')
    ).where(Transaction.asset_id == asset_id).where(Transaction.ticker != None).group_by(Transaction.ticker)

    results = (await session.exec(statement)).all()
    return {ticker: float(qty) for ticker, qty in results if qty > 0.0001}

async def get_total_btc_holdings(session: AsyncSession, asset_id: str) -> float:
    statement = select(
        func.sum(
            case(
                (Transaction.type == TransactionType.BUY, Transaction.quantity),
                (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                else_=0
            )
        )
    ).where(
        (Transaction.asset_id == asset_id) | (Transaction.ticker == 'BTC')
    )
    result = (await session.exec(statement)).first()
    return float(result) if result else 0.0

async def get_asset_total_quantity(session: AsyncSession, asset_id: str) -> float:
    statement = select(
        func.sum(
            case(
                (Transaction.type == TransactionType.BUY, Transaction.quantity),
                (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                else_=0
            )
        )
    ).where(Transaction.asset_id == asset_id)
    result = (await session.exec(statement)).first()
    return float(result) if result else 0.0


async def get_all_assets_total_contributions(session: AsyncSession) -> dict:
    statement = select(
        AssetHistory.asset_id,
        func.sum(AssetHistory.contribution).label('total_contributed')
    ).group_by(AssetHistory.asset_id)

    results = (await session.exec(statement)).all()
    return {asset_id: float(contributed) if contributed is not None else 0.0 for asset_id, contributed in results}

async def get_asset_total_contributed(session: AsyncSession, asset_id: str) -> float:
    statement = select(func.sum(AssetHistory.contribution)).where(AssetHistory.asset_id == asset_id)
    result = (await session.exec(statement)).first()
    return float(result) if result is not None else 0.0


async def create_transaction(session: AsyncSession, transaction: Transaction) -> Transaction:
    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)
    return transaction

async def update_transaction(session: AsyncSession, transaction_id: str, transaction_data: Transaction) -> Optional[Transaction]:
    transaction = await session.get(Transaction, transaction_id)
    if not transaction:
        return None

    update_data = transaction_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(transaction, key, value)

    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)
    return transaction

async def delete_transaction(session: AsyncSession, transaction_id: str) -> bool:
    transaction = await session.get(Transaction, transaction_id)
    if not transaction:
        return False
    await session.delete(transaction)
    await session.commit()
    return True
