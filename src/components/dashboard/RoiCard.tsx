import { useState } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { Asset } from '../../types'

type RoiDataPoint = Record<string, string | number>

interface Props {
  roiData: RoiDataPoint[]
  allAssetsForHistory: Asset[]
  darkMode: boolean
}

export function RoiCard({ roiData, allAssetsForHistory, darkMode }: Props) {
  const [visibleAssets, setVisibleAssets] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { totalROI: true }
    allAssetsForHistory.forEach(a => { initial[a.id] = true })
    return initial
  })

  const toggleAsset = (id: string) =>
    setVisibleAssets(prev => ({ ...prev, [id]: !prev[id] }))

  const activeClass   = 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
  const inactiveClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  const baseClass     = 'px-3 py-1 rounded-lg text-sm font-semibold transition-colors'

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {allAssetsForHistory.map(asset => (
          <button
            key={asset.id}
            onClick={() => toggleAsset(asset.id)}
            className={`${baseClass} ${visibleAssets[asset.id] ? activeClass : inactiveClass} ${asset.isArchived ? 'opacity-60' : ''}`}
          >
            {asset.name} {asset.isArchived ? '📦' : ''}
          </button>
        ))}
      </div>

      {/* Gráfico */}
      {roiData.length > 0 && (
        <div className="h-[300px] -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={roiData}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="month" stroke={darkMode ? '#94a3b8' : '#64748b'} tick={{ fontSize: 12 }} />
              <YAxis
                stroke={darkMode ? '#94a3b8' : '#64748b'}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                  border: `1px solid ${darkMode ? '#475569' : '#e2e8f0'}`,
                  borderRadius: '12px'
                }}
                formatter={(v) => [`${Number(v).toFixed(2)}%`, '']}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />

              <Line
                type="monotone" dataKey="totalROI" stroke="#6366f1" strokeWidth={3}
                dot={false} activeDot={{ r: 6, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
                name="Total ROI" connectNulls
              />

              {allAssetsForHistory
                .filter(a => visibleAssets[a.id])
                .map(asset => (
                  <Line
                    key={asset.id}
                    type="monotone"
                    dataKey={`ROI_${asset.name}`}
                    stroke={asset.color}
                    strokeWidth={asset.isArchived ? 1.5 : 2}
                    strokeOpacity={asset.isArchived ? 0.4 : 0.7}
                    strokeDasharray={asset.isArchived ? '5 5' : 'none'}
                    dot={false}
                    activeDot={{ r: 6, fill: asset.color, strokeWidth: 2, stroke: 'white' }}
                    name={`ROI ${asset.name}${asset.isArchived ? ' (archivado)' : ''}`}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
