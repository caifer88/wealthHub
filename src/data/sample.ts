import { Asset, HistoryEntry, BitcoinTransaction, StockTransaction } from '../types'

export const SAMPLE_DATA = {
  assets: [
    {
      id: 'asset-1',
      name: 'Acciones Española',
      category: 'Inversión' as const,
      color: '#4F46E5',
      baseAmount: 5500,
      archived: false,
      targetAllocation: 30,
      riskLevel: 'medium' as const
    },
    {
      id: 'asset-2',
      name: 'Criptomonedas',
      category: 'Criptomonedas' as const,
      color: '#F97316',
      baseAmount: 3300,
      archived: false,
      targetAllocation: 20,
      riskLevel: 'high' as const
    },
    {
      id: 'asset-3',
      name: 'Cash',
      category: 'Efectivo' as const,
      color: '#22C55E',
      baseAmount: 2000,
      archived: false,
      targetAllocation: 50,
      riskLevel: 'low' as const
    }
  ] as Asset[],
  history: [
    {
      id: 'hist-1',
      month: '2024-01',
      assetId: 'asset-1',
      nav: 5000,
      contribution: 5000
    },
    {
      id: 'hist-2',
      month: '2024-01',
      assetId: 'asset-2',
      nav: 3000,
      contribution: 3000
    },
    {
      id: 'hist-3',
      month: '2024-01',
      assetId: 'asset-3',
      nav: 2000,
      contribution: 2000
    },
    {
      id: 'hist-4',
      month: '2024-02',
      assetId: 'asset-1',
      nav: 5300,
      contribution: 5000
    },
    {
      id: 'hist-5',
      month: '2024-02',
      assetId: 'asset-2',
      nav: 3200,
      contribution: 3000
    },
    {
      id: 'hist-6',
      month: '2024-02',
      assetId: 'asset-3',
      nav: 2000,
      contribution: 2000
    }
  ] as HistoryEntry[],
  bitcoinTransactions: [
    {
      id: 'btc-1',
      date: '2024-01-15',
      type: 'buy' as const,
      amount: 10000,
      amountBTC: 0.235294,
      totalCost: 10000,
      meanPrice: 42500
    },
    {
      id: 'btc-2',
      date: '2024-02-10',
      type: 'buy' as const,
      amount: 8000,
      amountBTC: 0.16,
      totalCost: 8000,
      meanPrice: 50000
    }
  ] as BitcoinTransaction[],
  stockTransactions: [
    {
      id: 'stock-1',
      ticker: 'AAPL',
      date: '2024-01-20',
      type: 'buy' as const,
      shares: 10,
      pricePerShare: 150,
      fees: 5,
      totalAmount: 1505
    },
    {
      id: 'stock-2',
      ticker: 'MSFT',
      date: '2024-02-05',
      type: 'buy' as const,
      shares: 5,
      pricePerShare: 380,
      fees: 3,
      totalAmount: 1903
    },
    {
      id: 'stock-3',
      ticker: 'AAPL',
      date: '2024-02-15',
      type: 'buy' as const,
      shares: 8,
      pricePerShare: 160,
      fees: 4,
      totalAmount: 1284
    }
  ] as StockTransaction[]
}
