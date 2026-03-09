import yfinance as yf
import pandas as pd
import requests
from bs4 import BeautifulSoup  # Añadido para hacer web scraping
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
        # Intento 1: Yahoo Finance (Actualizado para extraer el float de forma segura)
        try:
            ticker = yf.Ticker("BTC-EUR")
            hist = ticker.history(period="5d")
            
            if not hist.empty:
                close_value = hist['Close'].iloc[-1]
                # Extracción segura compatible con las nuevas versiones de pandas
                if hasattr(close_value, 'item'):
                    close_price = float(close_value.item())
                else:
                    close_price = float(close_value)
                    
                return PriceData(
                    asset_id=asset_id or "btc",
                    asset_name=asset_name,
                    ticker="BTC-EUR",
                    price=round(close_price, 2),
                    currency="EUR",
                    fetched_at=format_datetime_iso(datetime.now()),
                    source="yfinance"
                )
        except Exception as e:
            logger.warning(f"⚠️ Yahoo falló para Bitcoin: {e}. Intentando CoinGecko...")

        # Intento 2: Fallback CoinGecko API (Pública, sin bloqueos y muy fiable)
        try:
            url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur"
            res = requests.get(url, headers=PriceFetcher.HEADERS, timeout=10)
            if res.status_code == 200:
                data = res.json()
                return PriceData(
                    asset_id=asset_id or "btc",
                    asset_name=asset_name,
                    ticker="BTC-EUR",
                    price=round(float(data['bitcoin']['eur']), 2),
                    currency="EUR",
                    fetched_at=format_datetime_iso(datetime.now()),
                    source="coingecko_api"
                )
        except Exception as e:
            logger.warning(f"⚠️ CoinGecko falló para Bitcoin: {e}. Intentando Binance...")

        # Intento 3: Fallback Binance API (Mantenido por si acaso)
        try:
            res = requests.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR", timeout=10)
            if res.status_code == 200:
                data = res.json()
                return PriceData(
                    asset_id=asset_id or "btc",
                    asset_name=asset_name,
                    ticker="BTC-EUR",
                    price=round(float(data['price']), 2),
                    currency="EUR",
                    fetched_at=format_datetime_iso(datetime.now()),
                    source="binance_api"
                )
        except Exception as e:
            logger.error(f"❌ Fallo total en Bitcoin usando todos los métodos: {e}")
            
        return None

    @staticmethod
    @cached(cache=TTLCache(maxsize=50, ttl=14400), key=lambda tickers, date: str(tickers) + str(date))  # 4 hours cache
    def fetch_multiple_stocks(tickers: Dict[str, Tuple[str, str]], date: datetime) -> List[PriceData]:
        prices = []
        
        for ticker_symbol, (name, asset_id) in tickers.items():
            price = None
            source = "yfinance"
            
            # Intento 1: yfinance
            try:
                data = yf.download(ticker_symbol, period="5d", progress=False)
                if not data.empty:
                    close_value = data['Close'].iloc[-1]
                    if hasattr(close_value, 'item'):
                        price = float(close_value.item())
                    else:
                        price = float(close_value)
            except Exception as e:
                logger.warning(f"⚠️ yfinance falló para {ticker_symbol}. Intentando API directa...")

            # Intento 2: Petición HTTP directa a la API JSON de Yahoo
            if price is None:
                try:
                    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker_symbol}?range=1d&interval=1d"
                    res = requests.get(url, headers=PriceFetcher.HEADERS, timeout=10)
                    
                    if res.status_code == 200:
                        chart_data = res.json()
                        if chart_data.get('chart', {}).get('result'):
                            result = chart_data['chart']['result'][0]
                            price = float(result['meta']['regularMarketPrice'])
                            source = "yahoo_api_direct"
                except Exception as e:
                    logger.warning(f"⚠️ Fallo en la petición HTTP API para {ticker_symbol}")

            # Intento 3: Batería de Web Scraping (MarketWatch, Finviz, CNBC, Yahoo HTML)
            if price is None:
                logger.info(f"🔄 Iniciando batería de Web Scraping para {ticker_symbol}...")
                
                # Opción A: MarketWatch
                try:
                    mw_url = f"https://www.marketwatch.com/investing/stock/{ticker_symbol.lower()}"
                    mw_res = requests.get(mw_url, headers=PriceFetcher.HEADERS, timeout=10)
                    if mw_res.status_code == 200:
                        soup = BeautifulSoup(mw_res.text, "html.parser")
                        price_element = soup.find("bg-quote", {"class": "value"})
                        if price_element:
                            price = float(price_element.text.replace(',', '').strip())
                            source = "marketwatch_scraper"
                except Exception as e:
                    logger.debug(f"Fallo en MarketWatch: {e}")

                # Opción B: Finviz (Muy fiable para acciones de EEUU)
                if price is None:
                    try:
                        fv_url = f"https://finviz.com/quote.ashx?t={ticker_symbol.upper()}"
                        fv_res = requests.get(fv_url, headers=PriceFetcher.HEADERS, timeout=10)
                        if fv_res.status_code == 200:
                            soup = BeautifulSoup(fv_res.text, "html.parser")
                            # En Finviz el precio está junto a la etiqueta 'Price' en negrita
                            price_label = soup.find(string="Price")
                            if price_label:
                                price_val = price_label.find_next("b").text
                                price = float(price_val.replace(',', '').strip())
                                source = "finviz_scraper"
                    except Exception as e:
                        logger.debug(f"Fallo en Finviz: {e}")

                # Opción C: CNBC
                if price is None:
                    try:
                        cnbc_url = f"https://www.cnbc.com/quotes/{ticker_symbol}"
                        cnbc_res = requests.get(cnbc_url, headers=PriceFetcher.HEADERS, timeout=10)
                        if cnbc_res.status_code == 200:
                            soup = BeautifulSoup(cnbc_res.text, "html.parser")
                            price_element = soup.find("span", {"class": "QuoteStrip-lastPrice"})
                            if price_element:
                                price = float(price_element.text.replace(',', '').strip())
                                source = "cnbc_scraper"
                    except Exception as e:
                        logger.debug(f"Fallo en CNBC: {e}")

                # Opción D: Yahoo HTML Puro
                if price is None:
                    try:
                        yh_url = f"https://finance.yahoo.com/quote/{ticker_symbol}"
                        yh_res = requests.get(yh_url, headers=PriceFetcher.HEADERS, timeout=10)
                        if yh_res.status_code == 200:
                            soup = BeautifulSoup(yh_res.text, "html.parser")
                            streamer = soup.find("fin-streamer", {"data-symbol": ticker_symbol.upper(), "data-field": "regularMarketPrice"})
                            if streamer and streamer.get("value"):
                                price = float(streamer.get("value"))
                                source = "yahoo_html_scraper"
                    except Exception as e:
                        logger.debug(f"Fallo en Yahoo HTML: {e}")

            # Validar y guardar el precio final obtenido
            if price is not None:
                prices.append(PriceData(
                    asset_id=asset_id,
                    asset_name=name,
                    ticker=ticker_symbol,
                    price=round(price, 2),
                    fetched_at=format_datetime_iso(datetime.now()),
                    source=source
                ))
                logger.info(f"✅ {ticker_symbol}: {round(price, 2)} EUR (Fuente: {source})")
            else:
                logger.error(f"❌ No se pudo obtener precio para {ticker_symbol} con NINGÚN método.")
                
        return prices