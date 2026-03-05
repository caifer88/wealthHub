import { useMemo } from 'react'
import { Asset, HistoryEntry } from '../types'

// Constants
const EXCLUDED_ASSETS = ['Cash']

// Helper functions
const groupHistoryByMonth = (history: HistoryEntry[]): Record<string, HistoryEntry[]> => {
  return history.reduce((grouped, entry) => {
    if (!grouped[entry.month]) {
      grouped[entry.month] = []
    }
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
      const assetHistory = history.filter(h => h.assetId === asset.id)
      
      if (assetHistory.length === 0) {
        return {
          asset,
          nav: 0,
          totalInvested: 0,
          totalProfit: 0,
          roi: 0,
          percentage: 0
        }
      }

      const latestEntry = assetHistory[assetHistory.length - 1]
      const totalInvested = assetHistory.reduce((sum, h) => sum + (h.contribution || 0), 0)
      const totalProfit = latestEntry.nav - totalInvested
      const roi = totalInvested > 0 ? ((totalProfit) / totalInvested) * 100 : 0

      return {
        asset,
        nav: latestEntry.nav,
        totalInvested,
        totalProfit,
        roi,
        percentage: 0
      }
    })
  }, [assets, history])
}

export const useCumulativeReturn = (history: HistoryEntry[], assets: Asset[]) => {
  return useMemo(() => {
    const grouped = groupHistoryByMonth(history)
    const activeAssets = getActiveAssets(assets)

    return Object.entries(grouped).map(([month, entries]) => {
      const monthData: Record<string, number | string> = { month }
      let totalROI = 0
      let totalNav = 0
      let totalInvested = 0

      activeAssets.forEach(asset => {
        const entry = entries.find(e => e.assetId === asset.id)
        if (entry) {
          const allEntries = history.filter(h => h.assetId === asset.id && h.month <= month)
          const navValue = entry.nav
          const invested = allEntries.reduce((sum, h) => sum + (h.contribution || 0), 0)
          const roi = invested > 0 ? ((navValue - invested) / invested) * 100 : 0

          monthData[`ROI_${asset.name}`] = roi
          totalNav += navValue
          totalInvested += invested
        }
      })

      totalROI = totalInvested > 0 ? ((totalNav - totalInvested) / totalInvested) * 100 : 0
      monthData.totalROI = totalROI

      return monthData
    })
  }, [history, assets])
}

export const useEvolutionData = (history: HistoryEntry[], assets: Asset[]) => {
  return useMemo(() => {
    const grouped = groupHistoryByMonth(history)
    const activeAssets = getActiveAssets(assets)
    const sortedMonths = Object.keys(grouped).sort()
    const cumulativeInvested: Record<string, number> = {}

    return sortedMonths.map(month => {
      const entries = grouped[month]
      const monthData: Record<string, number | string> = { month }
      let totalNav = 0

      // Calculate cumulative investment up to this month
      let monthCumulativeInvested = 0
      activeAssets.forEach(asset => {
        const allEntriesUpToMonth = history.filter(h => h.assetId === asset.id && h.month <= month)
        const assetCumulativeInvested = allEntriesUpToMonth.reduce((sum, h) => sum + (h.contribution || 0), 0)
        cumulativeInvested[`${asset.id}_${month}`] = assetCumulativeInvested
        monthCumulativeInvested += assetCumulativeInvested
      })

      activeAssets.forEach(asset => {
        const entry = entries.find(e => e.assetId === asset.id)
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
