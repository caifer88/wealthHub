"""
Utility functions for WealthHub Backend
"""

import functools
import time
import asyncio
from typing import Callable, Any, Dict, Tuple
from datetime import datetime, timedelta
import calendar
import logging

logger = logging.getLogger(__name__)


def get_last_business_day(year: int, month: int) -> datetime:
    """
    Calculate the last business day of a given month.
    
    Args:
        year: Year (e.g., 2024)
        month: Month (1-12)
    
    Returns:
        datetime object of the last business day
    
    Example:
        >>> get_last_business_day(2024, 2)
        datetime(2024, 2, 29)  # 29 Feb 2024 is a Thursday (business day)
    """
    # Get the last day of the month
    last_day = calendar.monthrange(year, month)[1]
    last_date = datetime(year, month, last_day)
    
    # Check if it's a weekend (5=Saturday, 6=Sunday)
    weekday = last_date.weekday()
    
    # If Saturday (5), go back 1 day
    if weekday == 5:
        last_date -= timedelta(days=1)
    # If Sunday (6), go back 2 days
    elif weekday == 6:
        last_date -= timedelta(days=2)
    
    return last_date


def validate_month(year: int, month: int) -> bool:
    """
    Validate year and month parameters.
    
    Args:
        year: Year to validate
        month: Month to validate (1-12)
    
    Returns:
        True if valid, False otherwise
    """
    current_year = datetime.now().year
    current_month = datetime.now().month
    
    # Allow current and previous years, but not future
    if year > current_year:
        logger.warning(f"Invalid year: {year} (future year not allowed)")
        return False
    
    # Month should be 1-12
    if month < 1 or month > 12:
        logger.warning(f"Invalid month: {month} (must be 1-12)")
        return False
    
    # Don't allow future months in current year
    if year == current_year and month > current_month:
        logger.warning(f"Invalid month: {month} (future month not allowed)")
        return False
    
    return True


def format_date(dt: datetime) -> str:
    """
    Format datetime to ISO string without timezone info.
    
    Args:
        dt: datetime object
    
    Returns:
        String in format YYYY-MM-DD
    """
    return dt.strftime("%Y-%m-%d")


def format_datetime_iso(dt: datetime) -> str:
    """
    Format datetime to ISO 8601 format.
    
    Args:
        dt: datetime object
    
    Returns:
        String in ISO 8601 format
    """
    return dt.isoformat() + "Z"


def merge_price_updates(existing_data: list, new_prices: list) -> list:
    """
    Merge new price data with existing data, avoiding duplicates.
    
    For a given month/asset combination:
    - If exists: update the value
    - If new: add it
    
    Args:
        existing_data: Existing price history
        new_prices: New prices from API
    
    Returns:
        Merged price data
    """
    # Create a map of existing data by (month, assetId) with index
    existing_map = {}
    for idx, entry in enumerate(existing_data):
        key = (entry.get("month"), entry.get("assetId"))
        existing_map[key] = (idx, entry)
    
    # Update or insert new prices
    result = list(existing_data)
    for new_price in new_prices:
        key = (new_price.get("month"), new_price.get("assetId"))
        if key in existing_map:
            # Update existing entry using stored index
            idx = existing_map[key][0]
            result[idx] = new_price
            logger.debug(f"Updated price for {new_price.get('assetId')} in {new_price.get('month')}")
        else:
            # Add new entry
            result.append(new_price)
            logger.debug(f"Added new price for {new_price.get('assetId')} in {new_price.get('month')}")
    
    return result


def extract_isin_from_string(text: str) -> list:
    """
    Extract ISIN codes from a string.
    ISIN format: 2 letters + 9 digits + 1 check digit = 12 characters total.
    
    Args:
        text: Text to search for ISINs
    
    Returns:
        List of found ISINs
    """
    import re
    # ISIN pattern: starts with 2 letters (country code), then 10 alphanumeric
    pattern = r"\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b"
    isins = re.findall(pattern, text)
    return list(set(isins))  # Remove duplicates


def async_ttl_cache(maxsize: int = 128, ttl: int = 3600):
    """
    A simple thread-safe, async-compatible TTL cache decorator.

    Args:
        maxsize: Maximum number of entries in the cache
        ttl: Time to live in seconds
    """
    def decorator(func: Callable):
        cache: Dict[str, Tuple[float, Any]] = {}
        # Lazy initialization of the lock to ensure it's created within the running event loop
        _lock: asyncio.Lock | None = None

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            nonlocal _lock
            if _lock is None:
                _lock = asyncio.Lock()

            # Create a simple hashable key from args and kwargs
            # (Note: this is a basic implementation and might not handle all complex types)
            key = str(args) + str(kwargs)

            async with _lock:
                if key in cache:
                    timestamp, result = cache[key]
                    if time.time() - timestamp < ttl:
                        return result
                    else:
                        del cache[key]

            # If not in cache or expired, call the function
            result = await func(*args, **kwargs)

            async with _lock:
                # Evict oldest if full
                if len(cache) >= maxsize:
                    oldest_key = min(cache.keys(), key=lambda k: cache[k][0])
                    del cache[oldest_key]
                cache[key] = (time.time(), result)

            return result
        return wrapper
    return decorator
