"""
Migration script: Google Apps Script to PostgreSQL.
Downloads all historical data from GAS and inserts it into the new database.
"""

import sys
import os
import requests
import asyncio
import logging
from config import settings

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger("migrator")

# Import DB services
from services.db_service import create_db_and_tables, save_data_to_db, get_session

def migrate():
    """Run migration ETL"""
    logger.info("Starting migration from GAS to DB...")

    gas_url = settings.VITE_GAS_URL
    if not gas_url:
        logger.error("VITE_GAS_URL is not set in environment or config. Cannot migrate.")
        return

    logger.info(f"Fetching data from GAS: {gas_url[:30]}...")
    try:
        response = requests.get(gas_url, timeout=30)
        response.raise_for_status()
        result = response.json()

        if not result.get("success"):
            logger.error("GAS returned unsuccessfull response.")
            return

        data = result.get("data")
        if not data:
            logger.error("No data found in GAS response.")
            return

        logger.info(f"Found {len(data.get('assets', []))} assets")
        logger.info(f"Found {len(data.get('history', []))} history entries")
        logger.info(f"Found {len(data.get('bitcoinTransactions', []))} btc transactions")
        logger.info(f"Found {len(data.get('stockTransactions', []))} stock transactions")

        logger.info("Initializing DB tables...")
        create_db_and_tables()

        logger.info("Saving data to PostgreSQL...")

        # Get a database session
        session_generator = get_session()
        session = next(session_generator)

        try:
            # Since save_data_to_db is async, we run it in event loop
            success = asyncio.run(save_data_to_db(session, data))
        finally:
            session.close()

        if success:
            logger.info("✅ Migration completed successfully!")
        else:
            logger.error("❌ Migration failed during database save.")

    except Exception as e:
        logger.error(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
