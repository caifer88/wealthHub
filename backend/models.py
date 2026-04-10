"""
Data models for WealthHub Backend API
Combined SQLModel (DB + Validation) and Pydantic models
"""
from sqlmodel import Field, SQLModel
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from pydantic.alias_generators import to_camel
from typing import Any
from sqlalchemy import Column, Numeric
from typing import Optional, List, Dict
from enum import Enum
from decimal import Decimal
from datetime import date as DateType, datetime

class AssetCategory(str, Enum):
    """Asset category types"""
    CRYPTO      = "CRYPTO"
    FUND        = "FUND"         # genérico / legacy
    FUND_ACTIVE = "FUND_ACTIVE"  # gestión activa
    FUND_INDEX  = "FUND_INDEX"   # fondos indexados
    STOCK       = "STOCK"
    PENSION     = "PENSION"
    CASH        = "CASH"
    OTHER       = "OTHER"


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
    parent_asset_id: Optional[str] = Field(default=None, foreign_key="asset.id", max_length=50)


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
            "id": str(obj.id),
            "asset_id": str(obj.asset_id) if obj.asset_id is not None else None,
            "month": obj.snapshot_date.strftime("%Y-%m") if hasattr(obj, "snapshot_date") else getattr(obj, "month", ""),
            "nav": str(obj.nav) if getattr(obj, "nav", None) is not None else "0.0",
            "contribution": str(obj.contribution) if getattr(obj, "contribution", None) is not None else "0.0",
            "participations": str(obj.participations) if getattr(obj, "participations", None) is not None else None,
            "liquid_nav_value": str(obj.liquid_nav_value) if getattr(obj, "liquid_nav_value", None) is not None else None,
            "mean_cost": str(obj.mean_cost) if getattr(obj, "mean_cost", None) is not None else None,
        }



class BitcoinTransaction(SQLModel, table=True):
    """Bitcoin-specific transaction model with optimized schema"""
    __tablename__ = "bitcoin_transaction"
    model_config = frontend_config

    id: str = Field(primary_key=True, max_length=100)
    asset_id: Optional[str] = Field(default=None, foreign_key="asset.id", max_length=50, index=True)
    transaction_date: DateType
    type: Optional[str] = Field(default=None)
    amount_btc: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    price_eur_per_btc: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    fees_eur: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 4)))
    total_amount_eur: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(15, 4)))
    exchange_rate_usd_eur: Optional[Decimal] = Field(default=Decimal("1.08"), sa_column=Column(Numeric(15, 8)))


class StockTransaction(SQLModel, table=True):
    """Stock-specific transaction model"""
    __tablename__ = "stock_transaction"
    model_config = frontend_config

    id: str = Field(primary_key=True, max_length=100)
    asset_id: Optional[str] = Field(default=None, foreign_key="asset.id", max_length=50, index=True)
    transaction_date: DateType
    type: Optional[str] = Field(default=None)
    ticker: Optional[str] = Field(default=None, max_length=50, index=True)
    currency: Optional[str] = Field(default="USD", max_length=10)
    quantity: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    price_per_unit: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 8)))
    fees: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 4)))
    total_amount: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(15, 4)))
    exchange_rate_eur_usd: Optional[Decimal] = Field(default=Decimal("1.08"), sa_column=Column(Numeric(15, 8)))


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
    exchange_rate_eur_usd: Optional[float] = None  # EUR/USD rate used for conversion
    exchange_rate_source: Optional[str] = None  # 'yfinance', 'fallback_db', 'fallback_hardcoded'


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


class StockMetricsDTO(BaseModel):
    """Data Transfer Object for individual stock metrics in portfolio"""
    model_config = frontend_config

    ticker: str
    shares: float
    cost_basis_eur: float  # Total amount invested in EUR
    cost_basis_usd: float  # Total amount invested in USD
    average_price_usd: float  # Weighted average purchase price in USD
    current_price_usd: float  # Latest price from asset_history
    current_price_eur: float  # Current price converted to EUR
    current_value_eur: float  # shares × current_price_eur
    unrealized_gain_eur: float  # current_value_eur - cost_basis_eur
    unrealized_gain_usd: float  # current_value_usd - cost_basis_usd
    unrealized_gain_percent: float  # (unrealized_gain / cost_basis) × 100
    last_price_update: Optional[str] = None  # ISO datetime of last price fetch


class StockPortfolioSummaryDTO(BaseModel):
    """Consolidated stock portfolio summary (single source of truth)"""
    model_config = frontend_config

    total_value_eur: float  # Sum of all current_value_eur across holdings
    total_invested_eur: float  # Sum of all cost_basis_eur
    total_unrealized_gain_eur: float  # total_value_eur - total_invested_eur
    total_unrealized_gain_percent: float  # (total_unrealized_gain_eur / total_invested_eur) × 100
    exchange_rate_eur_usd: float  # Latest EUR/USD rate used for conversion
    last_update: str  # ISO datetime of last portfolio calculation
    number_of_tickers: int  # Count of unique stock holdings
    tickers: List[StockMetricsDTO]  # List of individual holdings


# Añade esto en backend/models.py

class BitcoinTransactionDTO(BaseModel):
    """DTO para comunicación API de Bitcoin Transactions"""
    model_config = frontend_config

    id: str
    asset_id: Optional[str] = None
    transaction_date: DateType
    type: Optional[str] = None
    amount_btc: Optional[Decimal] = None
    price_eur_per_btc: Optional[Decimal] = None
    fees_eur: Optional[Decimal] = None
    total_amount_eur: Optional[Decimal] = None
    exchange_rate_usd_eur: Optional[Decimal] = None

    @model_validator(mode='before')
    @classmethod
    def coerce_uuids(cls, obj: Any) -> Any:
        if isinstance(obj, dict):
            return obj
        return {
            "id": str(obj.id) if obj.id is not None else None,
            "asset_id": str(obj.asset_id) if obj.asset_id is not None else None,
            "transaction_date": obj.transaction_date,
            "type": obj.type,
            "amount_btc": obj.amount_btc,
            "price_eur_per_btc": obj.price_eur_per_btc,
            "fees_eur": obj.fees_eur,
            "total_amount_eur": obj.total_amount_eur,
            "exchange_rate_usd_eur": obj.exchange_rate_usd_eur,
        }


class StockTransactionDTO(BaseModel):
    """DTO para comunicación API de Stock Transactions"""
    model_config = frontend_config

    id: str
    asset_id: Optional[str] = None
    transaction_date: DateType
    type: Optional[str] = None
    ticker: Optional[str] = None
    currency: Optional[str] = None
    quantity: Optional[Decimal] = None
    price_per_unit: Optional[Decimal] = None
    fees: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    exchange_rate_eur_usd: Optional[Decimal] = None

    @model_validator(mode='before')
    @classmethod
    def coerce_uuids(cls, obj: Any) -> Any:
        if isinstance(obj, dict):
            return obj
        return {
            "id": str(obj.id) if obj.id is not None else None,
            "asset_id": str(obj.asset_id) if obj.asset_id is not None else None,
            "transaction_date": obj.transaction_date,
            "type": obj.type,
            "ticker": getattr(obj, "ticker", None),
            "currency": getattr(obj, "currency", None),
            "quantity": getattr(obj, "quantity", None),
            "price_per_unit": getattr(obj, "price_per_unit", None),
            "fees": getattr(obj, "fees", None),
            "total_amount": getattr(obj, "total_amount", None),
            "exchange_rate_eur_usd": getattr(obj, "exchange_rate_eur_usd", None),
        }
