"""
Database service for WealthHub using SQLModel.
Provides methods to interact with the PostgreSQL database.
"""

import logging
from typing import List, Optional, Dict, Any
from sqlmodel import Session, select, SQLModel, create_engine, delete
from datetime import datetime

from config import settings
from db_models import DBAsset, DBHistoryEntry, DBBitcoinTransaction, DBStockTransaction, DBStockHistory
from models import PriceData
from utils import merge_price_updates, format_datetime_iso

logger = logging.getLogger(__name__)

# Fallback to sqlite for local dev if DATABASE_URL is not provided
db_url = getattr(settings, "DATABASE_URL", None) or "sqlite:///./wealthhub.db"
engine = create_engine(db_url)

def create_db_and_tables():
    """Create database tables"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Yield database session"""
    with Session(engine) as session:
        yield session

async def load_assets_from_db(session: Session) -> List[dict]:
    """Load assets from database, returning a list of dicts for backward compatibility"""
    try:
        assets = session.exec(select(DBAsset)).all()
        return [asset.model_dump() for asset in assets]
    except Exception as e:
        logger.error(f"❌ Error loading assets from db: {str(e)}")
        return []

async def load_data_from_db(session: Session) -> dict:
    """Load all data structures from database to mimic old GAS format"""
    try:
        assets = session.exec(select(DBAsset)).all()
        history = session.exec(select(DBHistoryEntry)).all()
        btc_txs = session.exec(select(DBBitcoinTransaction)).all()
        stock_txs = session.exec(select(DBStockTransaction)).all()
        stock_history = session.exec(select(DBStockHistory)).all()

        return {
            "assets": [a.model_dump() for a in assets],
            "history": [h.model_dump() for h in history],
            "bitcoinTransactions": [b.model_dump() for b in btc_txs],
            "stockTransactions": [s.model_dump() for s in stock_txs],
            "stockHistory": [sh.model_dump() for sh in stock_history]
        }
    except Exception as e:
        logger.error(f"❌ Error loading data from db: {str(e)}")
        return {}

async def save_data_to_db(session: Session, data: dict) -> bool:
    """Save all data directly from frontend (assets, history, txs)"""
    try:
        session.exec(delete(DBStockHistory))
        session.exec(delete(DBStockTransaction))
        session.exec(delete(DBBitcoinTransaction))
        session.exec(delete(DBHistoryEntry))
        session.exec(delete(DBAsset))

        if "assets" in data:
            for a in data["assets"]:
                a_dict = a.copy()
                if "componentTickers" in a_dict: del a_dict["componentTickers"]
                if "participations" not in a_dict: a_dict["participations"] = 0.0
                if "meanCost" not in a_dict: a_dict["meanCost"] = 0.0
                session.add(DBAsset(**a_dict))

        seen_history_ids = set()
        stock_history_added = set()

        if "history" in data:
            for h in data["history"]:
                h_dict = h.copy()
                hid = h_dict.get("id")
                asset_id = str(h_dict.get("assetId", ""))
                
                # --- NUEVO: Separar los tickers a su propia tabla DBStockHistory ---
                if asset_id.startswith("ticker-"):
                    ticker_name = asset_id.replace("ticker-", "")
                    sh_id = hid or f"{ticker_name}-{h_dict.get('month')}"
                    
                    if sh_id not in stock_history_added:
                        session.add(DBStockHistory(
                            id=sh_id,
                            month=h_dict.get("month", ""),
                            ticker=ticker_name,
                            price=float(h_dict.get("nav", 0.0)),
                            currency="EUR"
                        ))
                        stock_history_added.add(sh_id)
                    continue

                # Historial de activos normal
                if hid:
                    if hid in seen_history_ids:
                        continue
                    seen_history_ids.add(hid)
                    
                if "source" in h_dict: del h_dict["source"]
                if "date" in h_dict: del h_dict["date"]
                if "participations" not in h_dict: h_dict["participations"] = 0.0
                if "liquidNavValue" not in h_dict: h_dict["liquidNavValue"] = 0.0
                if "nav" not in h_dict: h_dict["nav"] = 0.0
                if "contribution" not in h_dict: h_dict["contribution"] = 0.0
                if "meanCost" not in h_dict: h_dict["meanCost"] = 0.0
                
                session.add(DBHistoryEntry(**h_dict))

        # Por si en el futuro el frontend envía stockHistory por separado
        if "stockHistory" in data:
            for sh in data["stockHistory"]:
                if sh.get("id") not in stock_history_added:
                    session.add(DBStockHistory(**sh))
                    stock_history_added.add(sh.get("id"))

        if "bitcoinTransactions" in data:
            for b in data["bitcoinTransactions"]:
                session.add(DBBitcoinTransaction(**b))

        if "stockTransactions" in data:
            for s in data["stockTransactions"]:
                session.add(DBStockTransaction(**s))

        session.commit()
        logger.info("✅ Data saved to DB successfully")
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"❌ Error saving data to db: {str(e)}")
        return False

