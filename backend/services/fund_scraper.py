import requests
from bs4 import BeautifulSoup
from typing import Optional
from datetime import datetime
import logging
import re
from models import PriceData
from cachetools import cached, TTLCache
from utils import format_datetime_iso

logger = logging.getLogger(__name__)

class FundScraper:
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }


    # Cache valid for 4 hours (14400 seconds)
    @staticmethod
    @cached(cache=TTLCache(maxsize=100, ttl=14400))
    def fetch_fund_price(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Try multiple strategies to fetch fund price"""
        
        # Estrategia 1: FT Markets
        price_data = FundScraper._fetch_from_ft(isin, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (FT Markets)")
            return price_data
        
        # Estrategia 2: Morningstar
        price_data = FundScraper._fetch_from_morningstar(isin, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (Morningstar)")
            return price_data
        
        # Estrategia 3: Fondos.net (Spanish funds database)
        price_data = FundScraper._fetch_from_fondosnet(isin, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (Fondos.net)")
            return price_data
        
        logger.error(f"❌ No se encontró precio para {asset_name} ({isin}) en ninguna fuente")
        return None

    @staticmethod
    def _fetch_from_ft(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Financial Times Markets"""
        try:
            logger.info(f"🔄 Intentando FT Markets para {asset_name} ({isin})")
            url = f"https://markets.ft.com/data/funds/tearsheet/summary?s={isin}:EUR"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            
            if response.status_code != 200:
                logger.debug(f"FT retornó status {response.status_code}")
                return None

            soup = BeautifulSoup(response.text, "html.parser")
            
            # Intentar múltiples selectores
            price_selectors = [
                {"name": "span", "class": "mod-ui-data-list__value"},
                {"name": "span", "class": "js-mod-data--lastPrice"},
                {"name": "span", "data-field": "last_close"},
            ]
            
            for selector in price_selectors:
                try:
                    element = soup.find(selector.pop("name"), **selector)
                    if element:
                        price_text = element.text.strip()
                        price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(",", ""))
                        if price_match:
                            return FundScraper._create_price_data(asset_id, asset_name, isin, price_match.group())
                except:
                    continue
            
            # Buscar en meta tags (más robusto)
            meta_price = soup.find("meta", {"itemprop": "price"})
            if meta_price:
                price_val = meta_price.get("content")
                if price_val:
                    return FundScraper._create_price_data(asset_id, asset_name, isin, price_val)
            
            logger.debug(f"No se encontró selector válido en FT para {isin}")
            return None
            
        except Exception as e:
            logger.debug(f"Error en FT scraper para {isin}: {e}")
            return None

    @staticmethod
    def _fetch_from_morningstar(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Morningstar via API and Next.js State"""
        import json # Asegúrate de importarlo en la cabecera de fund_scraper.py
        
        try:
            logger.info(f"🔄 Intentando Morningstar API para {asset_name} ({isin})")
            
            # INTENTO 1: API interna de Morningstar (Excelente para SecIds como 0P0001NBRZ)
            # Probamos con y sin el sufijo común de planes de pensiones españoles
            for suffix in ["", "]2]0]FOESP$$ALL"]:
                api_url = f"https://tools.morningstar.es/api/rest.svc/timeseries_price/t92wz0sj7c?id={isin}{suffix}&currencyId=EUR&idtype=Morningstar&frequency=daily&outputType=JSON"
                response_api = requests.get(api_url, headers=FundScraper.HEADERS, timeout=10)
                
                if response_api.status_code == 200 and "TimeSeries" in response_api.text:
                    try:
                        data = response_api.json()
                        history = data.get('TimeSeries', {}).get('Security', [{}])[0].get('HistoryDetail', [])
                        if history:
                            # Tomamos el último precio registrado en la serie histórica
                            last_price = history[-1].get('Value')
                            if last_price:
                                return FundScraper._create_price_data(asset_id, asset_name, isin, str(last_price))
                    except Exception as e:
                        logger.debug(f"Error en API de Morningstar con sufijo '{suffix}': {e}")

            # INTENTO 2: Morningstar Web (Nueva interfaz Next.js)
            logger.info(f"🔄 Intentando Morningstar Web (Next.js) para {asset_name} ({isin})")
            url = f"https://www.morningstar.es/es/funds/{isin}/quote.html"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                
                # Extraemos el JSON gigante que Next.js inyecta en el HTML para renderizar la página
                next_data = soup.find("script", id="__NEXT_DATA__")
                if next_data and next_data.string:
                    # Usamos expresiones regulares para capturar el valor exacto (nav, closePrice o price)
                    price_match = re.search(r'"nav"\s*:\s*\{\s*"value"\s*:\s*([\d\.]+)', next_data.string)
                    if not price_match:
                        price_match = re.search(r'"closePrice"\s*:\s*\{\s*"value"\s*:\s*([\d\.]+)', next_data.string)
                    if not price_match:
                        price_match = re.search(r'"price"\s*:\s*\{\s*"value"\s*:\s*([\d\.]+)', next_data.string)
                        
                    if price_match:
                        return FundScraper._create_price_data(asset_id, asset_name, isin, price_match.group(1))

                # INTENTO 3: Selectores HTML clásicos como último recurso
                price_selectors = [
                    {"name": "span", "class": "label-value"},
                    {"name": "td", "class": "text-right"},
                    {"name": "div", "class": "price-value"} # Clase frecuente en nuevas UI
                ]
                
                for selector in price_selectors:
                    try:
                        elements = soup.find_all(selector.pop("name"), **selector)
                        for element in elements:
                            price_text = element.text.strip()
                            price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(",", "").replace("€", "").strip())
                            if price_match:
                                return FundScraper._create_price_data(asset_id, asset_name, isin, price_match.group())
                    except:
                        continue

            logger.debug(f"No se encontró precio en Morningstar para {isin}")
            return None
            
        except Exception as e:
            logger.debug(f"Error en Morningstar scraper para {isin}: {e}")
            return None

    @staticmethod
    def _fetch_from_fondosnet(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Fondos.net (Spanish funds database)"""
        try:
            logger.info(f"🔄 Intentando Fondos.net para {asset_name} ({isin})")
            url = f"https://www.fondos.net/fondo/{isin.lower()}"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            
            if response.status_code != 200:
                logger.debug(f"Fondos.net retornó status {response.status_code}")
                return None
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Buscar el valor actual del fondo
            price_patterns = [
                r'(?:Valor|Price|Precio).*?[\d,]+\.?\d+',
                r'(?:Último cierre|Last Close).*?[\d,]+\.?\d+',
            ]
            
            text_content = soup.get_text()
            for pattern in price_patterns:
                matches = re.finditer(pattern, text_content, re.IGNORECASE)
                for match in matches:
                    price_match = re.search(r'[\d,]+\.?\d*', match.group().replace(",", ""))
                    if price_match:
                        return FundScraper._create_price_data(asset_id, asset_name, isin, price_match.group())
            
            logger.debug(f"No se encontró precio en Fondos.net para {isin}")
            return None
            
        except Exception as e:
            logger.debug(f"Error en Fondos.net scraper para {isin}: {e}")
            return None

    @staticmethod
    def _create_price_data(asset_id, name, isin, price_str):
        """Create PriceData object from price string"""
        try:
            # Limpiar el string y convertir a float
            price_clean = price_str.replace(",", "").replace("€", "").strip()
            price_value = float(price_clean)
            
            return PriceData(
                assetId=asset_id,
                assetName=name,
                isin=isin,
                price=round(price_value, 4),
                currency="EUR",
                fetchedAt=format_datetime_iso(datetime.now()),
                source="fund_scraper"
            )
        except Exception as e:
            logger.debug(f"Error al parsear precio '{price_str}' para {isin}: {e}")
            return None