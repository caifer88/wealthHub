"""
Stock Portfolio Service
Calculates consolidated stock portfolio metrics - single source of truth
"""

import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from decimal import Decimal
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func

from models import (
    StockTransaction,
    HistoryEntry as AssetHistory,
    StockMetricsDTO, 
    StockPortfolioSummaryDTO,
    ExchangeRate,
    AssetCategory
)
from services import db_service
from services.stock_asset_manager import get_ticker_to_asset_mapping

logger = logging.getLogger(__name__)


async def get_stock_portfolio_summary(session: AsyncSession) -> StockPortfolioSummaryDTO:
    """
    Calculate consolidated stock portfolio summary.
    
    This is the single source of truth for portfolio metrics.
    
    Returns:
        StockPortfolioSummaryDTO with complete portfolio overview
    """
    logger.info("📊 Calculating stock portfolio summary...")
    
    try:
        # Get all stock transactions (now from dedicated table)
        stock_txns = await db_service.get_all_stock_transactions(session)
        
        if not stock_txns:
            logger.info("📭 No stock transactions found")
            return StockPortfolioSummaryDTO(
                total_value_eur=0.0,
                total_invested_eur=0.0,
                total_unrealized_gain_eur=0.0,
                total_unrealized_gain_percent=0.0,
                exchange_rate_eur_usd=1.1,
                last_update=datetime.now().isoformat(),
                number_of_tickers=0,
                tickers=[]
            )
        
        # Get latest EUR/USD rate
        eur_usd_rate = await db_service.get_latest_exchange_rate(session, "EUR/USD")
        if not eur_usd_rate or eur_usd_rate <= 0:
            eur_usd_rate = 1.1
            logger.warning(f"⚠️ Using fallback EUR/USD rate: {eur_usd_rate}")
        else:
            logger.info(f"💱 EUR/USD rate: {eur_usd_rate:.4f}")
        
        # Get ticker to asset_id mapping (real Stock Assets)
        ticker_asset_map = await get_ticker_to_asset_mapping(session)
        logger.debug(f"📋 Loaded mapping for {len(ticker_asset_map)} stock tickers")
        
        # Aggregate transactions by ticker
        ticker_transactions: Dict[str, List] = {}
        for txn in stock_txns:
            ticker = txn.ticker.upper() if txn.ticker else None
            if not ticker:
                continue
            if ticker not in ticker_transactions:
                ticker_transactions[ticker] = []
            ticker_transactions[ticker].append(txn)
        
        logger.info(f"📈 Processing {len(ticker_transactions)} unique stock tickers")
        
        # Calculate metrics per ticker
        stock_metrics_list: List[StockMetricsDTO] = []
        total_value_eur = 0.0
        total_invested_eur = 0.0
        
        for ticker, txns in ticker_transactions.items():
            try:
                metrics = await calculate_stock_metrics(
                    session,
                    ticker,
                    txns,
                    eur_usd_rate,
                    ticker_asset_map
                )
                stock_metrics_list.append(metrics)
                total_value_eur += metrics.current_value_eur
                total_invested_eur += metrics.cost_basis_eur
                logger.info(f"Ticker: {metrics.ticker} | Coste: {metrics.average_price_usd} | Precio Mercado: {metrics.current_price_usd}")
                
            except Exception as e:
                logger.error(f"❌ Error calculating metrics for {ticker}: {str(e)}")
                continue
        
        # Calculate summary totals
        total_unrealized_gain_eur = total_value_eur - total_invested_eur
        total_unrealized_gain_percent = 0.0
        
        if total_invested_eur > 0:
            total_unrealized_gain_percent = (total_unrealized_gain_eur / total_invested_eur) * 100
        
        logger.info(f"✅ Portfolio summary:")
        logger.info(f"   Total value (EUR): €{total_value_eur:,.2f}")
        logger.info(f"   Total invested (EUR): €{total_invested_eur:,.2f}")
        logger.info(f"   Unrealized gain (EUR): €{total_unrealized_gain_eur:,.2f} ({total_unrealized_gain_percent:.2f}%)")
        logger.info(f"   Holdings: {len(stock_metrics_list)} tickers")
        
        # Sort by current value descending
        stock_metrics_list.sort(key=lambda m: m.current_value_eur, reverse=True)
        
        return StockPortfolioSummaryDTO(
            total_value_eur=round(total_value_eur, 2),
            total_invested_eur=round(total_invested_eur, 2),
            total_unrealized_gain_eur=round(total_unrealized_gain_eur, 2),
            total_unrealized_gain_percent=round(total_unrealized_gain_percent, 2),
            exchange_rate_eur_usd=eur_usd_rate,
            last_update=datetime.now().isoformat(),
            number_of_tickers=len(stock_metrics_list),
            tickers=stock_metrics_list
        )
        
    except Exception as e:
        logger.error(f"❌ Error calculating portfolio summary: {str(e)}", exc_info=True)
        raise


