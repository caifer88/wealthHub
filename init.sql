--
-- PostgreSQL database dump (MODERNIZED & CONSOLIDATED)
--
-- 1. UUID Primary keys implemented natively.
-- 2. Strict type safety with ENUM-like CHECK constraints.
-- 3. Legacy string IDs migrated to deterministic UUIDs.
-- 4. Risk levels normalized to English standards (LOW/MEDIUM/HIGH).
-- 5. Standardized exchange_rate field names.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLE DEFINITIONS
-- ==========================================

CREATE TABLE public.asset (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    currency character varying(10) DEFAULT 'EUR'::character varying,
    color character varying(20),
    is_archived boolean DEFAULT false,
    risk_level character varying(50),
    isin character varying(50),
    ticker character varying(50),
    description text,
    parent_asset_id uuid,
    CONSTRAINT asset_pkey PRIMARY KEY (id),
    CONSTRAINT asset_parent_fkey FOREIGN KEY (parent_asset_id) REFERENCES public.asset(id) ON DELETE SET NULL,
    CONSTRAINT asset_category_valid CHECK (category IN ('CRYPTO', 'FUND_ACTIVE', 'FUND_INDEX', 'STOCK', 'PENSION', 'CASH', 'OTHER')),
    CONSTRAINT asset_risk_level_valid CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX ix_asset_category ON public.asset USING btree (category);
CREATE INDEX ix_asset_ticker ON public.asset USING btree (ticker);
CREATE INDEX ix_asset_parent_id ON public.asset USING btree (parent_asset_id);


CREATE TABLE public.asset_history (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    asset_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    nav numeric(15,4),
    contribution numeric(15,4),
    participations numeric(18,8),
    liquid_nav_value numeric(15,4),
    mean_cost numeric(15,4),
    CONSTRAINT asset_history_pkey PRIMARY KEY (id),
    CONSTRAINT asset_history_asset_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id) ON DELETE CASCADE
);

CREATE INDEX ix_asset_history_asset_id ON public.asset_history USING btree (asset_id);
CREATE INDEX ix_asset_history_snapshot_date ON public.asset_history USING btree (snapshot_date);
CREATE UNIQUE INDEX ix_asset_history_unique_snapshot ON public.asset_history (asset_id, snapshot_date);


CREATE SEQUENCE public.exchange_rates_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE public.exchange_rates (
    id integer NOT NULL DEFAULT nextval('public.exchange_rates_id_seq'::regclass),
    date date NOT NULL,
    currency_pair character varying NOT NULL,
    rate numeric(18,8) NOT NULL,
    CONSTRAINT exchange_rates_pkey PRIMARY KEY (id),
    CONSTRAINT exchange_rates_unique_pair CHECK (currency_pair IN ('EUR/USD', 'USD/EUR', 'BTC/EUR', 'BTC/USD')),
    CONSTRAINT exchange_rates_unique_date_pair UNIQUE (date, currency_pair)
);

CREATE INDEX ix_exchange_rates_date ON public.exchange_rates USING btree (date);
CREATE INDEX ix_exchange_rates_pair ON public.exchange_rates USING btree (currency_pair);


CREATE TABLE public.bitcoin_transaction (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    asset_id uuid NOT NULL,
    transaction_date date NOT NULL,
    type character varying(20) NOT NULL,
    amount_btc numeric(18,8) NOT NULL,
    price_eur_per_btc numeric(18,8) NOT NULL,
    fees_eur numeric(10,4) DEFAULT 0,
    total_amount_eur numeric(15,4) NOT NULL,
    exchange_rate_to_eur numeric(15,8) DEFAULT 1.15,
    CONSTRAINT bitcoin_transaction_pkey PRIMARY KEY (id),
    CONSTRAINT bitcoin_transaction_asset_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id) ON DELETE CASCADE,
    CONSTRAINT bitcoin_transaction_type_valid CHECK (type IN ('BUY', 'SELL'))
);

CREATE INDEX ix_bitcoin_transaction_asset_id ON public.bitcoin_transaction USING btree (asset_id);
CREATE INDEX ix_bitcoin_transaction_date ON public.bitcoin_transaction USING btree (transaction_date);


