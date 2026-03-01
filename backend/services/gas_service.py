import logging
from datetime import datetime
from typing import List, Optional
import requests

from config import settings
from models import PriceData
from utils import format_datetime_iso, merge_price_updates

logger = logging.getLogger(__name__)

async def load_assets_from_gas() -> List[dict]:
    """
    Load assets from Google Apps Script.
    No fallback to sample data - requires real assets from GAS.
    """
    if not settings.VITE_GAS_URL:
        logger.error("❌ GAS_URL not configured - cannot load assets")
        return []

    try:
        response = requests.get(settings.VITE_GAS_URL, timeout=settings.TIMEOUT)
        response.raise_for_status()

        data = response.json()
        if data.get("success") and data.get("data"):
            assets = data["data"].get("assets", [])
            logger.info(f"✅ Loaded {len(assets)} assets from GAS")
            return assets
        else:
            logger.error("❌ Invalid response from GAS")
            return []

    except Exception as e:
        logger.error(f"❌ Error loading from GAS: {str(e)}")
        return []

async def persist_prices_to_gas(
    prices: List[PriceData],
    year: Optional[int] = None,
    month: Optional[int] = None,
    fetch_date: Optional[datetime] = None
) -> bool:
    """
    Persist prices to Google Apps Script in data.json.
    Updates existing entries or adds new ones.
    """
    if not settings.VITE_GAS_URL:
        logger.warning("⚠️ GAS URL not configured, cannot persist prices")
        return False

    try:
        logger.info(f"📤 Persisting {len(prices)} prices to GAS")

        # Format prices for persistence
        month_str = f"{year:04d}-{month:02d}" if year and month else datetime.now().strftime("%Y-%m")

        history_entries = []
        for price in prices:
            # We must cast the Decimals back to float when sending to JSON payload if requests doesn't support Decimal serialization directly
            entry = {
                "month": month_str,
                "assetId": price.assetId,
                "nav": float(price.price),
                "contribution": float(price.price),  # Will be updated by frontend if needed
                "source": price.source,
                "date": price.fetchedAt
            }
            history_entries.append(entry)

        # Load current data from GAS
        current_data = await load_data_from_gas()

        # Merge with existing history
        if current_data:
            existing_history = current_data.get("history", [])
            history_entries = merge_price_updates(existing_history, history_entries)

        # Prepare payload
        payload = {
            "action": "updateHistory",
            "history": history_entries,
            "timestamp": format_datetime_iso(datetime.now())
        }

        # Send to GAS
        response = requests.post(
            settings.VITE_GAS_URL,
            json=payload,
            timeout=settings.TIMEOUT
        )
        response.raise_for_status()

        logger.info("✅ Prices persisted to GAS")
        return True

    except Exception as e:
        logger.error(f"❌ Error persisting prices to GAS: {str(e)}")
        return False

async def load_data_from_gas() -> dict:
    """Load full data structure from GAS"""
    if not settings.VITE_GAS_URL:
        return {}

    try:
        response = requests.get(settings.VITE_GAS_URL, timeout=settings.TIMEOUT)
        response.raise_for_status()
        data = response.json()
        return data.get("data", {}) if data.get("success") else {}
    except Exception as e:
        logger.error(f"Error loading data from GAS: {str(e)}")
        return {}
