export enum AssetCategory {
  CRYPTO = 'CRYPTO',
  FUND_ACTIVE = 'FUND_ACTIVE', // gestión activa
  FUND_INDEX = 'FUND_INDEX',  // fondos indexados
  STOCK = 'STOCK',
  PENSION = 'PENSION',
  CASH = 'CASH',
}

// Types for WealthHub application
export interface Asset {
  id: string;
  name: string;
  category: string;
  color: string;
  isArchived: boolean;
  riskLevel?: string;
  parent_asset_id?: string;
  isin?: string;  // ISIN for mutual funds
  ticker?: string;  // Ticker for stocks and crypto
  participations: number;  // Number of shares/participations
  meanCost: number;  // Average cost per participation
}

export interface HistoryEntry {
  id: string;
  month: string;
  asset_id: string;
  participations: number;  // Number of shares/participations
  liquidNavValue: number;  // Liquid asset value per share
  nav: number;  // Net Asset Value (participations * liquidNavValue)
  contribution: number;  // Amount contributed/invested
  meanCost: number;  // Average cost per participation
}

export interface BitcoinTransaction {
  id: string;
  assetId: string;
  transactionDate: string;  // ISO date format
  type: 'BUY' | 'SELL';
  amountBtc: number;        // Amount of Bitcoin
  priceEurPerBtc: number;   // Price per BTC in EUR
  feesEur: number;          // Transaction fees in EUR
  totalAmountEur: number;   // Total amount paid in EUR
  exchangeRateUsdEur: number; // EUR/USD exchange rate at time of transaction
}

export interface StockTransaction {
  id: string;
  assetId: string;
  transactionDate: string;  // ISO date format
  type: 'BUY' | 'SELL';
  ticker: string;
  currency: string;         // USD, EUR, etc.
  quantity: number;         // Number of shares
  pricePerUnit: number;     // Price per share
  fees: number;             // Transaction fees
  totalAmount: number;      // Total cost
  exchangeRateEurUsd: number; // EUR/USD exchange rate at time of transaction
}


export interface SyncState {
  isSyncing: boolean;
  lastSync: Date | null;
  syncError: string | null;
}

export interface Metrics {
  totalNAV: number;
  totalInv: number;
  totalProfit: number;
  roi: number;
  cash: number;
}

export interface PriceData {
  asset_id: string;
  asset_name: string;
  ticker?: string;
  isin?: string;
  price: number;
  currency: string;
  fetched_at: string;
  source: string;
}

export interface FetchMonthResponse {
  success: boolean;
  message: string;
  year: number;
  month: number;
  lastBusinessDay: string;
  prices: PriceData[];
  errors: string[];
  exchangeRateEurUsd?: number;
  exchangeRateSource?: string;
}

// ===== Stock Portfolio DTOs (from backend) =====

export interface StockMetricsDTO {
  ticker: string;
  shares: number;
  costBasisEur: number;        // Total invested in EUR
  costBasisUsd: number;        // Total invested in USD
  averagePriceUsd: number;     // Weighted average purchase price in USD
  currentPriceUsd: number;     // Latest price from asset_history
  currentPriceEur: number;     // Current price converted to EUR
  currentValueEur: number;     // shares × currentPriceEur
  unrealizedGainEur: number;   // currentValueEur - costBasisEur
  unrealizedGainUsd: number;   // currentValueUsd - costBasisUsd
  unrealizedGainPercent: number; // (unrealizedGainEur / costBasisEur) × 100
  lastPriceUpdate?: string;    // ISO datetime
}

export interface StockPortfolioSummaryDTO {
  totalValueEur: number;              // Sum of all currentValueEur
  totalInvestedEur: number;           // Sum of all costBasisEur
  totalUnrealizedGainEur: number;    // totalValueEur - totalInvestedEur
  totalUnrealizedGainPercent: number; // (totalUnrealizedGainEur / totalInvestedEur) × 100
  exchangeRateEurUsd: number;         // Latest EUR/USD rate used
  lastUpdate: string;                 // ISO datetime
  numberOfTickers: number;            // Count of holdings
  tickers: StockMetricsDTO[];         // Individual holdings
}
