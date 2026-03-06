"""
Data models for WealthHub Backend
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from decimal import Decimal


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
    """Asset model with ISIN field"""
    id: str
    name: str
    category: str
    color: str
    archived: bool = False
    riskLevel: Optional[str] = None
    isin: Optional[str] = None  # ISIN for funds and some assets
    ticker: Optional[str] = None  # Ticker for stocks and crypto
    componentTickers: Optional[List[str]] = None  # For broker assets with multiple holdings
    participations: Decimal = Decimal('0.0')  # Number of shares/participations
    meanCost: Decimal = Decimal('0.0')  # Average cost per participation
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "asset-1",
                "name": "Numantia Patrimonio Global",
                "category": "Fund",
                "color": "#6366f1",
                "archived": False,
                "riskLevel": "Medio",
                "isin": "ES0165151004",
                "ticker": None,
                "componentTickers": None,
                "participations": 400.5,
                "meanCost": 25.0
            }
        }


class HistoryEntry(BaseModel):
    """History entry model"""
    id: str
    month: str  # Format: YYYY-MM
    assetId: str
    participations: Decimal  # Number of shares/participations
    liquidNavValue: Decimal  # Liquid asset value per share (fetched from market)
    nav: Decimal  # Net Asset Value (participations * liquidNavValue)
    contribution: Decimal  # Amount contributed/invested
    meanCost: Decimal  # Average cost per participation


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
