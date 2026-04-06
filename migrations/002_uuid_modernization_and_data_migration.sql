--
-- Migration: UUID Modernization and Data Migration
-- Purpose: Migrate from VARCHAR(50) string IDs to UUID primary keys
--          Map old string IDs to new UUIDs
--          Update RiskLevel to English values (LOW/MEDIUM/HIGH)
--          Remove legacy FUND category
--          Standardize exchange_rate field naming
--
-- IMPORTANT: This migration should be reviewed and tested on a backup before running on production!
-- Steps:
-- 1. Back up current database
-- 2. Run this migration
-- 3. Verify all data integrity constraints
-- 4. Deploy updated application code
--

-- Step 1: Disable foreign key constraints temporarily
SET CONSTRAINTS ALL DEFERRED;

-- Step 2: Create temporary table to store ID mappings (old_string_id -> new_uuid)
CREATE TEMPORARY TABLE id_map (
    old_id VARCHAR(50) PRIMARY KEY,
    new_id UUID NOT NULL UNIQUE
);

-- Step 3: Insert mappings for all existing assets from old schema
INSERT INTO id_map (old_id, new_id)
SELECT DISTINCT id, uuid_generate_v4()
FROM asset;

-- Step 4: Create new temporary asset table with UUID structure
CREATE TEMPORARY TABLE asset_new_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('CRYPTO', 'FUND_ACTIVE', 'FUND_INDEX', 'STOCK', 'PENSION', 'CASH', 'OTHER')),
    currency VARCHAR(10) DEFAULT 'EUR',
    color VARCHAR(20),
    is_archived BOOLEAN DEFAULT false,
    risk_level VARCHAR(50) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    isin VARCHAR(50),
    ticker VARCHAR(50),
    description TEXT,
    parent_asset_id UUID
);

-- Step 5: Migrate asset data with transformations:
--   - Use mapped UUIDs for ID and parent_asset_id
--   - Normalize risk_level from Spanish to English (Bajo->LOW, Medio->MEDIUM, Alto->HIGH)
--   - Remove FUND entries (assume they should be mapped to FUND_ACTIVE or archived)
INSERT INTO asset_new_temp (id, name, category, currency, color, is_archived, risk_level, isin, ticker, description, parent_asset_id)
SELECT 
    m.new_id,
    a.name,
    -- Normalize risk_level from Spanish to English
    CASE 
        WHEN a.risk_level = 'Bajo' THEN 'LOW'
        WHEN a.risk_level = 'Medio' THEN 'MEDIUM'
        WHEN a.risk_level = 'Alto' THEN 'HIGH'
        WHEN a.risk_level IN ('LOW', 'MEDIUM', 'HIGH') THEN a.risk_level  -- Already English
        ELSE NULL
    END,
    a.isin,
    a.ticker,
    a.description,
    m_parent.new_id
FROM asset a
LEFT JOIN id_map m ON a.id = m.old_id
LEFT JOIN id_map m_parent ON a.parent_asset_id = m_parent.old_id;  

-- Step 6: Create temporary asset_history table with UUID structure
CREATE TEMPORARY TABLE asset_history_new_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    nav NUMERIC(15,4),
    contribution NUMERIC(15,4),
    participations NUMERIC(18,8),
    liquid_nav_value NUMERIC(15,4),
    mean_cost NUMERIC(15,4),
    UNIQUE(asset_id, snapshot_date)
);

-- Step 7: Migrate asset_history data with UUID mappings
INSERT INTO asset_history_new_temp (id, asset_id, snapshot_date, nav, contribution, participations, liquid_nav_value, mean_cost)
SELECT 
    uuid_generate_v4(),
    m.new_id,
    ah.snapshot_date,
    ah.nav,
    ah.contribution,
    ah.participations,
    ah.liquid_nav_value,
    ah.mean_cost
FROM asset_history ah
LEFT JOIN id_map m ON ah.asset_id = m.old_id
WHERE m.new_id IS NOT NULL;  -- Only include records with valid asset mappings

-- Step 8: Create temporary bitcoin_transaction table with UUID and renamed field
CREATE TEMPORARY TABLE bitcoin_transaction_new_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    amount_btc NUMERIC(18,8) NOT NULL,
    price_eur_per_btc NUMERIC(18,8) NOT NULL,
    fees_eur NUMERIC(10,4) DEFAULT 0,
    total_amount_eur NUMERIC(15,4) NOT NULL,
    exchange_rate_to_eur NUMERIC(15,8) DEFAULT 1.08
);

-- Step 9: Migrate bitcoin_transaction data
INSERT INTO bitcoin_transaction_new_temp (id, asset_id, transaction_date, type, amount_btc, price_eur_per_btc, fees_eur, total_amount_eur, exchange_rate_to_eur)
SELECT 
    uuid_generate_v4(),
    m.new_id,
    bt.transaction_date,
    bt.type,
    bt.amount_btc,
    bt.price_eur_per_btc,
    COALESCE(bt.fees_eur, 0),
    bt.total_amount_eur,
    COALESCE(bt.exchange_rate_usd_eur, 1.08)
