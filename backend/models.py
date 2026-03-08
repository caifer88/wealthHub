"""
Data models for WealthHub Backend API
"""



from pydantic import BaseModel, Field, ConfigDict, model_validator
from pydantic.alias_generators import to_camel
from typing import Optional, List
from enum import Enum
from decimal import Decimal
from datetime import date


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


class Asset(BaseModel):
    """Asset model with DB fields"""
    id: str
    name: str
    category: str
    currency: Optional[str] = "EUR"
    color: Optional[str] = None
    is_archived: bool = False
    risk_level: Optional[str] = None
    isin: Optional[str] = None  # ISIN for funds and some assets
    ticker: Optional[str] = None  # Ticker for stocks and crypto
    description: Optional[str] = ""
    # Fields that were in previous model but not in DB might be computed
    # or passed as separate DTO fields if needed.
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "a1",
                "name": "Basalto USA",
                "category": "Fund",
                "currency": "EUR",
                "color": "#102cb7",
                "is_archived": False,
                "risk_level": "Moderado",
                "isin": "ES0164691083",
                "ticker": None,
                "description": ""
            }
        }


class HistoryEntry(BaseModel):
    """History entry model corresponding to Asset_History"""
    id: str
    asset_id: Optional[str] = None
    snapshot_date: date
    nav: Optional[Decimal] = None
    contribution: Optional[Decimal] = None
    participations: Optional[Decimal] = None
    liquid_nav_value: Optional[Decimal] = None
    mean_cost: Optional[Decimal] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "h-2020-01-a5",
                "asset_id": "a5",
                "snapshot_date": "2020-01-01",
                "nav": 15000.0,
                "contribution": 0.0,
                "participations": None,
                "liquid_nav_value": None,
                "mean_cost": None
            }
        }


class Transaction(BaseModel):
    """Unified transaction model for Crypto and Stocks"""
    id: str
    asset_id: Optional[str] = None
    transaction_date: date
    type: Optional[str] = None
    ticker: Optional[str] = None
    currency: Optional[str] = "EUR"
    quantity: Optional[Decimal] = None
    price_per_unit: Optional[Decimal] = None
    fees: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "tx-btc-056",
                "asset_id": "a4",
                "transaction_date": "2026-02-19",
                "type": "BUY",
                "ticker": "BTC",
                "currency": "EUR",
                "quantity": 0.00603547,
                "price_per_unit": 57493.4512,
                "fees": 0.0,
                "total_amount": 347.0
            }
        }


class PriceData(BaseModel):
    """Price data for an asset"""
    assetId: str
    assetName: str
    ticker: Optional[str] = None
    isin: Optional[str] = None
    price: Decimal
    currency: str = "EUR"
    fetchedAt: str  # ISO format datetime
    source: str  # e.g., "yfinance", "morningstar", "ft_markets"
    
    class Config:
        json_schema_extra = {
            "example": {
                "assetId": "asset-1",
                "assetName": "Bitcoin",
                "ticker": "BTC-EUR",
                "isin": None,
                "price": 42500.50,
                "currency": "EUR",
                "fetchedAt": "2024-02-26T18:30:00Z",
                "source": "yfinance"
            }
        }


class FetchMonthResponse(BaseModel):
    """Response model for /fetch-month endpoint"""
    success: bool
    message: str
    year: int
    month: int
    lastBusinessDay: str  # Date in YYYY-MM-DD format
    prices: List[PriceData]
    errors: List[str] = []
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Precios obtenidos exitosamente",
                "year": 2024,
                "month": 2,
                "lastBusinessDay": "2024-02-29",
                "prices": [],
                "errors": []
            }
        }


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    message: str
    version: str

class PortfolioSummaryResponse(BaseModel):
    """Response model for portfolio summary endpoint"""
    total_value: float
    total_invested: float
    absolute_roi: float
    percentage_roi: float

class PortfolioAllocationResponse(BaseModel):
    """Response model for portfolio allocation endpoint"""
    allocations: dict[str, float]

class AssetMetricsResponse(BaseModel):
    """Response model for individual asset metrics endpoint"""
    asset_id: str
    total_contributed: float
    current_value: float
    absolute_return: float
    percentage_return: float
    twr: float


