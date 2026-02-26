import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { Asset, HistoryEntry, BitcoinTransaction, StockTransaction, SyncState, Metrics } from '../types'
import { generateUUID } from '../utils'
import { gasService, exportService } from '../services'
import { SAMPLE_DATA } from '../data/sample'

// Data validation functions
const sanitizeBitcoinTransactions = (txs: any[]): BitcoinTransaction[] => {
  if (!Array.isArray(txs)) return []
  console.log(`📊 Procesando ${txs.length} transacciones de Bitcoin`)
  return txs.map((tx: any) => {
    let txType: 'buy' | 'sell' = 'buy'
    if (tx.type === 'Compra' || tx.type === 'buy') {
      txType = 'buy'
    } else if (tx.type === 'Venta' || tx.type === 'sell') {
      txType = 'sell'
    }
    const amountBTC = parseFloat(tx.amountBTC) || 0
    return {
      id: tx.id || generateUUID(),
      date: tx.date || new Date().toISOString().split('T')[0],
      type: txType,
      amount: parseFloat(tx.amount) || parseFloat(tx.totalCost) || 0,
      amountBTC: amountBTC,
      totalCost: parseFloat(tx.totalCost) || parseFloat(tx.amount) || 0,
      meanPrice: parseFloat(tx.meanPrice) || 0
    } as BitcoinTransaction
  })
}

interface WealthContextType {
  // State
  assets: Asset[]
  history: HistoryEntry[]
  bitcoinTransactions: BitcoinTransaction[]
  stockTransactions: StockTransaction[]
  syncState: SyncState
  darkMode: boolean
  metrics: Metrics | null

  // Actions
  setAssets: (assets: Asset[]) => void
  setHistory: (history: HistoryEntry[]) => void
  setBitcoinTransactions: (txs: BitcoinTransaction[]) => void
  setStockTransactions: (txs: StockTransaction[]) => void
  setDarkMode: (mode: boolean) => void

  // Sync
  loadDataFromGAS: () => Promise<void>
  saveDataToGAS: (assets: Asset[], history: HistoryEntry[], bitcoinTxs: BitcoinTransaction[], stockTxs: StockTransaction[]) => Promise<void>
  downloadBackup: (assets: Asset[], history: HistoryEntry[], bitcoinTxs: BitcoinTransaction[], stockTxs: StockTransaction[]) => void
}

const WealthContext = createContext<WealthContextType | undefined>(undefined)

