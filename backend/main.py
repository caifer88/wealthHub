"""
WealthHub Backend API
Main FastAPI application with endpoints for fetching asset prices and managing data
"""

import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, create_engine, SQLModel

from config import settings
from models import (
    Asset, PriceData, FetchMonthResponse, HealthResponse,
    HistoryEntry, Transaction, PortfolioSummaryResponse,
    PortfolioAllocationResponse, AssetMetricsResponse
)
from utils import (
    get_last_business_day, validate_month, format_date,
    format_datetime_iso, merge_price_updates
)
from services.price_fetcher import PriceFetcher
from services.fund_scraper import FundScraper
from services import db_service
import db_models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Database engine
engine = create_engine(settings.DATABASE_URL or "sqlite:///./wealthhub.db", echo=settings.DEBUG)

def get_session():
    with Session(engine) as session:
        yield session

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Backend API for WealthHub wealth management application"
)

# Configure CORS
# Parse multiple frontend URLs
frontend_urls = [
    url.strip() for url in settings.FRONTEND_URL.split(',') if url.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"🔧 CORS configured for: {', '.join(frontend_urls)}")

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    logger.info("📦 Database tables created or verified")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="WealthHub Backend is running",
        version=settings.API_VERSION
    )

# --- Asset Endpoints ---

@app.get("/api/assets", response_model=List[Asset])
def get_assets(session: Session = Depends(get_session)):
    """Get all assets"""
    assets = db_service.get_all_assets(session)
    # Map DB models to Pydantic models (we're using same names mostly, simple dict mapping works)
    return [Asset(**asset.model_dump()) for asset in assets]

# --- Asset Endpoints ---

@app.get("/api/assets") # Quitamos response_model para devolver un JSON a medida
def get_assets(session: Session = Depends(get_session)):
    """Get all assets mapped for Frontend"""
    assets = db_service.get_all_assets(session)
    return [{
        "id": a.id,
        "name": a.name,
        "category": a.category,
        "color": a.color,
        "archived": a.is_archived,
        "riskLevel": a.risk_level,
        "isin": a.isin,
        "ticker": a.ticker,
        "description": a.description
    } for a in assets]

@app.post("/api/assets", response_model=Asset, status_code=status.HTTP_201_CREATED)
def create_asset(asset: Asset, session: Session = Depends(get_session)):
    """Create a new asset"""
    # Check if ID already exists
    if db_service.get_asset_by_id(session, asset.id):
        raise HTTPException(status_code=400, detail="Asset ID already exists")
    created = db_service.create_asset(session, asset)
    return Asset(**created.model_dump())

@app.put("/api/assets/{asset_id}", response_model=Asset)
def update_asset(asset_id: str, asset: Asset, session: Session = Depends(get_session)):
    """Update an existing asset"""
    updated = db_service.update_asset(session, asset_id, asset)
    if not updated:
        raise HTTPException(status_code=404, detail="Asset not found")
    return Asset(**updated.model_dump())

