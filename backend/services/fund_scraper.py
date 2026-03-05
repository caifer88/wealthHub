import httpx
from bs4 import BeautifulSoup
from typing import Optional
from datetime import datetime
import logging
import re
from models import PriceData
from utils import format_datetime_iso, async_ttl_cache

logger = logging.getLogger(__name__)

class FundScraper:
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }


    # Cache valid for 4 hours (14400 seconds)
    @staticmethod
    @async_ttl_cache(maxsize=100, ttl=14400)
    async def fetch_fund_price(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Try multiple strategies to fetch fund price"""
        
        async with httpx.AsyncClient(headers=FundScraper.HEADERS, timeout=15.0, follow_redirects=True) as client:
            # Estrategia 1: FT Markets
            price_data = await FundScraper._fetch_from_ft(client, isin, asset_name, asset_id)
            if price_data:
                logger.info(f"✅ {asset_name}: {price_data.price} EUR (FT Markets)")
                return price_data

            # Estrategia 2: Morningstar
            price_data = await FundScraper._fetch_from_morningstar(client, isin, asset_name, asset_id)
            if price_data:
                logger.info(f"✅ {asset_name}: {price_data.price} EUR (Morningstar)")
                return price_data

            # Estrategia 3: Fondos.net (Spanish funds database)
            price_data = await FundScraper._fetch_from_fondosnet(client, isin, asset_name, asset_id)
            if price_data:
                logger.info(f"✅ {asset_name}: {price_data.price} EUR (Fondos.net)")
                return price_data
        
        logger.error(f"❌ No se encontró precio para {asset_name} ({isin}) en ninguna fuente")
        return None

    @staticmethod
    async def _fetch_from_ft(client: httpx.AsyncClient, isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Financial Times Markets"""
        try:
            logger.info(f"🔄 Intentando FT Markets para {asset_name} ({isin})")
            url = f"https://markets.ft.com/data/funds/tearsheet/summary?s={isin}:EUR"
            response = await client.get(url)
            
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
    async def _fetch_from_morningstar(client: httpx.AsyncClient, isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Morningstar"""
        try:
            logger.info(f"🔄 Intentando Morningstar para {asset_name} ({isin})")
            # Convertir ISIN a formato esperado por Morningstar (ej: ES0165151004 -> LU0165151004)
            url = f"https://www.morningstar.es/es/funds/{isin}/quote.html"
            response = await client.get(url)
            
            if response.status_code != 200:
                logger.debug(f"Morningstar retornó status {response.status_code}")
                return None
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Buscar el precio en Morningstar
            price_selectors = [
                {"name": "span", "class": "label-value"},
                {"name": "td", "class": "text-right"},
            ]
            
            for selector in price_selectors:
                try:
                    elements = soup.find_all(selector.pop("name"), **selector)
                    for element in elements:
                        price_text = element.text.strip()
                        price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(",", "").replace("€", "").strip())
                        if price_match:
                            price_val = price_match.group()
                            return FundScraper._create_price_data(asset_id, asset_name, isin, price_val)
                except:
                    continue
            
            logger.debug(f"No se encontró precio en Morningstar para {isin}")
            return None
            
        except Exception as e:
            logger.debug(f"Error en Morningstar scraper para {isin}: {e}")
            return None

    @staticmethod
    async def _fetch_from_fondosnet(client: httpx.AsyncClient, isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Fondos.net (Spanish funds database)"""
        try:
            logger.info(f"🔄 Intentando Fondos.net para {asset_name} ({isin})")
            url = f"https://www.fondos.net/fondo/{isin.lower()}"
            response = await client.get(url)
            
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