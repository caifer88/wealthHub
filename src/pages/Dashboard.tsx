import { useState, useMemo } from 'react'
import { 
  LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { useWealth } from '../context/WealthContext'
import { MetricCard } from '../components/ui/MetricCard'
import { Card } from '../components/ui/Card'
import { formatCurrency } from '../utils'
import { useROIMetrics, useEvolutionData, useCumulativeReturn } from '../hooks'

export default function Dashboard() {
  const { assets, history, darkMode, metrics } = useWealth()
  const [showTotal, setShowTotal] = useState(true)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [distributionFilter, setDistributionFilter] = useState<string[]>([])
  const [roiViewMode, setRoiViewMode] = useState<'chart' | 'table'>('chart')
  
  // Initialize visibleAssets with all non-Cash assets visible
  const [visibleAssets, setVisibleAssets] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { totalROI: true }
    assets.filter(a => a.name !== 'Cash').forEach(a => {
      initial[a.id] = true
    })
    return initial
  })

  // Include archived assets in historical calculations, but keep active-only for UI filters
  const activeAssets = useMemo(() => assets.filter(a => !a.archived), [assets])
  const allAssetsForHistory = useMemo(() => assets.filter(a => a.name !== 'Cash'), [assets])
  
  const evolutionData = useEvolutionData(history, allAssetsForHistory)
  const roiData = useCumulativeReturn(history, allAssetsForHistory)
  const roiMetrics = useROIMetrics(assets, history)

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-slate-600 dark:text-slate-400">Cargando datos...</p>
      </div>
    )
  }

  // Distribution data for pie chart
  const distributionData = activeAssets
    .filter(a => a.name !== 'Cash')
    .filter(a => distributionFilter.length === 0 || distributionFilter.includes(a.id))
    .map(asset => ({
      name: asset.name,
      value: roiMetrics.find(m => m.asset.id === asset.id)?.nav || 0,
      color: asset.color
    }))
    .filter(d => d.value > 0)



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

      {/* Métricas principales */}
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

      {/* Evolución de Patrimonio */}
      <Card title="Evolución de Patrimonio" className="overflow-hidden">
        <div className="space-y-6">
          {/* Filtros de Activos */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowTotal(!showTotal)}
              className={`px-4 py-2 rounded-2xl font-semibold transition-colors ${
                showTotal
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              📊 Total
            </button>
            {activeAssets
              .filter(a => a.name !== 'Cash')
              .map(asset => (
                <button
                  key={asset.id}
                  onClick={() =>
                    setSelectedAssets(
                      selectedAssets.includes(asset.id)
                        ? selectedAssets.filter(id => id !== asset.id)
                        : [...selectedAssets, asset.id]
                    )
                  }
                  className={`px-4 py-2 rounded-2xl font-semibold transition-colors ${
                    selectedAssets.includes(asset.id)
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                  style={{
                    borderLeft: `4px solid ${asset.color}`
                  }}
                >
                  {asset.name}
                </button>
              ))}
          </div>

          {/* Gráfica Principal */}
          {evolutionData.length > 0 && (
            <div className="h-[400px] -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                  <XAxis
                    dataKey="month"
                    stroke={darkMode ? '#94a3b8' : '#64748b'}
                    tick={{ fontSize: 12 }}
                  />
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

                  {/* Total */}
                  {showTotal && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
                        name="Total"
                        connectNulls={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="invested"
                        stroke="#94a3b8"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, fill: '#94a3b8', stroke: 'white', strokeWidth: 2 }}
                        name="Total Invertido"
                        connectNulls={true}
                      />
                    </>
                  )}

                  {/* Activos seleccionados */}
                  {selectedAssets.length > 0 &&
                    activeAssets
                      .filter(a => selectedAssets.includes(a.id))
                      .map(asset => (
                        <Line
                          key={asset.id}
                          type="monotone"
                          dataKey={asset.name}
                          stroke={asset.color}
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 6, fill: asset.color, stroke: 'white', strokeWidth: 2 }}
                          name={asset.name}
                          connectNulls={true}
                        />
                      ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Distribución y ROI */}
      {/* Distribución */}
      <Card title="Distribución del Patrimonio" className="overflow-hidden">
          <div className="space-y-4">
            {/* Filtros de Distribución */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDistributionFilter([])}
                className={`px-4 py-2 rounded-2xl font-semibold transition-colors text-sm ${
                  distributionFilter.length === 0
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                🔄 Todos
              </button>
              {activeAssets
                .filter(a => a.name !== 'Cash')
                .map(asset => (
                  <button
                    key={asset.id}
                    onClick={() =>
                      setDistributionFilter(
                        distributionFilter.includes(asset.id)
                          ? distributionFilter.filter(id => id !== asset.id)
                          : [...distributionFilter, asset.id]
                      )
                    }
                    className={`px-4 py-2 rounded-2xl font-semibold transition-colors text-sm ${
                      distributionFilter.includes(asset.id)
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                    style={{
                      borderLeft: `4px solid ${asset.color}`
                    }}
                  >
                    {asset.name}
                  </button>
                ))}
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
                    fill="#8884d8"
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

      {/* ROI Rentabilidad */}
      <Card title="Rentabilidad Acumulada">
          <div className="space-y-4">
            {/* Controles de vista y filtros ROI */}
            <div className="flex flex-wrap gap-2 justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRoiViewMode('chart')}
                  className={`px-4 py-2 rounded-2xl font-semibold transition-colors text-sm ${
                    roiViewMode === 'chart'
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  📈 Gráfico
                </button>
                <button
                  onClick={() => setRoiViewMode('table')}
                  className={`px-4 py-2 rounded-2xl font-semibold transition-colors text-sm ${
                    roiViewMode === 'table'
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  📊 Tabla
                </button>
              </div>
              
              {/* Filtros ROI */}
              {roiViewMode === 'chart' && (
                <div className="flex flex-wrap gap-2">
                  {allAssetsForHistory
                    .map(asset => (
                      <button
                        key={asset.id}
                        onClick={() =>
                          setVisibleAssets(prev => ({
                            ...prev,
                            [asset.id]: !prev[asset.id]
                          }))
                        }
                        className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                          visibleAssets[asset.id]
                            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        } ${asset.archived ? 'opacity-60' : ''}`}
                      >
                        {asset.name} {asset.archived ? '📦' : ''}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Modo Gráfico */}
            {roiViewMode === 'chart' && roiData.length > 0 && (
              <div className="h-[300px] -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={roiData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                    <XAxis
                      dataKey="month"
                      stroke={darkMode ? '#94a3b8' : '#64748b'}
                      tick={{ fontSize: 12 }}
                    />
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

                    {/* Total ROI */}
                    <Line
                      type="monotone"
                      dataKey="totalROI"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
                      name="Total ROI"
                      connectNulls={true}
                    />

                    {/* ROI por Activo */}
                    {allAssetsForHistory
                      .filter(a => visibleAssets[a.id])
                      .map((asset) => (
                        <Line
                          key={asset.id}
                          type="monotone"
                          dataKey={`ROI_${asset.name}`}
                          stroke={asset.color}
                          strokeWidth={asset.archived ? 1.5 : 2}
                          strokeOpacity={asset.archived ? 0.4 : 0.7}
                          strokeDasharray={asset.archived ? '5 5' : 'none'}
                          dot={false}
                          activeDot={{ r: 6, fill: asset.color, strokeWidth: 2, stroke: 'white' }}
                          name={`ROI ${asset.name}${asset.archived ? ' (archivado)' : ''}`}
                          connectNulls={true}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Modo Tabla */}
            {roiViewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Activo</th>
                      <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">NAV Actual</th>
                      <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Invertido</th>
                      <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Ganancia</th>
                      <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">ROI %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roiMetrics
                      .filter(m => m.asset.name !== 'Cash')
                      .map(metric => (
                        <tr key={metric.asset.id} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                          metric.asset.archived ? 'bg-slate-50 dark:bg-slate-900 opacity-60' : ''
                        }`}>
                          <td className={`py-3 px-4 font-semibold ${metric.asset.archived ? 'text-slate-500 dark:text-slate-500' : 'dark:text-white'}`}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metric.asset.color }}></div>
                              {metric.asset.name}
                              {metric.asset.archived && <span className="text-xs ml-2 px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">Archivado</span>}
                            </div>
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${metric.asset.archived ? 'text-slate-500 dark:text-slate-500' : 'dark:text-white'}`}>
                            {formatCurrency(Math.round(metric.nav))}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${metric.asset.archived ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>
                            {formatCurrency(Math.round(metric.totalInvested))}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${
                            metric.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          } ${metric.asset.archived ? 'opacity-60' : ''}`}>
                            {formatCurrency(metric.totalProfit)}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${
                            metric.asset.archived ? 'text-slate-500 dark:text-slate-500' : 'text-indigo-600'
                          }`}>
                            {metric.roi.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
    </div>
  )
}
