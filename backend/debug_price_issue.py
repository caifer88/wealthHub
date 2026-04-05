#!/usr/bin/env python3
"""
Debug script to diagnose the price fetching issue.
Checks:
1. Stock transactions in database
2. Asset mappings (ticker → asset_id)
3. Asset history entries and their liquid_nav_value
4. Why current_price_usd might be None or wrong
"""

import asyncio
import logging
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy.ext.asyncio import create_async_engine
from database import engine
from models import StockTransaction, Asset, HistoryEntry as AssetHistory, AssetCategory
from services.stock_asset_manager import get_ticker_to_asset_mapping

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


async def debug_stock_prices():
    """Diagnose the stock price issue"""
    
    async with AsyncSession(engine) as session:
        print("\n" + "="*80)
        print("🔍 STOCK PRICE FETCH DIAGNOSIS")
        print("="*80)
        
        # 1. Check stock transactions
        print("\n1️⃣  STOCK TRANSACTIONS")
        print("-" * 80)
        stmt = select(StockTransaction).order_by(StockTransaction.transaction_date.desc())
        results = await session.exec(stmt)
        transactions = results.all()
        
        print(f"   Total transactions: {len(transactions)}")
        
        # Group by ticker
        by_ticker = {}
        for txn in transactions:
            ticker = txn.ticker.upper() if txn.ticker else "UNKNOWN"
            if ticker not in by_ticker:
                by_ticker[ticker] = []
            by_ticker[ticker].append(txn)
        
        print(f"   Unique tickers: {len(by_ticker)}")
        for ticker in sorted(by_ticker.keys()):
            txns = by_ticker[ticker]
            print(f"     • {ticker}: {len(txns)} transactions")
            for txn in txns[:2]:  # Show first 2
                print(f"       - {txn.transaction_date}: {txn.type} {txn.quantity} @ ${txn.price_per_unit}")
        
        # 2. Check asset mappings
        print("\n2️⃣  ASSET MAPPINGS (Ticker → Asset ID)")
        print("-" * 80)
        
        ticker_asset_map = await get_ticker_to_asset_mapping(session)
        print(f"   Total mappings: {len(ticker_asset_map)}")
        
        for ticker, asset_id in sorted(ticker_asset_map.items()):
            print(f"     • {ticker} → {asset_id}")
        
        # 3. Check all STOCK assets in database
        print("\n3️⃣  ALL STOCK ASSETS IN DATABASE")
        print("-" * 80)
        
        stmt = select(Asset).where(
            Asset.category == AssetCategory.STOCK.value
        ).order_by(Asset.ticker)
        results = await session.exec(stmt)
        stock_assets = results.all()
        
        print(f"   Total STOCK assets: {len(stock_assets)}")
        for asset in stock_assets:
            print(f"     • {asset.ticker:8} ({asset.id:30}) - {asset.name}")
        
        # 4. Check asset_history entries for stock assets
        print("\n4️⃣  ASSET HISTORY ENTRIES (Prices)")
        print("-" * 80)
        
        for ticker, asset_id in sorted(ticker_asset_map.items()):
            print(f"\n   {ticker} (asset_id: {asset_id})")
            
            stmt = select(AssetHistory).where(
                AssetHistory.asset_id == asset_id
            ).order_by(AssetHistory.snapshot_date.desc())
            
            results = await session.exec(stmt)
            history_entries = results.all()
            
            if not history_entries:
                print(f"     ❌ NO HISTORY ENTRIES FOUND")
            else:
                print(f"     ✓ Found {len(history_entries)} entries")
                for entry in history_entries[:3]:  # Show last 3
                    nav_val = entry.liquid_nav_value
                    print(f"       • {entry.snapshot_date}: nav={entry.nav}, liquid_nav_value={nav_val}")
                    
                    # Check if liquid_nav_value would pass the filter in get_latest_stock_price_usd
                    if nav_val is None:
                        print(f"         ⚠️  liquid_nav_value is None → will use fallback!")
                    elif float(nav_val) <= 0:
                        print(f"         ⚠️  liquid_nav_value <= 0 → will use fallback!")
                    else:
                        price = float(nav_val)
                        print(f"         ✓ Price: ${price:.2f} USD")
        
        # 5. Verify mismatches
        print("\n5️⃣  MISMATCH CHECK")
        print("-" * 80)
        
        # Tickers in transactions but not in asset mapping
        txn_tickers = set(by_ticker.keys()) - set(ticker_asset_map.keys())
        if txn_tickers:
            print(f"   ⚠️  Tickers in transactions but NO asset mapping:")
            for ticker in txn_tickers:
                print(f"     • {ticker}")
        
        # Asset IDs in asset mapping but no history entries
        for ticker, asset_id in sorted(ticker_asset_map.items()):
            stmt = select(AssetHistory).where(
                AssetHistory.asset_id == asset_id
            )
            results = await session.exec(stmt)
            history_count = len(results.all())
            
            if history_count == 0:
                print(f"   ⚠️  {ticker} ({asset_id}): NO history entries in asset_history")


if __name__ == "__main__":
    asyncio.run(debug_stock_prices())
