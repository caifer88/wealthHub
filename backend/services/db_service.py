"""
Database repository for WealthHub Backend
"""

from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import func, case
from typing import List, Optional, Any
import logging

from models import Asset, HistoryEntry as AssetHistory, BitcoinTransaction, StockTransaction, TransactionType

logger = logging.getLogger(__name__)

async def get_all_assets(session: AsyncSession) -> List[Asset]:
    """Get all assets (including root and child assets)"""
    statement = select(Asset)
    results = await session.exec(statement)
    return results.all()

async def get_root_assets(session: AsyncSession) -> List[Asset]:
    """Get only root assets (where parent_asset_id IS NULL)"""
    statement = select(Asset).where(Asset.parent_asset_id.is_(None))
    results = await session.exec(statement)
    return results.all()

async def get_child_assets(session: AsyncSession, parent_asset_id: str) -> List[Asset]:
    """Get child assets for a given parent"""
    statement = select(Asset).where(Asset.parent_asset_id == parent_asset_id)
    results = await session.exec(statement)
    return results.all()

async def get_assets_by_parent(session: AsyncSession, parent_asset_id: Optional[str] = None) -> List[Asset]:
    """Get assets filtered by parent. If parent_asset_id is None, returns root assets"""
    if parent_asset_id is None:
        return await get_root_assets(session)
    return await get_child_assets(session, parent_asset_id)

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


async def get_all_transactions(session: AsyncSession) -> List[dict]:
    """Get all transactions (both Bitcoin and Stock) in a unified format, ordered by date (descending)"""
    btc_txs = await get_all_bitcoin_transactions(session)
    stock_txs = await get_all_stock_transactions(session)
    
    # Convert to unified format for backward compatibility with history calculations
    all_txs = []
    for btc_tx in btc_txs:
        all_txs.append({
            'id': btc_tx.id,
            'asset_id': btc_tx.asset_id,
            'transaction_date': btc_tx.transaction_date,
            'type': btc_tx.type,
            'ticker': 'BTC',
            'quantity': btc_tx.amount_btc,
            'total_amount': btc_tx.total_amount_eur,
            'currency': 'EUR',
            'exchange_rate': 1.0  # EUR is base, no exchange needed
        })
    
    for stock_tx in stock_txs:
        all_txs.append({
            'id': stock_tx.id,
            'asset_id': stock_tx.asset_id,
            'transaction_date': stock_tx.transaction_date,
            'type': stock_tx.type,
            'ticker': stock_tx.ticker,
            'quantity': stock_tx.quantity,
            'total_amount': stock_tx.total_amount,
            'currency': stock_tx.currency,
            'exchange_rate': stock_tx.exchange_rate_to_eur
        })
    
    # Sort by transaction_date descending
    all_txs.sort(key=lambda x: x['transaction_date'] if x['transaction_date'] else '', reverse=True)
    return all_txs

async def get_transactions_by_asset(session: AsyncSession, asset_id: str) -> List[dict]:
    """Get all transactions for an asset (both Bitcoin and Stock) in unified format"""
    btc_txs = await get_bitcoin_transactions_by_asset(session, asset_id)
    stock_txs = await get_stock_transactions_by_asset(session, asset_id)
    
    # Convert to unified format
    all_txs = []
    for btc_tx in btc_txs:
        all_txs.append({
            'id': btc_tx.id,
            'asset_id': btc_tx.asset_id,
            'transaction_date': btc_tx.transaction_date,
            'type': btc_tx.type,
            'ticker': 'BTC',
            'quantity': btc_tx.amount_btc,
            'total_amount': btc_tx.total_amount_eur,
            'currency': 'EUR',
            'exchange_rate': 1.0
        })
    
    for stock_tx in stock_txs:
        all_txs.append({
            'id': stock_tx.id,
            'asset_id': stock_tx.asset_id,
            'transaction_date': stock_tx.transaction_date,
            'type': stock_tx.type,
            'ticker': stock_tx.ticker,
            'quantity': stock_tx.quantity,
            'total_amount': stock_tx.total_amount,
            'currency': stock_tx.currency,
            'exchange_rate': stock_tx.exchange_rate_to_eur
        })
    
    # Sort by transaction_date descending
    all_txs.sort(key=lambda x: x['transaction_date'] if x['transaction_date'] else '', reverse=True)
    return all_txs

