"""
Data models for WealthHub Backend API
"""

from pydantic import BaseModel, Field
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
