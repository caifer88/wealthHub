import datetime
from sqlmodel import Field, SQLModel
from typing import Optional
from decimal import Decimal


class Asset(SQLModel, table=True):
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


class AssetHistory(SQLModel, table=True):
    __tablename__ = "asset_history"
    id: str = Field(primary_key=True, max_length=100)
    asset_id: Optional[str] = Field(default=None, foreign_key="asset.id", max_length=50, index=True)
    snapshot_date: datetime.date = Field(index=True)
    nav: Optional[Decimal] = Field(default=None)
    contribution: Optional[Decimal] = Field(default=None)
    participations: Optional[Decimal] = Field(default=None)
    liquid_nav_value: Optional[Decimal] = Field(default=None)
    mean_cost: Optional[Decimal] = Field(default=None)


class Transaction(SQLModel, table=True):
    id: str = Field(primary_key=True, max_length=100)
    asset_id: Optional[str] = Field(default=None, foreign_key="asset.id", max_length=50, index=True)
    transaction_date: datetime.date
    type: Optional[str] = Field(default=None, max_length=20)
    ticker: Optional[str] = Field(default=None, max_length=50, index=True)
    currency: Optional[str] = Field(default="EUR", max_length=10)
    quantity: Optional[Decimal] = Field(default=None)
    price_per_unit: Optional[Decimal] = Field(default=None)
    fees: Optional[Decimal] = Field(default=None)
    total_amount: Optional[Decimal] = Field(default=None)


class ExchangeRate(SQLModel, table=True):
    __tablename__ = "exchange_rates"
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date = Field(index=True)
    currency_pair: str = Field(max_length=20, index=True)
    rate: Decimal = Field(default=0)