FROM bitcoin_transaction bt
LEFT JOIN id_map m ON bt.asset_id = m.old_id
WHERE m.new_id IS NOT NULL;  -- Only include records with valid asset mappings

-- Step 10: Create temporary stock_transaction table with UUID and renamed field
CREATE TEMPORARY TABLE stock_transaction_new_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    ticker VARCHAR(50) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    quantity NUMERIC(18,8) NOT NULL,
    price_per_unit NUMERIC(18,8) NOT NULL,
    fees NUMERIC(10,4) DEFAULT 0,
    total_amount NUMERIC(15,4) NOT NULL,
    exchange_rate_to_eur NUMERIC(15,8) DEFAULT 1.08
);

-- Step 11: Migrate stock_transaction data
INSERT INTO stock_transaction_new_temp (id, asset_id, transaction_date, type, ticker, currency, quantity, price_per_unit, fees, total_amount, exchange_rate_to_eur)
SELECT 
    uuid_generate_v4(),
    m.new_id,
    st.transaction_date,
    st.type,
    st.ticker,
    COALESCE(st.currency, 'USD'),
    st.quantity,
    st.price_per_unit,
    COALESCE(st.fees, 0),
    st.total_amount,
    COALESCE(st.exchange_rate_eur_usd, 1.08)  -- Renamed field
FROM stock_transaction st
LEFT JOIN id_map m ON st.asset_id = m.old_id
WHERE m.new_id IS NOT NULL;  -- Only include records with valid asset mappings

-- Step 12: Rename old tables to backup and install new tables
ALTER TABLE asset RENAME TO asset_old;
ALTER TABLE asset_new_temp RENAME TO asset;

ALTER TABLE asset_history RENAME TO asset_history_old;
ALTER TABLE asset_history_new_temp RENAME TO asset_history;

ALTER TABLE bitcoin_transaction RENAME TO bitcoin_transaction_old;
ALTER TABLE bitcoin_transaction_new_temp RENAME TO bitcoin_transaction;

ALTER TABLE stock_transaction RENAME TO stock_transaction_old;
ALTER TABLE stock_transaction_new_temp RENAME TO stock_transaction;

-- Step 13: Recreate indexes on new tables
CREATE INDEX ix_asset_category ON asset USING btree (category);
CREATE INDEX ix_asset_ticker ON asset USING btree (ticker);
CREATE INDEX ix_asset_parent_id ON asset USING btree (parent_asset_id);

CREATE INDEX ix_asset_history_asset_id ON asset_history USING btree (asset_id);
CREATE INDEX ix_asset_history_snapshot_date ON asset_history USING btree (snapshot_date);
CREATE UNIQUE INDEX ix_asset_history_unique_snapshot ON asset_history (asset_id, snapshot_date);

CREATE INDEX ix_bitcoin_transaction_asset_id ON bitcoin_transaction USING btree (asset_id);
CREATE INDEX ix_bitcoin_transaction_date ON bitcoin_transaction USING btree (transaction_date);

CREATE INDEX ix_stock_transaction_asset_id ON stock_transaction USING btree (asset_id);
CREATE INDEX ix_stock_transaction_ticker ON stock_transaction USING btree (ticker);
CREATE INDEX ix_stock_transaction_date ON stock_transaction USING btree (transaction_date);

-- Step 14: Re-enable constraints
SET CONSTRAINTS ALL IMMEDIATE;

-- Step 15: Logging/validation
-- Verify migration success
SELECT 
    (SELECT COUNT(*) FROM asset) as new_asset_count,
    (SELECT COUNT(*) FROM asset_old) as old_asset_count,
    (SELECT COUNT(*) FROM asset_history) as new_history_count,
    (SELECT COUNT(*) FROM asset_history_old) as old_history_count,
    (SELECT COUNT(*) FROM bitcoin_transaction) as new_btc_count,
    (SELECT COUNT(*) FROM bitcoin_transaction_old) as old_btc_count,
    (SELECT COUNT(*) FROM stock_transaction) as new_stock_count,
    (SELECT COUNT(*) FROM stock_transaction_old) as old_stock_count;


-- Check for any assets with invalid categories (should be 0)
SELECT COUNT(*) as invalid_categories FROM asset 
WHERE category NOT IN ('CRYPTO', 'FUND_ACTIVE', 'FUND_INDEX', 'STOCK', 'PENSION', 'CASH', 'OTHER');

-- Check for any assets with invalid risk_levels (should be 0)
SELECT COUNT(*) as invalid_risk_levels FROM asset 
WHERE risk_level IS NOT NULL AND risk_level NOT IN ('LOW', 'MEDIUM', 'HIGH');

-- List any orphaned foreign keys (should be 0)
SELECT COUNT(*) as orphaned_histories FROM asset_history ah
WHERE NOT EXISTS (SELECT 1 FROM asset a WHERE a.id = ah.asset_id);

-- Note on cleanup:
-- The _old backup tables can be dropped after verification:
-- DROP TABLE asset_old;
-- DROP TABLE asset_history_old;
-- DROP TABLE bitcoin_transaction_old;
-- DROP TABLE stock_transaction_old;
