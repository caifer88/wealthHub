"""
Data models for WealthHub Backend API
Combined SQLModel (DB + Validation) and Pydantic models
"""
from sqlmodel import Field, SQLModel
from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel
from typing import Any
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


class HistoryResponseDTO(BaseModel):
    """Data Transfer Object for returning history entries from the API"""
    model_config = frontend_config

    id: str
    asset_id: Optional[str] = Field(default=None, alias="asset_id")
    month: str
    nav: float
    contribution: float
    participations: Optional[float] = None
    liquid_nav_value: Optional[float] = None
    mean_cost: Optional[float] = None

    @model_validator(mode='before')
    @classmethod
    def format_attributes(cls, obj: Any) -> Any:
        if isinstance(obj, dict):
            return obj

        return {
            "id": obj.id,
            "asset_id": obj.asset_id,
            "month": obj.snapshot_date.strftime("%Y-%m") if hasattr(obj, "snapshot_date") else getattr(obj, "month", ""),
            "nav": float(obj.nav) if getattr(obj, "nav", None) is not None else 0.0,
            "contribution": float(obj.contribution) if getattr(obj, "contribution", None) is not None else 0.0,
            "participations": float(obj.participations) if getattr(obj, "participations", None) is not None else None,
            "liquid_nav_value": float(obj.liquid_nav_value) if getattr(obj, "liquid_nav_value", None) is not None else None,
            "mean_cost": float(obj.mean_cost) if getattr(obj, "mean_cost", None) is not None else None,
        }


class TransactionResponseDTO(BaseModel):
    """Data Transfer Object for returning transactions from the API"""
    model_config = frontend_config

    id: str
    asset_id: Optional[str] = Field(default=None, alias="asset_id")
    date: str
    type: Optional[str] = None
    ticker: Optional[str] = None
    quantity: float
    price_per_unit: float
    fees: float
    total_amount: float

    @model_validator(mode='before')
    @classmethod
    def format_attributes(cls, obj: Any) -> Any:
        if isinstance(obj, dict):
            return obj

        return {
            "id": obj.id,
            "asset_id": obj.asset_id,
            "date": obj.transaction_date.strftime("%Y-%m-%d") if hasattr(obj, "transaction_date") else getattr(obj, "date", ""),
            "type": obj.type,
            "ticker": obj.ticker,
            "quantity": float(obj.quantity) if getattr(obj, "quantity", None) is not None else 0.0,
            "price_per_unit": float(obj.price_per_unit) if getattr(obj, "price_per_unit", None) is not None else 0.0,
            "fees": float(obj.fees) if getattr(obj, "fees", None) is not None else 0.0,
            "total_amount": float(obj.total_amount) if getattr(obj, "total_amount", None) is not None else 0.0,
        }


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

    asset_id: str = Field(alias="asset_id")
    asset_name: str = Field(alias="asset_name")
    ticker: Optional[str] = None
    isin: Optional[str] = None
    price: Decimal
    currency: str = "EUR"
    fetched_at: str = Field(alias="fetched_at")  # ISO format datetime
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
