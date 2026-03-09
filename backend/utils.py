"""
Utility functions for WealthHub Backend
"""

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
