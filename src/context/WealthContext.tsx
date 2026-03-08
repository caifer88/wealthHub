import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import { Asset, HistoryEntry, Transaction, SyncState, Metrics } from '../types'
import { generateUUID } from '../utils'
import { config } from '../config'

// Data validation functions
// Data validation functions
export const sanitizeTransactions = (txs: any[]): Transaction[] => {
  if (!Array.isArray(txs)) return []
  return txs.map((tx: any) => {
    let txType: 'buy' | 'sell' = 'buy'
    if (tx.type === 'Compra' || tx.type === 'buy') {
      txType = 'buy'
    } else if (tx.type === 'Venta' || tx.type === 'sell') {
      txType = 'sell'
    }
    return {
      id: tx.id || generateUUID(),
      assetId: tx.assetId || tx.asset_id || '',
      ticker: tx.ticker || undefined,
      date: tx.date || tx.transaction_date || new Date().toISOString().split('T')[0],
      type: txType,
      quantity: parseFloat(tx.quantity) || parseFloat(tx.shares) || parseFloat(tx.amountBTC) || 0,
      pricePerUnit: parseFloat(tx.pricePerUnit) || parseFloat(tx.price_per_unit) || parseFloat(tx.pricePerShare) || parseFloat(tx.meanPrice) || 0,
      fees: parseFloat(tx.fees) || 0,
      totalAmount: parseFloat(tx.totalAmount) || parseFloat(tx.total_amount) || parseFloat(tx.totalCost) || parseFloat(tx.amount) || 0
    } as Transaction
  })
}
const SAMPLE_DATA = {
  assets: [
    {
      id: 'asset-basalto',
      name: 'Basalto',
      category: 'Fund' as const,
      color: '#6366f1',
      archived: false,
      riskLevel: 'Medio' as const,
      isin: 'ES0164691083',
      participations: 3786.90437,
      meanCost: 10.02
    },
    {
      id: 'asset-sp500',
      name: 'Vanguard U.S. 500 Stock Index Fund EUR Acc',
      category: 'Fund' as const,
      color: '#10b981',
      archived: false,
      riskLevel: 'Medio' as const,
      isin: 'IE0032126645',
      participations: 181.47,
      meanCost: 66.25
    },
    {
      id: 'asset-numantia',
      name: 'Renta 4 Multigestión Numantia Patrimonio Global',
      category: 'Fund' as const,
      color: '#f59e0b',
      archived: false,
      riskLevel: 'Medio' as const,
      isin: 'ES0173311103',
      participations: 603.156901,
      meanCost: 25.97
    },
    {
      id: 'asset-numantia-pp',
      name: 'Numantia Pensiones PP',
      category: 'Fund' as const,
      color: '#8b5cf6',
      archived: false,
      riskLevel: 'Medio' as const,
      isin: 'N5430',
      participations: 2056.8217,
      meanCost: 12.99
    },
    {
      id: 'asset-cash',
      name: 'Cash',
      category: 'Cash' as const,
      color: '#22C55E',
      archived: false,
      riskLevel: 'Bajo' as const,
      participations: 0,
      meanCost: 0
    }
  ] as Asset[],
  history: [
    {
      id: 'hist-1',
      month: '2026-03',
      assetId: 'asset-basalto',
      participations: 3786.90437,
      liquidNavValue: 10.02,
      nav: 37931.26,
      contribution: 37931.26,
      meanCost: 10.02
    },
    {
      id: 'hist-2',
      month: '2026-03',
      assetId: 'asset-sp500',
      participations: 181.47,
      liquidNavValue: 66.25,
      nav: 12022.38,
      contribution: 12022.38,
      meanCost: 66.25
    },
    {
      id: 'hist-3',
      month: '2026-03',
      assetId: 'asset-numantia',
      participations: 603.156901,
      liquidNavValue: 25.97,
      nav: 15647.22,
      contribution: 15647.22,
      meanCost: 25.97
    },
    {
      id: 'hist-4',
      month: '2026-03',
      assetId: 'asset-numantia-pp',
      participations: 2056.8217,
      liquidNavValue: 12.99,
      nav: 26718.44,
      contribution: 26718.44,
      meanCost: 12.99
    }
  ] as HistoryEntry[],
  transactions: [
    {
      id: 'btc-1',
      assetId: 'a4',
      date: '2024-01-15',
      type: 'buy' as const,
      quantity: 0.235294,
      totalAmount: 10000,
      pricePerUnit: 42500,
      fees: 0
    },
    {
      id: 'btc-2',
      assetId: 'a4',
      date: '2024-02-10',
      type: 'buy' as const,
      quantity: 0.16,
      totalAmount: 8000,
      pricePerUnit: 50000,
      fees: 0
    },
    {
      id: 'stock-1',
      assetId: 'a9',
      ticker: 'AAPL',
      date: '2024-01-20',
      type: 'buy' as const,
      quantity: 10,
      pricePerUnit: 150,
      fees: 5,
      totalAmount: 1505
    },
    {
      id: 'stock-2',
      assetId: 'a9',
      ticker: 'MSFT',
      date: '2024-02-05',
      type: 'buy' as const,
      quantity: 5,
      pricePerUnit: 380,
      fees: 3,
      totalAmount: 1903
    },
    {
      id: 'stock-3',
      assetId: 'a9',
      ticker: 'AAPL',
      date: '2024-02-15',
      type: 'buy' as const,
      quantity: 8,
      pricePerUnit: 160,
      fees: 4,
      totalAmount: 1284
    }
  ] as Transaction[]
}

