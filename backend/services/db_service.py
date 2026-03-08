import os
import sys

# Add backend directory to sys.path to allow importing from backend modules
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from sqlmodel import Session, create_engine, select, delete
from config import settings
from db_models import Asset, Asset_History, Transaction
import logging

logger = logging.getLogger(__name__)

engine = None
if settings.DATABASE_URL:
    engine = create_engine(settings.DATABASE_URL, echo=False)

def get_session():
    with Session(engine) as session:
        yield session

def load_assets_from_db(session: Session):
    try:
        statement = select(Asset)
        results = session.exec(statement).all()
        return [
            {
                "id": a.id,
                "name": a.name,
                "category": a.category,
                "color": a.color,
                "archived": a.is_archived,
                "riskLevel": a.risk_level,
                "isin": a.isin,
                "ticker": a.ticker,
                "description": a.description
            } for a in results
        ]
    except Exception as e:
        logger.error(f"Error loading assets from DB: {str(e)}")
        return []

def load_history_from_db(session: Session):
    try:
        statement = select(Asset_History)
        results = session.exec(statement).all()
        return [
            {
                "id": h.id,
                "month": h.snapshot_date.strftime("%Y-%m"), # Format: YYYY-MM
                "assetId": h.asset_id,
                "participations": float(h.participations) if h.participations is not None else 0,
                "liquidNavValue": float(h.liquid_nav_value) if h.liquid_nav_value is not None else 0,
                "nav": float(h.nav) if h.nav is not None else 0,
                "contribution": float(h.contribution) if h.contribution is not None else 0,
                "meanCost": float(h.mean_cost) if h.mean_cost is not None else 0
            } for h in results
        ]
    except Exception as e:
        logger.error(f"Error loading history from DB: {str(e)}")
        return []

def load_transactions_from_db(session: Session):
    try:
        statement = select(Transaction)
        results = session.exec(statement).all()
        return [
            {
                "id": t.id,
                "assetId": t.asset_id,
                "date": t.transaction_date.strftime("%Y-%m-%d"),
                "type": t.type.lower() if t.type else "buy",
                "ticker": t.ticker,
                "quantity": float(t.quantity) if t.quantity is not None else 0,
                "pricePerUnit": float(t.price_per_unit) if t.price_per_unit is not None else 0,
                "fees": float(t.fees) if t.fees is not None else 0,
                "totalAmount": float(t.total_amount) if t.total_amount is not None else 0
            } for t in results
        ]
    except Exception as e:
        logger.error(f"Error loading transactions from DB: {str(e)}")
        return []

def save_full_data_to_db(session: Session, data: dict):
    try:
        # Clear existing data - using delete construct for sqlmodel/sqlalchemy 2.0+
        session.exec(delete(Transaction))
        session.exec(delete(Asset_History))
        session.exec(delete(Asset))

        # Insert Assets
        for a in data.get("assets", []):
            asset = Asset(
                id=a.get("id"),
                name=a.get("name"),
                category=a.get("category"),
                color=a.get("color"),
                is_archived=a.get("archived", False),
                risk_level=a.get("riskLevel"),
                isin=a.get("isin"),
                ticker=a.get("ticker"),
                description=a.get("description", "")
            )
            session.add(asset)

        session.flush() # Ensure assets exist before history/transactions

        # Insert History
        import datetime
        for h in data.get("history", []):
            try:
                # Convert YYYY-MM to date by appending -01
                month_str = h.get("month")
                snapshot_date = datetime.datetime.strptime(f"{month_str}-01", "%Y-%m-%d").date()

                history_entry = Asset_History(
                    id=h.get("id"),
                    asset_id=h.get("assetId"),
                    snapshot_date=snapshot_date,
                    nav=h.get("nav"),
                    contribution=h.get("contribution"),
                    participations=h.get("participations"),
                    liquid_nav_value=h.get("liquidNavValue"),
                    mean_cost=h.get("meanCost")
                )
                session.add(history_entry)
            except Exception as e:
                logger.error(f"Error parsing history entry: {h}. Error: {e}")

        # Insert Transactions
        for t in data.get("transactions", []):
            try:
                tx_date_str = t.get("date")
                tx_date = datetime.datetime.strptime(tx_date_str, "%Y-%m-%d").date()
                tx = Transaction(
                    id=t.get("id"),
                    asset_id=t.get("assetId"),
                    transaction_date=tx_date,
                    type=t.get("type", "").upper(),
                    ticker=t.get("ticker"),
                    quantity=t.get("quantity"),
                    price_per_unit=t.get("pricePerUnit"),
                    fees=t.get("fees"),
                    total_amount=t.get("totalAmount")
                )
                session.add(tx)
            except Exception as e:
                logger.error(f"Error parsing transaction entry: {t}. Error: {e}")

        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Error saving full data to DB: {str(e)}")
        raise e