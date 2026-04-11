import { useState, useMemo } from 'react'
import { useWealth } from '../context/WealthContext'
import { useWealthData } from '../hooks'
import { MetricCard } from '../components/ui/MetricCard'
import { Card } from '../components/ui/Card'
import { formatCurrency } from '../utils'
import { useROIMetrics, useEvolutionData, useCumulativeReturn } from '../hooks'
import { WealthEvolutionChart } from '../components/dashboard/WealthEvolutionChart'
import { AssetDistributionPie } from '../components/dashboard/AssetDistributionPie'
import { RoiCard } from '../components/dashboard/RoiCard'
import type { Asset } from '../types'
import { RoiTable } from '../components/dashboard/RoiTable'
import { AllocationBar } from '../components/dashboard/AllocationBar'
import { useAllocationByCategory } from '../hooks/useAllocation'

export default function Dashboard() {
  const { darkMode } = useWealth()
  const { assets, history, metrics, isLoading } = useWealthData()
  const [roiViewMode, setRoiViewMode] = useState<'chart' | 'table'>('chart')

  const activeAssets       = useMemo(() => assets.filter((a: Asset) => !a.isArchived), [assets])
  const allAssetsForHistory = useMemo(() => assets.filter((a: Asset) => a.name !== 'Cash'), [assets])

  const evolutionData = useEvolutionData(history, allAssetsForHistory)
  const roiData       = useCumulativeReturn(history, allAssetsForHistory)
  const roiMetrics    = useROIMetrics(assets, history)
  const allocations   = useAllocationByCategory(assets, history, roiMetrics)

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-slate-600 dark:text-slate-400">Cargando datos...</p>
      </div>
    )
  }

  /** Build distribution data for the pie chart based on an optional filter */
  const getDistributionData = (filter: string[]) =>
    activeAssets
      .filter((a: Asset) => filter.length === 0 || filter.includes(a.id))
      .map((asset: Asset) => ({
        name: asset.name,
        value: asset.name === 'Cash'
          ? metrics.cash
          : (roiMetrics.find(m => m.asset.id === asset.id)?.nav ?? 0),
        color: asset.color
      }))
      .filter((d: { name: string; value: number; color: string }) => d.value > 0)

  const activeClass   = 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
  const inactiveClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  const baseClass     = 'px-4 py-2 rounded-2xl font-semibold transition-colors text-sm'

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
          Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Visión general de tu patrimonio
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Valor Total"
          value={formatCurrency(Math.round(metrics.totalNAV))}
          subtitle="Patrimonio actual"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Inversión"
          value={formatCurrency(Math.round(metrics.totalInv))}
          subtitle="Total invertido"
          color="text-slate-400"
        />
        <MetricCard
          title="Ganancia/Pérdida"
          value={formatCurrency(metrics.totalProfit)}
          subtitle="Resultado neto"
          color={metrics.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}
        />
        <MetricCard
          title="ROI"
          value={`${metrics.roi.toFixed(2)}%`}
          subtitle="Rentabilidad"
          color="text-indigo-600"
        />
        <MetricCard
          title="Cash"
          value={formatCurrency(metrics.cash)}
          subtitle="Efectivo disponible"
          color="text-emerald-600"
        />
      </div>

      {/* Asset Allocation Bar */}
      <AllocationBar allocations={allocations} />

      {/* Evolución de Patrimonio */}
      <WealthEvolutionChart
        evolutionData={evolutionData}
        activeAssets={activeAssets}
        darkMode={darkMode}
      />

      {/* Distribución + Rentabilidad — side by side on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución del Patrimonio */}
        <AssetDistributionPie
          activeAssets={activeAssets}
          getDistributionData={getDistributionData}
        />

        {/* Rentabilidad Acumulada */}
        <Card title="Rentabilidad Acumulada">
          <div className="space-y-4">
            {/* Toggles chart / table */}
            <div className="flex gap-2">
              <button
                onClick={() => setRoiViewMode('chart')}
                className={`${baseClass} ${roiViewMode === 'chart' ? activeClass : inactiveClass}`}
              >
                📈 Gráfico
              </button>
              <button
                onClick={() => setRoiViewMode('table')}
                className={`${baseClass} ${roiViewMode === 'table' ? activeClass : inactiveClass}`}
              >
                📊 Tabla
              </button>
            </div>

            {roiViewMode === 'chart' && (
              <RoiCard
                roiData={roiData}
                allAssetsForHistory={allAssetsForHistory}
                darkMode={darkMode}
              />
            )}

            {roiViewMode === 'table' && (
              <RoiTable roiMetrics={roiMetrics} />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