async def get_asset_holdings(session: AsyncSession, asset_id: str) -> dict:
    """Get stock holdings (quantities) by ticker for an asset"""
    statement = select(
        StockTransaction.ticker,
        func.sum(
            case(
                (func.upper(StockTransaction.type) == TransactionType.BUY.value, StockTransaction.quantity),
                (func.upper(StockTransaction.type) == TransactionType.SELL.value, -StockTransaction.quantity),
                else_=0
            )
        ).label('total_quantity')
    ).where(StockTransaction.asset_id == asset_id).group_by(StockTransaction.ticker)

    results = (await session.exec(statement)).all()
    return {ticker: float(qty) for ticker, qty in results if qty > 0.0001}

async def get_total_btc_holdings(session: AsyncSession, asset_id: str, to_date: Optional[Any] = None) -> float:
    """Get total Bitcoin holdings (in BTC) for an asset up to a specific date"""
    statement = select(
        func.sum(
            case(
                (func.upper(BitcoinTransaction.type) == TransactionType.BUY.value, BitcoinTransaction.amount_btc),
                (func.upper(BitcoinTransaction.type) == TransactionType.SELL.value, -BitcoinTransaction.amount_btc),
                else_=0
            )
        )
    ).where(BitcoinTransaction.asset_id == asset_id)
    
    if to_date:
        statement = statement.where(BitcoinTransaction.transaction_date <= to_date)
        
    result = (await session.exec(statement)).first()
    return float(result) if result else 0.0

async def get_asset_total_quantity(session: AsyncSession, asset_id: str, to_date: Optional[Any] = None) -> float:
    """Get total stock quantity for an asset up to a specific date"""
    statement = select(
        func.sum(
            case(
                (func.upper(StockTransaction.type) == TransactionType.BUY.value, StockTransaction.quantity),
                (func.upper(StockTransaction.type) == TransactionType.SELL.value, -StockTransaction.quantity),
                else_=0
            )
        )
    ).where(StockTransaction.asset_id == asset_id)
    
    if to_date:
        statement = statement.where(StockTransaction.transaction_date <= to_date)
        
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





