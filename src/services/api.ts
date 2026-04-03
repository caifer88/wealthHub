import { config } from '../config';
import { Asset, StockPortfolioSummaryDTO, BitcoinTransaction, StockTransaction } from '../types';

export const api = {
  // Assets
  createAsset: async (assetData: Omit<Asset, 'id'> | Asset) => {
    const response = await fetch(`${config.backendUrl}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assetData),
    });
    if (!response.ok) throw new Error('Failed to create asset');
    return response.json();
  },

  updateAsset: async (id: string, assetData: Partial<Asset>) => {
    const response = await fetch(`${config.backendUrl}/api/assets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assetData),
    });
    if (!response.ok) throw new Error('Failed to update asset');
    return response.json();
  },

  deleteAsset: async (id: string) => {
    const response = await fetch(`${config.backendUrl}/api/assets/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete asset');
    return true;
  },

  updateHistory: async (id: string, data: any) => {
    const response = await fetch(`${config.backendUrl}/api/history/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update history');
    return response.json();
  },

  deleteHistory: async (id: string) => {
    const response = await fetch(`${config.backendUrl}/api/history/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete history');
    return true;
  },

  // Stock Portfolio (Phase 3 endpoints)
  getStockPortfolioSummary: async (): Promise<StockPortfolioSummaryDTO> => {
    const response = await fetch(`${config.backendUrl}/api/stocks/portfolio`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch stock portfolio');
    return response.json();
  },

  getStockAllocation: async (): Promise<Record<string, number>> => {
    const response = await fetch(`${config.backendUrl}/api/stocks/allocation`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch stock allocation');
    return response.json();
  },

  // Bitcoin Transactions (Bifurcation Phase 5)
  getBitcoinTransactions: async (): Promise<BitcoinTransaction[]> => {
    const response = await fetch(`${config.backendUrl}/api/bitcoin/transactions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch Bitcoin transactions');
    return response.json();
  },

  createBitcoinTransaction: async (transaction: BitcoinTransaction): Promise<BitcoinTransaction> => {
    const response = await fetch(`${config.backendUrl}/api/bitcoin/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!response.ok) throw new Error('Failed to create Bitcoin transaction');
    return response.json();
  },

  updateBitcoinTransaction: async (id: string, transaction: BitcoinTransaction): Promise<BitcoinTransaction> => {
    const response = await fetch(`${config.backendUrl}/api/bitcoin/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!response.ok) throw new Error('Failed to update Bitcoin transaction');
    return response.json();
  },

  deleteBitcoinTransaction: async (id: string): Promise<void> => {
    const response = await fetch(`${config.backendUrl}/api/bitcoin/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete Bitcoin transaction');
  },

  // Stock Transactions (Bifurcation Phase 5)
  getStockTransactions: async (): Promise<StockTransaction[]> => {
    const response = await fetch(`${config.backendUrl}/api/stocks/transactions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch Stock transactions');
    return response.json();
  },

  createStockTransaction: async (transaction: StockTransaction): Promise<StockTransaction> => {
    const response = await fetch(`${config.backendUrl}/api/stocks/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!response.ok) throw new Error('Failed to create Stock transaction');
    return response.json();
  },

  updateStockTransaction: async (id: string, transaction: StockTransaction): Promise<StockTransaction> => {
    const response = await fetch(`${config.backendUrl}/api/stocks/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!response.ok) throw new Error('Failed to update Stock transaction');
    return response.json();
  },

  deleteStockTransaction: async (id: string): Promise<void> => {
    const response = await fetch(`${config.backendUrl}/api/stocks/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete Stock transaction');
  },
};

