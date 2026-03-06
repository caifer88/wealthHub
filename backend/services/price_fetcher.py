import yfinance as yf
import pandas as pd
import requests
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
import logging
from models import PriceData
from cachetools import cached, TTLCache
from utils import format_datetime_iso

logger = logging.getLogger(__name__)

class PriceFetcher:
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    }


    @staticmethod
    @cached(cache=TTLCache(maxsize=10, ttl=3600))  # 1 hour cache
    def fetch_bitcoin_price(date: datetime, asset_id: str = None, asset_name: str = "Bitcoin") -> Optional[PriceData]:
        # Intento 1: Yahoo Finance
        try:
            # En nuevas versiones de yfinance, no se debe inyectar session manualmente
            # yfinance usa curl_cffi internamente para evitar bloqueos
            btc_ticker = yf.Ticker("BTC-USD")
            ticker = yf.Ticker("BTC-EUR")
            hist = ticker.history(period="5d") # Pedimos 5 días para asegurar
            btc_hist = btc_ticker.history(period="5d")

            logger.info(f"📈 Historial de BTC-EUR: {hist.tail(1)}")
            logger.info(f"📈 Historial de BTC-USD: {btc_hist.tail(1)}")
            
            if not hist.empty:
                close_price = float(hist['Close'].iloc[-1])
                return PriceData(
                    assetId=asset_id or "btc",
                    assetName=asset_name,
                    ticker="BTC-EUR",
                    price=round(close_price, 2),
                    currency="EUR",
                    fetchedAt=format_datetime_iso(datetime.now()),
                    source="yfinance"
                )
        except Exception as e:
            logger.warning(f"⚠️ Yahoo falló para Bitcoin: {e}. Intentando Binance...")

        # Intento 2: Fallback Binance API (Pública y sin bloqueos)
        try:
            res = requests.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR", timeout=10)
            data = res.json()
            return PriceData(
                assetId=asset_id or "Bitcoin",
                assetName=asset_name,
                ticker="BTC-EUR",
                price=round(float(data['price']), 2),
                currency="EUR",
                fetchedAt=format_datetime_iso(datetime.now()),
                source="binance_api"
            )
        except Exception as e:
            logger.error(f"❌ Fallo total en Bitcoin: {e}")
            return None


    @staticmethod
    @cached(cache=TTLCache(maxsize=50, ttl=14400), key=lambda tickers, date: str(tickers) + str(date))  # 4 hours cache
    def fetch_multiple_stocks(tickers: Dict[str, Tuple[str, str]], date: datetime) -> List[PriceData]:
        prices = []
        
        for ticker_symbol, (name, asset_id) in tickers.items():
            try:
                # Usamos download directamente que a veces es más estable que el objeto Ticker
                data = yf.download(ticker_symbol, period="5d", progress=False)
                if not data.empty:
                    # Asegurar que obtenemos un valor numérico (no una Series)
                    close_value = data['Close'].iloc[-1]
                    # Convertir a float, manejo especial para Series 
                    if hasattr(close_value, 'item'):
                        price = float(close_value.item())
                    else:
                        price = float(close_value)
                    
                    prices.append(PriceData(
                        assetId=asset_id,
                        assetName=name,
                        ticker=ticker_symbol,
                        price=round(price, 2),
                        fetchedAt=format_datetime_iso(datetime.now()),
                        source="yfinance"
                    ))
                    logger.info(f"✅ {ticker_symbol}: {round(price, 2)} EUR")
            except Exception as e:
                logger.warning(f"Error con {ticker_symbol}: {e}")
        return prices