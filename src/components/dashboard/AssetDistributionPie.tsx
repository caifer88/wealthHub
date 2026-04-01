import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '../ui/Card'
import { formatCurrency } from '../../utils'
import { getCategoryMeta } from '../../hooks/useAllocation'
import type { Asset } from '../../types'

interface DistributionEntry {
  name: string
  value: number
  color: string
}

interface Props {
  activeAssets: Asset[]
  getDistributionData: (filter: string[]) => DistributionEntry[]
}

export function AssetDistributionPie({ activeAssets, getDistributionData }: Props) {
  const [distributionFilter, setDistributionFilter] = useState<string[]>([])

  const distributionData = getDistributionData(distributionFilter)

  const toggleFilter = (id: string) =>
    setDistributionFilter(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const activeClass   = 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
  const inactiveClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  const baseClass     = 'px-4 py-2 rounded-2xl font-semibold transition-colors text-sm'

  return (
    <Card title="Distribución del Patrimonio" className="overflow-hidden">
      <div className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDistributionFilter([])}
            className={`${baseClass} ${distributionFilter.length === 0 ? activeClass : inactiveClass}`}
          >
            🔄 Todos
          </button>

          {activeAssets.map(asset => {
            const meta = getCategoryMeta(asset.category)
            return (
              <button
                key={asset.id}
                onClick={() => toggleFilter(asset.id)}
                style={{ borderLeft: `4px solid ${asset.color}` }}
                className={`${baseClass} ${distributionFilter.includes(asset.id) ? activeClass : inactiveClass}`}
              >
                {meta.icon} {asset.name}
              </button>
            )
          })}
        </div>

        {/* Gráfico */}
        {distributionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            Sin datos de distribución
          </p>
        )}
      </div>
    </Card>
  )
}
