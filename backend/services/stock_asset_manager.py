"""
Stock Asset Manager Service
Handles creation and lookup of real Stock Assets to replace fake asset IDs
"""

import logging
import uuid
from typing import Optional, Dict
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from models import Asset, Transaction, AssetCategory
from services import db_service

logger = logging.getLogger(__name__)


async def get_or_create_stock_asset(
    session: AsyncSession, 
    ticker: str, 
    broker_id: str,
    asset_name: Optional[str] = None
) -> str:
    """
    Get or create a Stock Asset for a given ticker.
    
    This ensures that each stock ticker has a real Asset record (not a fake ID)
    that can be properly referenced via foreign key in asset_history.
    
    Args:
        session: Database session
        ticker: Stock ticker symbol (e.g., "AAPL", "GOOGL")
        broker_id: The parent asset_id of the broker/account holding this stock
        asset_name: Optional name for the asset (defaults to ticker)
    
    Returns:
        The asset_id of the Stock Asset (newly created or existing)
    """
    if not ticker or not broker_id:
        logger.error(f"❌ Invalid input: ticker={ticker}, broker_id={broker_id}")
        raise ValueError("ticker and broker_id are required")
    
    ticker = ticker.upper().strip()
    
    # Try to find existing Stock asset by ticker and category
    # Search by ticker field and asset_type
    statement = select(Asset).where(
        Asset.ticker == ticker,
        Asset.category == AssetCategory.STOCK.value,
        Asset.parent_asset_id == broker_id
    )
    existing_asset = (await session.exec(statement)).first()
    
    if existing_asset:
        logger.debug(f"✓ Stock asset found for {ticker}: {existing_asset.id}")
        return existing_asset.id
    
    # Alternative: search by name pattern if ticker field not reliable
    statement_by_name = select(Asset).where(
        Asset.name == ticker,
        Asset.category == AssetCategory.STOCK.value,
        Asset.parent_asset_id == broker_id
    )
    existing_by_name = (await session.exec(statement_by_name)).first()
    
    if existing_by_name:
        logger.debug(f"✓ Stock asset found by name for {ticker}: {existing_by_name.id}")
        return existing_by_name.id
    
    # Create new Stock Asset
    new_asset_id = f"stock-{ticker}-{str(uuid.uuid4())[:8]}"
    asset_name = asset_name or f"Stock {ticker}"
    
    new_asset = Asset(
        id=new_asset_id,
        name=asset_name,
        ticker=ticker,
        category=AssetCategory.STOCK.value,
        currency="USD",  # Stock prices in USD; conversion happens at history level
        parent_asset_id=broker_id,
        is_archived=False,
        description=f"Stock ticker {ticker} held at broker {broker_id}"
    )
    
    try:
        created_asset = await db_service.create_asset(session, new_asset)
        logger.info(f"✅ Created new Stock Asset: {ticker} (id: {created_asset.id})")
        return created_asset.id
    except Exception as e:
        logger.error(f"❌ Failed to create stock asset for {ticker}: {str(e)}")
        raise


async def ensure_all_transaction_tickers_exist(
    session: AsyncSession,
    broker_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Ensure all stock transactions have corresponding real Stock Assets.
    
    Scans the transaction table for any tickers that don't have a real Asset
    and creates those assets.
    
    Args:
        session: Database session
        broker_id: Optional filter - only process transactions for a specific broker.
                  If None, processes all unique tickers.
    
    Returns:
        Dictionary mapping ticker → asset_id for assets created/verified
    """
    logger.info("🔄 Ensuring all transaction tickers have real Stock Assets...")
    
    # Get all stock transactions with tickers (from dedicated table)
    all_txns = await db_service.get_all_stock_transactions(session)
    
    # Filter by broker if specified
    txns_to_process = [
        t for t in all_txns 
        if t.ticker and (broker_id is None or t.asset_id == broker_id)
    ]
    
    if not txns_to_process:
        logger.info("✓ No stock transactions with tickers found")
        return {}
    
    # Get unique tickers and their corresponding broker assets
    ticker_broker_map = {}
    for txn in txns_to_process:
        ticker = txn.ticker.upper().strip()
        if ticker not in ticker_broker_map:
            # The asset_id in the transaction is the broker
            ticker_broker_map[ticker] = txn.asset_id
    
    logger.info(f"📋 Found {len(ticker_broker_map)} unique tickers to process")
    
    result_map = {}
    
    # Create or retrieve asset for each ticker
    for ticker, broker_asset_id in ticker_broker_map.items():
        if not broker_asset_id:
            logger.warning(f"⚠️ Transaction for {ticker} has no broker_id (asset_id), skipping")
            continue
        
        try:
            asset_id = await get_or_create_stock_asset(
                session,
                ticker=ticker,
                broker_id=broker_asset_id
            )
            result_map[ticker] = asset_id
        except Exception as e:
            logger.error(f"❌ Failed to create asset for {ticker}: {str(e)}")
            continue
    
    logger.info(f"✅ Processed {len(result_map)} stock tickers, created/verified {len(result_map)} assets")
    return result_map


async def get_ticker_to_asset_mapping(
    session: AsyncSession,
    ticker_list: Optional[list] = None
) -> Dict[str, str]:
    """
    Get mapping of tickers to their real Stock Asset IDs.
    
    Args:
        session: Database session
        ticker_list: Optional list of tickers to filter by. If None, returns all stock assets.
    
    Returns:
        Dictionary mapping ticker → asset_id
    """
    statement = select(Asset).where(
        Asset.category == AssetCategory.STOCK.value
    )
    
    if ticker_list:
        # Make all tickers uppercase for comparison
        ticker_list_upper = [t.upper() for t in ticker_list]
        statement = statement.where(Asset.ticker.in_(ticker_list_upper))
    
    results = (await session.exec(statement)).all()
    
    mapping = {
        asset.ticker: asset.id 
        for asset in results 
        if asset.ticker
    }
    
    logger.debug(f"Retrieved mapping for {len(mapping)} tickers")
    return mapping
