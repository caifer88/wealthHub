import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatCurrency } from '../../utils'
import type { Asset } from '../../types'

interface RoiMetric {
  asset: Asset
  nav: number
  totalInvested: number
  totalProfit: number
  roi: number
}

type SortKey = 'name' | 'nav' | 'totalInvested' | 'totalProfit' | 'roi'
type SortDir = 'asc' | 'desc'

interface Props {
  roiMetrics: RoiMetric[]
}

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name',          label: 'Activo',    align: 'left'  },
  { key: 'nav',           label: 'NAV Actual', align: 'right' },
  { key: 'totalInvested', label: 'Invertido',  align: 'right' },
  { key: 'totalProfit',   label: 'Ganancia',   align: 'right' },
  { key: 'roi',           label: 'ROI %',      align: 'right' },
]

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={14} className="opacity-30" />
  return sortDir === 'asc'
    ? <ChevronUp  size={14} className="text-indigo-500" />
    : <ChevronDown size={14} className="text-indigo-500" />
}

export function RoiTable({ roiMetrics }: Props) {
  // Default: ROI descending — users care most about "who is winning"
  const [sortKey, setSortKey] = useState<SortKey>('roi')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      // Text column → asc by default; numeric columns → desc by default
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    const rows = roiMetrics.filter(m => m.asset.name !== 'Cash')
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.asset.name.localeCompare(b.asset.name, 'es')
      } else {
        cmp = a[sortKey] - b[sortKey]
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [roiMetrics, sortKey, sortDir])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            {COLUMNS.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`
                  py-3 px-4 font-bold text-slate-600 dark:text-slate-400
                  ${col.align === 'right' ? 'text-right' : 'text-left'}
                  select-none cursor-pointer
                  hover:text-slate-900 dark:hover:text-white
                  hover:bg-slate-50 dark:hover:bg-slate-800/60
                  transition-colors group
                `}
              >
                <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                  {col.label}
                  <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map(metric => {
            const archived = metric.asset.isArchived
            return (
              <tr
                key={metric.asset.id}
                className={`
                  border-b border-slate-100 dark:border-slate-800
                  hover:bg-slate-50 dark:hover:bg-slate-900
                  transition-colors
                  ${archived ? 'opacity-60 bg-slate-50 dark:bg-slate-900' : ''}
                `}
              >
                {/* Activo */}
                <td className={`py-3 px-4 font-semibold ${archived ? 'text-slate-500 dark:text-slate-500' : 'dark:text-white'}`}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: metric.asset.color }}
                    />
                    {metric.asset.name}
                    {archived && (
                      <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                        Archivado
                      </span>
                    )}
                  </div>
                </td>

                {/* NAV */}
                <td className={`py-3 px-4 text-right font-bold tabular-nums ${archived ? 'text-slate-500 dark:text-slate-500' : 'dark:text-white'}`}>
                  {formatCurrency(Math.round(metric.nav))}
                </td>

                {/* Invertido */}
                <td className={`py-3 px-4 text-right font-bold tabular-nums ${archived ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>
                  {formatCurrency(Math.round(metric.totalInvested))}
                </td>

                {/* Ganancia */}
                <td className={`py-3 px-4 text-right font-bold tabular-nums
                  ${metric.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                  ${archived ? 'opacity-60' : ''}
                `}>
                  {formatCurrency(metric.totalProfit)}
                </td>

                {/* ROI */}
                <td className={`py-3 px-4 text-right font-bold tabular-nums ${archived ? 'text-slate-500 dark:text-slate-500' : 'text-indigo-600'}`}>
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {/* Mini trend bar */}
                    <span
                      className={`inline-block h-1.5 rounded-full ${metric.roi >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(Math.abs(metric.roi) * 1.2, 48)}px` }}
                      title={`ROI: ${metric.roi.toFixed(2)}%`}
                    />
                    {metric.roi.toFixed(2)}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* Footer: totals */}
        {sorted.length > 1 && (() => {
          const totals = sorted.reduce(
            (acc, m) => ({
              nav:           acc.nav           + m.nav,
              totalInvested: acc.totalInvested + m.totalInvested,
              totalProfit:   acc.totalProfit   + m.totalProfit,
            }),
            { nav: 0, totalInvested: 0, totalProfit: 0 }
          )
          const totalRoi = totals.totalInvested > 0
            ? (totals.totalProfit / totals.totalInvested) * 100
            : 0

          return (
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <td className="py-3 px-4 font-black text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                  Total
                </td>
                <td className="py-3 px-4 text-right font-black tabular-nums dark:text-white">
                  {formatCurrency(Math.round(totals.nav))}
                </td>
                <td className="py-3 px-4 text-right font-black tabular-nums text-slate-600 dark:text-slate-400">
                  {formatCurrency(Math.round(totals.totalInvested))}
                </td>
                <td className={`py-3 px-4 text-right font-black tabular-nums ${totals.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(totals.totalProfit)}
                </td>
                <td className="py-3 px-4 text-right font-black tabular-nums text-indigo-600">
                  {totalRoi.toFixed(2)}%
                </td>
              </tr>
            </tfoot>
          )
        })()}
      </table>
    </div>
  )
}
