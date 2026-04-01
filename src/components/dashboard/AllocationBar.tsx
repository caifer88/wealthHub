import { formatCurrency } from '../../utils'
import type { AllocationEntry } from '../../hooks/useAllocation'

interface Props {
  allocations: AllocationEntry[]
}

export function AllocationBar({ allocations }: Props) {
  if (allocations.length === 0) return null

  const totalNAV = allocations.reduce((s, a) => s + a.totalNAV, 0)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
        Asset Allocation
      </p>

      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {allocations.map(a => (
          <div
            key={a.category}
            style={{ width: `${a.percentage}%`, backgroundColor: a.meta.barColor }}
            title={`${a.meta.icon} ${a.meta.label}: ${a.percentage.toFixed(1)}%`}
            className="transition-all duration-500 first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {allocations.map(a => (
          <div key={a.category} className="flex items-center gap-2 min-w-0">
            {/* Color dot */}
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: a.meta.barColor }}
            />

            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                {a.meta.icon} {a.meta.label}
              </p>
              <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {formatCurrency(Math.round(a.totalNAV))}
                <span className="ml-1.5 font-bold text-slate-600 dark:text-slate-300">
                  {a.percentage.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">Total cartera (excl. Cash)</p>
        <p className="text-sm font-black tabular-nums dark:text-white">
          {formatCurrency(Math.round(totalNAV))}
        </p>
      </div>
    </div>
  )
}
