"""
Database repository for WealthHub Backend
Replaces GAS service with direct DB interactions
"""

from sqlmodel import Session, select, delete
from typing import List, Optional
import logging

from db_models import Asset, AssetHistory, Transaction
from models import Asset as PydanticAsset
from models import HistoryEntry as PydanticHistoryEntry
from models import Transaction as PydanticTransaction

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

def create_asset(session: Session, asset_data: PydanticAsset) -> Asset:
    """Create a new asset"""
    asset = Asset(**asset_data.model_dump())
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset

def update_asset(session: Session, asset_id: str, asset_data: PydanticAsset) -> Optional[Asset]:
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

def create_history_entry(session: Session, history_data: PydanticHistoryEntry) -> AssetHistory:
    """Create a new history entry"""
    entry = AssetHistory(**history_data.model_dump())
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

def update_history_entry(session: Session, history_id: str, history_data: PydanticHistoryEntry) -> Optional[AssetHistory]:
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

def create_transaction(session: Session, transaction_data: PydanticTransaction) -> Transaction:
    """Create a new transaction"""
    transaction = Transaction(**transaction_data.model_dump())
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction

def update_transaction(session: Session, transaction_id: str, transaction_data: PydanticTransaction) -> Optional[Transaction]:
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