async def upsert_history_from_transactions(session: AsyncSession, asset_id: str, month_date) -> None:
    """
    After saving a transaction, recalculate and upsert the asset_history entry
    for the corresponding month. This keeps contribution and participations in sync
    without touching the NAV/price data set during monthly syncs.
    
    Works with split bitcoin_transaction and stock_transaction tables.
    """
    from decimal import Decimal
    from datetime import date
    import uuid

    # month_date is the first day of the month of the transaction
    year = month_date.year
    month = month_date.month
    month_start = date(year, month, 1)

    # Next month start for range filter
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)

    # Get Bitcoin transactions for this asset in the month
    btc_txs = await get_bitcoin_transactions_by_asset(session, asset_id)
    month_btc_txs = [
        tx for tx in btc_txs
        if tx.transaction_date is not None
        and month_start <= tx.transaction_date < month_end
    ]

    # Get Stock transactions for this asset in the month
    stock_txs = await get_stock_transactions_by_asset(session, asset_id)
    month_stock_txs = [
        tx for tx in stock_txs
        if tx.transaction_date is not None
        and month_start <= tx.transaction_date < month_end
    ]

    # Sum contributions for the month (only BUY type transactions)
    monthly_contribution = Decimal("0.0")
    
    # Bitcoin contributions (already in EUR)
    for tx in month_btc_txs:
        if str(tx.type).upper() == 'BUY':
            amount = Decimal(str(tx.total_amount_eur or 0))
            monthly_contribution += amount

    # Stock contributions (may need currency conversion)
    for tx in month_stock_txs:
        if str(tx.type).upper() == 'BUY':
            amount = Decimal(str(tx.total_amount or 0))
            ex_rate = Decimal(str(tx.exchange_rate_to_eur or 1.0))
            if tx.currency == 'USD' or ex_rate != Decimal("1.0"):
                monthly_contribution += amount / ex_rate
            else:
                monthly_contribution += amount

    # Calculate running participations for the asset up to end of this month
    all_btc_txs = await get_bitcoin_transactions_by_asset(session, asset_id)
    all_btc_up_to_month = [
        tx for tx in all_btc_txs
        if tx.transaction_date is not None
        and tx.transaction_date < month_end
    ]

    all_stock_txs = await get_stock_transactions_by_asset(session, asset_id)
    all_stock_up_to_month = [
        tx for tx in all_stock_txs
        if tx.transaction_date is not None
        and tx.transaction_date < month_end
    ]

    running_qty = Decimal("0.0")
    
    # Bitcoin participations (in BTC)
    for tx in all_btc_up_to_month:
        qty = Decimal(str(tx.amount_btc or 0))
        if str(tx.type).upper() == 'BUY':
            running_qty += qty
        elif str(tx.type).upper() == 'SELL':
            running_qty -= qty

    # Stock participations (sum of all stock quantities)
    for tx in all_stock_up_to_month:
        qty = Decimal(str(tx.quantity or 0))
        if str(tx.type).upper() == 'BUY':
            running_qty += qty
        elif str(tx.type).upper() == 'SELL':
            running_qty -= qty

    running_qty = max(running_qty, Decimal("0.0"))

    # Get existing history entry for this month
    existing_all = await get_history_by_asset(session, asset_id)
    existing_list = [h for h in existing_all if h.snapshot_date == month_start]
    existing = existing_list[0] if existing_list else None

    if existing:
        existing.contribution = monthly_contribution
        existing.participations = running_qty
        session.add(existing)
        await session.commit()
    else:
        # No history entry for this month yet — create one with 0 NAV/price
        # (the NAV will be filled in on next NAV sync)
        new_entry = AssetHistory(
            id=str(uuid.uuid4()),
            asset_id=asset_id,
            snapshot_date=month_start,
            contribution=monthly_contribution,
            participations=running_qty,
            nav=Decimal("0.0"),
            liquid_nav_value=Decimal("0.0"),
            mean_cost=Decimal("0.0")
        )
        session.add(new_entry)
        await session.commit()


async def save_exchange_rate(session: AsyncSession, rate_date, pair: str, rate_value: float) -> None:
    """Save or update an exchange rate for a given date and currency pair."""
    from models import ExchangeRate
    from decimal import Decimal

    statement = select(ExchangeRate).where(
        ExchangeRate.date == rate_date,
        ExchangeRate.currency_pair == pair
    )
    existing = (await session.exec(statement)).first()

    if existing:
        existing.rate = Decimal(str(rate_value))
        session.add(existing)
    else:
        entry = ExchangeRate(
            date=rate_date,
            currency_pair=pair,
            rate=Decimal(str(rate_value))
        )
        session.add(entry)
    await session.commit()


async def get_latest_exchange_rate(session: AsyncSession, pair: str) -> float:
    """Get the latest exchange rate for a given currency pair."""
    from models import ExchangeRate

    statement = select(ExchangeRate).where(
        ExchangeRate.currency_pair == pair
    ).order_by(ExchangeRate.date.desc())
    result = (await session.exec(statement)).first()
    return float(result.rate) if result else 0.0


# ===== Bitcoin Transaction Methods =====

