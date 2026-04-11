import { useMemo } from 'react'
import { useAssets, useHistory, useBitcoinTransactions, useStockTransactions, useMetrics, useExchangeRate, useRefetchAll } from '../context/WealthContext'

/**
 * Hook consolidado para obtener todos los datos de la aplicación
 * Reemplaza el antiguo "useWealth" para acceso a datos
 * Retorna datos + estados de loading/error
 */
export const useWealthData = () => {
  const assetsQuery = useAssets()
  const historyQuery = useHistory()
  const bitcoinTxQuery = useBitcoinTransactions()
  const stockTxQuery = useStockTransactions()
  const metricsQuery = useMetrics()
  const exchangeRateQuery = useExchangeRate()
  const refetchAll = useRefetchAll()

  const isLoading = useMemo(() => 
    assetsQuery.isLoading || 
    historyQuery.isLoading || 
    bitcoinTxQuery.isLoading || 
    stockTxQuery.isLoading ||
    metricsQuery.isLoading,
    [assetsQuery.isLoading, historyQuery.isLoading, bitcoinTxQuery.isLoading, stockTxQuery.isLoading, metricsQuery.isLoading]
  )

  const isFetching = useMemo(() => 
    assetsQuery.isFetching || 
    historyQuery.isFetching || 
    bitcoinTxQuery.isFetching || 
    stockTxQuery.isFetching ||
    metricsQuery.isFetching,
    [assetsQuery.isFetching, historyQuery.isFetching, bitcoinTxQuery.isFetching, stockTxQuery.isFetching, metricsQuery.isFetching]
  )

  const error = useMemo(() => 
    assetsQuery.error || 
    historyQuery.error || 
    bitcoinTxQuery.error || 
    stockTxQuery.error ||
    metricsQuery.error,
    [assetsQuery.error, historyQuery.error, bitcoinTxQuery.error, stockTxQuery.error, metricsQuery.error]
  )

  return {
    assets: assetsQuery.data || [],
    history: historyQuery.data || [],
    bitcoinTransactions: bitcoinTxQuery.data || [],
    stockTransactions: stockTxQuery.data || [],
    metrics: metricsQuery.data || null,
    eurUsdRate: exchangeRateQuery.data || 1.15,
    isLoading,
    isFetching,
    error,
    refetchData: refetchAll,
  }
}
