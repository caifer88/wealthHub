import sys
import os
sys.path.insert(0, os.path.abspath('services'))
from fund_scraper import FundScraper
import logging

logging.basicConfig(level=logging.INFO)

isins = {
    "Vanguard SP500": "IE0032126645",
    "Basalto USA": "ES0164691083",
    "Numantia Patrimonio": "ES0173311103"
}

for name, isin in isins.items():
    print(f"--- FETCHING {name} - {isin} ---")
    res = FundScraper.fetch_fund_price(isin, name, isin)
    print("RESULT:", res)

