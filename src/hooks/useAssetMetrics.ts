import { useMemo } from 'react'
import { Asset, HistoryEntry, StockTransaction, BitcoinTransaction } from '../types'
import { calculateMeanCost, calculateTotalInvested, getCurrentParticipations } from '../utils'

interface PositionData {
  ticker: string
  nav: number
  shares: number
  avgPrice: number
}

interface AssetMetrics {
  currentValue: number
  invested: number
  participations: number
  meanCost: number
  liquidNavValue: number
  gain: number
  gainPercent: number
  positionsData: PositionData[]
  hasPositions: boolean
}

export function useAssetMetrics(
  asset: Asset,
  assets: Asset[],
  history: HistoryEntry[],
  stockTransactions: StockTransaction[],
  bitcoinTransactions: BitcoinTransaction[]
): AssetMetrics {
  
  return useMemo(() => {
    // 1. Calculate current NAV
    const getAssetNAV = (asset_id: string): number => {
      const assetHistory = history.filter(h => h.asset_id === asset_id)
      if (assetHistory.length === 0) return 0
      const sorted = [...assetHistory].sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
      return sorted[0].nav || 0
    }

    const getLatestMonth = (): string | null => {
      if (history.length === 0) return null
      const months = [...new Set(history.map(h => h.month))].sort().reverse()
      return months[0] || null
    }

    const getAssetNAVFromLatestMonth = (asset_id: string): number => {
      const latestMonth = getLatestMonth()
      if (!latestMonth) return 0
      const entryInLatestMonth = history.find(h => h.asset_id === asset_id && h.month === latestMonth)
      if (entryInLatestMonth) return entryInLatestMonth.nav || 0
      return getAssetNAV(asset_id)
    }

    const getAssetValueWithComponents = (a: Asset): number => {
      const componentAssets = assets.filter(comp =>
        comp.name && a.name && comp.name.length < a.name.length && a.name.includes(comp.name) && comp.id !== a.id
      )
      if (componentAssets.length > 0) {
        return componentAssets.reduce((sum, comp) => sum + getAssetNAVFromLatestMonth(comp.id), 0)
      }
      return getAssetNAVFromLatestMonth(a.id)
    }

    const currentValue = getAssetValueWithComponents(asset)

    // 2. Base metrics
    let participations = getCurrentParticipations(asset.id, history)
    let meanCost = calculateMeanCost(asset.id, history)
    let invested = calculateTotalInvested(asset.id, history)

    // 3. Crypto / Bitcoin Override
    if (asset.category === 'Crypto' || asset.name.toLowerCase().includes('bitcoin')) {
      let btcShares = 0
      let btcCost = 0
      bitcoinTransactions.forEach(tx => {
        if (tx.type === 'BUY') {
          btcShares += (tx.amountBtc || 0)
          btcCost += (tx.totalAmountEur || 0)
        } else {
          const avg = btcShares > 0 ? btcCost / btcShares : 0
          btcShares -= (tx.amountBtc || 0)
          btcCost -= ((tx.amountBtc || 0) * avg)
        }
      })
      participations = btcShares
      invested = btcCost
      meanCost = btcShares > 0 ? btcCost / btcShares : 0
    }

    const liquidNavValue = participations > 0 ? currentValue / participations : 0

    // 4. Positions Data for Parents (Brokers or Sub-assets)
    let positionsData: PositionData[] = []

    if (asset.name === 'Interactive Brokers') {
      const ibTransactions = stockTransactions
      const tickerMap = new Map<string, { shares: number; totalCost: number }>()

      for (const tx of ibTransactions) {
        const existing = tickerMap.get(tx.ticker) || { shares: 0, totalCost: 0 }
        if (tx.type === 'BUY') {
          existing.shares += tx.quantity
          existing.totalCost += tx.totalAmount
        } else {
          const avgPrice = existing.shares > 0 ? existing.totalCost / existing.shares : 0
          existing.shares -= tx.quantity
          existing.totalCost -= (tx.quantity * avgPrice)
        }
        tickerMap.set(tx.ticker, existing)
      }

      for (const [ticker, data] of tickerMap.entries()) {
        if (data.shares > 0) {
          const searchTicker = ticker.trim().toUpperCase()
          const tickerAsset = assets.find(a =>
            (a.ticker && a.ticker.trim().toUpperCase() === searchTicker) ||
            (a.name && a.name.trim().toUpperCase() === searchTicker)
          )

          let lastHistory = null
          if (tickerAsset) {
            lastHistory = history.filter(h => h.asset_id === tickerAsset.id).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
          }
          if (!lastHistory) {
            const fakeasset_id = `ticker-${searchTicker}`
            lastHistory = history.filter(h => h.asset_id === fakeasset_id).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
          }

          let currentPrice = data.totalCost / data.shares

          if (lastHistory) {
            if (lastHistory.liquidNavValue > 0) {
              currentPrice = lastHistory.liquidNavValue
            } else if (lastHistory.nav > 0 && lastHistory.participations > 0) {
              currentPrice = lastHistory.nav / lastHistory.participations
            } else if (lastHistory.nav > 0) {
              currentPrice = lastHistory.nav / data.shares
            }
          }

          const nav = data.shares * currentPrice
          const avgPrice = data.totalCost / data.shares

          positionsData.push({ ticker, nav, shares: data.shares, avgPrice })
        }
      }
    } else {
      // Para otros activos, buscar si contienen componentes
      const componentAssets = assets.filter(comp =>
        comp.name && asset.name && comp.name.length < asset.name.length && asset.name.includes(comp.name) && comp.id !== asset.id
      )
      positionsData = componentAssets.map(comp => ({
        ticker: comp.ticker || comp.isin || comp.name,
        nav: getAssetNAV(comp.id),
        shares: getCurrentParticipations(comp.id, history),
        avgPrice: calculateMeanCost(comp.id, history)
      }))
    }

    const hasPositions = positionsData.length > 0
    const gain = currentValue - invested
    const gainPercent = invested > 0 ? (gain / invested) * 100 : 0

    return {
      currentValue,
      invested,
      participations,
      meanCost,
      liquidNavValue,
      gain,
      gainPercent,
      positionsData,
      hasPositions
    }
  }, [asset, assets, history, stockTransactions, bitcoinTransactions])
}
