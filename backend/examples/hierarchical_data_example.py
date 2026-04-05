"""
Example: Data initialization script for hierarchical asset structure
This script demonstrates how to set up a hierarchical asset structure
for common use cases like brokers with stocks, bank accounts, or fund families.
"""

# Example 1: Broker with multiple stocks
INTERACTIVE_BROKERS = {
    "id": "interactive-brokers",
    "name": "Interactive Brokers",
    "category": "CASH",  # Root asset is typically CASH (broker account)
    "currency": "USD",
    "color": "#0066CC",
    "parentAssetId": None,  # Root
    "description": "Interactive Brokers IB LLC account"
}

# Stocks held at Interactive Brokers
APPLE = {
    "id": "aapl-ib",
    "name": "Apple Inc",
    "category": "STOCK",
    "ticker": "AAPL",
    "currency": "USD",
    "color": "#555555",
    "parentAssetId": "interactive-brokers",  # Child of Interactive Brokers
    "description": "Apple Inc common stock"
}

MICROSOFT = {
    "id": "msft-ib",
    "name": "Microsoft Corp",
    "category": "STOCK",
    "ticker": "MSFT",
    "currency": "USD",
    "color": "#00A4EF",
    "parentAssetId": "interactive-brokers",  # Child of Interactive Brokers
    "description": "Microsoft Corp common stock"
}

GOOGLE = {
    "id": "googl-ib",
    "name": "Alphabet Inc",
    "category": "STOCK",
    "ticker": "GOOGL",
    "currency": "USD",
    "color": "#4285F4",
    "parentAssetId": "interactive-brokers",  # Child of Interactive Brokers
    "description": "Alphabet Inc (Google) capit class A"
}

# Example 2: Bank account with funds
BBVA_CUENTA = {
    "id": "bbva-cuenta",
    "name": "BBVA Cuenta Corriente",
    "category": "CASH",
    "currency": "EUR",
    "color": "#0066FF",
    "parentAssetId": None,  # Root
    "description": "BBVA Spanish checking account"
}

BBVA_FONDO = {
    "id": "bbva-fondo-renta",
    "name": "BBVA Fondo Renta Fija",
    "category": "FUND_ACTIVE",
    "currency": "EUR",
    "color": "#0066FF",
    "parentAssetId": "bbva-cuenta",  # Child of BBVA account
    "description": "BBVA active management fixed income fund",
    "isin": "ES0413900477"
}

BBVA_INDEX = {
    "id": "bbva-visionglobal",
    "name": "BBVA Visión Global 30/70",
    "category": "FUND_INDEX",
    "currency": "EUR",
    "color": "#0066FF",
    "parentAssetId": "bbva-cuenta",  # Child of BBVA account
    "description": "BBVA index fund with 30/70 stock/bond allocation",
    "isin": "ES0131105213"
}

# Example 3: Crypto exchange with assets
KRAKEN = {
    "id": "kraken-exchange",
    "name": "Kraken Exchange",
    "category": "CASH",
    "currency": "USD",
    "color": "#6D00CC",
    "parentAssetId": None,  # Root
    "description": "Kraken crypto exchange account"
}

BITCOIN = {
    "id": "btc-kraken",
    "name": "Bitcoin",
    "category": "CRYPTO",
    "ticker": "BTC",
    "currency": "USD",
    "color": "#FF6B00",
    "parentAssetId": "kraken-exchange",  # Child of Kraken
    "description": "Bitcoin cryptocurrency"
}

ETHEREUM = {
    "id": "eth-kraken",
    "name": "Ethereum",
    "category": "CRYPTO",
    "ticker": "ETH",
    "currency": "USD",
    "color": "#627EEA",
    "parentAssetId": "kraken-exchange",  # Child of Kraken
    "description": "Ethereum cryptocurrency"
}

# All assets to initialize
EXAMPLE_ASSETS = [
    # Interactive Brokers group
    INTERACTIVE_BROKERS,
    APPLE,
    MICROSOFT,
    GOOGLE,
    
    # BBVA group
    BBVA_CUENTA,
    BBVA_FONDO,
    BBVA_INDEX,
    
    # Kraken group
    KRAKEN,
    BITCOIN,
    ETHEREUM,
]


def visualize_hierarchy():
    """Helper function to visualize the hierarchical structure"""
    print("\n=== Asset Hierarchy Structure ===\n")
    
    # Group by parent
    roots = [a for a in EXAMPLE_ASSETS if a["parentAssetId"] is None]
    
    for root in roots:
        print(f"📦 {root['name']} (ID: {root['id']})")
        
        children = [a for a in EXAMPLE_ASSETS if a["parentAssetId"] == root["id"]]
        for child in children:
            print(f"   ├─ {child['name']} ({child['category']}) - ID: {child['id']}")
        
        print()


if __name__ == "__main__":
    visualize_hierarchy()