@app.delete("/api/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, session: Session = Depends(get_session)):
    """Delete an asset"""
    if not db_service.delete_asset(session, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")

# --- History Endpoints ---

@app.get("/api/history")
def get_history(session: Session = Depends(get_session)):
    """Get all history mapped for Frontend"""
    history = db_service.get_all_history(session)
    return [{
        "id": h.id,
        "assetId": h.asset_id,
        "month": h.snapshot_date.strftime("%Y-%m"), # Convertimos 2020-01-01 a "2020-01"
        "nav": float(h.nav) if h.nav else 0,
        "contribution": float(h.contribution) if h.contribution else 0,
        "participations": float(h.participations) if h.participations else None,
        "liquidNavValue": float(h.liquid_nav_value) if h.liquid_nav_value else None,
        "meanCost": float(h.mean_cost) if h.mean_cost else None
    } for h in history]

@app.get("/api/history/asset/{asset_id}", response_model=List[HistoryEntry])
def get_asset_history(asset_id: str, session: Session = Depends(get_session)):
    """Get history for a specific asset"""
    history = db_service.get_history_by_asset(session, asset_id)
    return [HistoryEntry(**entry.model_dump()) for entry in history]

@app.post("/api/history", response_model=HistoryEntry, status_code=status.HTTP_201_CREATED)
def create_history(entry: HistoryEntry, session: Session = Depends(get_session)):
    """Create a new history entry"""
    created = db_service.create_history_entry(session, entry)
    return HistoryEntry(**created.model_dump())

@app.put("/api/history/{history_id}", response_model=HistoryEntry)
def update_history(history_id: str, entry: HistoryEntry, session: Session = Depends(get_session)):
    """Update an existing history entry"""
    updated = db_service.update_history_entry(session, history_id, entry)
    if not updated:
        raise HTTPException(status_code=404, detail="History entry not found")
    return HistoryEntry(**updated.model_dump())

@app.delete("/api/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history(history_id: str, session: Session = Depends(get_session)):
    """Delete a history entry"""
    if not db_service.delete_history_entry(session, history_id):
        raise HTTPException(status_code=404, detail="History entry not found")

# --- Transaction Endpoints ---

@app.get("/api/transactions")
def get_transactions(session: Session = Depends(get_session)):
    """Get all transactions mapped for Frontend"""
    transactions = db_service.get_all_transactions(session)
    return [{
        "id": t.id,
        "assetId": t.asset_id,
        "date": t.transaction_date.strftime("%Y-%m-%d"),
        "type": t.type,
        "ticker": t.ticker,
        "quantity": float(t.quantity) if t.quantity else 0,
        "pricePerUnit": float(t.price_per_unit) if t.price_per_unit else 0,
        "fees": float(t.fees) if t.fees else 0,
        "totalAmount": float(t.total_amount) if t.total_amount else 0
    } for t in transactions]

@app.get("/api/transactions/asset/{asset_id}", response_model=List[Transaction])
def get_asset_transactions(asset_id: str, session: Session = Depends(get_session)):
    """Get transactions for a specific asset"""
    transactions = db_service.get_transactions_by_asset(session, asset_id)
    return [Transaction(**tx.model_dump()) for tx in transactions]

@app.post("/api/transactions", response_model=Transaction, status_code=status.HTTP_201_CREATED)
def create_transaction(transaction: Transaction, session: Session = Depends(get_session)):
    """Create a new transaction"""
    created = db_service.create_transaction(session, transaction)
    return Transaction(**created.model_dump())

@app.put("/api/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: str, transaction: Transaction, session: Session = Depends(get_session)):
    """Update an existing transaction"""
    updated = db_service.update_transaction(session, transaction_id, transaction)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return Transaction(**updated.model_dump())

@app.delete("/api/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: str, session: Session = Depends(get_session)):
    """Delete a transaction"""
    if not db_service.delete_transaction(session, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")

# --- Analytics Endpoints ---

@app.get("/api/portfolio/summary", response_model=PortfolioSummaryResponse)
def get_portfolio_summary(session: Session = Depends(get_session)):
    """Get the latest portfolio summary"""
    latest_history = db_service.get_latest_portfolio_history(session)
    active_assets = {a.id for a in db_service.get_all_assets(session) if not a.is_archived}

    total_value = 0.0
    total_invested = 0.0

    for history in latest_history:
        if history.asset_id in active_assets:
            # We calculate total invested as the sum of all contributions over time,
            # or based on mean_cost * participations. Based on common practice and
            # the prompt "total invertido (coste medio * participaciones)", we use mean_cost * participations.
            nav = float(history.nav) if history.nav else 0.0

            mean_cost = float(history.mean_cost) if history.mean_cost else 0.0
            participations = float(history.participations) if history.participations else 0.0
            invested = mean_cost * participations if participations > 0 else float(history.contribution or 0.0)

            total_value += nav
            total_invested += invested

    absolute_roi = total_value - total_invested
    percentage_roi = (absolute_roi / total_invested * 100) if total_invested > 0 else 0.0

    return PortfolioSummaryResponse(
        total_value=total_value,
        total_invested=total_invested,
        absolute_roi=absolute_roi,
        percentage_roi=percentage_roi
    )

@app.get("/api/portfolio/allocation", response_model=PortfolioAllocationResponse)
def get_portfolio_allocation(session: Session = Depends(get_session)):
    """Get the portfolio allocation by category"""
    latest_history = db_service.get_latest_portfolio_history(session)
    assets = db_service.get_all_assets(session)

    asset_dict = {a.id: a for a in assets if not a.is_archived}

    total_value = 0.0
    allocations = {}

    for history in latest_history:
        if history.asset_id in asset_dict:
            asset = asset_dict[history.asset_id]
            nav = float(history.nav) if history.nav else 0.0

            total_value += nav
            if asset.category not in allocations:
                allocations[asset.category] = 0.0
            allocations[asset.category] += nav

    if total_value > 0:
        for cat in allocations:
            allocations[cat] = (allocations[cat] / total_value) * 100

    return PortfolioAllocationResponse(allocations=allocations)

@app.get("/api/assets/{asset_id}/metrics", response_model=AssetMetricsResponse)
def get_asset_metrics(asset_id: str, session: Session = Depends(get_session)):
    """Get metrics for a specific asset"""
    asset = db_service.get_asset_by_id(session, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    history = db_service.get_history_by_asset(session, asset_id)
    if not history:
        return AssetMetricsResponse(
            asset_id=asset_id,
            total_contributed=0.0,
            current_value=0.0,
            absolute_return=0.0,
            percentage_return=0.0,
            twr=0.0
        )

    # History is sorted by snapshot_date desc, we need asc for TWR
    history_asc = list(reversed(history))

    latest = history_asc[-1]

    current_value = float(latest.nav) if latest.nav else 0.0
    mean_cost = float(latest.mean_cost) if latest.mean_cost else 0.0
    participations = float(latest.participations) if latest.participations else 0.0

    if participations > 0 and mean_cost > 0:
        total_contributed = mean_cost * participations
    else:
        total_contributed = float(latest.contribution) if latest.contribution else 0.0

    absolute_return = current_value - total_contributed
    percentage_return = (absolute_return / total_contributed * 100) if total_contributed > 0 else 0.0

    # Calculate Time-Weighted Return (TWR)
    # TWR = [(1 + RN) * (1 + RN+1) ... ] - 1
    # Rn = (V_end - (V_begin + CF)) / (V_begin + CF)

    twr_multiplier = 1.0
    previous_nav = 0.0
    previous_contribution = 0.0

    for i, entry in enumerate(history_asc):
        nav = float(entry.nav) if entry.nav else 0.0

        # Contribution at this period.
        # Since 'contribution' usually tracks running total, the cash flow is the diff
        curr_total_contrib = 0.0
        if entry.participations and entry.mean_cost and float(entry.participations) > 0:
             curr_total_contrib = float(entry.participations) * float(entry.mean_cost)
        else:
             curr_total_contrib = float(entry.contribution) if entry.contribution else 0.0

        cash_flow = curr_total_contrib - previous_contribution

        # We only calculate return if there was an initial value or a cashflow
        base_value = previous_nav + cash_flow
        if base_value > 0:
             period_return = (nav - base_value) / base_value
             twr_multiplier *= (1 + period_return)

        previous_nav = nav
        previous_contribution = curr_total_contrib

    twr = (twr_multiplier - 1.0) * 100

    return AssetMetricsResponse(
        asset_id=asset_id,
        total_contributed=total_contributed,
        current_value=current_value,
        absolute_return=absolute_return,
        percentage_return=percentage_return,
        twr=twr
    )

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

@app.get("/fetch-month", response_model=FetchMonthResponse)
async def fetch_month_prices(
    year: int = Query(..., ge=2020, le=2099, description="Year (e.g., 2024)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    session: Session = Depends(get_session)
):
    """
    Fetch prices for all assets for the given month.
    """
    
    logger.info(f"📊 Fetch-month request: {year}-{month:02d}")
    
    if not validate_month(year, month):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid month: {year}-{month:02d}"
        )
    
    errors: List[str] = []
    prices: List[PriceData] = []
    
    try:
        last_business_day = get_last_business_day(year, month)
        logger.info(f"📅 Last business day: {format_date(last_business_day)}")
        
        db_assets = db_service.get_all_assets(session)
        if not db_assets:
            return FetchMonthResponse(
                success=False,
                message="No assets available in the database.",
                year=year,
                month=month,
                lastBusinessDay=format_date(last_business_day),
                prices=[],
                errors=["No assets available"]
            )
        
        assets = [asset.model_dump() for asset in db_assets]
        active_assets = [a for a in assets if not a.get("is_archived", False)]
        
        crypto_assets = [a for a in active_assets if a.get("category") == "Crypto" and ("BTC" in str(a.get("ticker", "")).upper() or "BITCOIN" in str(a.get("name", "")).upper())]
        fund_assets = [a for a in active_assets if a.get("category") == "Fund"]
        
        broker_assets_dict = {}
        stocks_assets = [a for a in active_assets if a.get("category") == "Stocks"]
        
        for broker_asset in stocks_assets:
             broker_id = broker_asset.get("id")
             # Calculate holdings for this broker using the database aggregation
             active_tickers = db_service.get_asset_holdings(session, broker_id)

             broker_assets_dict[broker_asset.get("name")] = {
                 "name": broker_asset.get("name"),
                 "id": broker_id,
                 "category": "Broker",
                 "componentTickers": list(active_tickers.keys()),
                 "holdings": active_tickers
             }
        
        broker_assets = list(broker_assets_dict.values())
        
        tasks = []
        
        def fetch_btc():
            if crypto_assets:
                btc_asset = crypto_assets[0]
                return ("btc", btc_asset, PriceFetcher.fetch_bitcoin_price(
                    date=last_business_day,
                    asset_id=btc_asset["id"],
                    asset_name=btc_asset["name"]
                ))
            return ("btc", None, None)

        if crypto_assets:
            tasks.append(asyncio.to_thread(fetch_btc))

        def make_fund_fetcher(fund):
            def fetch():
                return ("fund", fund, FundScraper.fetch_fund_price(
                    isin=fund["isin"],
                    asset_name=fund["name"],
                    asset_id=fund["id"]
                ))
            return fetch

        for fund in fund_assets:
            if not fund.get("isin"):
                continue
            tasks.append(asyncio.to_thread(make_fund_fetcher(fund)))

        def make_broker_fetcher(broker):
            def fetch():
                component_tickers = broker.get("componentTickers", [])
                holdings = broker.get("holdings", {})
                
                if not component_tickers:
                    return ("broker", broker, [])

                tickers_map = {
                    ticker: (f"{broker.get('name')} - {ticker}", broker["id"])
                    for ticker in component_tickers
                }
                
                individual_prices = PriceFetcher.fetch_multiple_stocks(tickers_map, last_business_day)
                
                total_broker_value = 0.0
                for p in individual_prices:
                    shares = holdings.get(p.ticker, 0.0)
                    total_broker_value += float(p.price) * shares
                    p.assetId = f"ticker-{p.ticker}"
                    p.assetName = f"Stock {p.ticker}"
                
                if total_broker_value > 0:
                    aggregated_price = PriceData(
                        assetId=broker["id"],
                        assetName=broker["name"],
                        ticker=None,
                        price=round(total_broker_value, 2),
                        currency="EUR",
                        fetchedAt=format_datetime_iso(datetime.now()),
                        source="yfinance_aggregated"
                    )
                    return ("broker", broker, [aggregated_price] + individual_prices)
                    
                return ("broker", broker, individual_prices)
            return fetch

        for broker in broker_assets:
            if broker.get("componentTickers"):
                tasks.append(asyncio.to_thread(make_broker_fetcher(broker)))

        results = await asyncio.gather(*tasks)

        # To keep track of nav mapping
        nav_mapping = {}

        for result in results:
            type_ = result[0]
            if type_ == "btc":
                _, asset, btc_data = result
                if btc_data:
                    prices.append(btc_data)
                    nav_mapping[btc_data.assetId] = btc_data.price # Just storing price
                else: errors.append("Failed to fetch Bitcoin price")
            elif type_ == "fund":
                _, fund, price_data = result
                if price_data:
                    prices.append(price_data)
                    nav_mapping[price_data.assetId] = price_data.price
                else: errors.append(f"Failed to fetch price for {fund.get('name')}")
            elif type_ == "broker":
                _, broker, broker_prices = result
                prices.extend(broker_prices)
                for p in broker_prices:
                    if p.ticker is None: # The aggregated one
                         nav_mapping[p.assetId] = p.price
        
        logger.info(f"✅ Fetched {len(prices)} prices successfully")
        
        if len(prices) == 0:
            return FetchMonthResponse(
                success=False,
                message="No prices fetched",
                year=year,
                month=month,
                lastBusinessDay=format_date(last_business_day),
                prices=[],
                errors=errors
            )
        
        from decimal import Decimal
        import uuid

        saved_count = 0
        month_str = f"{year}-{month:02d}-01"
        date_obj = datetime.strptime(month_str, "%Y-%m-%d").date()

        # We only want to save HistoryEntry for actual assets (not individual tickers inside a broker)
        # So we look at the original active_assets and the nav_mapping

        for asset in active_assets:
             asset_id = asset["id"]
             if asset_id in nav_mapping:
                 val = nav_mapping[asset_id]
                 
                 # Recuperar historial anterior para mantener datos (aportaciones, coste medio...)
                 prev_history_all = db_service.get_history_by_asset(session, asset_id)
                 # Evitamos coger datos del propio mes si se está recalculando
                 prev_history = [h for h in prev_history_all if h.snapshot_date < date_obj]
                 
                 participations = (prev_history[0].participations 
                                if prev_history and prev_history[0].participations is not None 
                                else Decimal("0.0"))

                 contribution = (prev_history[0].contribution 
                                if prev_history and prev_history[0].contribution is not None 
                                else Decimal("0.0"))

                 mean_cost = (prev_history[0].mean_cost 
                            if prev_history and prev_history[0].mean_cost is not None 
                            else Decimal("0.0"))
                 
                 # Detectar si el activo es Bitcoin
                 is_btc = asset.get("category") == "Crypto" and ("BTC" in str(asset.get("ticker", "")).upper() or "BITCOIN" in str(asset.get("name", "")).upper())
                 
                 if is_btc:
                     # La verdad: Calcular participaciones reales desde transacciones (vía DB aggregation)
                     btc_holdings = db_service.get_total_btc_holdings(session, asset_id)
                     
                     participations = Decimal(str(round(btc_holdings, 8)))
                     nav_val = Decimal(str(round(float(val) * btc_holdings, 2)))
                     liquid_nav = Decimal(str(val))
                     
                 elif asset.get("name") == "Interactive Brokers":
                     nav_val = Decimal(str(val))
                     liquid_nav = Decimal("1.0") if float(val) > 0 else Decimal("0.0")
                     
                 else:
                     # Fondos indexados y resto de activos
                     nav_val = Decimal(str(round(float(val) * float(participations), 2)))
                     liquid_nav = Decimal(str(val))

                 history_entry = HistoryEntry(
                     id=str(uuid.uuid4()),
                     asset_id=asset_id,
                     snapshot_date=date_obj,
                     liquid_nav_value=liquid_nav,
                     nav=nav_val,
                     contribution=contribution,
                     participations=participations,
                     mean_cost=mean_cost
                 )
                 db_service.create_history_entry(session, history_entry)
                 saved_count += 1

        logger.info(f"💾 Saved {saved_count} history entries to database")
        
        return FetchMonthResponse(
            success=True,
            message=f"Successfully fetched and saved {len(prices)} prices",
            year=year,
            month=month,
            lastBusinessDay=format_date(last_business_day),
            prices=prices,
            errors=errors
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in fetch-month: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching prices: {str(e)}")
