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

  // Cargar datos iniciales desde la Base de Datos
  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false

        const fetchFromDatabase = async () => {
            try {
                // Hacemos las llamadas a la API de FastAPI
                const [assetsRes, historyRes, txsRes] = await Promise.all([
                    fetch(`${config.backendUrl}/api/assets`),
                    fetch(`${config.backendUrl}/api/history`),
                    fetch(`${config.backendUrl}/api/transactions`)
                ]);

                if (!assetsRes.ok) throw new Error("Fallo al conectar con la API");

                const dbAssets = await assetsRes.json();
                const dbHistory = await historyRes.json();
                const dbTxs = await txsRes.json();

                if (dbAssets.length > 0) {
                    setAssets(dbAssets);
                    setHistory(dbHistory);

                    // Separar transacciones unificadas en Crypto y Acciones
                    const btcTxs: any[] = [];
                    const stockTxs: any[] = [];

                    dbTxs.forEach((tx: any) => {
                        // Identificamos las de Bitcoin (por ticker o assetId 'a4')
                        if (tx.assetId === 'a4' || tx.ticker === 'BTC') {
                            btcTxs.push({
                                id: tx.id,
                                date: tx.date,
                                type: tx.type.toLowerCase(),
                                amountBTC: tx.quantity,
                                meanPrice: tx.pricePerUnit,
                                totalCost: tx.totalAmount,
                                amount: tx.totalAmount
                            });
                        } else {
                            // Encontrar el nombre del broker original
                            const brokerAsset = dbAssets.find((a: any) => a.id === tx.assetId);
                            stockTxs.push({
                                id: tx.id,
                                ticker: tx.ticker,
                                date: tx.date,
                                type: tx.type.toLowerCase(),
                                shares: tx.quantity,
                                pricePerShare: tx.pricePerUnit,
                                fees: tx.fees,
                                totalAmount: tx.totalAmount,
                                broker: brokerAsset ? brokerAsset.name : undefined
                            });
                        }
                    });

                    setBitcoinTransactions(sanitizeBitcoinTransactions(btcTxs));
                    setStockTransactions(sanitizeStockTransactions(stockTxs));
                    setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }));
                    return;
                }
            } catch (error) {
                console.error("Error cargando de BD, usando fallback localStorage:", error);
                
                // Fallback a localStorage si el backend está apagado
                const localAssets = JSON.parse(localStorage.getItem('wm_assets_v4') || '[]')
                const localHistory = JSON.parse(localStorage.getItem('wm_history_v4') || '[]')
                const localBitcoin = JSON.parse(localStorage.getItem('wm_bitcoinTransactions_v4') || '[]')
                const localStocks = JSON.parse(localStorage.getItem('wm_stockTransactions_v4') || '[]')

                if (localAssets.length > 0) {
                    setAssets(localAssets)
                    setHistory(localHistory)
                    setBitcoinTransactions(sanitizeBitcoinTransactions(localBitcoin))
                    setStockTransactions(sanitizeStockTransactions(localStocks))
                    setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }))
                    return
                }

                // Si no hay datos, usar datos de muestra
                setAssets(SAMPLE_DATA.assets)
                setHistory(SAMPLE_DATA.history)
                setBitcoinTransactions(SAMPLE_DATA.bitcoinTransactions)
                setStockTransactions(SAMPLE_DATA.stockTransactions)
                setSyncState(prev => ({ ...prev, syncError: 'Usando datos de muestra' }))
            }
        };

        fetchFromDatabase();
    }
  }, [])

  // Guardar en localStorage
  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    localStorage.setItem('wm_assets_v4', JSON.stringify(assets))
    localStorage.setItem('wm_history_v4', JSON.stringify(history))
    localStorage.setItem('wm_bitcoinTransactions_v4', JSON.stringify(bitcoinTransactions))
    localStorage.setItem('wm_stockTransactions_v4', JSON.stringify(stockTransactions))

    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('wm_theme', darkMode ? 'dark' : 'light')
  }, [assets, history, bitcoinTransactions, stockTransactions, darkMode])

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

      // EVITAR DOBLE CONTABILIDAD: Excluir acciones si ya tenemos el contenedor 'Interactive Brokers'
      const isIBActive = activeAssets.some(a => a.name === 'Interactive Brokers')
      const isStockInIB = isIBActive && asset.ticker && stockTransactions.some(tx => tx.broker === 'Interactive Brokers' && tx.ticker === asset.ticker)
      
      // Excluir activos que son sub-componentes de otros (ej: Basalto dentro de Fondo Basalto)
      const isComponent = activeAssets.some(parent => 
        parent.name && asset.name && parent.name.length > asset.name.length && parent.name.includes(asset.name) && parent.id !== asset.id
      )

      if (isStockInIB || isComponent) {
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
