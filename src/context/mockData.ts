import { Asset, HistoryEntry, BitcoinTransaction, StockTransaction, AssetCategory } from '../types'

export const SAMPLE_DATA = {
  assets: [
    {
      id: 'asset-basalto',
      name: 'Basalto',
      category: AssetCategory.FUND_INDEX,
      color: '#6366f1',
      isArchived: false,
      riskLevel: 'Medio' as const,
      isin: 'ES0164691083',
      participations: 3786.90437,
      meanCost: 10.02
    },
    {
      id: 'asset-sp500',
      name: 'Vanguard U.S. 500 Stock Index Fund EUR Acc',
      category: AssetCategory.FUND_INDEX,
      color: '#10b981',
      isArchived: false,
      riskLevel: 'Medio' as const,
      isin: 'IE0032126645',
      participations: 181.47,
      meanCost: 66.25
    },
    {
      id: 'asset-numantia',
      name: 'Renta 4 Multigestión Numantia Patrimonio Global',
      category: AssetCategory.FUND_INDEX,
      color: '#f59e0b',
      isArchived: false,
      riskLevel: 'Medio' as const,
      isin: 'ES0173311103',
      participations: 603.156901,
      meanCost: 25.97
    },
    {
      id: 'asset-numantia-pp',
      name: 'Numantia Pensiones PP',
      category: AssetCategory.FUND_INDEX,
      color: '#8b5cf6',
      isArchived: false,
      riskLevel: 'Medio' as const,
      isin: 'N5430',
      participations: 2056.8217,
      meanCost: 12.99
    },
    {
      id: 'asset-cash',
      name: 'Cash',
      category: AssetCategory.CASH,
      color: '#22C55E',
      isArchived: false,
      riskLevel: 'Bajo' as const,
      participations: 0,
      meanCost: 0
    }
  ] as Asset[],
  history: [
    {
      id: 'hist-1',
      month: '2026-03',
      asset_id: 'asset-basalto',
      participations: 3786.90437,
      liquidNavValue: 10.02,
      nav: 37931.26,
      contribution: 37931.26,
      meanCost: 10.02
    },
    {
      id: 'hist-2',
      month: '2026-03',
      asset_id: 'asset-sp500',
      participations: 181.47,
      liquidNavValue: 66.25,
      nav: 12022.38,
      contribution: 12022.38,
      meanCost: 66.25
    },
    {
      id: 'hist-3',
      month: '2026-03',
      asset_id: 'asset-numantia',
      participations: 603.156901,
      liquidNavValue: 25.97,
      nav: 15647.22,
      contribution: 15647.22,
      meanCost: 25.97
    },
    {
      id: 'hist-4',
      month: '2026-03',
      asset_id: 'asset-numantia-pp',
      participations: 2056.8217,
      liquidNavValue: 12.99,
      nav: 26718.44,
      contribution: 26718.44,
      meanCost: 12.99
    }
  ] as HistoryEntry[],
  bitcoinTransactions: [
    {
      id: 'btc-1',
      assetId: 'a4',
      transactionDate: '2024-01-15',
      type: 'BUY' as const,
      amountBtc: 0.235294,
      priceEurPerBtc: 42500,
      feesEur: 0,
      totalAmountEur: 10000,
      exchangeRateUsdEur: 1.08
    },
    {
      id: 'btc-2',
      assetId: 'a4',
      transactionDate: '2024-02-10',
      type: 'BUY' as const,
      amountBtc: 0.16,
      priceEurPerBtc: 50000,
      feesEur: 0,
      totalAmountEur: 8000,
      exchangeRateUsdEur: 1.08
    }
  ] as BitcoinTransaction[],
  stockTransactions: [
    {
      id: 'stock-1',
      assetId: 'asset-sp500',
      ticker: 'AAPL',
      transactionDate: '2024-01-20',
      type: 'BUY' as const,
      currency: 'USD',
      quantity: 10,
      pricePerUnit: 150,
      fees: 5,
      totalAmount: 1505,
      exchangeRateEurUsd: 1.08
    },
    {
      id: 'stock-2',
      assetId: 'asset-sp500',
      ticker: 'MSFT',
      transactionDate: '2024-02-05',
      type: 'BUY' as const,
      currency: 'USD',
      quantity: 5,
      pricePerUnit: 380,
      fees: 3,
      totalAmount: 1903,
      exchangeRateEurUsd: 1.08
    },
    {
      id: 'stock-3',
      assetId: 'asset-sp500',
      ticker: 'AAPL',
      transactionDate: '2024-02-15',
      type: 'BUY' as const,
      currency: 'USD',
      quantity: 8,
      pricePerUnit: 160,
      fees: 4,
      totalAmount: 1284,
      exchangeRateEurUsd: 1.08
    }
  ] as StockTransaction[]
}