interface WealthContextType {
  // State
  assets: Asset[]
  history: HistoryEntry[]
  transactions: Transaction[]
  syncState: SyncState
  darkMode: boolean
  metrics: Metrics | null

  // Actions
  setAssets: (assets: Asset[]) => void
  setHistory: (history: HistoryEntry[]) => void
  setTransactions: (txs: Transaction[]) => void
  setDarkMode: (mode: boolean) => void

  // Sync
  loadDataFromBackend: () => Promise<void>
  saveDataToBackend: (assets: Asset[], history: HistoryEntry[], txs: Transaction[]) => Promise<void>
  downloadBackup: (assets: Asset[], history: HistoryEntry[], txs: Transaction[]) => void
}

const WealthContext = createContext<WealthContextType | undefined>(undefined)


const gasFetcher = async (url: string) => {
  const res = await fetch(url)
  const result = await res.json()
  if (!result.success || !result.data) {
    throw new Error('Failed to load data from GAS')
  }
  return result.data
}

export const WealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<Asset[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSync: null,
    syncError: null
  })
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('wm_theme') === 'dark')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const isFirstRender = useRef(true)

  // SWR para data fetching automático
  const { data: backendData, error: backendError, mutate: mutateBackendData, isValidating } = useSWR(`${config.backendUrl}/data`, backendFetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute
  })

  // Sincronizar estado isSyncing de SWR
  useEffect(() => {
    setSyncState(prev => ({ ...prev, isSyncing: isValidating }))
  }, [isValidating])

  // Sincronizar Context con los datos de SWR (cada vez que SWR tenga nuevos datos validados)
  useEffect(() => {
    // Si tenemos nueva data de SWR, actualizamos el estado independientemente del primer render
    if (backendData && backendData.assets) {
        isFirstRender.current = false // Marcamos que ya pasó el primer render para otros efectos si hace falta

        // Usamos la misma lógica de normalización / validación que había
        let txs = backendData.transactions || []
        txs = sanitizeTransactions(txs)

        setAssets(backendData.assets)
        setHistory(backendData.history || [])
        setTransactions(txs)
        setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
        return
    }

    // Solo caer en fallback si hay error y es el primer render para no sobreescribir datos en cache local tras un fallo temporal
    if (backendError && isFirstRender.current) {
        isFirstRender.current = false
        // Fallback a localStorage
        const localAssets = JSON.parse(localStorage.getItem('wm_assets_v4') || '[]')
        const localHistory = JSON.parse(localStorage.getItem('wm_history_v4') || '[]')
        const localTransactions = JSON.parse(localStorage.getItem('wm_transactions_v4') || '[]')

        if (localAssets.length > 0) {
            setAssets(localAssets)
            setHistory(localHistory)
            setTransactions(sanitizeTransactions(localTransactions))
            setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
            return
        }

        // Si no hay datos en ningún lado, usar datos de muestra
        setAssets(SAMPLE_DATA.assets)
        setHistory(SAMPLE_DATA.history)
        setTransactions(SAMPLE_DATA.transactions)
        setSyncState(prev => ({ ...prev, syncError: 'Usando datos de muestra' }))
    }
  }, [backendData, backendError])

  // Guardar en localStorage y sincronizar con GAS
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    localStorage.setItem('wm_assets_v4', JSON.stringify(assets))
    localStorage.setItem('wm_history_v4', JSON.stringify(history))
    localStorage.setItem('wm_transactions_v4', JSON.stringify(transactions))

    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('wm_theme', darkMode ? 'dark' : 'light')

    if (assets.length > 0) {
      saveDataToBackend(assets, history, transactions)
    }
  }, [assets, history, transactions, darkMode])

  // Calcular métricas
  useEffect(() => {
    if (assets.length === 0) {
      setMetrics(null)
      return
    }

    const activeAssets = assets.filter(a => !a.archived)
    const cashAsset = activeAssets.find(a => a.name === 'Cash')
    
    // Obtener el valor de Cash del último mes del historial
    let cash = 0
    if (cashAsset) {
      const cashHistory = history
        .filter(h => h.assetId === cashAsset.id)
        .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
      if (cashHistory.length > 0) {
        cash = cashHistory[0].nav || 0
      } else {
        cash = 0
      }
    }

    // Calcular NAV total y ROI (excluyendo Cash para ganancia/pérdida)
    let totalNAV = 0
    let totalInvested = 0
    let totalProfit = 0

    activeAssets.forEach(asset => {
      // Excluir Cash del cálculo de ganancia/pérdida
      if (asset.name === 'Cash') return

      // EVITAR DOBLE CONTABILIDAD: Excluir acciones si ya tenemos el contenedor Broker
      const brokerAssets = activeAssets.filter(a => a.category === 'Stocks' || a.name === 'Interactive Brokers')
      const isStockInBroker = brokerAssets.some(broker =>
         asset.ticker && transactions.some((tx: any) => tx.assetId === broker.id && tx.ticker === asset.ticker)
      )
      
      // Excluir activos que son sub-componentes de otros (ej: Basalto dentro de Fondo Basalto)
      const isComponent = activeAssets.some(parent => 
        parent.name && asset.name && parent.name.length > asset.name.length && parent.name.includes(asset.name) && parent.id !== asset.id
      )

      if (isStockInBroker || isComponent) {
        return // Saltamos este activo para no sumarlo dos veces al total
      }

      const assetHistory = history.filter(h => h.assetId === asset.id).sort((a, b) => 
        new Date(a.month).getTime() - new Date(b.month).getTime()
      )
      
      if (assetHistory.length > 0) {
        // Usar el último valor del histórico para el NAV
        const lastEntry = assetHistory[assetHistory.length - 1]
        totalNAV += lastEntry.nav
        // Sumamos TODO el histórico de aportaciones para el Total Invertido
        totalInvested += assetHistory.reduce((sum, h) => sum + (h.contribution || 0), 0)
      }
    })

    totalProfit = totalNAV - totalInvested
    const roi = totalInvested > 0 ? ((totalProfit) / totalInvested) * 100 : 0

    setMetrics({
      totalNAV,
      totalInv: totalInvested,
      totalProfit,
      roi,
      cash
    })
  }, [assets, history])

  const loadDataFromBackend = useCallback(async () => {
    // SWR mutate triggers a re-fetch and updates hook state automatically
    mutateBackendData()
  }, [mutateBackendData])

  const saveDataToBackend = useCallback(async (
    assetsToSave: Asset[],
    historyToSave: HistoryEntry[],
    transactionsToSave: Transaction[]
  ) => {
    if (!assetsToSave || assetsToSave.length === 0) return

    setSyncState(prev => ({ ...prev, isSyncing: true }))

    try {
      const dataToSend = {
        assets: assetsToSave,
        history: historyToSave,
        transactions: transactionsToSave,
        lastUpdated: new Date().toISOString()
      }

      await fetch(`${config.backendUrl}/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      })

      setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
    } catch (error) {
      console.error('❌ Error sincronizando con Backend:', error)
      setSyncState(prev => ({
        ...prev,
        syncError: error instanceof Error ? error.message : 'Error de sincronización'
      }))
    } finally {
      setSyncState(prev => ({ ...prev, isSyncing: false }))
    }
  }, [])

  const downloadBackup = useCallback((
    assetsToBackup: Asset[],
    historyToBackup: HistoryEntry[],
    transactionsToBackup: Transaction[]
  ) => {
    const backupData = {
      assets: assetsToBackup,
      history: historyToBackup,
      transactions: transactionsToBackup,
      exportedAt: new Date().toISOString()
    }

    const dataStr = JSON.stringify(backupData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wealthhub_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const value: WealthContextType = {
    assets,
    history,
    transactions,
    syncState,
    darkMode,
    metrics,
    setAssets,
    setHistory,
    setTransactions,
    setDarkMode,
    loadDataFromBackend,
    saveDataToBackend,
    downloadBackup
  }

  return <WealthContext.Provider value={value}>{children}</WealthContext.Provider>
}

export const useWealth = () => {
  const context = useContext(WealthContext)
  if (context === undefined) {
    throw new Error('useWealth must be used within WealthProvider')
  }
  return context
}
