import { config } from '../config';
import { Asset } from '../types';

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

  // Transactions
  createTransaction: async (data: any) => {
    const response = await fetch(`${config.backendUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create transaction');
    return response.json();
  },

  updateTransaction: async (id: string, data: any) => {
    const response = await fetch(`${config.backendUrl}/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update transaction');
    return response.json();
  },

  deleteTransaction: async (id: string) => {
    const response = await fetch(`${config.backendUrl}/api/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete transaction');
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
  }
};
