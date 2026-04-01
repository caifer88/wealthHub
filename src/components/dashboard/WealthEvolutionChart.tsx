import { useState, useRef, useEffect } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { ChevronDown } from 'lucide-react'
import { Card } from '../ui/Card'
import { formatCurrency } from '../../utils'
import { type Asset } from '../../types'
import { getCategoryMeta } from '../../hooks/useAllocation'

type EvolutionDataPoint = Record<string, string | number>

interface Props {
  evolutionData: EvolutionDataPoint[]
  activeAssets: Asset[]
  darkMode: boolean
}

// ─── Hook: close dropdown on outside click ───────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WealthEvolutionChart({ evolutionData, activeAssets, darkMode }: Props) {
  const [showTotal, setShowTotal]         = useState(true)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [dropdownOpen, setDropdownOpen]   = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useClickOutside(dropdownRef, () => setDropdownOpen(false))

  const toggleAsset = (id: string) =>
    setSelectedAssets(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const selectAll = () => setSelectedAssets(activeAssets.map(a => a.id))
  const clearAll  = () => setSelectedAssets([])

  // Group assets by category
  const groups = activeAssets.reduce<Record<string, Asset[]>>((acc, asset) => {
    const cat = asset.category ?? 'OTHER'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(asset)
    return acc
  }, {})

  // Dropdown label
  const selectionLabel = selectedAssets.length === 0
    ? 'Seleccionar activos…'
    : selectedAssets.length === activeAssets.length
      ? 'Todos los activos'
      : `${selectedAssets.length} activo${selectedAssets.length > 1 ? 's' : ''}`

  // Shared button styles
  const activeClass   = 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
  const inactiveClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  const baseClass     = 'px-4 py-2 rounded-2xl font-semibold transition-colors text-sm'

  return (
    <Card title="Evolución de Patrimonio" className="overflow-hidden">
      <div className="space-y-6">

        {/* ── Filtros ── */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Total toggle */}
          <button
            onClick={() => setShowTotal(v => !v)}
            className={`${baseClass} ${showTotal ? activeClass : inactiveClass}`}
          >
            📊 Total
          </button>

          {/* ── Multi-select dropdown ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className={`${baseClass} flex items-center gap-2 ${
                selectedAssets.length > 0 ? activeClass : inactiveClass
              }`}
            >
              {selectionLabel}
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">

                {/* Actions bar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                  <button
                    onClick={selectAll}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Todos
                  </button>
                  <span className="text-xs text-slate-400">{selectedAssets.length}/{activeAssets.length}</span>
                  <button
                    onClick={clearAll}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline"
                  >
                    Ninguno
                  </button>
                </div>

                {/* Groups */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(groups).map(([cat, assets]) => (
                    <div key={cat}>
                      {/* Category header */}
                      <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {(() => { const m = getCategoryMeta(cat); return `${m.icon} ${m.label}` })()}
                      </p>

                      {/* Asset rows */}
                      {assets.map(asset => {
                        const checked = selectedAssets.includes(asset.id)
                        return (
                          <label
                            key={asset.id}
                            className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            {/* Color swatch */}
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: asset.color }}
                            />

                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAsset(asset.id)}
                              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                            />

                            {/* Name */}
                            <span className={`text-sm font-medium flex-1 ${
                              checked
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              {asset.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Gráfico ── */}
        {evolutionData.length > 0 && (
          <div className="h-[400px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData} margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="month" stroke={darkMode ? '#94a3b8' : '#64748b'} tick={{ fontSize: 12 }} />
                <YAxis
                  stroke={darkMode ? '#94a3b8' : '#64748b'}
                  tick={{ fontSize: 12 }}
                  label={{ value: '€', angle: -90, position: 'insideLeft', offset: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                    border: `1px solid ${darkMode ? '#475569' : '#e2e8f0'}`,
                    borderRadius: '12px'
                  }}
                  formatter={(v) => [formatCurrency(Number(v)), '']}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />

                {showTotal && (
                  <>
                    <Line
                      type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3}
                      dot={false} activeDot={{ r: 6, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
                      name="Total" connectNulls
                    />
                    <Line
                      type="monotone" dataKey="invested" stroke="#94a3b8"
                      strokeDasharray="5 5" strokeWidth={2}
                      dot={false} activeDot={{ r: 6, fill: '#94a3b8', stroke: 'white', strokeWidth: 2 }}
                      name="Total Invertido" connectNulls
                    />
                  </>
                )}

                {selectedAssets.length > 0 &&
                  activeAssets
                    .filter(a => selectedAssets.includes(a.id))
                    .map(asset => (
                      <Line
                        key={asset.id}
                        type="monotone" dataKey={asset.name} stroke={asset.color} strokeWidth={3}
                        dot={false} activeDot={{ r: 6, fill: asset.color, stroke: 'white', strokeWidth: 2 }}
                        name={asset.name} connectNulls
                      />
                    ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  )
}
