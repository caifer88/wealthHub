-- Migration: UUID Modernization and Data Transformation
-- Purpose: Migrate from VARCHAR string IDs to native PostgreSQL UUIDs
--          Update enum values to standardized formats
--          Rename exchange_rate fields for consistency

BEGIN; -- Start transaction for atomicity

-- Step 1: Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create mapping table to preserve ID relationships
CREATE TABLE IF NOT EXISTS id_map_old_new (
    old_id VARCHAR(50) PRIMARY KEY,
    new_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Backup existing tables (rename to _old)
ALTER TABLE IF EXISTS asset RENAME TO asset_old;
ALTER TABLE IF EXISTS bitcoin_transaction RENAME TO bitcoin_transaction_old;
ALTER TABLE IF EXISTS stock_transaction RENAME TO stock_transaction_old;
ALTER TABLE IF EXISTS asset_history RENAME TO asset_history_old;
ALTER TABLE IF EXISTS exchange_rates RENAME TO exchange_rates_old;
ALTER TABLE IF EXISTS processed_dates RENAME TO processed_dates_old;

-- Step 4: Create new tables with UUID PKs and constraints
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE asset (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_asset_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20),
    currency VARCHAR(3),
    ticker VARCHAR(10),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT asset_category_valid CHECK (category IN ('CRYPTO', 'FUND_ACTIVE', 'FUND_INDEX', 'STOCK', 'PENSION', 'CASH', 'OTHER')),
    CONSTRAINT asset_risk_level_valid CHECK (risk_level IS NULL OR risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    FOREIGN KEY (parent_asset_id) REFERENCES asset(id) ON DELETE CASCADE,
    UNIQUE(ticker, category)
);

CREATE TABLE bitcoin_transaction (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    type VARCHAR(10),
    amount_btc DECIMAL(18, 8),
    price_eur_per_btc DECIMAL(18, 2),
    fees_eur DECIMAL(18, 2),
    total_amount_eur DECIMAL(18, 2),
    exchange_rate_to_eur DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT transaction_type_valid CHECK (type IN ('BUY', 'SELL')),
    FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE
);

CREATE TABLE stock_transaction (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    type VARCHAR(10),
    ticker VARCHAR(10) NOT NULL,
    quantity DECIMAL(18, 4),
    price_per_unit DECIMAL(18, 4),
    currency VARCHAR(3),
    fees DECIMAL(18, 2),
    total_amount DECIMAL(18, 2),
    exchange_rate_to_eur DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT transaction_type_valid CHECK (type IN ('BUY', 'SELL')),
    FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE
);

CREATE TABLE asset_history (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL,
    total_amount_eur DECIMAL(18, 2),
    total_invested_eur DECIMAL(18, 2),
    exchange_rate_to_eur DECIMAL(10, 4),
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE
);

CREATE TABLE exchange_rates (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency_pair VARCHAR(10) NOT NULL,
    rate DECIMAL(10, 6) NOT NULL,
    date DATE NOT NULL,
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT exchange_rates_unique_date_pair UNIQUE (date, currency_pair)
);

CREATE TABLE processed_dates (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE,
    UNIQUE(asset_id, year, month)
);

-- Step 5: Create indexes for performance
CREATE INDEX idx_asset_category ON asset(category);
CREATE INDEX idx_asset_parent_id ON asset(parent_asset_id);
CREATE INDEX idx_asset_ticker ON asset(ticker);
CREATE INDEX idx_bitcoin_transaction_asset_id ON bitcoin_transaction(asset_id);
CREATE INDEX idx_bitcoin_transaction_date ON bitcoin_transaction(transaction_date);
CREATE INDEX idx_stock_transaction_asset_id ON stock_transaction(asset_id);
CREATE INDEX idx_stock_transaction_date ON stock_transaction(transaction_date);
CREATE INDEX idx_asset_history_asset_id ON asset_history(asset_id);
CREATE INDEX idx_asset_history_snapshot_date ON asset_history(snapshot_date);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(date);

-- Step 6: Migrate data from old tables
-- First, populate asset table with data transformation
INSERT INTO id_map_old_new (old_id, new_id, table_name)
SELECT DISTINCT id, uuid_generate_v4(), 'asset'
FROM asset_old;

INSERT INTO asset (id, parent_asset_id, name, description, category, risk_level, currency, ticker, is_archived, created_at, updated_at)
SELECT 
    im.new_id,
    CASE 
        WHEN ao.parent_asset_id IS NOT NULL THEN im_parent.new_id
        ELSE NULL 
    END as parent_asset_id,
    ao.name,
    ao.description,
    CASE 
        WHEN ao.risk_level = 'Bajo' THEN 'LOW'
        WHEN ao.risk_level = 'Medio' THEN 'MEDIUM'
        WHEN ao.risk_level = 'Alto' THEN 'HIGH'
        ELSE ao.risk_level
    END as risk_level,
    ao.currency,
    ao.ticker,
    COALESCE(ao.is_archived, FALSE),
    ao.created_at,
    ao.updated_at
FROM asset_old ao
LEFT JOIN id_map_old_new im ON ao.id = im.old_id AND im.table_name = 'asset'
LEFT JOIN id_map_old_new im_parent ON ao.parent_asset_id = im_parent.old_id AND im_parent.table_name = 'asset'
WHERE im.new_id IS NOT NULL;

-- Migrate bitcoin transactions
INSERT INTO bitcoin_transaction (id, asset_id, transaction_date, type, amount_btc, price_eur_per_btc, fees_eur, total_amount_eur, exchange_rate_to_eur, created_at)
SELECT
    uuid_generate_v4(),
    im.new_id as asset_id,
    bto.transaction_date,
    bto.type,
    bto.amount_btc,
    bto.price_eur_per_btc,
    bto.fees_eur,
    bto.total_amount_eur,
    bto.exchange_rate_usd_eur as exchange_rate_to_eur,
    bto.created_at
FROM bitcoin_transaction_old bto
LEFT JOIN id_map_old_new im ON bto.asset_id = im.old_id AND im.table_name = 'asset'
WHERE im.new_id IS NOT NULL;

-- Migrate stock transactions (rename field and id)
INSERT INTO stock_transaction (id, asset_id, transaction_date, type, ticker, quantity, price_per_unit, currency, fees, total_amount, exchange_rate_to_eur, created_at)
SELECT
    uuid_generate_v4(),
    im.new_id as asset_id,
    sto.transaction_date,
    sto.type,
    sto.ticker,
    sto.quantity,
    sto.price_per_unit,
    sto.currency,
    sto.fees,
    sto.total_amount,
    sto.exchange_rate_eur_usd as exchange_rate_to_eur,
    sto.created_at
FROM stock_transaction_old sto
LEFT JOIN id_map_old_new im ON sto.asset_id = im.old_id AND im.table_name = 'asset'
WHERE im.new_id IS NOT NULL;

-- Migrate asset history (rename field and id)
INSERT INTO asset_history (id, asset_id, total_amount_eur, total_invested_eur, exchange_rate_to_eur, snapshot_date, created_at)
SELECT
    uuid_generate_v4(),
    im.new_id as asset_id,
    aho.total_amount_eur,
    aho.total_invested_eur,
    aho.exchange_rate_eur_usd as exchange_rate_to_eur,
    aho.snapshot_date,
    aho.created_at
FROM asset_history_old aho
LEFT JOIN id_map_old_new im ON aho.asset_id = im.old_id AND im.table_name = 'asset'
WHERE im.new_id IS NOT NULL;

-- Migrate exchange rates
INSERT INTO exchange_rates (id, currency_pair, rate, date, source, created_at)
SELECT
    uuid_generate_v4(),
    currency_pair,
    rate,
    date,
    source,
    created_at
FROM exchange_rates_old;

-- Migrate processed dates
INSERT INTO processed_dates (id, asset_id, year, month, processed_at)
SELECT
    uuid_generate_v4(),
    im.new_id as asset_id,
    pdo.year,
    pdo.month,
    pdo.processed_at
FROM processed_dates_old pdo
LEFT JOIN id_map_old_new im ON pdo.asset_id = im.old_id AND im.table_name = 'asset'
WHERE im.new_id IS NOT NULL;

-- Step 7: Validation queries to verify migration success
-- Check for orphaned foreign keys (should return 0)
SELECT COUNT(*) as orphaned_transactions FROM bitcoin_transaction WHERE asset_id NOT IN (SELECT id FROM asset);
SELECT COUNT(*) as orphaned_stock_transactions FROM stock_transaction WHERE asset_id NOT IN (SELECT id FROM asset);
SELECT COUNT(*) as orphaned_asset_history FROM asset_history WHERE asset_id NOT IN (SELECT id FROM asset);

-- Check for invalid enum values (should return 0)
SELECT COUNT(*) as invalid_categories FROM asset WHERE category NOT IN ('CRYPTO', 'FUND_ACTIVE', 'FUND_INDEX', 'STOCK', 'PENSION', 'CASH', 'OTHER');
SELECT COUNT(*) as invalid_risk_levels FROM asset WHERE risk_level NOT IN ('LOW', 'MEDIUM', 'HIGH', NULL);
SELECT COUNT(*) as invalid_transaction_types FROM bitcoin_transaction WHERE type NOT IN ('BUY', 'SELL', NULL);

-- Check record counts match
SELECT 'Assets migrated' as check_name, COUNT(*) as count FROM asset UNION ALL
SELECT 'Bitcoin transactions migrated', COUNT(*) FROM bitcoin_transaction UNION ALL
SELECT 'Stock transactions migrated', COUNT(*) FROM stock_transaction UNION ALL
SELECT 'Asset history records migrated', COUNT(*) FROM asset_history UNION ALL
SELECT 'Exchange rates migrated', COUNT(*) FROM exchange_rates;

-- Step 8: Drop old tables (comment out if you want to keep backups)
-- Once verified, uncomment these to remove old tables:
-- DROP TABLE IF EXISTS processed_dates_old;
-- DROP TABLE IF EXISTS asset_history_old;
-- DROP TABLE IF EXISTS stock_transaction_old;
-- DROP TABLE IF EXISTS bitcoin_transaction_old;
-- DROP TABLE IF EXISTS asset_old;
-- DROP TABLE IF EXISTS exchange_rates_old;

COMMIT; -- Complete transaction
