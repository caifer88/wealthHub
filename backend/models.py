"""
Data models for WealthHub Backend
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


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
    baseAmount: float
    archived: bool = False
    targetAllocation: Optional[float] = None
    riskLevel: Optional[str] = None
    isin: Optional[str] = None  # NEW: ISIN for funds and some assets
    ticker: Optional[str] = None  # NEW: Ticker for stocks and crypto
    componentTickers: Optional[List[str]] = None  # NEW: For broker assets with multiple holdings
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "asset-1",
                "name": "Numantia Patrimonio Global",
                "category": "Fund",
                "color": "#6366f1",
                "baseAmount": 10000,
                "archived": False,
                "targetAllocation": 30,
                "riskLevel": "Medio",
                "isin": "ES0165151004",
                "ticker": None,
                "componentTickers": None
            }
        }


class HistoryEntry(BaseModel):
    """History entry model"""
    id: str
    month: str  # Format: YYYY-MM
    assetId: str
    nav: float  # Net Asset Value
    contribution: float  # Amount contributed/invested


class PriceData(BaseModel):
    """Price data for an asset"""
    assetId: str
    assetName: str
    ticker: Optional[str] = None
    isin: Optional[str] = None
    price: float
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
