import React, { useState, useMemo, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Trash2, Plus, Edit3, ArrowUp, ArrowDown } from 'lucide-react'
import { useWealthData } from '../hooks'
import { useStockPortfolio } from '../hooks'
import { Card } from '../components/ui/Card'
import { MetricCard } from '../components/ui/MetricCard'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, formatUSD, formatDate, generateUUID } from '../utils'
import type { StockTransaction, Asset } from '../types'
import { api } from '../services/api'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function Stocks() {
  const { stockTransactions, refetchData, assets, eurUsdRate } = useWealthData()
  const { portfolio, loading: portfolioLoading, error: portfolioError, refetch: refetchPortfolio } = useStockPortfolio()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<StockTransaction | null>(null)
  const [sortColumn, setSortColumn] = useState<'transactionDate' | 'ticker' | 'type' | 'quantity' | 'price' | 'fees' | 'total'>('transactionDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [formData, setFormData] = useState({
    ticker: '',
    assetId: '',
    transactionDate: new Date().toISOString().split('T')[0],
    type: 'BUY' as 'BUY' | 'SELL',
    currency: 'USD',
    quantity: 0,
    pricePerUnit: 0,
    fees: 0,
    totalAmount: 0,
    exchangeRateEurUsd: 1.15
  })
  
  // EUR/USD rate for converting transaction amounts (stored in USD) to EUR
  const fxRate = eurUsdRate > 0 ? eurUsdRate : 1.15 // fallback

  const fxRate = eurUsdRate > 0 ? eurUsdRate : 1.08

  const portfolioMetrics = useMemo(() => {
    if (!portfolio) {
      return {
        tickers: [],
        tickerMap: {} as Record<string, any>,
        totalValue: 0,
        totalInvestment: 0,
        unrealizedGains: 0
      }
    }

    const tickers = portfolio.tickers.map(ticker => [
      ticker.ticker,
      {
        shares: ticker.shares,
        costUSD: ticker.costBasisUsd || 0,
        costEUR: ticker.costBasisEur || 0,
        avgPriceUSD: ticker.averagePriceUsd || 0,
        avgPriceEUR: (ticker.costBasisEur || 0) / (ticker.shares || 1),
        lastPrice: ticker.currentPriceEur || 0,
        currentValue: ticker.currentValueEur || 0,
        unrealizedGain: ticker.unrealizedGainEur || 0,
        unrealizedGainPercent: ticker.unrealizedGainPercent || 0
      }
    ] as const)

    const tickerMap = Object.fromEntries(tickers)

    return {
      tickers,
      tickerMap,
      totalValue: portfolio.totalValueEur || 0,
      totalInvestment: portfolio.totalInvestedEur || 0,
      unrealizedGains: portfolio.totalUnrealizedGainEur || 0
    }
  }, [portfolio])

  const getSortedTransactions = useCallback((txs: StockTransaction[], column: 'transactionDate' | 'ticker' | 'type' | 'quantity' | 'price' | 'fees' | 'total', direction: 'asc' | 'desc') => {
    const sorted = [...txs]
    const isAsc = direction === 'asc'

    switch (column) {
      case 'transactionDate':
        return sorted.sort((a, b) => isAsc ? new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime() : new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      case 'ticker':
        return sorted.sort((a, b) => isAsc ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker))
      case 'type':
        return sorted.sort((a, b) => isAsc ? a.type.localeCompare(b.type) : b.type.localeCompare(a.type))
      case 'quantity':
        return sorted.sort((a, b) => isAsc ? a.quantity - b.quantity : b.quantity - a.quantity)
      case 'price':
        return sorted.sort((a, b) => isAsc ? a.pricePerUnit - b.pricePerUnit : b.pricePerUnit - a.pricePerUnit)
      case 'fees':
        return sorted.sort((a, b) => isAsc ? a.fees - b.fees : b.fees - a.fees)
      case 'total':
        return sorted.sort((a, b) => isAsc ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount)
      default:
        return sorted
    }
  }, [])

  const sortedTransactions = useMemo(
    () => getSortedTransactions(stockTransactions, sortColumn, sortDirection),
    [stockTransactions, sortColumn, sortDirection, getSortedTransactions]
  )

  const filteredTransactions = useMemo(() => {
    let filtered = sortedTransactions
    if (searchQuery.trim()) {
      filtered = filtered.filter(tx =>
        tx.ticker.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    }
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(tx => tx.type === typeFilter)
    }
    return filtered
  }, [sortedTransactions, searchQuery, typeFilter])

  // Fix: use current market value for allocation, not cost basis
  const distributionData = portfolioMetrics.tickers.map(([ticker, data]) => ({
    name: ticker,
    value: data.currentValue,
    shares: data.shares,
    avgPrice: data.avgPriceEUR
  }))

  // Bar chart: ranking by current value
  const barData = portfolioMetrics.tickers
    .map(([ticker, data], idx) => ({
      ticker,
      value: Math.round(data.currentValue),
      gain: data.unrealizedGainPercent,
      isPositive: data.unrealizedGain >= 0,
      color: CHART_COLORS[idx % CHART_COLORS.length]
    }))
    .sort((a, b) => b.value - a.value)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.ticker.trim()) return

    const runUpdate = async () => {
      try {
        const totalAmount = formData.quantity * formData.pricePerUnit + formData.fees;
        
        // Find asset id
        const searchTicker = formData.ticker.trim().toUpperCase();
        const tickerAsset = assets.find((a: Asset) => 
          (a.ticker && a.ticker.trim().toUpperCase() === searchTicker) || 
          (a.name && a.name.trim().toUpperCase() === searchTicker)
        );
        const fbAsset = assets.find((a: Asset) => a.name === 'Interactive Brokers' || a.category === 'Stocks');
        const assetId = tickerAsset ? tickerAsset.id : (fbAsset ? fbAsset.id : undefined);

        const txData = {
          id: editingTransaction ? editingTransaction.id : generateUUID(),
          assetId: assetId,
          ticker: searchTicker,
          transactionDate: formData.transactionDate,
          type: formData.type,
          currency: formData.currency,
          quantity: formData.quantity,
          pricePerUnit: formData.pricePerUnit,
          fees: formData.fees,
          totalAmount: totalAmount,
          exchangeRateEurUsd: formData.exchangeRateEurUsd
        }

        if (editingTransaction) {
          await api.updateStockTransaction(editingTransaction.id, txData as any)
        } else {
          await api.createStockTransaction(txData as any)
        }

        await refetchData()
        await refetchPortfolio()

        setIsModalOpen(false)
        setEditingTransaction(null)
        setFormData({
          ticker: '',
          assetId: '',
          transactionDate: new Date().toISOString().split('T')[0],
          type: 'BUY',
          currency: 'USD',
          quantity: 0,
          pricePerUnit: 0,
          fees: 0,
          totalAmount: 0,
          exchangeRateEurUsd: 0 // Se obtiene automáticamente del backend
        });
      } catch (error) {
        console.error('Error saving stock transaction', error)
        alert('Error guardando la transacción')
      }
    }

    runUpdate()
  }

  const handleOpenModal = (transaction?: StockTransaction) => {
    if (transaction) {
      setEditingTransaction(transaction)
      setFormData({
        ticker: transaction.ticker,
        assetId: transaction.assetId,
        transactionDate: transaction.transactionDate,
        type: transaction.type,
        currency: transaction.currency,
        quantity: transaction.quantity,
        pricePerUnit: transaction.pricePerUnit,
        fees: transaction.fees,
        totalAmount: transaction.totalAmount,
        exchangeRateEurUsd: transaction.exchangeRateEurUsd
      })
    } else {
      setEditingTransaction(null)
      setFormData({
        ticker: '',
        assetId: '',
        transactionDate: new Date().toISOString().split('T')[0],
        type: 'BUY',
        currency: 'USD',
        quantity: 0,
        pricePerUnit: 0,
        fees: 0,
        totalAmount: 0,
        exchangeRateEurUsd: 0 // Se obtiene automáticamente del backend
      })
    }
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar esta transacción?')) {
      const runDelete = async () => {
        try {
          await api.deleteStockTransaction(id)
          await refetchData()
          await refetchPortfolio()
        } catch (error) {
          console.error('Error deleting stock transaction', error)
          alert('Error eliminando la transacción')
        }
      }
      runDelete()
    }
  }

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection(column === 'transactionDate' || column === 'total' || column === 'quantity' || column === 'price' || column === 'fees' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ col }: { col: typeof sortColumn }) =>
    sortColumn === col
      ? (sortDirection === 'asc' ? <ArrowUp size={12} className="shrink-0" /> : <ArrowDown size={12} className="shrink-0" />)
      : null

  const gainPct = portfolioMetrics.totalInvestment > 0
    ? (portfolioMetrics.unrealizedGains / portfolioMetrics.totalInvestment * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6">
      {portfolioError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900 border border-rose-200 dark:border-rose-800 rounded-lg">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
            Error cargando datos: {portfolioError}
          </p>
        </div>
      )}

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
            Gestor de Acciones
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Gestiona tu cartera de acciones · Tipo de cambio: 1 € = {fxRate.toFixed(4)} $
          </p>
        </div>
        <Button variant="primary" onClick={() => handleOpenModal()}>
          <Plus size={20} className="inline mr-2" />
          Nueva Transacción
        </Button>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Valor Total Cartera"
          value={portfolioLoading ? 'Cargando...' : formatCurrency(Math.round(portfolioMetrics.totalValue))}
          subtitle="Precio actual (€)"
          color="text-indigo-600"
        />
        <MetricCard
          title="Inversión Neta"
          value={portfolioLoading ? 'Cargando...' : formatCurrency(Math.round(portfolioMetrics.totalInvestment))}
          subtitle="Capital empleado (€)"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Ganancia No Realizada"
          value={portfolioLoading ? 'Cargando...' : formatCurrency(Math.round(portfolioMetrics.unrealizedGains))}
          subtitle={portfolioLoading ? 'Cargando...' : `${portfolioMetrics.unrealizedGains >= 0 ? '▲' : '▼'} ${gainPct}% sobre inversión`}
          color={portfolioMetrics.unrealizedGains >= 0 ? 'text-emerald-500' : 'text-rose-500'}
        />
        <MetricCard
          title="Tickers"
          value={portfolioLoading ? 'Cargando...' : portfolioMetrics.tickers.length}
          subtitle="Posiciones abiertas"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Transacciones"
          value={stockTransactions.length}
          subtitle="Total realizadas"
          color="text-slate-900 dark:text-white"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie: Allocation by market value */}
        <Card title="Distribución por Valor de Mercado">
          {distributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={90}
                  innerRadius={40}
                  dataKey="value"
                >
                  {distributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v)), 'Valor actual']}
                  contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-16">
              Sin acciones en cartera
            </p>
          )}
        </Card>

        {/* Bar: Ranking by current value */}
        <Card title="Posiciones por Valor Actual (€)">
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(v, _, props) => [
                    `${formatCurrency(Number(v))}  (${props.payload?.gain?.toFixed(1)}%)`,
                    'Valor actual'
                  ]}
                  contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {barData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-16">
              Sin acciones en cartera
            </p>
          )}
        </Card>
      </div>

      {/* Ticker Position Cards */}
      {portfolioMetrics.tickers.length > 0 && (
        <div>
          <h2 className="text-lg font-bold dark:text-white mb-3">Posiciones Abiertas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {portfolioMetrics.tickers.map(([ticker, data], idx) => {
              const portfolioPct = portfolioMetrics.totalValue > 0
                ? (data.currentValue / portfolioMetrics.totalValue) * 100
                : 0
              const isPositive = data.unrealizedGain >= 0
              const color = CHART_COLORS[idx % CHART_COLORS.length]

              return (
                <div
                  key={ticker}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xl font-black tracking-tight dark:text-white">{ticker}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {data.shares.toLocaleString('es-ES', { maximumFractionDigits: 4 })} acc.
                      </span>
                    </div>
                    <span
                      className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                        isPositive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                      }`}
                    >
                      {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {isPositive ? '+' : ''}{data.unrealizedGainPercent.toFixed(1)}%
                    </span>
                  </div>

                  {/* Main values */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Valor actual</p>
                      <p className="text-lg font-black tabular-nums dark:text-white">
                        {formatCurrency(Math.round(data.currentValue))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">P&L</p>
                      <p className={`text-lg font-black tabular-nums ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(Math.round(data.unrealizedGain))}
                      </p>
                    </div>
                  </div>

                  {/* Secondary info */}
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span>Invertido: <strong className="dark:text-slate-300">{formatCurrency(Math.round(data.costEUR))}</strong></span>
                    <span>Precio/acc: <strong className="dark:text-slate-300">{formatCurrency(Math.round(data.lastPrice))}</strong></span>
                  </div>

                  {/* Portfolio weight progress bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">% del portfolio</span>
                      <span className="text-xs font-bold dark:text-slate-300">{portfolioPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${portfolioPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <Card title="Historial de Transacciones" className="overflow-hidden">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ticker..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['ALL', 'BUY', 'SELL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  typeFilter === f
                    ? f === 'BUY'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : f === 'SELL'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {f === 'ALL' ? 'Todas' : f === 'BUY' ? '▲ Compras' : '▼ Ventas'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                {([
                  { col: 'transactionDate', label: 'Fecha', align: 'left' },
                  { col: 'ticker', label: 'Ticker', align: 'left' },
                  { col: 'type', label: 'Tipo', align: 'left' },
                  { col: 'quantity', label: 'Acciones', align: 'right' },
                  { col: 'price', label: 'Precio ($)', align: 'right' },
                ] as const).map(({ col, label, align }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`text-${align} py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none`}
                  >
                    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                      {label}
                      <SortIcon col={col} />
                    </div>
                  </th>
                ))}
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Ratio (€/$)</th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Inversión (€)</th>
                <th
                  onClick={() => handleSort('fees')}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    Comisión ($)<SortIcon col="fees" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('total')}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    Total ($)<SortIcon col="total" />
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                  <td className="py-3 px-4 font-semibold dark:text-white">{formatDate(tx.transactionDate)}</td>
                  <td className="py-3 px-4 font-black dark:text-white">{tx.ticker}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                      tx.type === 'BUY'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                    }`}>
                      {tx.type === 'BUY' ? '▲ Compra' : '▼ Venta'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{tx.quantity}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-600 dark:text-slate-300">{formatUSD(tx.pricePerUnit)}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{(tx.exchangeRateEurUsd || 1.15).toFixed(4)}</td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(tx.totalAmount / (tx.exchangeRateEurUsd || 1.15))}
                  </td>
                  <td className="py-3 px-4 text-right dark:text-slate-300">{formatUSD(tx.fees)}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{formatUSD(tx.totalAmount)}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1.5 justify-center">
                      <button
                        onClick={() => handleOpenModal(tx)}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 size={13} className="text-blue-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} className="text-rose-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-10">
            {stockTransactions.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">Sin transacciones aún</p>
            ) : (
              <div>
                <p className="text-slate-500 dark:text-slate-400 mb-2">Sin resultados para los filtros aplicados</p>
                <button
                  onClick={() => { setSearchQuery(''); setTypeFilter('ALL') }}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer with count */}
        {filteredTransactions.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-right">
            {filteredTransactions.length} de {stockTransactions.length} transacciones
          </p>
        )}
      </Card>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        title={editingTransaction ? 'Editar Transacción Acción' : 'Nueva Transacción Acción'}
        onClose={() => {
          setIsModalOpen(false)
          setEditingTransaction(null)
        }}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Ticker (Ej: AAPL, MSFT)"
            value={formData.ticker}
            onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
            placeholder="AAPL"
            required
            maxLength={5}
          />

          <Input
            label="Fecha"
            type="date"
            value={formData.transactionDate}
            onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
            required
          />

          <Select
            label="Tipo de Transacción"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'BUY' | 'SELL' })}
            options={[
              { value: 'BUY', label: 'Compra' },
              { value: 'SELL', label: 'Venta' }
            ]}
          />

          <Input
            label="Número de Acciones"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
            step="0.01"
            min="0"
            required
          />

          <Input
            label="Precio por Acción ($)"
            type="number"
            value={formData.pricePerUnit}
            onChange={(e) => setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || 0 })}
            step="0.01"
            min="0"
            required
          />

          <Input
            label="Comisión ($)"
            type="number"
            value={formData.fees}
            onChange={(e) => setFormData({ ...formData, fees: parseFloat(e.target.value) })}
            step="0.01"
            min="0"
          />

          <Input
            label="Tipo de Cambio (1€ = X$) - Opcional"
            type="number"
            value={formData.exchangeRateEurUsd}
            onChange={(e) => setFormData({ ...formData, exchangeRateEurUsd: parseFloat(e.target.value) || 0 })}
            step="0.0001"
            min="0.0001"
            placeholder="Se obtiene automáticamente del historial de cambios"
          />
          <p className="text-xs text-slate-500 mt-1 italic">
            * Se obtiene automáticamente del día de la transacción. Puedes editarlo si necesitas usar un valor específico.
          </p>

          {formData.quantity > 0 && formData.pricePerUnit > 0 && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong>Total USD:</strong> {formatUSD(formData.quantity * formData.pricePerUnit + formData.fees)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong>Equivalente EUR:</strong> {formatCurrency((formData.quantity * formData.pricePerUnit + formData.fees) / formData.exchangeRateEurUsd)}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingTransaction ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
