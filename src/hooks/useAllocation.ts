import { useMemo } from 'react'
import { AssetCategory, type Asset, type HistoryEntry } from '../types'

// ─── Category metadata ────────────────────────────────────────────────────────

export interface CategoryMeta {
  label: string      // Display label
  icon: string       // Emoji icon
  color: string      // Tailwind bg color class (for pills/badges)
  textColor: string  // Tailwind text color class
  barColor: string   // Hex for the allocation bar segment
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  [AssetCategory.FUND_ACTIVE]: {
    label: 'Gestión Activa',
    icon: '🎯',
    color: 'bg-blue-100 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-300',
    barColor: '#3b82f6',
  },
  [AssetCategory.FUND_INDEX]: {
    label: 'Indexados',
    icon: '📊',
    color: 'bg-violet-100 dark:bg-violet-900/40',
    textColor: 'text-violet-700 dark:text-violet-300',
    barColor: '#8b5cf6',
  },
  [AssetCategory.CRYPTO]: {
    label: 'Cripto',
    icon: '₿',
    color: 'bg-amber-100 dark:bg-amber-900/40',
    textColor: 'text-amber-700 dark:text-amber-300',
    barColor: '#f59e0b',
  },
  [AssetCategory.STOCK]: {
    label: 'Acciones',
    icon: '📈',
    color: 'bg-sky-100 dark:bg-sky-900/40',
    textColor: 'text-sky-700 dark:text-sky-300',
    barColor: '#0ea5e9',
  },
  [AssetCategory.PENSION]: {
    label: 'Pensión',
    icon: '🏦',
    color: 'bg-emerald-100 dark:bg-emerald-900/40',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    barColor: '#10b981',
  },
  [AssetCategory.CASH]: {
    label: 'Cash',
    icon: '💵',
    color: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-300',
    barColor: '#22c55e',
  },
}

// Fallback for unknown categories
export const DEFAULT_CATEGORY_META: CategoryMeta = {
  label: 'Otros',
  icon: '📁',
  color: 'bg-slate-100 dark:bg-slate-800',
  textColor: 'text-slate-600 dark:text-slate-400',
  barColor: '#94a3b8',
}

export function getCategoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? DEFAULT_CATEGORY_META
}

// ─── Allocation entry ─────────────────────────────────────────────────────────

export interface AllocationEntry {
  category: string
  meta: CategoryMeta
  totalNAV: number
  totalInvested: number
  totalProfit: number
  roi: number
  percentage: number          // % of total portfolio NAV
  assets: Asset[]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface RoiMetric {
  asset: Asset
  nav: number
  totalInvested: number
  totalProfit: number
  roi: number
}

/**
 * Groups assets by category and computes allocation metrics.
 * Excludes Cash from the portfolio totals (it has its own KPI card).
 */
export function useAllocationByCategory(
  assets: Asset[],
  _history: HistoryEntry[],
  roiMetrics: RoiMetric[],
): AllocationEntry[] {
  return useMemo(() => {
    const grouped: Record<string, { assets: Asset[]; nav: number; invested: number; profit: number }> = {}

    roiMetrics
      .filter(m => m.asset.name !== 'Cash' && !m.asset.isArchived && m.nav > 0)
      .forEach(({ asset, nav, totalInvested, totalProfit }) => {
        const cat = asset.category || 'OTHER'
        if (!grouped[cat]) grouped[cat] = { assets: [], nav: 0, invested: 0, profit: 0 }
        grouped[cat].assets.push(asset)
        grouped[cat].nav     += nav
        grouped[cat].invested += totalInvested
        grouped[cat].profit  += totalProfit
      })

    const portfolioNAV = Object.values(grouped).reduce((s, g) => s + g.nav, 0)

    return Object.entries(grouped)
      .map(([category, g]) => ({
        category,
        meta: getCategoryMeta(category),
        totalNAV:      g.nav,
        totalInvested: g.invested,
        totalProfit:   g.profit,
        roi: g.invested > 0 ? (g.profit / g.invested) * 100 : 0,
        percentage: portfolioNAV > 0 ? (g.nav / portfolioNAV) * 100 : 0,
        assets: g.assets,
      }))
      .sort((a, b) => b.totalNAV - a.totalNAV)  // biggest allocation first
  }, [roiMetrics, assets])
}
