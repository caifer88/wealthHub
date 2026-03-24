export enum AssetCategory {
  CRYPTO = 'CRYPTO',
  FUND = 'FUND',
  STOCK = 'STOCK',
  PENSION = 'PENSION',
  CASH = 'CASH'
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
  date: string;
  type: 'buy' | 'sell';
  amount: number;
  amountBTC: number;
  totalCost: number;
  meanPrice: number;
}

export interface StockTransaction {
  id: string;
  ticker: string;
  date: string;
  type: 'buy' | 'sell';
  shares: number;
  pricePerShare: number;
  fees: number;
  totalAmount: number;
  broker?: string;  // Broker identifier (e.g."Interactive Brokers")
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
}