async def get_all_bitcoin_transactions(session: AsyncSession) -> List[BitcoinTransaction]:
    """Get all Bitcoin transactions ordered by date (descending)"""
    statement = select(BitcoinTransaction).order_by(BitcoinTransaction.transaction_date.desc())
    results = await session.exec(statement)
    return results.all()


async def get_bitcoin_transactions_by_asset(session: AsyncSession, asset_id: str) -> List[BitcoinTransaction]:
    """Get all Bitcoin transactions for a specific asset"""
    statement = select(BitcoinTransaction).where(
        BitcoinTransaction.asset_id == asset_id
    ).order_by(BitcoinTransaction.transaction_date.desc())
    results = await session.exec(statement)
    return results.all()


async def get_bitcoin_transaction_by_id(session: AsyncSession, transaction_id: str) -> Optional[BitcoinTransaction]:
    """Get a specific Bitcoin transaction by ID"""
    return await session.get(BitcoinTransaction, transaction_id)


async def create_bitcoin_transaction(session: AsyncSession, transaction: BitcoinTransaction) -> BitcoinTransaction:
    """Create a new Bitcoin transaction"""
    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)
    return transaction


async def update_bitcoin_transaction(session: AsyncSession, transaction_id: str, transaction_data: BitcoinTransaction) -> Optional[BitcoinTransaction]:
    """Update an existing Bitcoin transaction"""
    transaction = await session.get(BitcoinTransaction, transaction_id)
    if not transaction:
        return None

    update_data = transaction_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(transaction, key, value)

    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)
    return transaction


async def delete_bitcoin_transaction(session: AsyncSession, transaction_id: str) -> bool:
    """Delete a Bitcoin transaction"""
    transaction = await session.get(BitcoinTransaction, transaction_id)
    if not transaction:
        return False
    await session.delete(transaction)
    await session.commit()
    return True


# ===== Stock Transaction Methods =====

async def get_all_stock_transactions(session: AsyncSession) -> List[StockTransaction]:
    """Get all Stock transactions ordered by date (descending)"""
    statement = select(StockTransaction).order_by(StockTransaction.transaction_date.desc())
    results = await session.exec(statement)
    return results.all()


async def get_stock_transactions_by_asset(session: AsyncSession, asset_id: str) -> List[StockTransaction]:
    """Get all Stock transactions for a specific asset"""
    statement = select(StockTransaction).where(
        StockTransaction.asset_id == asset_id
    ).order_by(StockTransaction.transaction_date.desc())
    results = await session.exec(statement)
    return results.all()


async def get_stock_transactions_by_ticker(session: AsyncSession, ticker: str) -> List[StockTransaction]:
    """Get all Stock transactions for a specific ticker"""
    statement = select(StockTransaction).where(
        StockTransaction.ticker == ticker
    ).order_by(StockTransaction.transaction_date.desc())
    results = await session.exec(statement)
    return results.all()


async def get_stock_transaction_by_id(session: AsyncSession, transaction_id: str) -> Optional[StockTransaction]:
    """Get a specific Stock transaction by ID"""
    return await session.get(StockTransaction, transaction_id)


async def create_stock_transaction(session: AsyncSession, transaction: StockTransaction) -> StockTransaction:
    """Create a new Stock transaction"""
    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)
    return transaction


async def update_stock_transaction(session: AsyncSession, transaction_id: str, transaction_data: StockTransaction) -> Optional[StockTransaction]:
    """Update an existing Stock transaction"""
    transaction = await session.get(StockTransaction, transaction_id)
    if not transaction:
        return None

    update_data = transaction_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(transaction, key, value)

    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)
    return transaction


async def delete_stock_transaction(session: AsyncSession, transaction_id: str) -> bool:
    """Delete a Stock transaction"""
    transaction = await session.get(StockTransaction, transaction_id)
    if not transaction:
        return False
    await session.delete(transaction)
    await session.commit()
    return True


