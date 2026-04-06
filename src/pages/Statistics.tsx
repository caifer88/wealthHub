import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useWealthData } from '../hooks'
import { Card } from '../components/ui/Card'
import { MetricCard } from '../components/ui/MetricCard'
import { formatCurrency } from '../utils'
import { useROIMetrics } from '../hooks'
import { useAllocationByCategory } from '../hooks/useAllocation'
import type { Asset, HistoryEntry } from '../types'

interface YearlyMetrics {
  year: number
  monthsWithData: number
  totalInvested: number
  totalNav: number
  totalGainLoss: number
  roi: number
  investmentByAsset: Record<string, { invested: number; nav: number; navAtStart: number; gainLoss: number; roi: number }>
  contributionRate: number
}

export default function Statistics() {
  const { assets, history, metrics } = useWealthData()
  const roiMetrics = useROIMetrics(assets, history)
  const allocations = useAllocationByCategory(assets, history, roiMetrics)
  const [expandedYears, setExpandedYears] = useState<number[]>([])

  const toggleYear = (year: number) => {
    setExpandedYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    )
  }

  const yearlyMetrics = useMemo(() => {
    if (history.length === 0) return []

    // Sort history by month for correct period calculations
    const sortedHistory = [...history].sort((a: HistoryEntry, b: HistoryEntry) => a.month.localeCompare(b.month))

    // Find Cash asset ID
    const cashAsset = assets.find((a: Asset) => a.name === 'Cash')
    const cashasset_id = cashAsset?.id

    // Group history by year
    const byYear: Record<number, Record<string, any[]>> = {}

    sortedHistory.forEach(entry => {
      const year = new Date(entry.month).getFullYear()
      if (!byYear[year]) {
        byYear[year] = {}
      }
      if (!byYear[year][entry.asset_id]) {
        byYear[year][entry.asset_id] = []
      }
      byYear[year][entry.asset_id].push(entry)
    })

    // Create a map of last NAV for each asset per month for reference
    const lastNavByAssetMonth: Record<string, Record<string, number>> = {}
    sortedHistory.forEach(entry => {
      if (!lastNavByAssetMonth[entry.asset_id]) {
        lastNavByAssetMonth[entry.asset_id] = {}
      }
      lastNavByAssetMonth[entry.asset_id][entry.month] = entry.nav
    })

    // Calculate metrics for each year
    const metrics: YearlyMetrics[] = []
    const years = Object.keys(byYear)
      .map(y => parseInt(y))
      .sort((a, b) => a - b)

    years.forEach((year, yearIndex) => {
      const yearData = byYear[year]
      const monthsSet = new Set<string>()
      let totalInvested = 0
      let totalNavEnd = 0
      let totalNavStart = 0
      let totalGainLoss = 0
      const investmentByAsset: Record<string, { invested: number; nav: number; navAtStart: number; gainLoss: number; roi: number }> = {}

      // Get all assets in this year
      const allasset_ids = new Set(Object.keys(yearData))
      allasset_ids.forEach(asset_id => {
        const entries = yearData[asset_id] || []
        const isCash = asset_id === cashasset_id

        if (entries.length > 0) {
          // Count months
          entries.forEach(e => monthsSet.add(e.month))


          
          // Get invested amount in this year
          const yearInvested = entries.reduce((sum, e) => sum + (e.contribution || 0), 0)
          
          // Get NAV at end of year (last entry of the year)
          const lastEntry = entries[entries.length - 1]
          const navEnd = lastEntry.nav

          // Get NAV at start of year
          let navStart = 0
          if (yearIndex > 0) {
            const prevYear = years[yearIndex - 1]
            const prevYearData = byYear[prevYear]
            if (prevYearData && prevYearData[asset_id] && prevYearData[asset_id].length > 0) {
              navStart = prevYearData[asset_id][prevYearData[asset_id].length - 1].nav
            }
          }

          // Calculate gain: (End NAV - Start NAV) - Annual Contribution
          // This gives us the profit/loss from the investment in this period
          const assetGainLoss = navEnd - navStart - yearInvested

          // Calculate ROI: Gain / (Start NAV + Invested) * 100
          const assetCapitalAtRisk = navStart + yearInvested
          const assetRoi = assetCapitalAtRisk > 0 ? (assetGainLoss / assetCapitalAtRisk) * 100 : 0

          // Only count non-Cash assets in ROI and gain calculations
          if (!isCash) {
            totalInvested += yearInvested
            totalNavEnd += navEnd
            totalNavStart += navStart
            totalGainLoss += assetGainLoss
          }

          investmentByAsset[asset_id] = {
            invested: yearInvested,
            nav: navEnd,
            navAtStart: navStart,
            gainLoss: assetGainLoss,
            roi: assetRoi
          }
        }
      })

      const monthsWithData = monthsSet.size
      // ROI = Gain / (Start NAV + Invested) * 100
      const capitalAtRisk = totalNavStart + totalInvested
      const roi = capitalAtRisk > 0 ? (totalGainLoss / capitalAtRisk) * 100 : 0

      // Calculate contribution rate (average monthly investment)
      const monthlyContribution = totalInvested / monthsWithData
      const contributionRate = monthlyContribution

      metrics.push({
        year,
        monthsWithData,
        totalInvested,
        totalNav: totalNavEnd,
        totalGainLoss,
        roi,
        investmentByAsset,
        contributionRate
      })
    })

    return metrics
  }, [history, assets])

  // Calculate accumulated investment per asset
  const cumulativeInvestment = useMemo(() => {
    const cumulative: Record<string, { total: number; yearStart: number; yearEnd: number }> = {}

    yearlyMetrics.forEach(year => {
      Object.entries(year.investmentByAsset).forEach(([asset_id, data]) => {
        if (!cumulative[asset_id]) {
          cumulative[asset_id] = { total: 0, yearStart: year.year, yearEnd: year.year }
        }
        cumulative[asset_id].total += data.invested
        cumulative[asset_id].yearEnd = year.year
      })
    })

    return cumulative
  }, [yearlyMetrics])

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-slate-600 dark:text-slate-400">Sin datos de estadísticas</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
          Estadísticas
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Análisis de inversión y rendimiento
        </p>
      </header>

      {/* KPI Overview - Aligned with Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* Block 0: Strategy Allocation (Macro) */}
      <Card title="🎯 Asignación por Estrategia">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Estrategia</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">NAV Actual</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Invertido</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Ganancia</th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">% Cartera</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">ROI %</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(a => (
                <tr key={a.category} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="py-3 px-4 font-bold dark:text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.meta.barColor }} />
                    {a.meta.icon} {a.meta.label}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums dark:text-white">
                    {formatCurrency(Math.round(a.totalNAV))}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-500 dark:text-slate-400">
                    {formatCurrency(Math.round(a.totalInvested))}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold tabular-nums ${a.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(Math.round(a.totalProfit))}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-indigo-600">
                    {a.percentage.toFixed(1)}%
                  </td>
                  <td className={`py-3 px-4 text-right font-bold tabular-nums ${a.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {a.roi.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
            {allocations.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  <td className="py-3 px-4 font-black text-slate-700 dark:text-slate-300 uppercase">Total Cartera</td>
                  <td className="py-3 px-4 text-right font-black tabular-nums dark:text-white">
                    {formatCurrency(Math.round(allocations.reduce((s, a) => s + a.totalNAV, 0)))}
                  </td>
                  <td className="py-3 px-4 text-right font-black tabular-nums text-slate-600 dark:text-slate-400">
                    {formatCurrency(Math.round(allocations.reduce((s, a) => s + a.totalInvested, 0)))}
                  </td>
                  <td className={`py-3 px-4 text-right font-black tabular-nums ${allocations.reduce((s, a) => s + a.totalProfit, 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(Math.round(allocations.reduce((s, a) => s + a.totalProfit, 0)))}
                  </td>
                  <td className="py-3 px-4 text-center font-black text-indigo-600">100.0%</td>
                  <td className="py-3 px-4 text-right font-black tabular-nums text-indigo-600">
                    {(() => {
                      const inv = allocations.reduce((s, a) => s + a.totalInvested, 0)
                      const prof = allocations.reduce((s, a) => s + a.totalProfit, 0)
                      return inv > 0 ? ((prof / inv) * 100).toFixed(2) + '%' : '0.00%'
                    })()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Block 1: Annual Analysis */}
      <Card title="📅 Análisis Anual">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Año</th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Meses</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Invertido</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Valor Final</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Ganancia</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">ROI %</th>
              </tr>
            </thead>
            <tbody>
              {yearlyMetrics.map(year => (
                <tr key={year.year} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="py-3 px-4 font-bold dark:text-white">{year.year}</td>
                  <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">
                    {year.monthsWithData}{year.monthsWithData < 12 ? '*' : ''}
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">
                    {formatCurrency(Math.round(year.totalInvested))}
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">
                    {formatCurrency(Math.round(year.totalNav))}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${
                    year.totalGainLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {formatCurrency(Math.round(year.totalGainLoss))}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600">
                    {year.roi.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            * Año incompleto: la media se calcula con los meses disponibles
          </p>
        </div>
      </Card>

      {/* Block 2: Cumulative Investment by Asset */}
      <Card title="💰 Inversión Acumulada por Activo">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Activo</th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Período</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Inversión Total</th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">% del Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cumulativeInvestment)
                .filter(([asset_id]) => asset_id !== assets.find((a: Asset) => a.name === 'Cash')?.id)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([asset_id, data]) => {
                  const asset = assets.find((a: Asset) => a.id === asset_id)
                  const percentage = metrics.totalInv > 0
                    ? (data.total / metrics.totalInv) * 100
                    : 0

                  return (
                    <tr key={asset_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="py-3 px-4 font-semibold dark:text-white">
                        <div className="flex items-center gap-2">
                          {asset && (
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }}></div>
                          )}
                          {asset?.name || 'Desconocido'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">
                        {data.yearStart === data.yearEnd ? data.yearStart : `${data.yearStart}-${data.yearEnd}`}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        data.total >= 0 ? 'dark:text-white' : 'text-amber-600'
                      }`}>
                        {data.total >= 0 ? formatCurrency(Math.round(data.total)) : `${formatCurrency(Math.round(Math.abs(data.total)))} (retirado)`}
                      </td>
                      <td className="py-3 px-4 text-center text-indigo-600 font-bold">
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Block 3: Asset Breakdown by Year with Collapsible Rows */}
      <Card title="📊 Desglose por Activos">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400 w-12"></th>
                <th className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Año / Activo</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Invertido</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Valor Final</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Ganancia</th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">ROI %</th>
              </tr>
            </thead>
            <tbody>
              {yearlyMetrics.map(year => {
                const isExpanded = expandedYears.includes(year.year)
                const assetCount = Object.keys(year.investmentByAsset).filter(
                  asset_id => asset_id !== assets.find((a: Asset) => a.name === 'Cash')?.id
                ).length

                return (
                  <div key={`year-section-${year.year}`}>
                    {/* Year Summary Row */}
                    <tr 
                      key={`year-${year.year}`}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                      onClick={() => toggleYear(year.year)}
                    >
                      <td className="py-3 px-4 text-center">
                        {assetCount > 0 && (
                          isExpanded ? <ChevronDown size={16} className="text-indigo-600" /> : <ChevronRight size={16} className="text-slate-600" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold dark:text-white">{year.year}</td>
                      <td className="py-3 px-4 text-right font-bold dark:text-white">
                        {formatCurrency(Math.round(year.totalInvested))}
                      </td>
                      <td className="py-3 px-4 text-right font-bold dark:text-white">
                        {formatCurrency(Math.round(year.totalNav))}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        year.totalGainLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {formatCurrency(Math.round(year.totalGainLoss))}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-600">
                        {year.roi.toFixed(2)}%
                      </td>
                    </tr>

                    {/* Expanded Asset Rows */}
                    {isExpanded && Object.entries(year.investmentByAsset)
                      .filter(([asset_id]) => asset_id !== assets.find((a: Asset) => a.name === 'Cash')?.id)
                      .sort(([, a], [, b]) => b.invested - a.invested)
                      .map(([asset_id, data]) => {
                        const asset = assets.find((a: Asset) => a.id === asset_id)

                        return (
                          <tr 
                            key={`${year.year}-${asset_id}`} 
                            className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-4 font-semibold dark:text-white">
                              <div className="flex items-center gap-2 ml-4">
                                {asset && (
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: asset.color }}></div>
                                )}
                                {asset?.name || 'Desconocido'}
                              </div>
                            </td>
                            <td className={`py-3 px-4 text-right font-semibold ${
                              data.invested >= 0 ? 'dark:text-white' : 'text-amber-600'
                            }`}>
                              {data.invested >= 0 ? formatCurrency(Math.round(data.invested)) : `${formatCurrency(Math.round(Math.abs(data.invested)))} (↗)`}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold dark:text-white">
                              {formatCurrency(Math.round(data.nav))}
                            </td>
                            <td className={`py-3 px-4 text-right font-semibold ${
                              data.gainLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {formatCurrency(Math.round(data.gainLoss))}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-indigo-600">
                              {data.roi.toFixed(2)}%
                            </td>
                          </tr>
                        )
                      })}
                  </div>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
