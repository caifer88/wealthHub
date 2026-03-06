import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from sqlmodel import SQLModel, Session, create_engine, select
from starlette.concurrency import run_in_threadpool

from config import settings
from db_models import DBAsset, DBHistoryEntry
from models import PriceData

logger = logging.getLogger(__name__)

# Setup database engine
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)

def init_db():
    """Initialize database tables"""
    logger.info(f"🗄️ Initializing database at {settings.DATABASE_URL}")
    SQLModel.metadata.create_all(engine)

def _load_assets_sync() -> List[dict]:
    with Session(engine) as session:
        assets = session.exec(select(DBAsset)).all()

        result = []
        for a in assets:
            asset_dict = {
                "id": a.id,
                "name": a.name,
                "category": a.category,
                "color": a.color,
                "archived": a.archived,
                "riskLevel": a.riskLevel,
                "isin": a.isin,
                "ticker": a.ticker,
                "participations": float(a.participations),
                "meanCost": float(a.meanCost),
            }

            if a.componentTickers:
                try:
                    asset_dict["componentTickers"] = json.loads(a.componentTickers)
                except:
                    asset_dict["componentTickers"] = [t.strip() for t in a.componentTickers.split(",")]

            result.append(asset_dict)

        return result

async def load_assets_from_db() -> List[dict]:
    """
    Load all assets from database and format them like the GAS response.
    Returns a list of dicts to maintain compatibility with existing API.
    """
    try:
        result = await run_in_threadpool(_load_assets_sync)
        logger.info(f"✅ Loaded {len(result)} assets from DB")
        return result

    except Exception as e:
        logger.error(f"❌ Error loading assets from DB: {str(e)}")
        return []

def _persist_prices_sync(
    prices: List[PriceData],
    month_str: str
) -> None:
    with Session(engine) as session:
        for price in prices:
            statement = select(DBHistoryEntry).where(
                DBHistoryEntry.month == month_str,
                DBHistoryEntry.assetId == price.assetId
            )
            existing_entry = session.exec(statement).first()

            if existing_entry:
                existing_entry.nav = float(price.price)
                existing_entry.source = price.source
                existing_entry.date = price.fetchedAt
                session.add(existing_entry)
            else:
                new_entry = DBHistoryEntry(
                    month=month_str,
                    assetId=price.assetId,
                    nav=float(price.price),
                    contribution=float(price.price),
                    source=price.source,
                    date=price.fetchedAt
                )
                session.add(new_entry)

        session.commit()

async def persist_prices_to_db(
    prices: List[PriceData],
    year: Optional[int] = None,
    month: Optional[int] = None,
    fetch_date: Optional[datetime] = None
) -> bool:
    """
    Persist prices to the database.
    Updates existing entries for the same month and asset, or creates new ones.
    """
    try:
        logger.info(f"📤 Persisting {len(prices)} prices to DB")

        month_str = f"{year:04d}-{month:02d}" if year and month else datetime.now().strftime("%Y-%m")

        await run_in_threadpool(_persist_prices_sync, prices, month_str)

        logger.info("✅ Prices persisted to DB")
        return True

    except Exception as e:
        logger.error(f"❌ Error persisting prices to DB: {str(e)}")
        return False

def _load_history_sync() -> List[dict]:
    with Session(engine) as session:
        history_entries = session.exec(select(DBHistoryEntry)).all()
        return [
            {
                "month": h.month,
                "assetId": h.assetId,
                "nav": h.nav,
                "contribution": h.contribution,
                "source": h.source,
                "date": h.date
            }
            for h in history_entries
        ]

async def load_data_from_db() -> dict:
    """
    Load full data structure from database to emulate GAS `load_data_from_gas`.
    Returns a dict with 'assets' and 'history'.
    (stockTransactions might need a separate table if fully migrated, but we mock it for now
    or return empty to let the fallback strategy handle it if they aren't migrated)
    """
    try:
        history = await run_in_threadpool(_load_history_sync)
        assets = await load_assets_from_db()

        return {
            "assets": assets,
            "history": history,
            "stockTransactions": [] # Add a DB table for this later if needed
        }

    except Exception as e:
        logger.error(f"Error loading data from DB: {str(e)}")
        return {}