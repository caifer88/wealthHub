import { useMemo } from 'react'
import { Asset, HistoryEntry } from '../types'
export { useStockPortfolio } from './useStockPortfolio'
export { useBitcoinTransactions } from './useBitcoinTransactions'
export { useStockTransactions } from './useStockTransactions'

const EXCLUDED_ASSETS = ['Cash']

const groupHistoryByMonth = (history: HistoryEntry[]): Record<string, HistoryEntry[]> => {
  return history.reduce((grouped, entry) => {
    if (!grouped[entry.month]) grouped[entry.month] = []
    grouped[entry.month].push(entry)
    return grouped
  }, {} as Record<string, HistoryEntry[]>)
}

const getActiveAssets = (assets: Asset[]): Asset[] => {
  return assets.filter(a => !EXCLUDED_ASSETS.includes(a.name))
}

export const useROIMetrics = (assets: Asset[], history: HistoryEntry[]) => {
  return useMemo(() => {
    const activeAssets = getActiveAssets(assets)
    return activeAssets.map(asset => {
      const assetHistory = history
        .filter(h => h.asset_id === asset.id)
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      
      if (assetHistory.length === 0) {
        return { asset, nav: 0, totalInvested: 0, totalProfit: 0, roi: 0, percentage: 0 }
      }

      const latestEntry = assetHistory[assetHistory.length - 1]
      // Sumamos el historial completo de aportaciones
      const totalInvested = assetHistory.reduce((sum, h) => sum + (h.contribution || 0), 0)
      const totalProfit = latestEntry.nav - totalInvested
      const roi = totalInvested > 0 ? ((totalProfit) / totalInvested) * 100 : 0

      return { asset, nav: latestEntry.nav, totalInvested, totalProfit, roi, percentage: 0 }
    })
  }, [assets, history])
}

export const useCumulativeReturn = (history: HistoryEntry[], assets: Asset[]) => {
  return useMemo(() => {
    const grouped = groupHistoryByMonth(history)
    const activeAssets = getActiveAssets(assets)
    const sortedMonths = Object.keys(grouped).sort()

    return sortedMonths.map(month => {
      const entries = grouped[month]
      const monthData: Record<string, number | string> = { month }
      let totalNav = 0
      let totalInvested = 0

      activeAssets.forEach(asset => {
        const entry = entries.find(e => e.asset_id === asset.id)
        if (entry) {
          const allEntries = history.filter(h => h.asset_id === asset.id && h.month <= month)
          const navValue = entry.nav
          // Sumamos lo aportado hasta este mes específico
          const invested = allEntries.reduce((sum, h) => sum + (h.contribution || 0), 0)
          const roi = invested > 0 ? ((navValue - invested) / invested) * 100 : 0

          monthData[`ROI_${asset.name}`] = roi
          totalNav += navValue
          totalInvested += invested
        }
      })

      monthData.totalROI = totalInvested > 0 ? ((totalNav - totalInvested) / totalInvested) * 100 : 0
      return monthData
    })
  }, [history, assets])
}

export const useEvolutionData = (history: HistoryEntry[], assets: Asset[]) => {
  return useMemo(() => {
    const grouped = groupHistoryByMonth(history)
    const activeAssets = getActiveAssets(assets)
    const sortedMonths = Object.keys(grouped).sort()

    return sortedMonths.map(month => {
      const entries = grouped[month]
      const monthData: Record<string, number | string> = { month }
      let totalNav = 0
      let monthCumulativeInvested = 0

      activeAssets.forEach(asset => {
        const allEntriesUpToMonth = history.filter(h => h.asset_id === asset.id && h.month <= month)
        monthCumulativeInvested += allEntriesUpToMonth.reduce((sum, h) => sum + (h.contribution || 0), 0)
      })

      activeAssets.forEach(asset => {
        const entry = entries.find(e => e.asset_id === asset.id)
        if (entry) {
          monthData[asset.name] = entry.nav
          totalNav += entry.nav
        }
      })

      monthData.total = totalNav
      monthData.invested = monthCumulativeInvested

      return monthData
    })
  }, [history, assets])
}