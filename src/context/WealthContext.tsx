import React, { createContext, useContext, useState, useRef, useEffect } from 'react'
import { Asset, HistoryEntry, BitcoinTransaction, StockTransaction, SyncState, Metrics } from '../types'
import { generateUUID } from '../utils'
import { SAMPLE_DATA } from './mockData'
import { config } from '../config'

// Data validation functions
const sanitizeBitcoinTransactions = (txs: any[]): BitcoinTransaction[] => {
  if (!Array.isArray(txs)) return []
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

// // @ts-ignore
export const sanitizeStockTransactions = (txs: any[]): StockTransaction[] => {
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
      ticker: tx.ticker || '',
      date: tx.date || new Date().toISOString().split('T')[0],
      type: txType,
      shares: parseFloat(tx.shares) || 0,
      pricePerShare: parseFloat(tx.pricePerShare) || 0,
      fees: parseFloat(tx.fees) || 0,
      totalAmount: parseFloat(tx.totalAmount) || 0,
      broker: tx.broker || undefined
    } as StockTransaction
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

  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // Cargar datos iniciales desde la Base de Datos
  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false

        const fetchFromDatabase = async () => {
            try {
                // Hacemos las llamadas a la API de FastAPI
                const [assetsRes, historyRes, txsRes, summaryRes] = await Promise.all([
                    fetch(`${config.backendUrl}/api/assets`),
                    fetch(`${config.backendUrl}/api/history`),
                    fetch(`${config.backendUrl}/api/transactions`),
                    fetch(`${config.backendUrl}/api/portfolio/summary`)
                ]);

                // ✅ 1. Comprobamos TODOS los endpoints críticos
                if (!assetsRes.ok || !historyRes.ok || !txsRes.ok) {
                    throw new Error("Fallo al conectar con la API principal");
                }

                const dbAssets = await assetsRes.json();
                const dbHistory = await historyRes.json();
                const dbTxs = await txsRes.json();
                const dbSummary = summaryRes.ok ? await summaryRes.json() : null;

                // Aplicamos los datos aunque la base de datos esté vacía
                setAssets(dbAssets);
                setHistory(dbHistory);

                // Separar transacciones unificadas en Crypto y Acciones
                const btcTxs: any[] = [];
                const stockTxs: any[] = [];

                if (Array.isArray(dbTxs)) {
                    dbTxs.forEach((tx: any) => {
                        // ✅ 2. Evitamos el crash de toLowerCase() si type es null
                        const txType = (tx.type || 'buy').toLowerCase(); 

                        // Identificamos las de Bitcoin
                        if (tx.assetId === 'a4' || tx.ticker === 'BTC') {
                            btcTxs.push({
                                id: tx.id,
                                date: tx.date,
                                type: txType,
                                amountBTC: tx.quantity,
                                meanPrice: tx.pricePerUnit,
                                totalCost: tx.totalAmount,
                                amount: tx.totalAmount
                            });
                        } else {
                            const brokerAsset = dbAssets.find((a: any) => a.id === tx.assetId);
                            stockTxs.push({
                                id: tx.id,
                                ticker: tx.ticker,
                                date: tx.date,
                                type: txType,
                                shares: tx.quantity,
                                pricePerShare: tx.pricePerUnit,
                                fees: tx.fees,
                                totalAmount: tx.totalAmount,
                                broker: brokerAsset ? brokerAsset.name : undefined
                            });
                        }
                    });
                }

                setBitcoinTransactions(sanitizeBitcoinTransactions(btcTxs));
                setStockTransactions(sanitizeStockTransactions(stockTxs));
                setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }));

                if (dbSummary) {
                    setMetrics({
                        totalNAV: dbSummary.total_value,
                        totalInv: dbSummary.total_invested,
                        totalProfit: dbSummary.absolute_roi,
                        roi: dbSummary.percentage_roi,
                        cash: dbSummary.cash_value
                    });
                }
                
                setIsDataLoaded(true); // ✅ Avisar que terminó de cargar ok
                return;
                
            } catch (error) {
                console.error("Error cargando de BD, usando fallback localStorage:", error);
                
                // Fallback a localStorage si el backend falla
                const localAssets = JSON.parse(localStorage.getItem('wm_assets_v4') || '[]')
                const localHistory = JSON.parse(localStorage.getItem('wm_history_v4') || '[]')
                const localBitcoin = JSON.parse(localStorage.getItem('wm_bitcoinTransactions_v4') || '[]')
                const localStocks = JSON.parse(localStorage.getItem('wm_stockTransactions_v4') || '[]')

                // (Misma función de cálculo que tenías...)
                const calculateFallbackMetrics = (assets: Asset[], history: HistoryEntry[], stockTxs: StockTransaction[]) => {
                    const activeAssets = assets.filter(a => !a.archived)
                    const cashAsset = activeAssets.find(a => a.name === 'Cash')
                    let cash = 0
                    if (cashAsset) {
                        const cashHistory = history.filter(h => h.assetId === cashAsset.id).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
                        cash = cashHistory.length > 0 ? cashHistory[0].nav || 0 : 0
                    }

                    let totalNAV = 0
                    let totalInvested = 0
                    let totalProfit = 0

                    activeAssets.forEach(asset => {
                        if (asset.name === 'Cash') return
                        const isIBActive = activeAssets.some(a => a.name === 'Interactive Brokers')
                        const isStockInIB = isIBActive && asset.ticker && stockTxs.some(tx => tx.broker === 'Interactive Brokers' && tx.ticker === asset.ticker)
                        const isComponent = activeAssets.some(parent => parent.name && asset.name && parent.name.length > asset.name.length && parent.name.includes(asset.name) && parent.id !== asset.id)

                        if (isStockInIB || isComponent) return

                        const assetHistory = history.filter(h => h.assetId === asset.id).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
                        if (assetHistory.length > 0) {
                            totalNAV += assetHistory[assetHistory.length - 1].nav
                            totalInvested += assetHistory.reduce((sum, h) => sum + (h.contribution || 0), 0)
                        }
                    })

                    totalProfit = totalNAV - totalInvested
                    const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

                    return { totalNAV, totalInv: totalInvested, totalProfit, roi, cash }
                }

                if (localAssets.length > 0) {
                    setAssets(localAssets)
                    setHistory(localHistory)
                    setBitcoinTransactions(sanitizeBitcoinTransactions(localBitcoin))
                    setStockTransactions(sanitizeStockTransactions(localStocks))
                    setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
                    setMetrics(calculateFallbackMetrics(localAssets, localHistory, sanitizeStockTransactions(localStocks)))
                } else {
                    setAssets(SAMPLE_DATA.assets)
                    setHistory(SAMPLE_DATA.history)
                    setBitcoinTransactions(SAMPLE_DATA.bitcoinTransactions)
                    setStockTransactions(SAMPLE_DATA.stockTransactions)
                    setSyncState(prev => ({ ...prev, syncError: 'Usando datos de muestra' }))
                    setMetrics({ totalNAV: 0, totalInv: 0, totalProfit: 0, roi: 0, cash: 0 })
                }
                
                setIsDataLoaded(true); // ✅ Avisar que terminó de cargar ok
            }
        };

        fetchFromDatabase();
    }
  }, [])

  // Calcular métricas de forma reactiva llamando al backend
  useEffect(() => {
    if (isFirstRender.current || assets.length === 0) return

    const calculateFallbackMetrics = (assetsList: Asset[], historyList: HistoryEntry[], stockTxs: StockTransaction[]) => {
      const activeAssets = assetsList.filter(a => !a.archived)
      const cashAsset = activeAssets.find(a => a.name === 'Cash')
      let cash = 0
      if (cashAsset) {
        const cashHistory = historyList.filter(h => h.assetId === cashAsset.id).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
        cash = cashHistory.length > 0 ? cashHistory[0].nav || 0 : 0
      }

      let totalNAV = 0
      let totalInvested = 0
      let totalProfit = 0

      activeAssets.forEach(asset => {
        if (asset.name === 'Cash') return
        const isIBActive = activeAssets.some(a => a.name === 'Interactive Brokers')
        const isStockInIB = isIBActive && asset.ticker && stockTxs.some(tx => tx.broker === 'Interactive Brokers' && tx.ticker === asset.ticker)
        const isComponent = activeAssets.some(parent => parent.name && asset.name && parent.name.length > asset.name.length && parent.name.includes(asset.name) && parent.id !== asset.id)

        if (isStockInIB || isComponent) return

        const assetHistory = historyList.filter(h => h.assetId === asset.id).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
        if (assetHistory.length > 0) {
            totalNAV += assetHistory[assetHistory.length - 1].nav
            totalInvested += assetHistory.reduce((sum, h) => sum + (h.contribution || 0), 0)
        }
      })

      totalProfit = totalNAV - totalInvested
      const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

      return { totalNAV, totalInv: totalInvested, totalProfit, roi, cash }
    }

    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${config.backendUrl}/api/portfolio/summary`)
        if (res.ok) {
          const dbSummary = await res.json()
          setMetrics({
            totalNAV: dbSummary.total_value,
            totalInv: dbSummary.total_invested,
            totalProfit: dbSummary.absolute_roi,
            roi: dbSummary.percentage_roi,
            cash: dbSummary.cash_value
          })
        } else {
          setMetrics(calculateFallbackMetrics(assets, history, stockTransactions))
        }
      } catch (e) {
        setMetrics(calculateFallbackMetrics(assets, history, stockTransactions))
      }
    }
    fetchMetrics()
  }, [assets, history, stockTransactions])

  // Guardar en localStorage
  useEffect(() => {
    // ✅ 3. Solo guardar cuando ya han cargado los datos iniciales
    if (!isDataLoaded) {
      return
    }

    localStorage.setItem('wm_assets_v4', JSON.stringify(assets))
    localStorage.setItem('wm_history_v4', JSON.stringify(history))
    localStorage.setItem('wm_bitcoinTransactions_v4', JSON.stringify(bitcoinTransactions))
    localStorage.setItem('wm_stockTransactions_v4', JSON.stringify(stockTransactions))

    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('wm_theme', darkMode ? 'dark' : 'light')
  }, [assets, history, bitcoinTransactions, stockTransactions, darkMode, isDataLoaded]) // <-- Añadir isDataLoaded a dependencias

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
    setDarkMode
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