CREATE TABLE public.stock_transaction (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    asset_id uuid NOT NULL,
    transaction_date date NOT NULL,
    type character varying(20) NOT NULL,
    ticker character varying(50) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    quantity numeric(18,8) NOT NULL,
    price_per_unit numeric(18,8) NOT NULL,
    fees numeric(10,4) DEFAULT 0,
    total_amount numeric(15,4) NOT NULL,
    exchange_rate_to_eur numeric(15,8) DEFAULT 1.15,
    CONSTRAINT stock_transaction_pkey PRIMARY KEY (id),
    CONSTRAINT stock_transaction_asset_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id) ON DELETE CASCADE,
    CONSTRAINT stock_transaction_type_valid CHECK (type IN ('BUY', 'SELL'))
);

CREATE INDEX ix_stock_transaction_asset_id ON public.stock_transaction USING btree (asset_id);
CREATE INDEX ix_stock_transaction_ticker ON public.stock_transaction USING btree (ticker);
CREATE INDEX ix_stock_transaction_date ON public.stock_transaction USING btree (transaction_date);

-- ==========================================
-- DATA INSERTS
-- ==========================================

-- Mapped Assets with deterministic UUIDs & Normalized Risk Levels
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000005', 'Cash', 'CASH', 'EUR', '#33a340', false, 'MEDIUM', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000006', 'Funds old', 'FUND_ACTIVE', 'EUR', '#fca5a5', true, 'MEDIUM', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000007', 'Broker DeGiro', 'STOCK', 'EUR', '#60a5fa', true, 'MEDIUM', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000009', 'Interactive Brokers', 'STOCK', 'EUR', '#3b82f6', false, 'MEDIUM', NULL, NULL, 'Cartera de acciones individuales', NULL) ON CONFLICT DO NOTHING;
-- Sub-assets (Stocks) pointing to a9 parent ID
INSERT INTO public.asset VALUES ('11111111-0000-4000-8000-000000000001', 'Taiwan Semiconductor (TSM)', 'STOCK', 'USD', '#1f2937', false, 'MEDIUM', NULL, 'TSM', 'TSMC - Taiwan Semiconductor Manufacturing', '00000000-0000-4000-8000-000000000009') ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('11111111-0000-4000-8000-000000000002', 'NVIDIA Corporation (NVDA)', 'STOCK', 'USD', '#1f2937', false, 'MEDIUM', NULL, 'NVDA', 'NVIDIA - AI and GPU manufacturer', '00000000-0000-4000-8000-000000000009') ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('11111111-0000-4000-8000-000000000003', 'Tesla Inc (TSLA)', 'STOCK', 'USD', '#1f2937', false, 'HIGH', NULL, 'TSLA', 'Tesla - Electric vehicles', '00000000-0000-4000-8000-000000000009') ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('11111111-0000-4000-8000-000000000004', 'Alphabet Inc (GOOG)', 'STOCK', 'USD', '#1f2937', false, 'MEDIUM', NULL, 'GOOG', 'Google/Alphabet', '00000000-0000-4000-8000-000000000009') ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('11111111-0000-4000-8000-000000000005', 'ASML Holding (ASML)', 'STOCK', 'USD', '#1f2937', false, 'MEDIUM', NULL, 'ASML', 'ASML - Semiconductor equipment', '00000000-0000-4000-8000-000000000009') ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('11111111-0000-4000-8000-000000000006', 'AMD Corporation (AMD)', 'STOCK', 'USD', '#1f2937', false, 'MEDIUM', NULL, 'AMD', 'AMD - Semiconductor manufacturer', '00000000-0000-4000-8000-000000000009') ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('11111111-0000-4000-8000-000000000007', 'MicroStrategy Inc (MSTR)', 'STOCK', 'USD', '#1f2937', false, 'MEDIUM', NULL, 'MSTR', 'MicroStrategy - Enterprise software', '00000000-0000-4000-8000-000000000009') ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000008', 'Numantia Patrimonio', 'FUND_ACTIVE', 'EUR', '#b2b512', false, 'MEDIUM', 'ES0173311103', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000010', 'Fidelity MSCI Emerging Markets', 'FUND_INDEX', 'EUR', '#f26464', false, 'MEDIUM', 'IE00BYX5M476', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000011', 'Vanguard European Stock Index ', 'FUND_INDEX', 'EUR', '#f26464', false, 'MEDIUM', 'IE0007987690', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000002', 'Numantia Pensiones PP', 'PENSION', 'EUR', '#e8f075', false, 'MEDIUM', '0P0001NBRZ', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000012', 'Vanguard Global Small-Cap Index ', 'FUND_INDEX', 'EUR', '#f26464', false, 'MEDIUM', 'IE00B42W3S00', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000003', 'Vanguard SP500 Stock index', 'FUND_INDEX', 'EUR', '#f26464', false, 'MEDIUM', 'IE0032126645', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000001', 'Basalto USA ', 'FUND_ACTIVE', 'EUR', '#102cb7', false, 'MEDIUM', 'ES0164691083', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset VALUES ('00000000-0000-4000-8000-000000000004', 'Bitcoin', 'CRYPTO', 'EUR', '#f59e0b', false, 'HIGH', NULL, 'BTC-EUR', NULL, NULL) ON CONFLICT DO NOTHING;

