import logging
from sqlalchemy import create_engine, text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def migrate_transactions():
    """Migrates bilingual transaction types to a unified English Enum in the database"""
    # Use direct SQLAlchemy connection to avoid Pydantic/SQLModel definition issues
    DATABASE_URL = "postgresql://wealthhub:wealthhub_password@localhost:5432/wealthhub"
    engine = create_engine(DATABASE_URL, echo=True)

    with engine.connect() as conn:
        with conn.begin():
            try:
                # Update COMPRA
                result = conn.execute(text("UPDATE transaction SET type = 'BUY' WHERE type = 'COMPRA'"))
                logger.info(f"Updated {result.rowcount} 'COMPRA' to 'BUY'.")

                # Update VENTA
                result = conn.execute(text("UPDATE transaction SET type = 'SELL' WHERE type = 'VENTA'"))
                logger.info(f"Updated {result.rowcount} 'VENTA' to 'SELL'.")

                logger.info("Transaction type migration completed successfully.")
            except Exception as e:
                logger.error(f"Error during migration: {e}")
                raise

if __name__ == "__main__":
    migrate_transactions()