export const WealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<Asset[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [bitcoinTransactions, setBitcoinTransactions] = useState<BitcoinTransaction[]>([])
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([])
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSync: null,
    syncError: null
  })
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('wm_theme') === 'dark')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const isFirstRender = useRef(true)

  // Cargar datos iniciales desde GAS o localStorage
  useEffect(() => {
    if(!isFirstRender.current) return
    isFirstRender.current = false
    
    const initializeData = async () => {
      try {
        // Intentar cargar desde GAS
        setSyncState(prev => ({ ...prev, isSyncing: true }))
        const result = await gasService.fetchData()

        if (result.success && result.data && result.data.assets) {
          console.log('✅ Datos cargados desde GAS exitosamente')
          
          // Normalizar datos de Bitcoin si es necesario
          let bitcoinTxs = result.data.bitcoinTransactions || []
          bitcoinTxs = bitcoinTxs.map((tx: any) => {
            let txType: 'buy' | 'sell' = 'buy'
            if (tx.type === 'Compra' || tx.type === 'buy') {
              txType = 'buy'
            } else if (tx.type === 'Venta' || tx.type === 'sell') {
              txType = 'sell'
            }
            const amountBTC = parseFloat(tx.amountBTC) || 0
            return {
              id: tx.id,
              date: tx.date,
              type: txType,
              amount: parseFloat(tx.amount) || parseFloat(tx.totalCost) || 0,
              amountBTC: amountBTC,
              totalCost: parseFloat(tx.totalCost) || parseFloat(tx.amount) || 0,
              meanPrice: parseFloat(tx.meanPrice) || 0
            } as BitcoinTransaction
          })
          
          // Normalizar datos de Stocks si es necesario
          let stockTxs = result.data.stockTransactions || []
          stockTxs = stockTxs.map((tx: any) => {
            let txType: 'buy' | 'sell' = 'buy'
            if (tx.type === 'Compra' || tx.type === 'buy') {
              txType = 'buy'
            } else if (tx.type === 'Venta' || tx.type === 'sell') {
              txType = 'sell'
            }
            return {
              id: tx.id,
              ticker: tx.ticker || '',
              date: tx.date || new Date().toISOString().split('T')[0],
              type: txType,
              shares: parseFloat(tx.shares) || 0,
              pricePerShare: parseFloat(tx.pricePerShare) || 0,
              fees: parseFloat(tx.fees) || 0,
              totalAmount: parseFloat(tx.totalAmount) || 0
            } as StockTransaction
          })
          
          setAssets(result.data.assets)
          setHistory(result.data.history || [])
          setBitcoinTransactions(bitcoinTxs)
          setStockTransactions(stockTxs)
          setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
          return
        }
      } catch (error) {
        // GAS falló, intentar localStorage
        console.log('⚠️ GAS no disponible, intentando localStorage:', error instanceof Error ? error.message : error)
      }

      // Fallback a localStorage
      const localAssets = JSON.parse(localStorage.getItem('wm_assets_v4') || '[]')
      const localHistory = JSON.parse(localStorage.getItem('wm_history_v4') || '[]')
      const localBitcoin = JSON.parse(localStorage.getItem('wm_bitcoinTransactions_v4') || '[]')
      const localStocks = JSON.parse(localStorage.getItem('wm_stockTransactions_v4') || '[]')

      if (localAssets.length > 0) {
        console.log('✅ Datos cargados desde localStorage')
        setAssets(localAssets)
        setHistory(localHistory)
        setBitcoinTransactions(sanitizeBitcoinTransactions(localBitcoin))
        setStockTransactions(localStocks)
        setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
        return
      }

      // Si no hay datos en ningún lado, usar datos de muestra
      console.log('ℹ️ Usando datos de muestra')
      setAssets(SAMPLE_DATA.assets)
      setHistory(SAMPLE_DATA.history)
      setBitcoinTransactions(SAMPLE_DATA.bitcoinTransactions)
      setStockTransactions(SAMPLE_DATA.stockTransactions)
      setSyncState(prev => ({ ...prev, syncError: 'Usando datos de muestra' }))
    }

    initializeData()
  }, [])

  // Guardar en localStorage y sincronizar con GAS
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    localStorage.setItem('wm_assets_v4', JSON.stringify(assets))
    localStorage.setItem('wm_history_v4', JSON.stringify(history))
    localStorage.setItem('wm_bitcoinTransactions_v4', JSON.stringify(bitcoinTransactions))
    localStorage.setItem('wm_stockTransactions_v4', JSON.stringify(stockTransactions))

    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('wm_theme', darkMode ? 'dark' : 'light')

    if (assets.length > 0) {
      saveDataToGAS(assets, history, bitcoinTransactions, stockTransactions)
    }
  }, [assets, history, bitcoinTransactions, stockTransactions, darkMode])

  // Calcular métricas
  useEffect(() => {
    if (assets.length === 0) {
      setMetrics(null)
      return
    }

    const activeAssets = assets.filter(a => !a.archived)
    const cashAsset = activeAssets.find(a => a.name === 'Cash')
    const liquidez = cashAsset?.baseAmount || 0

    // Calcular NAV total y ROI (excluyendo Cash para ganancia/pérdida)
    let totalNAV = 0
    let totalInvested = 0
    let totalProfit = 0

    activeAssets.forEach(asset => {
      // Excluir Cash del cálculo de ganancia/pérdida
      if (asset.name === 'Cash') {
        return
      }

      const assetHistory = history.filter(h => h.assetId === asset.id).sort((a, b) => 
        new Date(a.month).getTime() - new Date(b.month).getTime()
      )
      
      if (assetHistory.length > 0) {
        // Usar el último valor del histórico
        const lastEntry = assetHistory[assetHistory.length - 1]
        totalNAV += lastEntry.nav
        totalInvested += assetHistory.reduce((sum, h) => sum + h.contribution, 0)
      } else {
        // Si no hay histórico, usar baseAmount
        totalNAV += asset.baseAmount
        totalInvested += asset.baseAmount
      }
    })

    totalProfit = totalNAV - totalInvested
    const roi = totalInvested > 0 ? ((totalProfit) / totalInvested) * 100 : 0

    setMetrics({
      totalNAV,
      totalInv: totalInvested,
      totalProfit,
      roi,
      liquidez
    })
  }, [assets, history])

  const loadDataFromGAS = useCallback(async () => {
    try {
      const result = await gasService.fetchData()

      if (result.success && result.data) {
        setAssets(result.data.assets || [])
        setHistory(result.data.history || [])
        setBitcoinTransactions(sanitizeBitcoinTransactions(result.data.bitcoinTransactions || []))
        setStockTransactions(result.data.stockTransactions || [])
        setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
      }
    } catch (error) {
      // Fallback a localStorage
      const localAssets = JSON.parse(localStorage.getItem('wm_assets_v4') || '[]')
      if (localAssets.length > 0) {
        setAssets(localAssets)
        setHistory(JSON.parse(localStorage.getItem('wm_history_v4') || '[]'))
        setBitcoinTransactions(sanitizeBitcoinTransactions(JSON.parse(localStorage.getItem('wm_bitcoinTransactions_v4') || '[]')))
        setStockTransactions(JSON.parse(localStorage.getItem('wm_stockTransactions_v4') || '[]'))
        setSyncState(prev => ({ ...prev, syncError: 'Usando datos locales' }))
      }
    }
  }, [])

  const saveDataToGAS = useCallback(async (
    assetsToSave: Asset[],
    historyToSave: HistoryEntry[],
    bitcoinTxsToSave: BitcoinTransaction[],
    stockTxsToSave: StockTransaction[]
  ) => {
    if (!assetsToSave || assetsToSave.length === 0) return

    setSyncState(prev => ({ ...prev, isSyncing: true }))

    try {
      console.log('📤 Sincronizando datos con GAS...')
      const response = await gasService.saveData(assetsToSave, historyToSave, bitcoinTxsToSave, stockTxsToSave)

      if (response) {
        console.log('✅ Datos enviados a GAS (sincronización completada)')
      } else {
        console.log('ℹ️ Sincronización con GAS omitida (URL no configurada)')
      }
      setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
    } catch (error) {
      console.error('❌ Error sincronizando con GAS:', error)
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
    bitcoinTxsToBackup: BitcoinTransaction[],
    stockTxsToBackup: StockTransaction[]
  ) => {
    exportService.exportJSON(assetsToBackup, historyToBackup, bitcoinTxsToBackup, stockTxsToBackup)
  }, [])

  const value: WealthContextType = {
    assets,
    history,
    bitcoinTransactions,
    stockTransactions,
    syncState,
    darkMode,
    metrics,
    setAssets,
    setHistory,
    setBitcoinTransactions,
    setStockTransactions,
    setDarkMode,
    loadDataFromGAS,
    saveDataToGAS,
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
