-- Migration: Fix column name mismatches between persistent DB and SQLModel definitions
-- Date: 2026-04-10

-- 1. bitcoin_transaction: rename exchange_rate_to_eur -> exchange_rate_usd_eur
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bitcoin_transaction' AND column_name = 'exchange_rate_to_eur'
    ) THEN
        ALTER TABLE public.bitcoin_transaction
        RENAME COLUMN exchange_rate_to_eur TO exchange_rate_usd_eur;
    END IF;
END $$;

-- 2. stock_transaction: add exchange_rate_eur_usd if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stock_transaction' AND column_name = 'exchange_rate_eur_usd'
    ) THEN
        ALTER TABLE public.stock_transaction
        ADD COLUMN exchange_rate_eur_usd numeric(15,8) DEFAULT 1.08;
    END IF;
END $$;
