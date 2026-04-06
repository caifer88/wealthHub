import React, { createContext, useContext, useState, useRef, useEffect } from 'react'
import { Asset, HistoryEntry, BitcoinTransaction, StockTransaction, SyncState, Metrics } from '../types'
import { generateUUID } from '../utils'
import { SAMPLE_DATA } from './mockData'
import { config } from '../config'

// Data validation functions
const sanitizeBitcoinTransactions = (txs: any[]): BitcoinTransaction[] => {
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
      exchangeRateUsdEur: parseFloat(tx.exchangeRateUsdEur) || 1.08
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
      exchangeRateEurUsd: parseFloat(tx.exchangeRateEurUsd || tx.exchangeRate || tx.exchange_rate) || 1.08
    } as StockTransaction
  })
}

interface WealthContextType {
  assets: Asset[]
  history: HistoryEntry[]
  bitcoinTransactions: BitcoinTransaction[]
  stockTransactions: StockTransaction[]
  syncState: SyncState
  darkMode: boolean
  metrics: Metrics | null
  eurUsdRate: number
  setAssets: (assets: Asset[]) => void
  setHistory: (history: HistoryEntry[]) => void
  setBitcoinTransactions: (txs: BitcoinTransaction[]) => void
  setStockTransactions: (txs: StockTransaction[]) => void
  setDarkMode: (mode: boolean) => void
  refetchData: () => Promise<void>
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
  const [eurUsdRate, setEurUsdRate] = useState<number>(1.08) // default fallback
  
  // Referencias para controlar cargas
  const isFirstRender = useRef(true)
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  const fetchFromDatabase = async () => {
      try {
          // 1. Añadimos las dos nuevas rutas de transacciones en lugar de la genérica
          const [assetsRes, historyRes, btcTxsRes, stockTxsRes, summaryRes, exchangeRateRes] = await Promise.all([
              fetch(`${config.backendUrl}/api/assets`),
              fetch(`${config.backendUrl}/api/history`),
              fetch(`${config.backendUrl}/api/bitcoin/transactions`), // ✅ Nueva ruta BTC
              fetch(`${config.backendUrl}/api/stocks/transactions`),   // ✅ Nueva ruta Stocks
              fetch(`${config.backendUrl}/api/portfolio/summary`),
              fetch(`${config.backendUrl}/api/portfolio/exchange-rate`)
          ]);

          // 2. Comprobamos que no falle ninguna de las peticiones principales
          if (!assetsRes.ok || !historyRes.ok || !btcTxsRes.ok || !stockTxsRes.ok) {
              throw new Error("Fallo al conectar con la API");
          }

          const dbAssets = await assetsRes.json();
          const dbHistory = await historyRes.json();
          const dbBtcTxs = await btcTxsRes.json();     // JSON de Bitcoin
          const dbStockTxs = await stockTxsRes.json(); // JSON de Stocks
          const dbSummary = summaryRes.ok ? await summaryRes.json() : null;

          setAssets(dbAssets || []);
          setHistory(dbHistory || []);

          // 3. Como el backend ya nos devuelve las transacciones separadas, 
          // Pasamos los datos directamente a tus funciones sanitizadoras:
          setBitcoinTransactions(sanitizeBitcoinTransactions(dbBtcTxs || []));
          setStockTransactions(sanitizeStockTransactions(dbStockTxs || []));
          
          setSyncState(prev => ({ ...prev, lastSync: new Date(), syncError: null }));

          if (dbSummary) {
              setMetrics({
                  totalNAV: dbSummary.totalValue || 0,
                  totalInv: dbSummary.totalInvested || 0,
                  totalProfit: dbSummary.absoluteRoi || 0,
                  roi: dbSummary.percentageRoi || 0,
                  cash: dbSummary.cashValue || 0
              });
          }

                // Load exchange rate
                if (exchangeRateRes.ok) {
                    const rateData = await exchangeRateRes.json();
                    if (rateData && rateData.rate > 0) {
                        setEurUsdRate(rateData.rate);
                    }
                }

                setIsDataLoaded(true); // ✅ Avisamos que cargó correctamente
                
            } catch (error) {
                console.error("Error cargando de BD, usando fallback localStorage:", error);
                
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
                } else {
                    setAssets(SAMPLE_DATA.assets)
                    setHistory(SAMPLE_DATA.history)
                    setBitcoinTransactions(SAMPLE_DATA.bitcoinTransactions)
                    setStockTransactions(SAMPLE_DATA.stockTransactions)
                    setSyncState(prev => ({ ...prev, syncError: 'Usando datos de muestra' }))
                }
                
                setIsDataLoaded(true); // ✅ Avisamos que cargó (vía fallback)
            }
        };

  // Cargar datos iniciales desde la Base de Datos
  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false
        fetchFromDatabase();
    }
  }, [])

  // Guardar en localStorage
  useEffect(() => {
    // ✅ CORRECCIÓN 3: Evitar borrar el localStorage en el primer render
    if (!isDataLoaded) {
      return
    }

    localStorage.setItem('wm_assets_v4', JSON.stringify(assets))
    localStorage.setItem('wm_history_v4', JSON.stringify(history))
    localStorage.setItem('wm_bitcoinTransactions_v4', JSON.stringify(bitcoinTransactions))
    localStorage.setItem('wm_stockTransactions_v4', JSON.stringify(stockTransactions))

    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('wm_theme', darkMode ? 'dark' : 'light')
  }, [assets, history, bitcoinTransactions, stockTransactions, darkMode, isDataLoaded])

  const value: WealthContextType = {
    assets,
    history,
    bitcoinTransactions,
    stockTransactions,
    syncState,
    darkMode,
    metrics,
    eurUsdRate,
    setAssets,
    setHistory,
    setBitcoinTransactions,
    setStockTransactions,
    setDarkMode,
    refetchData: fetchFromDatabase
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