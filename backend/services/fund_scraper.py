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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    }

    # Cache valid for 4 hours (14400 seconds)
    @staticmethod
    @cached(cache=TTLCache(maxsize=100, ttl=14400))
    def fetch_fund_price(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Try multiple strategies to fetch fund (fondo de inversión) price"""

        # Strategy 1: QueFondos (Most reliable for Spanish funds)
        price_data = FundScraper._fetch_from_quefondos(isin, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (QueFondos)")
            return price_data

        # Strategy 2: Morningstar
        price_data = FundScraper._fetch_from_morningstar(isin, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (Morningstar)")
            return price_data

        # Strategy 3: FT Markets
        price_data = FundScraper._fetch_from_ft(isin, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (FT Markets)")
            return price_data

        # Strategy 4: Fondos.net
        price_data = FundScraper._fetch_from_fondosnet(isin, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (Fondos.net)")
            return price_data

        logger.error(f"❌ No price found for {asset_name} ({isin}) in any source")
        return None

    @staticmethod
    @cached(cache=TTLCache(maxsize=100, ttl=14400))
    def fetch_pension_price(dgs_code: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """
        Fetch NAV for Spanish pension plans (planes de pensiones).

        Pension plans use DGS codes (e.g. N5430) issued by the Dirección General
        de Seguros, NOT standard ISINs. Each source uses a different URL pattern
        from regular investment funds.
        """
        # Strategy 1: QueFondos – pension plan page (/planes/ not /fondos/)
        price_data = FundScraper._fetch_pension_from_quefondos(dgs_code, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (QueFondos PP)")
            return price_data

        # Strategy 2: Morningstar pension plan search by DGS code / name
        price_data = FundScraper._fetch_pension_from_morningstar(dgs_code, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (Morningstar PP)")
            return price_data

        # Strategy 3: Finect planes de pensiones
        price_data = FundScraper._fetch_pension_from_finect(dgs_code, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (Finect PP)")
            return price_data

        # Strategy 4: Inverco (official pension data)
        price_data = FundScraper._fetch_pension_from_inverco(dgs_code, asset_name, asset_id)
        if price_data:
            logger.info(f"✅ {asset_name}: {price_data.price} EUR (Inverco PP)")
            return price_data

        logger.error(f"❌ No price found for {asset_name} ({dgs_code}) in any pension source")
        return None

    @staticmethod
    def _fetch_from_quefondos(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from QueFondos.com (Very reliable for Spanish ISINs)"""
        try:
            logger.info(f"🔄 Trying QueFondos for {asset_name} ({isin})")
            url = f"https://www.quefondos.com/es/fondos/ficha/index.html?isin={isin}"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                # NAV is usually in a span with class "float-right enorme"
                price_element = soup.find("span", class_="float-right enorme")
                if price_element:
                    price_text = price_element.text.strip()
                    # Extract the number
                    price_match = re.search(r'[\d\.,]+', price_text)
                    if price_match:
                        return FundScraper._create_price_data(asset_id, asset_name, isin, price_match.group())
        except Exception as e:
            logger.debug(f"Error in QueFondos scraper for {isin}: {e}")
        return None

    @staticmethod
    def _fetch_from_morningstar(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Morningstar via API and Next.js State"""
        import json
        try:
            logger.info(f"🔄 Trying Morningstar API for {asset_name} ({isin})")
            
            # FIX: Use idtype=ISIN for Morningstar to accept ISIN correctly
            for suffix in ["", "]2]0]FOESP$$ALL"]:
                api_url = f"https://tools.morningstar.es/api/rest.svc/timeseries_price/t92wz0sj7c?id={isin}{suffix}&currencyId=EUR&idtype=ISIN&frequency=daily&outputType=JSON"
                response_api = requests.get(api_url, headers=FundScraper.HEADERS, timeout=10)
                
                if response_api.status_code == 200 and "TimeSeries" in response_api.text:
                    try:
                        data = response_api.json()
                        history = data.get('TimeSeries', {}).get('Security', [{}])[0].get('HistoryDetail', [])
                        if history:
                            last_price = history[-1].get('Value')
                            if last_price:
                                return FundScraper._create_price_data(asset_id, asset_name, isin, str(last_price))
                    except Exception as e:
                        logger.debug(f"Error in Morningstar API with suffix '{suffix}': {e}")

            # ATTEMPT Web Next.js
            logger.info(f"🔄 Trying Morningstar Web (Next.js) for {asset_name} ({isin})")
            url = f"https://www.morningstar.es/es/funds/{isin}/quote.html"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                next_data = soup.find("script", id="__NEXT_DATA__")
                if next_data and next_data.string:
                    price_match = re.search(r'"nav"\s*:\s*\{\s*"value"\s*:\s*([\d\.]+)', next_data.string)
                    if not price_match:
                        price_match = re.search(r'"closePrice"\s*:\s*\{\s*"value"\s*:\s*([\d\.]+)', next_data.string)
                    if not price_match:
                        price_match = re.search(r'"price"\s*:\s*\{\s*"value"\s*:\s*([\d\.]+)', next_data.string)
                        
                    if price_match:
                        return FundScraper._create_price_data(asset_id, asset_name, isin, price_match.group(1))

            return None
            
        except Exception as e:
            logger.debug(f"Error in Morningstar scraper for {isin}: {e}")
            return None

    @staticmethod
    def _fetch_from_ft(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Financial Times Markets"""
        try:
            logger.info(f"🔄 Trying FT Markets for {asset_name} ({isin})")
            url = f"https://markets.ft.com/data/funds/tearsheet/summary?s={isin}:EUR"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            if response.status_code != 200: return None
            soup = BeautifulSoup(response.text, "html.parser")
            
            price_selectors = [
                {"name": "span", "class": "mod-ui-data-list__value"},
                {"name": "span", "class": "js-mod-data--lastPrice"},
                {"name": "span", "data-field": "last_close"},
            ]
            for selector in price_selectors:
                try:
                    element = soup.find(selector.pop("name"), **selector)
                    if element:
                        price_match = re.search(r'[\d\.,]+', element.text.strip())
                        if price_match:
                            return FundScraper._create_price_data(asset_id, asset_name, isin, price_match.group())
                except:
                    continue
            return None
        except Exception as e:
            logger.debug(f"Error in FT scraper for {isin}: {e}")
            return None

    @staticmethod
    def _fetch_from_fondosnet(isin: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Fetch from Fondos.net"""
        try:
            logger.info(f"🔄 Trying Fondos.net for {asset_name} ({isin})")
            url = f"https://www.fondos.net/fondo/{isin.lower()}"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            if response.status_code != 200: return None
            
            soup = BeautifulSoup(response.text, "html.parser")
            price_patterns = [
                r'(?:Valor|Price|Precio).*?([\d\.,]+)',
                r'(?:Último cierre|Last Close).*?([\d\.,]+)',
            ]
            text_content = soup.get_text()
            for pattern in price_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    return FundScraper._create_price_data(asset_id, asset_name, isin, match.group(1))
            return None
        except Exception as e:
            logger.debug(f"Error in Fondos.net scraper for {isin}: {e}")
            return None

    # ─────────────────────────────────────────────────────────────
    # Pension plan specific scrapers (DGS codes, not ISINs)
    # ─────────────────────────────────────────────────────────────

    @staticmethod
    def _fetch_pension_from_quefondos(dgs_code: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """QueFondos pension plan page — /planes/ path uses the DGS code directly."""
        try:
            logger.info(f"🔄 Trying QueFondos PP for {asset_name} ({dgs_code})")
            url = f"https://www.quefondos.com/es/planes/ficha/index.html?isin={dgs_code}"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                # Same class as fund pages
                price_element = soup.find("span", class_="float-right enorme")
                if price_element:
                    price_match = re.search(r'[\d\.,]+', price_element.text.strip())
                    if price_match:
                        return FundScraper._create_price_data(asset_id, asset_name, dgs_code, price_match.group())
                # Fallback: look for any table cell that contains the value liquidativo
                for td in soup.find_all("td"):
                    if "valor" in td.text.lower() or "liquidativo" in td.text.lower():
                        sibling = td.find_next_sibling("td")
                        if sibling:
                            price_match = re.search(r'[\d\.,]+', sibling.text.strip())
                            if price_match:
                                return FundScraper._create_price_data(asset_id, asset_name, dgs_code, price_match.group())
        except Exception as e:
            logger.debug(f"Error in QueFondos PP for {dgs_code}: {e}")
        return None

    @staticmethod
    def _fetch_pension_from_morningstar(dgs_code: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """
        Morningstar pension plan lookup.

        1. Search for the fund by DGS code or name to get the Morningstar ID.
        2. Fetch the time-series price with that ID using the pension endpoint.
        """
        import json
        try:
            logger.info(f"🔄 Trying Morningstar PP search for {asset_name} ({dgs_code})")

            # Step 1: search Morningstar for the pension plan
            search_url = (
                "https://www.morningstar.es/es/search/getSearchResults.aspx"
                f"?t=PP&q={requests.utils.quote(dgs_code)}"
            )
            resp = requests.get(search_url, headers=FundScraper.HEADERS, timeout=10)
            ms_id = None
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        ms_id = results[0].get("id")
                except Exception:
                    pass

            # If DGS code search failed, try by name
            if not ms_id:
                search_url2 = (
                    "https://www.morningstar.es/es/search/getSearchResults.aspx"
                    f"?t=PP&q={requests.utils.quote(asset_name)}"
                )
                resp2 = requests.get(search_url2, headers=FundScraper.HEADERS, timeout=10)
                if resp2.status_code == 200:
                    try:
                        data2 = resp2.json()
                        results2 = data2.get("results", [])
                        if results2:
                            ms_id = results2[0].get("id")
                    except Exception:
                        pass

            if not ms_id:
                logger.debug(f"Morningstar PP: no ID found for {dgs_code}")
                return None

            # Step 2: fetch time-series price
            for suffix in ["", "]2]0]PPALL$$EUR"]:
                api_url = (
                    f"https://tools.morningstar.es/api/rest.svc/timeseries_price/t92wz0sj7c"
                    f"?id={ms_id}{suffix}&currencyId=EUR&idtype=MSID&frequency=daily&outputType=JSON"
                )
                api_resp = requests.get(api_url, headers=FundScraper.HEADERS, timeout=10)
                if api_resp.status_code == 200 and "TimeSeries" in api_resp.text:
                    try:
                        ts_data = api_resp.json()
                        history = ts_data.get("TimeSeries", {}).get("Security", [{}])[0].get("HistoryDetail", [])
                        if history:
                            last_price = history[-1].get("Value")
                            if last_price:
                                return FundScraper._create_price_data(asset_id, asset_name, dgs_code, str(last_price))
                    except Exception:
                        pass

        except Exception as e:
            logger.debug(f"Error in Morningstar PP for {dgs_code}: {e}")
        return None

    @staticmethod
    def _fetch_pension_from_finect(dgs_code: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """Finect pension plan pages use the DGS code in the URL."""
        try:
            logger.info(f"🔄 Trying Finect PP for {asset_name} ({dgs_code})")
            url = f"https://www.finect.com/fondos-de-pensiones/{dgs_code}"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                text = soup.get_text()
                # Look for "Valor liquidativo" followed by a price
                patterns = [
                    r'[Vv]alor\s+liquidativo[^\d]*([\d\.,]+)',
                    r'[Úú]ltimo\s+[Vv]alor[^\d]*([\d\.,]+)',
                    r'NAV[^\d]*([\d\.,]+)',
                ]
                for pattern in patterns:
                    match = re.search(pattern, text)
                    if match:
                        return FundScraper._create_price_data(asset_id, asset_name, dgs_code, match.group(1))
        except Exception as e:
            logger.debug(f"Error in Finect PP for {dgs_code}: {e}")
        return None

    @staticmethod
    def _fetch_pension_from_inverco(dgs_code: str, asset_name: str, asset_id: str) -> Optional[PriceData]:
        """
        Inverco publishes monthly pension plan data.
        Try a direct search on their site.
        """
        try:
            logger.info(f"🔄 Trying Inverco for {asset_name} ({dgs_code})")
            url = f"https://www.inverco.es/inversiones/planes-de-pensiones/{dgs_code}"
            response = requests.get(url, headers=FundScraper.HEADERS, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                text = soup.get_text()
                patterns = [
                    r'[Vv]alor\s+[Ll]iquidativo[^\d]*([\d\.,]+)',
                    r'NAV[^\d]*([\d\.,]+)',
                ]
                for pattern in patterns:
                    match = re.search(pattern, text)
                    if match:
                        return FundScraper._create_price_data(asset_id, asset_name, dgs_code, match.group(1))
        except Exception as e:
            logger.debug(f"Error in Inverco for {dgs_code}: {e}")
        return None

    @staticmethod
    def _create_price_data(asset_id, name, isin, price_str):
        """Create PriceData object safely converting European number formats to floats"""
        try:
            price_clean = price_str.replace("€", "").strip()
            
            # Logic to detect European decimals (1.234,56 -> 1234.56)
            if "." in price_clean and "," in price_clean:
                if price_clean.rfind(",") > price_clean.rfind("."):
                    price_clean = price_clean.replace(".", "").replace(",", ".")
                else:
                    price_clean = price_clean.replace(",", "")
            elif "," in price_clean:
                # If it only has a comma, assume it's the decimal separator (e.g.: 14,84)
                price_clean = price_clean.replace(",", ".")
                
            price_value = float(price_clean)
            
            if price_value <= 0:
                logger.warning(f"⚠️ Scraped price for {isin} is <= 0 ({price_value}). Ignoring it to prevent zeroing NAV")
                return None
            
            return PriceData(
                asset_id=asset_id,
                asset_name=name,
                isin=isin,
                price=round(price_value, 4),
                currency="EUR",
                fetched_at=format_datetime_iso(datetime.now()),
                source="fund_scraper"
            )
        except Exception as e:
            logger.error(f"Error parsing price '{price_str}' for {isin}: {e}")
            return None
