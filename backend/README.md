# WealthHub Backend API

FastAPI backend for WealthHub wealth management application. Automates fetching of asset prices (NAV) for cryptoassets, mutual funds, stocks, and pension plans.

## Installation

### Prerequisites

- Python 3.9+
- pip or poetry

### Setup

1. Copy environment variables:
```bash
cp .env.example .env
```

2. The database is automatically configured to use SQLite (`wealthhub.db`). Ensure `DATABASE_URL` is set in your `.env` if you want to use a different database.

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running

### Development

```bash
python main.py
```

The API will be available at `http://localhost:8000`

### With Uvicorn

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### With Docker

```bash
docker build -t wealthhub-backend .
docker run -p 8000:8000 --env-file .env wealthhub-backend
```

## API Endpoints

### Health Check

```
GET /health
```

Check if the API is running.

### Fetch Month Prices

```
GET /fetch-month?year=2024&month=2
```

Fetch prices for all assets for a given month. Automatically:
- Determines the last business day of the month
- Fetches Bitcoin price from yfinance
- Fetches fund prices from Morningstar
- Fetches stock prices from yfinance
- Updates history in Google Apps Script

**Query Parameters:**
- `year` (required): Year (e.g., 2024)
- `month` (required): Month (1-12)

**Response:**
```json
{
  "success": true,
  "message": "Successfully fetched X prices",
  "year": 2024,
  "month": 2,
  "lastBusinessDay": "2024-02-29",
  "prices": [
    {
      "asset_id": "btc-usd",
      "asset_name": "Bitcoin",
      "ticker": "BTC-EUR",
      "price": 42500.50,
      "currency": "EUR",
      "fetched_at": "2024-02-26T18:30:00Z",
      "source": "yfinance"
    }
  ],
  "errors": []
}
```

### Get Assets

```
GET /assets
```

Get list of all assets from Google Apps Script.

### Update Prices

```
POST /update-prices
Content-Type: application/json

[{
  "asset_id": "asset-1",
  "asset_name": "Asset Name",
  "price": 1000.50,
  "currency": "EUR",
  "fetched_at": "2024-02-26T18:30:00Z",
  "source": "manual"
}]
```

Update price data manually and persist to Google Apps Script.

## Asset Configuration

Assets need to be configured with proper identifiers:

### Bitcoin/Crypto
- `ticker`: "BTC-EUR" (for Bitcoin)
- Category: "Crypto"

### Mutual Funds
- `isin`: ISIN code (e.g., "ES0165151004")
- Category: "Fund"

### Stocks
- `ticker`: Stock ticker (e.g., "AAPL")
- Category: "Stock" or "Stocks"

### Pension Plans
- `ticker` or `isin`: Identifier for the plan
- Category: "Pension Plan"

## Hierarchical Asset Structure

The system supports a hierarchical organization of assets to group related items (e.g., stocks under a broker, funds under a bank account).

### Hierarchy Levels

1. **Root Assets** (`parent_asset_id = NULL`): Top-level containers like brokers or bank accounts
   - Example: "Interactive Brokers", "BBVA Cuenta Corriente"

2. **Child Assets**: Assets that belong to a root asset
   - Example: "AAPL" (child of "Interactive Brokers")

### API Endpoints for Hierarchical Assets

```
GET /api/assets                             # Returns root assets only (default)
GET /api/assets?parent_id={parent_id}       # Returns children of specified parent
GET /api/assets?include_all=true            # Returns all assets (root + children)
```

**Example Requests:**

```bash
# Get all brokers/accounts (root assets)
curl http://localhost:8000/api/assets

# Get all stocks in a specific broker
curl http://localhost:8000/api/assets?parent_id=interactive-brokers

# Get everything (for internal use)
curl http://localhost:8000/api/assets?include_all=true
```

**Frontend Usage:**

By default, the Assets Management page shows root assets. Users can expand each root asset to see its children.

### Creating Hierarchical Assets

**Root Asset (e.g., Broker):**
```json
POST /api/assets

{
  "id": "interactive-brokers",
  "name": "Interactive Brokers",
  "category": "CASH",
  "currency": "USD",
  "parentAssetId": null
}
```

**Child Asset (e.g., Stock in Broker):**
```json
POST /api/assets

{
  "id": "aapl-ib",
  "name": "Apple Inc",
  "category": "STOCK",
  "ticker": "AAPL",
  "currency": "USD",
  "parentAssetId": "interactive-brokers"
}
```

### Database Structure

The `asset` table includes:
- `parent_asset_id`: Foreign key to another asset (NULL for root assets)
- Indexed for efficient hierarchical queries

#### Indexes for Performance

```sql
CREATE INDEX idx_asset_parent_id ON asset(parent_asset_id);
CREATE INDEX idx_asset_parent_null ON asset(parent_asset_id) WHERE parent_asset_id IS NULL;
```

See [HIERARCHICAL_ASSETS.md](../HIERARCHICAL_ASSETS.md) for complete documentation.

## Data Persistence

Prices are automatically persisted to Google Apps Script in the `history` array with format:

```json
{
  "month": "2024-02",
  "asset_id": "asset-id",
  "nav": 42500.50,
  "contribution": 42500.50,
  "source": "yfinance",
  "date": "2024-02-26T18:30:00Z"
}
```

## Data Sources

- **Bitcoin & Stocks**: yfinance (Yahoo Finance)
- **Mutual Funds**: Morningstar (via ISIN), with fallback to Financial Times Markets

## Last Business Day Calculation

The API automatically calculates the last business day of any given month:
- Avoids weekends (Saturday/Sunday)
- Fetches prices as of this date
- Prevents fetching prices on weekends when markets are closed

## CORS Configuration

The API is configured to accept requests from `http://localhost:3000` by default. To change this, update `FRONTEND_URL` in `.env`.

## Error Handling

The API provides detailed error information:
- Missing assets: Listed in the `errors` array
- Failed fetches: Individual error messages per asset
- Will return partial results if some assets fail

## Development

### Adding New Asset Sources

1. Create a new service in `services/` directory
2. Implement price fetching logic
3. Add to `main.py` in the `fetch_month_prices` function
4. Test with sample assets

### Testing

Sample assets are provided when GAS URL is not configured or unavailable.

## Troubleshooting

### "GAS URL not configured"
- Check that `GAS_URL` is set in `.env`
- Verify the Google Apps Script deployment ID

### "Failed to fetch Bitcoin price"
- Check internet connection
- Verify yfinance is not rate-limited
- Try again later

### "Failed to fetch fund price"
- Verify ISIN code is correct
- Check if fund exists on Morningstar
- Try the Financial Times fallback

## Security

- CORS is configured for frontend URL only
- NO authentication implemented (suitable for personal use)
- Add authentication if exposing to internet

## License

Private - WealthHub Project
