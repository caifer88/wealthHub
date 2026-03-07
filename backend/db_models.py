"""
Database models for WealthHub Backend using SQLModel.
These models represent the tables in the PostgreSQL database.
"""

from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime


class DBAsset(SQLModel, table=True):
    """Database model for an Asset"""
    __tablename__ = "assets"

    id: str = Field(primary_key=True)
    name: str
    category: str
    color: str
    archived: bool = Field(default=False)
    riskLevel: Optional[str] = None
    isin: Optional[str] = None
    ticker: Optional[str] = None
    participations: float = Field(default=0.0)
    meanCost: float = Field(default=0.0)


class DBHistoryEntry(SQLModel, table=True):
    """Database model for a History Entry"""
    __tablename__ = "history"

    id: str = Field(primary_key=True)
    month: str  # Format: YYYY-MM
    assetId: str = Field(foreign_key="assets.id")
    participations: float
    liquidNavValue: float
    nav: float
    contribution: float
    meanCost: float


class DBBitcoinTransaction(SQLModel, table=True):
    """Database model for a Bitcoin Transaction"""
    __tablename__ = "bitcoin_transactions"

    id: str = Field(primary_key=True)
    date: str  # ISO format string or YYYY-MM-DD
    type: str  # "buy" or "sell"
    amount: float
    amountBTC: float
    totalCost: float
    meanPrice: float


class DBStockTransaction(SQLModel, table=True):
    """Database model for a Stock Transaction"""
    __tablename__ = "stock_transactions"

    id: str = Field(primary_key=True)
    ticker: str
    date: str  # ISO format string or YYYY-MM-DD
    type: str  # "buy" or "sell"
    shares: float
    pricePerShare: float
    fees: float
    totalAmount: float
    broker: Optional[str] = None
