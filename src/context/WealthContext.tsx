import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Asset, HistoryEntry, BitcoinTransaction, StockTransaction, Metrics } from '../types'
import { generateUUID } from '../utils'
import { config } from '../config'

// ============================================
// Data Validation Functions
// ============================================

export const sanitizeBitcoinTransactions = (txs: any[]): BitcoinTransaction[] => {
  if (!Array.isArray(txs)) return []
  return txs.map((tx: any) => {
    let txType: 'BUY' | 'SELL' = 'BUY'
    if (tx.type === 'Compra' || tx.type === 'buy' || tx.type === 'BUY') {
      txType = 'BUY'
    } else if (tx.type === 'Venta' || tx.type === 'sell' || tx.type === 'SELL') {
      txType = 'SELL'
    }
    return {
      id: tx.id || generateUUID(),
      assetId: tx.assetId || '',
      transactionDate: tx.transactionDate || tx.date || new Date().toISOString().split('T')[0],
      type: txType,
      amountBtc: parseFloat(tx.amountBtc) || 0,
      priceEurPerBtc: parseFloat(tx.priceEurPerBtc || tx.meanPrice) || 0,
      feesEur: parseFloat(tx.feesEur || tx.fees) || 0,
      totalAmountEur: parseFloat(tx.totalAmountEur || tx.totalCost || tx.amount) || 0,
      exchangeRateUsdEur: parseFloat(tx.exchangeRateUsdEur) || 1.15
    } as BitcoinTransaction
  })
}

export const sanitizeStockTransactions = (txs: any[]): StockTransaction[] => {
  if (!Array.isArray(txs)) return []
  return txs.map((tx: any) => {
    let txType: 'BUY' | 'SELL' = 'BUY'
    if (tx.type === 'Compra' || tx.type === 'buy' || tx.type === 'BUY') {
      txType = 'BUY'
    } else if (tx.type === 'Venta' || tx.type === 'sell' || tx.type === 'SELL') {
      txType = 'SELL'
    }
    return {
      id: tx.id || generateUUID(),
      assetId: tx.assetId || '',
      transactionDate: tx.transactionDate || tx.date || new Date().toISOString().split('T')[0],
      type: txType,
      ticker: tx.ticker || '',
      currency: tx.currency || 'USD',
      quantity: parseFloat(tx.quantity || tx.shares) || 0,
      pricePerUnit: parseFloat(tx.pricePerUnit || tx.pricePerShare) || 0,
      fees: parseFloat(tx.fees) || 0,
      totalAmount: parseFloat(tx.totalAmount) || 0,
      exchangeRateEurUsd: parseFloat(tx.exchangeRateEurUsd || tx.exchangeRate || tx.exchange_rate) || 1.15
    } as StockTransaction
  })
}

// ============================================
// Context Definition
// ============================================

interface WealthContextType {
  darkMode: boolean
  setDarkMode: (mode: boolean) => void
}

const WealthContext = createContext<WealthContextType | undefined>(undefined)

// ============================================
// Query Hooks (Data Fetching)
// ============================================

/**
 * Hook para obtener activos con caché automático
 * - Primero devuelve datos del caché (si existen)
 * - Luego refetch en background
 * - isLoading indica carga inicial, isFetching indica actualizaciones
 */
export const useAssets = () => {
  return useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const res = await fetch(`${config.backendUrl}/api/assets`)
      if (!res.ok) throw new Error('Error fetching assets')
      return res.json() as Promise<Asset[]>
    },
    initialData: () => {
      // Intentar cargar del localStorage para renderizado instantáneo
      try {
        const cached = localStorage.getItem('wealthhub_assets_cache')
        return cached ? JSON.parse(cached) : undefined
      } catch {
        return undefined
      }
    },
  })
}

export const useHistory = () => {
  return useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch(`${config.backendUrl}/api/history`)
      if (!res.ok) throw new Error('Error fetching history')
      return res.json() as Promise<HistoryEntry[]>
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('wealthhub_history_cache')
        return cached ? JSON.parse(cached) : undefined
      } catch {
        return undefined
      }
    },
  })
}

export const useBitcoinTransactions = () => {
  return useQuery({
    queryKey: ['bitcoinTransactions'],
    queryFn: async () => {
      const res = await fetch(`${config.backendUrl}/api/bitcoin/transactions`)
      if (!res.ok) throw new Error('Error fetching bitcoin transactions')
      const data = await res.json()
      return sanitizeBitcoinTransactions(data)
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('wealthhub_bitcoinTransactions_cache')
        return cached ? JSON.parse(cached) : undefined
      } catch {
        return undefined
      }
    },
  })
}

export const useStockTransactions = () => {
  return useQuery({
    queryKey: ['stockTransactions'],
    queryFn: async () => {
      const res = await fetch(`${config.backendUrl}/api/stocks/transactions`)
      if (!res.ok) throw new Error('Error fetching stock transactions')
      const data = await res.json()
      return sanitizeStockTransactions(data)
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('wealthhub_stockTransactions_cache')
        return cached ? JSON.parse(cached) : undefined
      } catch {
        return undefined
      }
    },
  })
}

export const useMetrics = () => {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await fetch(`${config.backendUrl}/api/portfolio/summary`)
      if (!res.ok) throw new Error('Error fetching metrics')
      const data = await res.json()
      return {
        totalNAV: data.totalValue || 0,
        totalInv: data.totalInvested || 0,
        totalProfit: data.absoluteRoi || 0,
        roi: data.percentageRoi || 0,
        cash: data.cashValue || 0,
      } as Metrics
    },
  })
}

export const useExchangeRate = () => {
  return useQuery({
    queryKey: ['exchangeRate'],
    queryFn: async () => {
      const res = await fetch(`${config.backendUrl}/api/portfolio/exchange-rate`)
      if (!res.ok) return 1.15
      const data = await res.json()
      return data.rate > 0 ? data.rate : 1.15
    },
    initialData: 1.15,
  })
}

// ============================================
// Provider Component
// ============================================

export const WealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Detectar preferencia del SO para dark mode (respeta window.matchMedia)
  const [darkMode, setDarkModeState] = useState(() => {
    const stored = localStorage.getItem('wealthhub_theme')
    if (stored) return stored === 'dark'
    // Si no hay preferencia guardada, respetar la del SO
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const setDarkMode = useCallback((mode: boolean) => {
    setDarkModeState(mode)
    localStorage.setItem('wealthhub_theme', mode ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', mode)
  }, [])

  // Efecto para aplicar dark mode al montar
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const value: WealthContextType = {
    darkMode,
    setDarkMode,
  }

  return <WealthContext.Provider value={value}>{children}</WealthContext.Provider>
}

// ============================================
// Context Hook
// ============================================

export const useWealth = () => {
  const context = useContext(WealthContext)
  if (context === undefined) {
    throw new Error('useWealth must be used within WealthProvider')
  }
  return context
}

// ============================================
// Convenience Hook para refetch all
// ============================================

export const useRefetchAll = () => {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    // Invalidar todas las queries para que se refetchen
    await queryClient.invalidateQueries()
  }, [queryClient])
}