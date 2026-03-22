import asyncio
import logging
from fastapi import APIRouter, HTTPException
import yfinance as yf
from cachetools import cached, TTLCache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/bitcoin", tags=["Bitcoin"])

@cached(cache=TTLCache(maxsize=1, ttl=86400))
def fetch_btc_history():
    ticker = yf.Ticker("BTC-EUR")
    hist = ticker.history(period="5y", interval="1wk")
    result = []
    for index, row in hist.iterrows():
        if str(row['Close']) != 'nan':
            result.append({
                "date": index.strftime("%Y-%m-%d"),
                "price": round(float(row['Close']), 2)
            })
    return result

@router.get("/historical-prices")
async def get_bitcoin_historical_prices():
    try:
        return await asyncio.to_thread(fetch_btc_history) 
    except Exception as e:
        logger.error(f"Error fetching historical BTC prices: {e}")
        raise HTTPException(status_code=500, detail=str(e))
