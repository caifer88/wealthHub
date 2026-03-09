"""
Database repository for WealthHub Backend
Replaces GAS service with direct DB interactions
"""

from sqlmodel import Session, select, delete
from sqlalchemy import func, case
from typing import List, Optional
import logging

from models import Asset, HistoryEntry as AssetHistory, Transaction

logger = logging.getLogger(__name__)

# --- Asset Operations ---

def get_all_assets(session: Session) -> List[Asset]:
    """Retrieve all assets"""
    statement = select(Asset)
    results = session.exec(statement)
    return results.all()

def get_asset_by_id(session: Session, asset_id: str) -> Optional[Asset]:
    """Retrieve an asset by ID"""
    return session.get(Asset, asset_id)

def create_asset(session: Session, asset: Asset) -> Asset:
    """Create a new asset"""
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset

def update_asset(session: Session, asset_id: str, asset_data: Asset) -> Optional[Asset]:
    """Update an existing asset"""
    asset = session.get(Asset, asset_id)
    if not asset:
        return None

    update_data = asset_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(asset, key, value)

    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset

def delete_asset(session: Session, asset_id: str) -> bool:
    """Delete an asset"""
    asset = session.get(Asset, asset_id)
    if not asset:
        return False
    session.delete(asset)
    session.commit()
    return True

# --- Asset History Operations ---

def get_all_history(session: Session) -> List[AssetHistory]:
    """Retrieve all history entries"""
    statement = select(AssetHistory).order_by(AssetHistory.snapshot_date.desc())
    results = session.exec(statement)
    return results.all()

def get_history_by_asset(session: Session, asset_id: str) -> List[AssetHistory]:
    """Retrieve history for a specific asset"""
    statement = select(AssetHistory).where(AssetHistory.asset_id == asset_id).order_by(AssetHistory.snapshot_date.desc())
    results = session.exec(statement)
    return results.all()

def create_history_entry(session: Session, entry: AssetHistory) -> AssetHistory:
    """Create a new history entry"""
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

def update_history_entry(session: Session, history_id: str, history_data: AssetHistory) -> Optional[AssetHistory]:
    """Update an existing history entry"""
    entry = session.get(AssetHistory, history_id)
    if not entry:
        return None

    update_data = history_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)

    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

def delete_history_entry(session: Session, history_id: str) -> bool:
    """Delete a history entry"""
    entry = session.get(AssetHistory, history_id)
    if not entry:
        return False
    session.delete(entry)
    session.commit()
    return True

def get_latest_portfolio_history(session: Session) -> List[AssetHistory]:
    """Retrieve the latest history entry for each active asset"""
    # Subquery to get the max snapshot_date per asset
    subq = select(
        AssetHistory.asset_id,
        func.max(AssetHistory.snapshot_date).label('max_date')
    ).group_by(AssetHistory.asset_id).subquery()

    statement = select(AssetHistory).join(
        subq,
        (AssetHistory.asset_id == subq.c.asset_id) & (AssetHistory.snapshot_date == subq.c.max_date)
    )
    return session.exec(statement).all()

# --- Transaction Operations ---

def get_all_transactions(session: Session) -> List[Transaction]:
    """Retrieve all transactions"""
    statement = select(Transaction).order_by(Transaction.transaction_date.desc())
    results = session.exec(statement)
    return results.all()

def get_transactions_by_asset(session: Session, asset_id: str) -> List[Transaction]:
    """Retrieve transactions for a specific asset"""
    statement = select(Transaction).where(Transaction.asset_id == asset_id).order_by(Transaction.transaction_date.desc())
    results = session.exec(statement)
    return results.all()

def get_asset_holdings(session: Session, asset_id: str) -> dict:
    """Calcula las posiciones actuales directamente en base de datos"""
    statement = select(
        Transaction.ticker,
        func.sum(
            case(
                (Transaction.type.in_(["BUY", "COMPRA"]), Transaction.quantity),
                (Transaction.type.in_(["SELL", "VENTA"]), -Transaction.quantity),
                else_=0
            )
        ).label('total_quantity')
    ).where(Transaction.asset_id == asset_id).where(Transaction.ticker != None).group_by(Transaction.ticker)

    results = session.exec(statement).all()
    # Devuelve solo los tickers con cantidad > 0
    return {ticker: float(qty) for ticker, qty in results if qty > 0.0001}

def get_total_btc_holdings(session: Session, asset_id: str) -> float:
    """Calcula la cantidad total de BTC directamente en base de datos"""
    statement = select(
        func.sum(
            case(
                (Transaction.type.in_(["BUY", "COMPRA"]), Transaction.quantity),
                (Transaction.type.in_(["SELL", "VENTA"]), -Transaction.quantity),
                else_=0
            )
        )
    ).where(
        (Transaction.asset_id == asset_id) | (Transaction.ticker == 'BTC')
    )
    result = session.exec(statement).first()
    return float(result) if result else 0.0

def create_transaction(session: Session, transaction: Transaction) -> Transaction:
    """Create a new transaction"""
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction

def update_transaction(session: Session, transaction_id: str, transaction_data: Transaction) -> Optional[Transaction]:
    """Update an existing transaction"""
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        return None

    update_data = transaction_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(transaction, key, value)

    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction

def delete_transaction(session: Session, transaction_id: str) -> bool:
    """Delete a transaction"""
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        return False
    session.delete(transaction)
    session.commit()
    return True
