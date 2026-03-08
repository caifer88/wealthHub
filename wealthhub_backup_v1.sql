--
-- PostgreSQL database dump
--

\restrict HcyUSDBzKvYUVRJGV842fvRSEcThIIUhoNntjnpM2vbH0sxML0fxJZ0R1m30YFH

-- Dumped from database version 15.17 (Debian 15.17-1.pgdg13+1)
-- Dumped by pg_dump version 15.17 (Debian 15.17-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.history DROP CONSTRAINT IF EXISTS "history_assetId_fkey";
ALTER TABLE IF EXISTS ONLY public.stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.stock_history DROP CONSTRAINT IF EXISTS stock_history_pkey;
ALTER TABLE IF EXISTS ONLY public.history DROP CONSTRAINT IF EXISTS history_pkey;
ALTER TABLE IF EXISTS ONLY public.bitcoin_transactions DROP CONSTRAINT IF EXISTS bitcoin_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.assets DROP CONSTRAINT IF EXISTS assets_pkey;
DROP TABLE IF EXISTS public.stock_transactions;
DROP TABLE IF EXISTS public.stock_history;
DROP TABLE IF EXISTS public.history;
DROP TABLE IF EXISTS public.bitcoin_transactions;
DROP TABLE IF EXISTS public.assets;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: wealthhub
--

CREATE TABLE public.assets (
    id character varying NOT NULL,
    name character varying NOT NULL,
    category character varying NOT NULL,
    color character varying NOT NULL,
    archived boolean NOT NULL,
    "riskLevel" character varying,
    isin character varying,
    ticker character varying,
    "componentTickers" character varying,
    participations double precision NOT NULL,
    "meanCost" double precision NOT NULL
);


ALTER TABLE public.assets OWNER TO wealthhub;

--
-- Name: bitcoin_transactions; Type: TABLE; Schema: public; Owner: wealthhub
--

CREATE TABLE public.bitcoin_transactions (
    id character varying NOT NULL,
    date character varying NOT NULL,
    type character varying NOT NULL,
    amount double precision NOT NULL,
    "amountBTC" double precision NOT NULL,
    "totalCost" double precision NOT NULL,
    "meanPrice" double precision NOT NULL
);


ALTER TABLE public.bitcoin_transactions OWNER TO wealthhub;

--
-- Name: history; Type: TABLE; Schema: public; Owner: wealthhub
--

CREATE TABLE public.history (
    id character varying NOT NULL,
    month character varying NOT NULL,
    "assetId" character varying NOT NULL,
    participations double precision NOT NULL,
    "liquidNavValue" double precision NOT NULL,
    nav double precision NOT NULL,
    contribution double precision NOT NULL,
    "meanCost" double precision NOT NULL
);


ALTER TABLE public.history OWNER TO wealthhub;

--
-- Name: stock_history; Type: TABLE; Schema: public; Owner: wealthhub
--

CREATE TABLE public.stock_history (
    id character varying NOT NULL,
    month character varying NOT NULL,
    ticker character varying NOT NULL,
    price double precision NOT NULL,
    currency character varying NOT NULL
);


ALTER TABLE public.stock_history OWNER TO wealthhub;

--
-- Name: stock_transactions; Type: TABLE; Schema: public; Owner: wealthhub
--

CREATE TABLE public.stock_transactions (
    id character varying NOT NULL,
    ticker character varying NOT NULL,
    date character varying NOT NULL,
    type character varying NOT NULL,
    shares double precision NOT NULL,
    "pricePerShare" double precision NOT NULL,
    fees double precision NOT NULL,
    "totalAmount" double precision NOT NULL,
    broker character varying
);


ALTER TABLE public.stock_transactions OWNER TO wealthhub;

--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: wealthhub
--

COPY public.assets (id, name, category, color, archived, "riskLevel", isin, ticker, "componentTickers", participations, "meanCost") FROM stdin;
a1	Basalto USA 	Fund	#102cb7	f	Moderado	ES0164691083		\N	3786.90437	0
a2	Numantia Pensiones PP	Fund	#e8f075	f	Moderado	0P0001NBRZ		\N	2056.8217	12.99
a3	Vanguard SP500 Stock index	Fund	#f26464	f	Moderado	IE0032126645		\N	181.47	0
a4	Bitcoin	Crypto	#f59e0b	f	Medio		BTC-EUR	\N	0.2476	73275
a5	Cash	Cash	#33a340	f	Moderado			\N	0	0
a6	Founds old	Funds	#fca5a5	t	Medio			\N	0	0
a7	Broker DeGiro	Stocks	#60a5fa	t	Medio			\N	0	0
a8	Numantia Patrimonio	Fund	#b2b512	f	Moderado	ES0173311103		\N	603.156901	25.97
a9	Interactive Brokers	Stocks	#3b82f6	f	Medio			\N	0	0
\.


--
-- Data for Name: bitcoin_transactions; Type: TABLE DATA; Schema: public; Owner: wealthhub
--

COPY public.bitcoin_transactions (id, date, type, amount, "amountBTC", "totalCost", "meanPrice") FROM stdin;
tx-btc-056	2026-02-19	buy	347	0.00603547	347	57493.4512
tx-btc-001	2026-02-05	buy	300	0.00494981	300	60608.38698859148
tx-btc-002	2026-01-30	buy	258	0.00355157	258	72643.92930450477
tx-btc-003	2026-01-26	buy	300	0.00403177	300	74409
tx-btc-004	2026-01-20	buy	300	0.00378417	300	79277.62230555182
tx-btc-005	2025-12-30	buy	313	0.00413175	313	75755
tx-btc-006	2025-12-24	buy	215	0.00286554	215	75029
tx-btc-007	2025-12-15	buy	300	0.00377916	300	79383
tx-btc-008	2025-12-09	buy	300	0.00379876	300	78973
tx-btc-009	2025-12-01	buy	419	0.00565864	419	74046
tx-btc-010	2025-11-14	buy	450	0.00531948	450	84595
tx-btc-011	2025-11-07	buy	300	0.0034358	300	87316
tx-btc-012	2025-11-05	buy	300	0.00327402	300	91630
tx-btc-013	2025-10-09	buy	300	0.00280005	300	107141
tx-btc-014	2025-09-29	buy	550	0.00562893	550	97710
tx-btc-015	2025-09-24	buy	300	0.00302828	300	99066
tx-btc-016	2025-08-19	buy	300	0.00295	300	101695
tx-btc-017	2025-08-12	buy	489	0.00472221	489	103553
tx-btc-018	2025-07-22	buy	300	0.00289669	300	103566
tx-btc-019	2025-07-10	buy	300	0.00309578	300	96906
tx-btc-020	2025-07-09	buy	300	0.00313702	300	95632
tx-btc-021	2025-07-02	buy	300	0.0032203	300	93159
tx-btc-022	2025-06-27	buy	300	0.00322403	300	93051
tx-btc-023	2025-06-23	buy	300	0.00337507	300	88887
tx-btc-024	2025-06-16	buy	500	0.00537127	500	93088
tx-btc-025	2025-06-13	buy	100	0.00107682	100	92866
tx-btc-026	2025-06-09	buy	300	0.00312661	300	95951
tx-btc-027	2025-06-02	buy	300	0.00326634	300	91846
tx-btc-028	2025-05-26	buy	300	0.003135	300	95694
tx-btc-029	2025-05-22	buy	300	0.00305481	300	98206
tx-btc-030	2025-05-13	buy	300	0.0034023	300	88176
tx-btc-031	2025-05-08	buy	300	0.00340295	300	88159
tx-btc-032	2025-05-01	buy	300	0.00352112	300	85200
tx-btc-033	2025-04-29	buy	300	0.00355248	300	84448
tx-btc-034	2025-04-27	buy	300	0.00361362	300	83019
tx-btc-035	2025-04-23	buy	300	0.0036096	300	83112
tx-btc-036	2025-04-22	buy	300	0.00377874	300	79392
tx-btc-037	2025-04-15	buy	300	0.00379307	300	79092
tx-btc-038	2025-03-28	buy	300	0.00369986	300	81084
tx-btc-039	2025-03-18	buy	250	0.003194	250	78272
tx-btc-040	2025-03-08	buy	250	0.00300867	250	83093
tx-btc-041	2025-02-25	buy	300	0.00338876	300	88528
tx-btc-042	2025-02-15	buy	300	0.00320238	300	93680
tx-btc-043	2025-01-31	buy	300	0.00282031	300	106371
tx-btc-044	2025-01-20	buy	300	0.0025919	300	115745
tx-btc-045	2024-12-08	buy	400	0.00411919	400	97106
tx-btc-046	2024-10-04	buy	500	0.00890313	500	56160
tx-btc-047	2024-10-04	buy	730	0.0129455	730	56367
tx-btc-048	2024-09-03	buy	500	0.00932731	500	53606
tx-btc-049	2024-08-21	buy	500	0.00935314	500	53458
tx-btc-050	2024-03-20	buy	325	0.00522273	325	62228
tx-btc-051	2024-03-20	buy	117	0.00177403	117	65952
tx-btc-052	2024-01-04	buy	500	0.01119961	500	44644
tx-btc-053	2023-08-09	buy	159	0.0059997	159	26515
tx-btc-054	2022-10-27	buy	220	0.01062	220	20742
tx-btc-055	2021-08-20	buy	500	0.01189645	500	42029
\.


--
-- Data for Name: history; Type: TABLE DATA; Schema: public; Owner: wealthhub
--

COPY public.history (id, month, "assetId", participations, "liquidNavValue", nav, contribution, "meanCost") FROM stdin;
h-2020-09-a5	2020-09	a5	0	0	15000	0	0
h-2020-09-a6	2020-09	a6	0	0	4119	400	0
h-2020-09-a7	2020-09	a7	0	0	15500	0	0
h-2020-10-a5	2020-10	a5	0	0	19400	4400	0
h-2020-10-a6	2020-10	a6	0	0	4477	400	0
h-2020-10-a7	2020-10	a7	0	0	11100	-4400	0
h-2020-11-a5	2020-11	a5	0	0	24100	4700	0
h-2020-11-a6	2020-11	a6	0	0	5139	400	0
h-2020-11-a7	2020-11	a7	0	0	6390.6	-4700	0
h-2020-12-a5	2020-12	a5	0	0	24100	0	0
h-2020-12-a6	2020-12	a6	0	0	5582	400	0
h-2020-12-a7	2020-12	a7	0	0	6391	0	0
h-2021-01-a4	2021-01	a4	0	0	0	0	0
h-2021-01-a5	2021-01	a5	0	0	15450	-8650	0
h-2021-01-a6	2021-01	a6	0	0	6019.4	0	0
h-2021-01-a7	2021-01	a7	0	0	46390.6	40000	0
h-2021-02-a4	2021-02	a4	0	0	0	0	0
h-2021-02-a5	2021-02	a5	0	0	15900	450	0
h-2021-02-a6	2021-02	a6	0	0	6497.7	410	0
h-2021-02-a7	2021-02	a7	0	0	45937.7	0	0
h-2021-03-a4	2021-03	a4	0	0	0	0	0
h-2021-03-a5	2021-03	a5	0	0	16350	450	0
h-2021-03-a6	2021-03	a6	0	0	7173.3	409	0
h-2021-03-a7	2021-03	a7	0	0	46522.6	0	0
h-2021-04-a4	2021-04	a4	0	0	0	0	0
h-2021-04-a5	2021-04	a5	0	0	16800	450	0
h-2021-04-a6	2021-04	a6	0	0	7699.5	410	0
h-2021-04-a7	2021-04	a7	0	0	44274.8	0	0
h-2021-05-a4	2021-05	a4	0	0	0	0	0
h-2021-05-a5	2021-05	a5	0	0	17250	450	0
h-2021-05-a6	2021-05-a6	0	0	8908	410	0
h-2021-05-a7	2021-05	a7	0	0	46511.9	0	0
h-2021-06-a4	2021-06	a4	0	0	0	0	0
h-2020-01-a5	2020-01	a5	0	0	15000	0	0
h-2020-01-a6	2020-01	a6	0	0	0	0	0
h-2020-01-a7	2020-01	a7	0	0	3000	3000	0
h-2020-02-a5	2020-02	a5	0	0	15000	0	0
h-2020-02-a6	2020-02	a6	0	0	0	0	0
h-2020-02-a7	2020-02	a7	0	0	3000	0	0
h-2020-03-a5	2020-03	a5	0	0	15000	0	0
h-2020-03-a6	2020-03	a6	0	0	0	0	0
h-2020-03-a7	2020-03	a7	0	0	6000	3000	0
h-2020-04-a5	2020-04	a5	0	0	15000	0	0
h-2020-04-a6	2020-04	a6	0	0	0	0	0
h-2020-04-a7	2020-04	a7	0	0	6000	0	0
h-2020-05-a5	2020-05	a5	0	0	15000	0	0
h-2020-05-a6	2020-05-a6	0	0	2425	2000	0
h-2020-05-a7	2020-05	a7	0	0	6000	0	0
h-2020-06-a5	2020-06	a5	0	0	15000	0	0
h-2020-06-a6	2020-06	a6	0	0	2859	400	0
h-2020-06-a7	2020-06	a7	0	0	6000	0	0
h-2020-07-a5	2020-07	a5	0	0	15000	0	0
h-2020-07-a6	2020-07	a6	0	0	3251	800	0
h-2020-07-a7	2020-07	a7	0	0	9000	200	0
h-2020-08-a5	2020-08	a5	0	0	15000	0	0
h-2020-08-a6	2020-08	a6	0	0	3753	400	0
h-2020-08-a7	2020-08	a7	0	0	12000	1500	0
h-2021-06-a5	2021-06	a5	0	0	17700	450	0
h-2021-06-a6	2021-06	a6	0	0	9954.1	1160	0
h-2021-06-a7	2021-06	a7	0	0	45437.4	0	0
h-2021-07-a4	2021-07	a4	0	0	0	0	0
h-2021-07-a5	2021-07	a5	0	0	18150	450	0
h-2021-07-a6	2021-07	a6	0	0	11327.6	1660	0
h-2021-07-a7	2021-07	a7	0	0	43459.2	0	0
h-2021-08-a4	2021-08	a4	0	0	500	500	0
h-2021-08-a5	2021-08	a5	0	0	15600	450	0
h-2021-08-a6	2021-08	a6	0	0	11670	150	0
h-2021-08-a7	2021-08	a7	0	0	45261.2	0	0
h-2021-09-a4	2021-09	a4	0	0	500	0	0
h-2021-09-a5	2021-09	a5	0	0	15600	-2600	0
h-2021-09-a6	2021-09	a6	0	0	12269	910	0
h-2021-09-a7	2021-09	a7	0	0	43299.9	0	0
h-2021-10-a4	2021-10	a4	0	0	500	0	0
h-2021-10-a5	2021-10	a5	0	0	14000	0	0
h-2021-10-a6	2021-10	a6	0	0	14039	1171	0
h-2021-10-a7	2021-10	a7	0	0	46499.6	0	0
h-2021-11-a4	2021-11	a4	0	0	500	0	0
h-2021-11-a5	2021-11	a5	0	0	14900	-2000	0
h-2021-11-a6	2021-11	a6	0	0	16321	2346	0
h-2021-11-a7	2021-11	a7	0	0	44783.2	0	0
h-2021-12-a4	2021-12	a4	0	0	500	0	0
h-2021-12-a5	2021-12	a5	0	0	17500	1500	0
h-2021-12-a6	2021-12	a6	0	0	14930	499	0
h-2021-12-a7	2021-12	a7	0	0	43356	0	0
h-2022-01-a2	2022-01	a2	0	0	0	0	0
h-2022-01-a4	2022-01	a4	0	0	500	0	0
h-2022-01-a5	2022-01	a5	0	0	17500	1100	0
h-2022-01-a6	2022-01	a6	0	0	15911	300	0
h-2022-01-a7	2022-01	a7	0	0	42120	0	0
h-2022-02-a2	2022-02	a2	0	0	0	0	0
h-2022-02-a4	2022-02	a4	0	0	500	0	0
h-2022-02-a5	2022-02	a5	0	0	18500	1000	0
h-2022-02-a6	2022-02	a6	0	0	16098	300	0
h-2022-02-a7	2022-02	a7	0	0	41805	0	0
h-2022-03-a2	2022-03	a2	0	0	0	0	0
h-2022-03-a4	2022-03	a4	0	0	500	0	0
h-2022-03-a5	2022-03	a5	0	0	21400	1400	0
h-2022-03-a6	2022-03	a6	0	0	17913	300	0
h-2022-03-a7	2022-03	a7	0	0	42703	0	0
h-2022-04-a2	2022-04	a2	0	0	0	0	0
h-2022-04-a4	2022-04	a4	0	0	500	0	0
h-2022-04-a5	2022-04	a5	0	0	21400	1400	0
h-2022-04-a6	2022-04	a6	0	0	17127	300	0
h-2022-04-a7	2022-04	a7	0	0	44096	0	0
h-2022-05-a2	2022-05	a2	0	0	620	620	0
h-2022-05-a4	2022-05	a4	0	0	500	0	0
h-2022-05-a5	2022-05	a5	0	0	23006	1400	0
h-2022-05-a6	2022-05	a6	0	0	16950	300	0
h-2022-05-a7	2022-05	a7	0	0	43640	0	0
h-2022-06-a2	2022-06-a2	0	0	1240	620	0
h-2022-06-a4	2022-06	a4	0	0	500	0	0
h-2022-06-a5	2022-06	a5	0	0	24007	1400	0
h-2022-06-a6	2022-06	a6	0	0	16385	300	0
h-2022-06-a7	2022-06	a7	0	0	44694	0	0
h-2022-07-a2	2022-07	a2	0	0	1878	620	0
h-2022-07-a4	2022-07	a4	0	0	500	0	0
h-2022-07-a5	2022-07	a5	0	0	24808	800	0
h-2022-07-a6	2022-07	a6	0	0	17727	0	0
h-2022-07-a7	2022-07	a7	0	0	45530	0	0
h-2022-08-a2	2022-08	a2	0	0	2480	620	0
h-2022-08-a4	2022-08	a4	0	0	500	0	0
h-2022-08-a5	2022-08	a5	0	0	25509	700	0
h-2022-08-a6	2022-08	a6	0	0	18062	0	0
h-2022-08-a7	2022-08	a7	0	0	46790	0	0
h-2022-09-a2	2022-09	a2	0	0	3027	620	0
h-2022-09-a4	2022-09	a4	0	0	500	0	0
h-2022-09-a5	2022-09	a5	0	0	27511	2000	0
h-2022-09-a6	2022-09	a6	0	0	16670	0	0
h-2022-09-a7	2022-09	a7	0	0	47340	0	0
h-2022-10-a2	2022-10	a2	0	0	3647	620	0
h-2022-10-a4	2022-10	a4	0	0	720	220	0
h-2022-10-a5	2022-10	a5	0	0	29013	1500	0
h-2022-10-a6	2022-10	a6	0	0	16193	0	0
h-2022-10-a7	2022-10	a7	0	0	46196	0	0
h-2022-11-a2	2022-11	a2	0	0	4330	620	0
h-2022-11-a4	2022-11	a4	0	0	720	0	0
h-2022-11-a5	2022-11	a5	0	0	37042	8000	0
h-2022-11-a6	2022-11	a6	0	0	16417	0	0
h-2022-11-a7	2022-11	a7	0	0	38700	-6000	0
h-2022-12-a2	2022-12	a2	0	0	5011	745	0
h-2022-12-a4	2022-12	a4	0	0	720	0	0
h-2022-12-a5	2022-12	a5	0	0	39068	2000	0
h-2022-12-a6	2022-12	a6	0	0	16024	0	0
h-2022-12-a7	2022-12-a7	0	0	38030	0	0
h-2023-01-a2	2023-01	a2	0	0	5700	620	0
h-2023-01-a4	2023-01	a4	0	0	720	0	0
h-2023-01-a5	2023-01	a5	0	0	41090	2000	0
h-2023-01-a6	2023-01	a6	0	0	16040	0	0
h-2023-01-a7	2023-01	a7	0	0	38000	0	0
h-2023-02-a2	2023-02	a2	0	0	6290	620	0
h-2023-02-a4	2023-02	a4	0	0	720	0	0
h-2023-02-a5	2023-02	a5	0	0	43130	2000	0
h-2023-02-a6	2023-02	a6	0	0	15960	0	0
h-2023-02-a7	2023-02	a7	0	0	37700	0	0
h-2023-03-a2	2023-03	a2	0	0	6850	620	0
h-2023-03-a4	2023-03	a4	0	0	720	0	0
h-2023-03-a5	2023-03	a5	0	0	9800	-33400	0
h-2023-03-a6	2023-03	a6	0	0	50100	34000	0
h-2023-03-a7	2023-03-a7	0	0	37200	0	0
h-2023-04-a2	2023-04	a2	0	0	7500	620	0
h-2023-04-a4	2023-04	a4	0	0	720	0	0
h-2023-04-a5	2023-04	a5	0	0	11200	1400	0
h-2023-04-a6	2023-04	a6	0	0	50200	0	0
h-2023-04-a7	2023-04	a7	0	0	36700	0	0
h-2023-05-a2	2023-05	a2	0	0	8130	620	0
h-2023-05-a4	2023-05	a4	0	0	720	0	0
h-2023-05-a5	2023-05	a5	0	0	12210	1000	0
h-2023-05-a6	2023-05	a6	0	0	50310	0	0
h-2023-05-a7	2023-05	a7	0	0	36700	0	0
h-2023-06-a2	2023-06	a2	0	0	8775	620	0
h-2023-06-a4	2023-06	a4	0	0	720	0	0
h-2023-06-a5	2023-06	a5	0	0	13730	1500	0
h-2023-06-a6	2023-06	a6	0	0	50450	0	0
h-2023-06-a7	2023-06	a7	0	0	36700	0	0
h-2023-07-a2	2023-07	a2	0	0	9496	620	0
h-2023-07-a4	2023-07	a4	0	0	720	0	0
h-2023-07-a5	2023-07	a5	0	0	0	-13750	0
h-2023-07-a6	2023-07	a6	0	0	20580	-30000	0
h-2023-07-a7	2023-07	a7	0	0	37000	0	0
h-2023-08-a2	2023-08	a2	0	0	10075	620	0
h-2023-08-a4	2023-08	a4	0	0	880	159	0
h-2023-08-a5	2023-08	a5	0	0	1500	1500	0
h-2023-08-a6	2023-08	a6	0	0	20673	0	0
h-2023-08-a7	2023-08	a7	0	0	35900	0	0
h-2023-09-a2	2023-09	a2	0	0	10667	620	0
h-2023-09-a4	2023-09	a4	0	0	880	0	0
h-2023-09-a5	2023-09	a5	0	0	3500	2000	0
h-2023-09-a6	2023-09	a6	0	0	20730	0	0
h-2023-09-a7	2023-09	a7	0	0	35430	0	0
h-2023-10-a2	2023-10	a2	0	0	11327	632	0
h-2023-10-a4	2023-10	a4	0	0	880	0	0
h-2023-10-a5	2023-10	a5	0	0	1500	-2000	0
h-2023-10-a6	2023-10	a6	0	0	20800	0	0
h-2023-10-a7	2023-10	a7	0	0	35000	0	0
h-2023-11-a2	2023-11	a2	0	0	12053	632	0
h-2023-11-a4	2023-11	a4	0	0	880	0	0
h-2023-11-a5	2023-11	a5	0	0	3300	1800	0
h-2023-11-a6	2023-11	a6	0	0	20870	0	0
h-2023-11-a7	2023-11	a7	0	0	34310	0	0
h-2023-12-a2	2023-12	a2	0	0	12900	632	0
h-2023-12-a4	2023-12	a4	0	0	880	0	0
h-2023-12-a5	2023-12	a5	0	0	5000	2700	0
h-2023-12-a6	2023-12	a6	0	0	20930	0	0
h-2023-12-a7	2023-12	a7	0	0	35320	0	0
h-2024-01-a2	2024-01	a2	0	0	13563	643	0
h-2024-01-a4	2024-01	a4	0	0	2600	500	0
h-2024-01-a5	2024-01	a5	0	0	3000	-2000	0
h-2024-01-a6	2024-01	a6	0	0	21000	0	0
h-2024-01-a7	2024-01	a7	0	0	36800	0	0
h-2024-02-a2	2024-02	a2	0	0	14243	643	0
h-2024-02-a4	2024-02	a4	0	0	2600	0	0
h-2024-02-a5	2024-02	a5	0	0	7000	3000	0
h-2024-02-a6	2024-02	a6	0	0	21070	0	0
h-2024-02-a7	2024-02	a7	0	0	39180	0	0
h-2024-03-a2	2024-03	a2	0	0	15035	643	0
h-2024-03-a4	2024-03	a4	0	0	4200	442	0
h-2024-03-a5	2024-03	a5	0	0	6000	-1000	0
h-2024-03-a6	2024-03	a6	0	0	45000	24400	0
h-2024-03-a7	2024-03	a7	0	0	0	-39180	0
h-2024-04-a2	2024-04	a2	0	0	15747	650	0
h-2024-04-a4	2024-04	a4	0	0	3725	0	0
h-2024-04-a5	2024-04	a5	0	0	0	-6000	0
h-2024-04-a6	2024-04	a6	0	0	45138	0	0
h-2024-04-a7	2024-04	a7	0	0	0	0	0
h-2024-05-a1	2024-05	a1	0	0	45252	45252	0
h-2024-05-a2	2024-05	a2	0	0	16457	650	0
h-2024-05-a3	2024-05	a3	0	0	400	400	0
h-2024-05-a4	2024-05	a4	0	0	3700	0	0
h-2024-05-a5	2024-05	a5	0	0	1000	1000	0
h-2024-05-a6	2024-05	a6	0	0	0	-45252	0
h-2024-05-a8	2024-05	a8	0	0	0	0	0
h-2024-06-a1	2024-06	a1	0	0	45975	0	0
h-2024-06-a2	2024-06	a2	0	0	17340	650	0
h-2024-06-a3	2024-06	a3	0	0	832	400	0
h-2024-06-a4	2024-06	a4	0	0	3725	0	0
h-2024-06-a5	2024-06	a5	0	0	2000	0	0
h-2024-06-a8	2024-06	a8	0	0	0	0	0
h-2024-07-a1	2024-07	a1	0	0	45196	0	0
h-2024-07-a2	2024-07	a2	0	0	17892	650	0
h-2024-07-a3	2024-07	a3	0	0	1230	400	0
h-2024-07-a4	2024-07	a4	0	0	3843	0	0
h-2024-07-a5	2024-07	a5	0	0	3936	0	0
h-2024-07-a8	2024-07	a8	0	0	0	0	0
h-2024-08-a1	2024-08	a1	0	0	45359	0	0
h-2024-08-a2	2024-08	a2	0	0	18645	650	0
h-2024-08-a3	2024-08	a3	0	0	1648	400	0
h-2024-08-a4	2024-08	a4	0	0	3800	500	0
h-2024-08-a5	2024-08	a5	0	0	6436	0	0
h-2024-08-a8	2024-08	a8	0	0	0	0	0
h-2024-09-a1	2024-09	a1	0	0	45896	0	0
h-2024-09-a2	2024-09	a2	0	0	19500	650	0
h-2024-09-a3	2024-09	a3	0	0	2082	400	0
h-2024-09-a4	2024-09	a4	0	0	4335	500	0
h-2024-09-a5	2024-09	a5	0	0	8338	0	0
h-2024-09-a8	2024-09	a8	0	0	0	0	0
h-2024-10-a1	2024-10	a1	0	0	47100	0	0
h-2024-10-a2	2024-10	a2	0	0	20218	650	0
h-2024-10-a3	2024-10	a3	0	0	2785	600	0
h-2024-10-a4	2024-10	a4	0	0	5803	1230	0
h-2024-10-a5	2024-10	a5	0	0	9640	0	0
h-2024-10-a8	2024-10	a8	0	0	0	0	0
h-2024-11-a1	2024-11	a1	0	0	52931	4000	0
h-2024-11-a2	2024-11	a2	0	0	20996	650	0
h-2024-11-a3	2024-11	a3	0	0	3552	600	0
h-2024-11-a4	2024-11	a4	0	0	7900	0	0
h-2024-11-a5	2024-11	a5	0	0	6060	0	0
h-2024-11-a8	2024-11	a8	0	0	0	0	0
h-2024-12-a1	2024-12	a1	0	0	52500	0	0
h-2024-12-a2	2024-12	a2	0	0	21690	650	0
h-2024-12-a3	2024-12	a3	0	0	4246	650	0
h-2024-12-a4	2024-12	a4	0	0	8200	400	0
h-2024-12-a5	2024-12	a5	0	0	6513	0	0
h-2024-12-a8	2024-12	a8	0	0	0	0	0
h-2025-01-a1	2025-01	a1	0	0	53582	0	0
h-2025-01-a2	2025-01	a2	0	0	22538	668	0
h-2025-01-a3	2025-01	a3	0	0	4682	400	0
h-2025-01-a4	2025-01	a4	0	0	9712	600	0
h-2025-01-a5	2025-01	a5	0	0	7516	0	0
h-2025-01-a8	2025-01	a8	0	0	0	0	0
h-2025-02-a1	2025-02	a1	0	0	52619	0	0
h-2025-02-a2	2025-02	a2	0	0	23456	668	0
h-2025-02-a3	2025-02	a3	0	0	5004	400	0
h-2025-02-a4	2025-02	a4	0	0	8400	600	0
h-2025-02-a5	2025-02	a5	0	0	7500	0	0
h-2025-02-a8	2025-02	a8	0	0	0	0	0
h-2025-03-a1	2025-03	a1	0	0	49769	0	0
h-2025-03-a2	2025-03	a2	0	0	23768	668	0
h-2025-03-a3	2025-03	a3	0	0	4901	400	0
h-2025-03-a4	2025-03	a4	0	0	8400	800	0
h-2025-03-a5	2025-03	a5	0	0	8000	0	0
h-2025-03-a8	2025-03	a8	0	0	0	0	0
h-2025-04-a1	2025-04	a1	0	0	52200	3000	0
h-2025-04-a2	2025-04	a2	0	0	23986	675	0
h-2025-04-a3	2025-04	a3	0	0	5168	500	0
h-2025-04-a4	2025-04	a4	0	0	11200	1500	0
h-2025-04-a5	2025-04	a5	0	0	10000	0	0
h-2025-04-a8	2025-04	a8	0	0	0	0	0
h-2025-05-a1	2025-05	a1	0	0	54115	0	0
h-2025-05-a2	2025-05	a2	0	0	25037	675	0
h-2025-05-a3	2025-05	a3	0	0	5900	400	0
h-2025-05-a4	2025-05	a4	0	0	13500	1500	0
h-2025-05-a5	2025-05	a5	0	0	10500	0	0
h-2025-05-a8	2025-05	a8	0	0	0	0	0
h-2025-06-a1	2025-06	a1	0	0	54727	0	0
h-2025-06-a2	2025-06	a2	0	0	25755	675	0
h-2025-06-a3	2025-06	a3	0	0	6468	500	0
h-2025-06-a4	2025-06	a4	0	0	15279	1800	0
h-2025-06-a5	2025-06	a5	0	0	11000	0	0
h-2025-06-a8	2025-06	a8	0	0	0	0	0
h-2025-07-a1	2025-07	a1	0	0	55036	0	0
h-2025-07-a2	2025-07	a2	0	0	26541	675	0
h-2025-07-a3	2025-07	a3	0	0	7100	400	0
h-2025-07-a4	2025-07	a4	0	0	17900	1200	0
h-2025-07-a5	2025-07	a5	0	0	32400	0	0
h-2025-07-a8	2025-07	a8	0	0	0	0	0
h-2025-08-a1	2025-08	a1	0	0	55340	0	0
h-2025-08-a2	2025-08	a2	0	0	26626	0	0
h-2025-08-a3	2025-08	a3	0	0	7600	400	0
h-2025-08-a4	2025-08	a4	0	0	17450	789	0
h-2025-08-a5	2025-08	a5	0	0	31400	0	0
h-2025-08-a8	2025-08	a8	0	0	0	0	0
h-2025-09-a1	2025-09	a1	0	0	56556	0	0
h-2025-09-a2	2025-09	a2	0	0	27025	0	0
h-2025-09-a3	2025-09	a3	0	0	8431	600	0
h-2025-09-a4	2025-09	a4	0	0	18970	850	0
h-2025-09-a5	2025-09	a5	0	0	43100	0	0
h-2025-09-a8	2025-09	a8	0	0	0	0	0
h-2025-10-a1	2025-10	a1	0	0	58088	0	0
h-2025-10-a2	2025-10	a2	0	0	27986	0	0
h-2025-10-a3	2025-10	a3	0	0	9619	800	0
h-2025-10-a4	2025-10	a4	0	0	17958	300	0
h-2025-10-a5	2025-10	a5	0	0	40000	0	0
h-2025-10-a8	2025-10	a8	0	0	0	0	0
h-2025-11-a1	2025-11	a1	0	0	55485	0	0
h-2025-11-a2	2025-11	a2	0	0	27820	0	0
h-2025-11-a3	2025-11	a3	0	0	10317	800	0
h-2025-11-a4	2025-11	a4	0	0	16282	1050	0
h-2025-11-a5	2025-11	a5	0	0	36300	0	0
h-2025-11-a8	2025-11	a8	0	0	0	0	0
h-2025-12-a1	2025-12	a1	0	0	55580	0	0
h-2025-12-a2	2025-12	a2	0	0	28383	0	0
h-2025-12-a3	2025-12	a3	0	0	11266	1000	0
h-2025-12-a4	2025-12	a4	0	0	17574	1547	0
h-2025-12-a5	2025-12	a5	0	0	35850	0	0
h-2025-12-a8	2025-12	a8	0	0	0	0	0
h-2026-01-a1	2026-01	a1	0	0	41103	-15212	0
h-2026-01-a2	2026-01	a2	0	0	29281	0	0
h-2026-01-a3	2026-01	a3	0	0	12000	800	0
h-2026-01-a4	2026-01	a4	0	0	14500	858	0
h-2026-01-a5	2026-01	a5	0	0	24800	-11000	0
h-2026-01-a8	2026-01	a8	0	0	15727	15512	0
h-2026-01-a9	2026-01	a9	0	0	4800	4791	0
d1588c3e-a9f8-4843-aa7f-7c32894b7dbb	2026-02	a4	0	0	14000	647	0
2d6597a7-d2bc-4aab-8037-44865b30c537	2026-02	a2	0	0	29392	0	0
82765ae1-a782-42db-99dd-24ca6cf36c20	2026-02	a8	0	0	16255	300	0
b5935c8f-0c4c-4159-b4c4-b10b93588ba8	2026-02	a3	0	0	12338	800	0
5a0aa4d1-09e9-4f40-99ae-9fb90c7d757b	2026-02	a5	0	0	24400	0	0
2dc4348f-4e61-4d8e-aaa3-7f76736c7e5d	2026-02	a1	0	0	42000	0	0
fcb77fcd-9cd6-4e4d-8084-cf2f2a217bac	2026-02	a9	0	0	5324	0	0
9006e77b-9c7a-4f87-b882-b2a07e358d3e	2026-03	a4	0.2476	61316.29	15181.913403999999	0	73275
f4fd47f6-45fc-4b46-b178-2e1d6cba1c2b	2026-03	a5	0	0	23400	-1000	0
a503d6d5-8d24-455d-bba9-c53ec6c1e6e3	2026-03	a1	3786.90437	10.9	41277.257633	0	0
082a914d-b96c-4896-8310-a0436866e504	2026-03	a3	181.47	70.84	12855.3348	250	0
094c58af-ba7b-48c7-b9ef-f4ae57d8ad84	2026-03	a8	603.156901	28.18	16996.96147018	0	25.97
aa006c2f-221e-42b7-9b43-a63dbd35e90d	2026-03	a9	0	1	5930.2	0	0
45d73d40-cdad-4ab2-a93f-847e53b14698	2026-03	a2	2056.8217	14.8741	30593.37164797	0	12.99
\.


--
-- Data for Name: stock_history; Type: TABLE DATA; Schema: public; Owner: wealthhub
--

COPY public.stock_history (id, month, ticker, price, currency) FROM stdin;
\.


--
-- Data for Name: stock_transactions; Type: TABLE DATA; Schema: public; Owner: wealthhub
--

COPY public.stock_transactions (id, ticker, date, type, shares, "pricePerShare", fees, "totalAmount", broker) FROM stdin;
tx-stock-001	AMD	2026-02-05	buy	10	168.77	0	1687.7	Interactive Brokers
tx-stock-002	MSTR	2026-02-05	buy	30	103.43	0	3102.9	Interactive Brokers
\.


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: wealthhub
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: bitcoin_transactions bitcoin_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: wealthhub
--

ALTER TABLE ONLY public.bitcoin_transactions
    ADD CONSTRAINT bitcoin_transactions_pkey PRIMARY KEY (id);


--
-- Name: history history_pkey; Type: CONSTRAINT; Schema: public; Owner: wealthhub
--

ALTER TABLE ONLY public.history
    ADD CONSTRAINT history_pkey PRIMARY KEY (id);


--
-- Name: stock_history stock_history_pkey; Type: CONSTRAINT; Schema: public; Owner: wealthhub
--

ALTER TABLE ONLY public.stock_history
    ADD CONSTRAINT stock_history_pkey PRIMARY KEY (id);


--
-- Name: stock_transactions stock_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: wealthhub
--

ALTER TABLE ONLY public.stock_transactions
    ADD CONSTRAINT stock_transactions_pkey PRIMARY KEY (id);


--
-- Name: history history_assetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wealthhub
--

ALTER TABLE ONLY public.history
    ADD CONSTRAINT "history_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES public.assets(id);


--
-- PostgreSQL database dump complete
--

\unrestrict HcyUSDBzKvYUVRJGV842fvRSEcThIIUhoNntjnpM2vbH0sxML0fxJZ0R1m30YFH