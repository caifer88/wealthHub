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
    """
    Persist prices to DB.
    Updates existing entries calculating participations and NAV correctly.
    """
    try:
        logger.info(f"📤 Persisting {len(prices)} prices to DB")
        month_str = f"{year:04d}-{month:02d}" if year and month else datetime.now().strftime("%Y-%m")

        # 1. Cargamos todos los datos ANTES para poder hacer los cálculos
        current_data = await load_data_from_db(session)
        assets_list = current_data.get("assets", [])
        btc_txs = current_data.get("bitcoinTransactions", [])
        existing_history = current_data.get("history", [])

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
                # 2. Identificar el tipo de activo
                asset_info = next((a for a in assets_list if a.get("id") == price.assetId), {})
                category = asset_info.get("category", "")

                # 3. Buscar historial actual o el último conocido para no perder datos
                existing_entry = next((h for h in existing_history if h.get("assetId") == price.assetId and h.get("month") == month_str), None)
                if not existing_entry:
                    past_entries = [h for h in existing_history if h.get("assetId") == price.assetId and h.get("month", "") < month_str]
                    last_entry = sorted(past_entries, key=lambda x: x.get("month", ""))[-1] if past_entries else {}
                else:
                    last_entry = existing_entry

                participations = float(last_entry.get("participations", 0.0))

                # 4. CÁLCULO EXACTO PARA BITCOIN: Sumar transacciones hasta la fecha
                if category == "Crypto":
                    participations = 0.0
                    for tx in btc_txs:
                        if tx.get("date", "")[:7] <= month_str:
                            amount = float(tx.get("amount", tx.get("quantity", 0)))
                            if str(tx.get("type", "")).upper() == "SELL":
                                participations -= amount
                            else:
                                participations += amount

                # 5. Calcular NAV total vs Valor Liquidativo Unitario
                if category == "Broker":
                    # El broker ya viene con el NAV total calculado en main.py
                    liquid_nav = 1.0 
                    nav = float(price.price)
                else:
                    # Bitcoin y Fondos traen el precio unitario (Liquidativo)
                    liquid_nav = float(price.price)
                    nav = liquid_nav * participations

                # 6. Añadimos el registro corregido
                entry = {
                    "month": month_str,
                    "assetId": price.assetId,
                    "liquidNavValue": liquid_nav,
                    "nav": nav,
                    "participations": participations,
                    "source": price.source,
                    "date": price.fetchedAt
                }
                history_entries.append(entry)

        # 7. Fusionar y guardar historial principal
        if current_data:
            merged_history = merge_price_updates(existing_history, history_entries)

            for entry in merged_history:
                stmt = select(DBHistoryEntry).where(
                    DBHistoryEntry.assetId == entry.get("assetId"),
                    DBHistoryEntry.month == entry.get("month")
                )
                existing = session.exec(stmt).first()

                if existing:
                    if "nav" in entry: existing.nav = float(entry["nav"])
                    if "liquidNavValue" in entry: existing.liquidNavValue = float(entry["liquidNavValue"])
                    if "participations" in entry: existing.participations = float(entry["participations"])
                    session.add(existing)
                else:
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

        # 8. Guardar valores históricos de las acciones
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