async def calculate_stock_metrics(
    session: AsyncSession,
    ticker: str,
    transactions: List[StockTransaction],
    eur_usd_rate: float,
    ticker_asset_map: Dict[str, str]
) -> StockMetricsDTO:
    """
    Calculate metrics for a single stock ticker.
    
    Args:
        session: Database session
        ticker: Stock ticker symbol
        transactions: List of buy/sell transactions for this ticker
        eur_usd_rate: Exchange rate to use for USD→EUR conversion
        ticker_asset_map: Mapping of ticker → asset_id
    
    Returns:
        StockMetricsDTO with calculated metrics for this holding
    """
    # Aggregate BUY and SELL quantities
    total_shares = 0.0
    total_cost_usd = 0.0
    last_transaction_date = None
    
    for txn in sorted(transactions, key=lambda t: t.transaction_date):
        quantity = float(txn.quantity) if txn.quantity else 0.0
        price_per_unit = float(txn.price_per_unit) if txn.price_per_unit else 0.0
        
        # Use transaction exchange rate to convert to original USD cost
        txn_eur_to_usd = float(txn.exchange_rate_eur_usd) if txn.exchange_rate_eur_usd else 1.0
        
        if txn.type and txn.type.upper() == "BUY":
            # USD cost = quantity × price_per_unit (price already in USD)
            cost = quantity * price_per_unit
            # Add fees (assumes fees are in EUR, convert to USD)
            fees = float(txn.fees) if txn.fees else 0.0
            fees_usd = fees * txn_eur_to_usd
            
            total_cost_usd += cost + fees_usd
            total_shares += quantity
            
        elif txn.type and txn.type.upper() == "SELL":
            total_shares -= quantity
            # Remove proportional cost basis on sale
            if total_shares >= 0 and quantity > 0:
                cost = quantity * price_per_unit
                # Proportional cost reduction
                if total_shares + quantity > 0:  # Had shares before this sale
                    proportion = quantity / (total_shares + quantity)
                    total_cost_usd *= (1 - proportion)
        
        last_transaction_date = txn.transaction_date
    
    # Only return metrics if there are positive holdings
    if total_shares <= 0.0001:
        logger.warning(f"⚠️ No active holdings for {ticker}")
        return StockMetricsDTO(
            ticker=ticker,
            shares=0.0,
            cost_basis_eur=0.0,
            cost_basis_usd=0.0,
            average_price_usd=0.0,
            current_price_usd=0.0,
            current_price_eur=0.0,
            current_value_eur=0.0,
            unrealized_gain_eur=0.0,
            unrealized_gain_usd=0.0,
            unrealized_gain_percent=0.0
        )
    
    # Calculate weighted average price
    average_price_usd = total_cost_usd / total_shares if total_shares > 0 else 0.0
    
    # Get latest price from asset_history using real asset_id
    # NOTE: liquid_nav_value is stored in EUR (monthly_fetch_service converts USD→EUR before saving)
    ticker_upper = ticker.upper()
    current_price_eur = await get_latest_stock_price_eur(
        session,
        ticker_upper,
        ticker_asset_map
    )

    # Fallback: derive EUR price from cost basis if no history
    cost_basis_eur = total_cost_usd / eur_usd_rate if eur_usd_rate > 0 else total_cost_usd
    average_price_eur = average_price_usd / eur_usd_rate if eur_usd_rate > 0 else average_price_usd

    if current_price_eur is None:
        logger.warning(f"⚠️ No current price found for {ticker}, using cost basis as proxy")
        current_price_eur = average_price_eur

    # USD equivalents (for display only — price history is stored in EUR)
    current_price_usd = current_price_eur * eur_usd_rate if eur_usd_rate > 0 else current_price_eur
    current_value_eur = total_shares * current_price_eur
    current_value_usd = current_value_eur * eur_usd_rate if eur_usd_rate > 0 else current_value_eur

    # Calculate gains
    unrealized_gain_usd = current_value_usd - total_cost_usd
    unrealized_gain_eur = current_value_eur - cost_basis_eur
    unrealized_gain_percent = 0.0
    
    if cost_basis_eur > 0.01:  # Avoid division by zero
        unrealized_gain_percent = (unrealized_gain_eur / cost_basis_eur) * 100
    
    logger.debug(
        f"✓ {ticker}: {total_shares:.4f} shares @ ${average_price_usd:.2f}"
        f" → €{cost_basis_eur:,.2f} invested"
        f" → €{current_value_eur:,.2f} current"
        f" → €{unrealized_gain_eur:,.2f} gain ({unrealized_gain_percent:+.2f}%)"
    )
    
    return StockMetricsDTO(
        ticker=ticker,
        shares=round(total_shares, 8),
        cost_basis_eur=round(cost_basis_eur, 2),
        cost_basis_usd=round(total_cost_usd, 2),
        average_price_usd=round(average_price_usd, 2),
        current_price_usd=round(current_price_usd, 2),
        current_price_eur=round(current_price_eur, 2),
        current_value_eur=round(current_value_eur, 2),
        unrealized_gain_eur=round(unrealized_gain_eur, 2),
        unrealized_gain_usd=round(unrealized_gain_usd, 2),
        unrealized_gain_percent=round(unrealized_gain_percent, 2),
        last_price_update=None  # Will be set if we get historical data
    )