class AssetResponse(BaseModel):
    id: str
    name: str
    category: str
    color: Optional[str] = None
    archived: bool = Field(default=False, validation_alias="is_archived")
    risk_level: Optional[str] = None
    isin: Optional[str] = None
    ticker: Optional[str] = None
    description: Optional[str] = ""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class HistoryResponse(BaseModel):
    id: str
    asset_id: Optional[str] = None
    month: str
    nav: float
    contribution: float
    participations: Optional[float] = None
    liquid_nav_value: Optional[float] = None
    mean_cost: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def map_fields(cls, data):
        # Handle both dict (from tests) and ORM object (from DB)
        if isinstance(data, dict):
            res = dict(data)
            if "snapshot_date" in res:
                res["month"] = res["snapshot_date"].strftime("%Y-%m")
            if "nav" in res and res["nav"] is not None:
                res["nav"] = float(res["nav"])
            else:
                res["nav"] = 0.0
            if "contribution" in res and res["contribution"] is not None:
                res["contribution"] = float(res["contribution"])
            else:
                res["contribution"] = 0.0
            if "participations" in res and res["participations"] is not None:
                res["participations"] = float(res["participations"])
            if "liquid_nav_value" in res and res["liquid_nav_value"] is not None:
                res["liquid_nav_value"] = float(res["liquid_nav_value"])
            if "mean_cost" in res and res["mean_cost"] is not None:
                res["mean_cost"] = float(res["mean_cost"])
            return res

        # Object from ORM
        res = {
            "id": getattr(data, "id", None),
            "asset_id": getattr(data, "asset_id", None),
        }
        if hasattr(data, "snapshot_date") and getattr(data, "snapshot_date"):
            res["month"] = getattr(data, "snapshot_date").strftime("%Y-%m")
        res["nav"] = float(getattr(data, "nav", 0.0) or 0.0)
        res["contribution"] = float(getattr(data, "contribution", 0.0) or 0.0)

        parts = getattr(data, "participations", None)
        res["participations"] = float(parts) if parts is not None else None

        liq = getattr(data, "liquid_nav_value", None)
        res["liquid_nav_value"] = float(liq) if liq is not None else None

        mean = getattr(data, "mean_cost", None)
        res["mean_cost"] = float(mean) if mean is not None else None

        return res

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

class TransactionResponse(BaseModel):
    id: str
    asset_id: Optional[str] = None
    date: str
    type: Optional[str] = None
    ticker: Optional[str] = None
    quantity: float
    price_per_unit: float
    fees: float
    total_amount: float

    @model_validator(mode="before")
    @classmethod
    def map_fields(cls, data):
        if isinstance(data, dict):
            res = dict(data)
            if "transaction_date" in res:
                res["date"] = res["transaction_date"].strftime("%Y-%m-%d")
            if "quantity" in res and res["quantity"] is not None:
                res["quantity"] = float(res["quantity"])
            else:
                res["quantity"] = 0.0
            if "price_per_unit" in res and res["price_per_unit"] is not None:
                res["price_per_unit"] = float(res["price_per_unit"])
            else:
                res["price_per_unit"] = 0.0
            if "fees" in res and res["fees"] is not None:
                res["fees"] = float(res["fees"])
            else:
                res["fees"] = 0.0
            if "total_amount" in res and res["total_amount"] is not None:
                res["total_amount"] = float(res["total_amount"])
            else:
                res["total_amount"] = 0.0
            return res

        res = {
            "id": getattr(data, "id", None),
            "asset_id": getattr(data, "asset_id", None),
            "type": getattr(data, "type", None),
            "ticker": getattr(data, "ticker", None),
        }
        if hasattr(data, "transaction_date") and getattr(data, "transaction_date"):
            res["date"] = getattr(data, "transaction_date").strftime("%Y-%m-%d")

        res["quantity"] = float(getattr(data, "quantity", 0.0) or 0.0)
        res["price_per_unit"] = float(getattr(data, "price_per_unit", 0.0) or 0.0)
        res["fees"] = float(getattr(data, "fees", 0.0) or 0.0)
        res["total_amount"] = float(getattr(data, "total_amount", 0.0) or 0.0)

        return res

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )
