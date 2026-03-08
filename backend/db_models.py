from typing import Optional
from datetime import date
from sqlmodel import Field, SQLModel
from decimal import Decimal

class Asset(SQLModel, table=True):
    id: str = Field(primary_key=True, max_length=50)
    name: str = Field(max_length=255)
    category: str = Field(max_length=50)
    color: Optional[str] = Field(default=None, max_length=20)
    is_archived: bool = Field(default=False)
    risk_level: Optional[str] = Field(default=None, max_length=50)
    isin: Optional[str] = Field(default=None, max_length=50)
    ticker: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None)

class Asset_History(SQLModel, table=True):
    id: str = Field(primary_key=True, max_length=100)
    asset_id: str = Field(foreign_key="asset.id", max_length=50)
    snapshot_date: date
    nav: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    contribution: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    participations: Optional[Decimal] = Field(default=None, max_digits=18, decimal_places=8)
    liquid_nav_value: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    mean_cost: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)

class Transaction(SQLModel, table=True):
    id: str = Field(primary_key=True, max_length=100)
    asset_id: str = Field(foreign_key="asset.id", max_length=50)
    transaction_date: date
    type: Optional[str] = Field(default=None, max_length=20)
    ticker: Optional[str] = Field(default=None, max_length=50)
    quantity: Optional[Decimal] = Field(default=None, max_digits=18, decimal_places=8)
    price_per_unit: Optional[Decimal] = Field(default=None, max_digits=18, decimal_places=8)
    fees: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=4)
    total_amount: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)