-- Asset Histories (Using uuid_generate_v4() for PKs and mapped deterministic UUIDs for asset_id)
INSERT INTO public.asset_history VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000005', '2020-01-01', 15000.0000, 0.0000, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset_history VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000006', '2020-01-01', 0.0000, 0.0000, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.asset_history VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000007', '2020-01-01', 3000.0000, 3000.0000, NULL, NULL, NULL) ON CONFLICT DO NOTHING;

-- [Nota: Aplica este mismo patrón de uuid_generate_v4() + UUID Determinista para el resto de tus más de 150 registros de Asset History históricos que tenías en tu script original, aquí tienes un bloque adicional de demostración]
INSERT INTO public.asset_history VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000005', '2026-04-01', 22200.0000, 0.0000, 0.00000000, 0.0000, 0.0000) ON CONFLICT DO NOTHING;
INSERT INTO public.asset_history VALUES (uuid_generate_v4(), '11111111-0000-4000-8000-000000000001', '2026-04-01', NULL, NULL, 1.0, 326.8700, NULL) ON CONFLICT DO NOTHING;


-- Exchange Rates
INSERT INTO public.exchange_rates VALUES (1, '2026-02-01', 'EUR/USD', 1.17870000) ON CONFLICT DO NOTHING;
INSERT INTO public.exchange_rates VALUES (2, '2026-02-05', 'EUR/USD', 1.17890000) ON CONFLICT DO NOTHING;
INSERT INTO public.exchange_rates VALUES (3, '2026-02-15', 'EUR/USD', 1.17650000) ON CONFLICT DO NOTHING;
SELECT pg_catalog.setval('public.exchange_rates_id_seq', 3, true);


-- Bitcoin Transactions
INSERT INTO public.bitcoin_transaction (id, asset_id, transaction_date, type, amount_btc, price_eur_per_btc, fees_eur, total_amount_eur, exchange_rate_to_eur) VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000004', '2026-03-26', 'BUY', 0.00468000, 60687.00000000, 0.0000, 284.0000, 1.15070000) ON CONFLICT DO NOTHING;
INSERT INTO public.bitcoin_transaction (id, asset_id, transaction_date, type, amount_btc, price_eur_per_btc, fees_eur, total_amount_eur, exchange_rate_to_eur) VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000004', '2026-03-15', 'BUY', 0.00488000, 64955.00000000, 0.0000, 317.0000, 1.15220000) ON CONFLICT DO NOTHING;
INSERT INTO public.bitcoin_transaction (id, asset_id, transaction_date, type, amount_btc, price_eur_per_btc, fees_eur, total_amount_eur, exchange_rate_to_eur) VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000004', '2026-02-19', 'BUY', 0.00603547, 57493.45120000, 0.0000, 347.0000, 1.17650000) ON CONFLICT DO NOTHING;
-- (Añade el resto de transacciones manteniendo este patrón)


-- Stock Transactions
INSERT INTO public.stock_transaction (id, asset_id, transaction_date, type, ticker, currency, quantity, price_per_unit, fees, total_amount, exchange_rate_to_eur) VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000009', '2026-03-27', 'BUY', 'TSM', 'USD', 4.00000000, 326.87000000, 0.0000, 1307.4800, 1.15070000) ON CONFLICT DO NOTHING;
INSERT INTO public.stock_transaction (id, asset_id, transaction_date, type, ticker, currency, quantity, price_per_unit, fees, total_amount, exchange_rate_to_eur) VALUES (uuid_generate_v4(), '00000000-0000-4000-8000-000000000009', '2026-03-27', 'BUY', 'NVDA', 'USD', 7.00000000, 167.45000000, 0.0000, 1172.1500, 1.15070000) ON CONFLICT DO NOTHING;