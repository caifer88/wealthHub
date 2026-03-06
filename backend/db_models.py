"""
Database models for WealthHub Backend using SQLModel
"""

from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class DBAsset(SQLModel, table=True):
    __tablename__ = "assets"

    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    category: str = Field(index=True)
    color: str
    archived: bool = Field(default=False)
    riskLevel: Optional[str] = None
    isin: Optional[str] = None
    ticker: Optional[str] = None

    # Store component tickers as comma separated string or JSON
    # For simplicity in sqlite/postgres compatibility, store as JSON string
    componentTickers: Optional[str] = Field(default=None)

    # Financial fields
    participations: float = Field(default=0.0)
    meanCost: float = Field(default=0.0)


class DBHistoryEntry(SQLModel, table=True):
    __tablename__ = "history_entries"

    id: Optional[int] = Field(default=None, primary_key=True)
    month: str = Field(index=True) # Format: YYYY-MM
    assetId: str = Field(index=True)

    # Stored as float for SQLite compatibility, can cast to Decimal in app logic
    nav: float = Field(default=0.0)
    contribution: float = Field(default=0.0)
    source: Optional[str] = None
    date: Optional[str] = None # When the price was fetched