async def get_latest_stock_price_eur(
    session: AsyncSession,
    ticker: str,
    ticker_asset_map: Dict[str, str]
) -> Optional[float]:
    """
    Get the latest price for a stock ticker in EUR.

    NOTE: monthly_fetch_service converts USD→EUR before storing in liquid_nav_value,
    so the value stored is already in EUR — NOT USD.

    Args:
        session: Database session
        ticker: Stock ticker (uppercase)
        ticker_asset_map: Mapping of ticker → asset_id

    Returns:
        Latest price in EUR, or None if not found
    """
    asset_id = ticker_asset_map.get(ticker)

    if not asset_id:
        logger.warning(f"⚠️ No real asset found for ticker {ticker}")
        return None

    try:
        statement = select(AssetHistory).where(
            AssetHistory.asset_id == asset_id
        ).order_by(AssetHistory.snapshot_date.desc())

        result = (await session.exec(statement)).first()

        if result and result.liquid_nav_value and result.liquid_nav_value > 0:
            # liquid_nav_value is stored in EUR (converted from USD by monthly_fetch_service)
            price_eur = float(result.liquid_nav_value)
            logger.debug(f"✓ Latest price for {ticker}: €{price_eur:.2f} (from {result.snapshot_date})")
            return price_eur

    except Exception as e:
        logger.debug(f"⚠️ Error fetching latest price for {ticker}: {str(e)}")

    return None


async def get_stock_allocation(
    session: AsyncSession
) -> Dict[str, float]:
    """
    Get allocation percentages by ticker (contribution to total portfolio value).
    
    Returns:
        Dict mapping ticker → allocation_percentage
    """
    try:
        summary = await get_stock_portfolio_summary(session)
        
        if summary.total_value_eur <= 0.01:
            return {}
        
        allocation = {}
        for metrics in summary.tickers:
            percentage = (metrics.current_value_eur / summary.total_value_eur) * 100
            allocation[metrics.ticker] = round(percentage, 2)
        
        return allocation
        
    except Exception as e:
        logger.error(f"❌ Error calculating allocation: {str(e)}")
        return {}
