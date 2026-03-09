"""
Data models for WealthHub Backend API
Combined SQLModel (DB + Validation) and Pydantic models
"""
from sqlmodel import Field, SQLModel
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import Column, Numeric
from typing import Optional, List, Dict
from enum import Enum
from decimal import Decimal
from datetime import date as DateType, datetime

class AssetCategory(str, Enum):
    """Asset category types"""
    CRYPTO = "Crypto"
    FUND = "Fund"
    STOCK = "Stock"
    PENSION = "Pension Plan"
    CASH = "Cash"
    OTHER = "Other"


class RiskLevel(str, Enum):
    """Risk level types"""
    LOW = "Bajo"
    MEDIUM = "Medio"
    HIGH = "Alto"


class TransactionType(str, Enum):
    """Transaction types"""
    BUY = "BUY"
    SELL = "SELL"


# Base configuration for models to serialize snake_case to camelCase for the frontend
frontend_config = ConfigDict(
    alias_generator=to_camel,
    populate_by_name=True,
    from_attributes=True
)


class Asset(SQLModel, table=True):
    """Asset model with DB fields"""
    __tablename__ = "asset"
    model_config = frontend_config

    id: str = Field(primary_key=True, max_length=50)
    name: str = Field(max_length=255)
    category: str = Field(max_length=50)
    currency: Optional[str] = Field(default="EUR", max_length=10)
    color: Optional[str] = Field(default=None, max_length=20)
    is_archived: bool = Field(default=False)
    risk_level: Optional[str] = Field(default=None, max_length=50)
    isin: Optional[str] = Field(default=None, max_length=50)
    ticker: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default="")


class HistoryEntry(SQLModel, table=True):
    """History entry model corresponding to asset_history"""
    __tablename__ = "asset_history"
    model_config = frontend_config

    id: str = Field(primary_key=True, max_length=100)
    asset_id: Optional[str] = Field(default=None, foreign_key="asset.id", max_length=50, index=True)
    snapshot_date: DateType = Field(index=True)
    nav: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    contribution: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    participations: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    liquid_nav_value: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    mean_cost: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))


class Transaction(SQLModel, table=True):
    """Unified transaction model for Crypto and Stocks"""
    __tablename__ = "transaction"
    model_config = frontend_config

    id: str = Field(primary_key=True, max_length=100)
    asset_id: Optional[str] = Field(default=None, foreign_key="asset.id", max_length=50, index=True)
    transaction_date: DateType
    type: Optional[str] = Field(default=None)
    ticker: Optional[str] = Field(default=None, max_length=50, index=True)
    currency: Optional[str] = Field(default="EUR", max_length=10)
    quantity: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    price_per_unit: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    fees: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    total_amount: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))


class ExchangeRate(SQLModel, table=True):
    __tablename__ = "exchange_rates"

    id: Optional[int] = Field(default=None, primary_key=True)
    date: DateType = Field(index=True)
    currency_pair: str = Field(max_length=20, index=True)
    rate: Decimal = Field(default=0, sa_column=Column(Numeric(18, 8)))


class PriceData(BaseModel):
    """Price data for an asset"""
    model_config = frontend_config

    asset_id: str = Field(alias="assetId")
    asset_name: str = Field(alias="assetName")
    ticker: Optional[str] = None
    isin: Optional[str] = None
    price: Decimal
    currency: str = "EUR"
    fetched_at: str = Field(alias="fetchedAt")  # ISO format datetime
    source: str  # e.g., "yfinance", "morningstar", "ft_markets"


class FetchMonthResponse(BaseModel):
    """Response model for /fetch-month endpoint"""
    model_config = frontend_config

    success: bool
    message: str
    year: int
    month: int
    last_business_day: str = Field(alias="lastBusinessDay")  # Date in YYYY-MM-DD format
    prices: List[PriceData]
    errors: List[str] = []


class HealthResponse(BaseModel):
    """Health check response"""
    model_config = frontend_config

    status: str
    message: str
    version: str


class PortfolioSummaryResponse(BaseModel):
    """Response model for portfolio summary endpoint"""
    model_config = frontend_config

    total_value: float
    total_invested: float
    absolute_roi: float
    percentage_roi: float
    cash_value: float = 0.0


class PortfolioAllocationResponse(BaseModel):
    """Response model for portfolio allocation endpoint"""
    model_config = frontend_config

    allocations: Dict[str, float]


class AssetMetricsResponse(BaseModel):
    """Response model for individual asset metrics endpoint"""
    model_config = frontend_config

    asset_id: str
    total_contributed: float
    current_value: float
    absolute_return: float
    percentage_return: float
    twr: float
