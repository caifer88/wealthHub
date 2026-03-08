// Types for WealthHub application
export interface Asset {
  id: string;
  name: string;
  category: string;
  color: string;
  archived: boolean;
  riskLevel?: string;
  isin?: string;  // ISIN for mutual funds
  ticker?: string;  // Ticker for stocks and crypto
  participations: number;  // Number of shares/participations
  meanCost: number;  // Average cost per participation
}

export interface HistoryEntry {
  id: string;
  month: string;
  assetId: string;
  participations: number;  // Number of shares/participations
  liquidNavValue: number;  // Liquid asset value per share
  nav: number;  // Net Asset Value (participations * liquidNavValue)
  contribution: number;  // Amount contributed/invested
  meanCost: number;  // Average cost per participation
}

export interface Transaction {
  id: string;
  assetId: string;
  date: string;
  type: 'buy' | 'sell';
  ticker?: string;
  quantity: number;
  pricePerUnit: number;
  fees: number;
  totalAmount: number;
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
  assetId: string;
  assetName: string;
  ticker?: string;
  isin?: string;
  price: number;
  currency: string;
  fetchedAt: string;
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