async def persist_prices_to_db(
    session: Session, prices: List[PriceData], year: Optional[int] = None, month: Optional[int] = None, fetch_date: Optional[datetime] = None
) -> bool:
    try:
        logger.info(f"📤 Persisting {len(prices)} prices to DB")
        month_str = f"{year:04d}-{month:02d}" if year and month else datetime.now().strftime("%Y-%m")

        history_entries = []
        stock_entries = []

        for price in prices:
            # Separamos las acciones individuales para su propia tabla
            if price.assetId and price.assetId.startswith("ticker-"):
                stock_entries.append({
                    "id": f"{price.ticker}-{month_str}",
                    "month": month_str,
                    "ticker": price.ticker,
                    "price": float(price.price),
                    "currency": price.currency or "EUR"
                })
            else:
                # Datos principales de activos (incluyendo el total del broker)
                history_entries.append({
                    "month": month_str,
                    "assetId": price.assetId,
                    "nav": float(price.price),
                    # ¡LÍNEA ELIMINADA! Ya NO sobreescribimos la aportación
                    "source": price.source,
                    "date": price.fetchedAt
                })

        current_data = await load_data_from_db(session)

        if current_data:
            existing_history = current_data.get("history", [])
            merged_history = merge_price_updates(existing_history, history_entries)

            # Update history in DB
            for entry in merged_history:
                # check if exists
                stmt = select(DBHistoryEntry).where(
                    DBHistoryEntry.assetId == entry.get("assetId"),
                    DBHistoryEntry.month == entry.get("month")
                )
                existing = session.exec(stmt).first()

                if existing:
                    # update
                    if "nav" in entry: existing.nav = float(entry["nav"])
                    if "contribution" in entry: existing.contribution = float(entry["contribution"])
                    # add other fields as necessary based on what merge_price_updates outputs
                    if "participations" in entry: existing.participations = float(entry["participations"])
                    if "liquidNavValue" in entry: existing.liquidNavValue = float(entry["liquidNavValue"])
                    if "meanCost" in entry: existing.meanCost = float(entry["meanCost"])
                    session.add(existing)
                else:
                    # insert
                    new_entry = DBHistoryEntry(
                        id=entry.get("id", f"{entry.get('assetId')}-{entry.get('month')}"),
                        month=entry.get("month"),
                        assetId=entry.get("assetId"),
                        participations=entry.get("participations", 0.0),
                        liquidNavValue=entry.get("liquidNavValue", 0.0),
                        nav=entry.get("nav", 0.0),
                        contribution=entry.get("contribution", 0.0),
                        meanCost=entry.get("meanCost", 0.0)
                    )
                    session.add(new_entry)

        for new_stock in stock_entries:
            stmt = select(DBStockHistory).where(
                DBStockHistory.ticker == new_stock["ticker"],
                DBStockHistory.month == new_stock["month"]
            )
            existing_stock = session.exec(stmt).first()
            if existing_stock:
                existing_stock.price = new_stock["price"]
                existing_stock.currency = new_stock["currency"]
                session.add(existing_stock)
            else:
                session.add(DBStockHistory(**new_stock))

        session.commit()
        logger.info("✅ Prices persisted to DB")
        return True

    except Exception as e:
        session.rollback()
        logger.error(f"❌ Error persisting prices to DB: {str(e)}")
        return False
