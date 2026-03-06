import React, { useState, useMemo, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Trash2, Plus, Edit3, ArrowUp, ArrowDown } from 'lucide-react'
import { useWealth } from '../context/WealthContext'
import { Card } from '../components/ui/Card'
import { MetricCard } from '../components/ui/MetricCard'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, formatDate, generateUUID } from '../utils'
import type { StockTransaction } from '../types'

export default function Stocks() {
  const { stockTransactions, setStockTransactions, assets, history } = useWealth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<StockTransaction | null>(null)
  const [sortColumn, setSortColumn] = useState<'date' | 'ticker' | 'type' | 'shares' | 'price' | 'fees' | 'total'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [formData, setFormData] = useState({
    ticker: '',
    date: new Date().toISOString().split('T')[0],
    type: 'buy' as 'buy' | 'sell',
    shares: 0,
    pricePerShare: 0,
    fees: 0,
    totalAmount: 0
  })
  
  // Find the Stocks/Acciones or Interactive Brokers asset to get its NAV from history
  const stocksAsset = useMemo(() => {
    return assets.find(a => 
      a.name === 'Interactive Brokers' || 
      a.category === 'Stocks' || 
      a.name.toLowerCase().includes('acciones')
    )
  }, [assets])
  
  // Get the latest NAV for the stocks asset
  const assetLatestNAV = useMemo(() => {
    if (!stocksAsset || !history) return 0
    const assetHistory = history.filter(h => h.assetId === stocksAsset.id)
    if (assetHistory.length === 0) return 0
    // Sort by month and get the latest
    const sorted = [...assetHistory].sort((a, b) => b.month.localeCompare(a.month))
    return sorted[0].nav || 0
  }, [stocksAsset, history])

  // Calcular métricas de cartera
  const portfolioMetrics = useMemo(() => {
    const tickerMap: Record<string, { shares: number; cost: number; avgPrice: number; lastPrice: number }> = {}

    // Calculate positions from transactions
    stockTransactions.forEach(tx => {
      if (!tickerMap[tx.ticker]) {
        tickerMap[tx.ticker] = { shares: 0, cost: 0, avgPrice: 0, lastPrice: 0 }
      }
      tickerMap[tx.ticker].lastPrice = tx.pricePerShare

      if (tx.type === 'buy') {
        tickerMap[tx.ticker].shares += tx.shares
        tickerMap[tx.ticker].cost += tx.totalAmount + tx.fees
      } else {
        tickerMap[tx.ticker].shares -= tx.shares
        tickerMap[tx.ticker].cost -= (tx.shares * tickerMap[tx.ticker].avgPrice) + tx.fees
      }

      tickerMap[tx.ticker].avgPrice =
        tickerMap[tx.ticker].shares > 0
          ? tickerMap[tx.ticker].cost / tickerMap[tx.ticker].shares
          : 0
    })

    const tickers = Object.entries(tickerMap).filter(([_, data]) => data.shares > 0)
    
    // Use asset NAV as total value if available, otherwise calculate from transaction prices
    const totalValue = assetLatestNAV > 0 
      ? assetLatestNAV 
      : tickers.reduce((sum, [_, data]) => sum + (data.shares * data.lastPrice), 0)
    
    // Calculate net investment
    let totalBuyCost = 0
    let totalSellProceeds = 0
    
    stockTransactions.forEach(tx => {
      if (tx.type === 'buy') {
        totalBuyCost += tx.totalAmount + tx.fees
      } else {
        totalSellProceeds += tx.totalAmount - tx.fees
      }
    })
    const totalInvestment = Math.max(0, totalBuyCost - totalSellProceeds)
    
    // Unrealized gains: current value - net invested
    const unrealizedGains = totalValue - totalInvestment

    return {
      tickers,
      tickerMap,
      totalValue,
      totalInvestment,
      unrealizedGains
    }
  }, [stockTransactions, assetLatestNAV])

  const getSortedTransactions = useCallback((txs: StockTransaction[], column: 'date' | 'ticker' | 'type' | 'shares' | 'price' | 'fees' | 'total', direction: 'asc' | 'desc') => {
    const sorted = [...txs]
    const isAsc = direction === 'asc'
    
    switch (column) {
      case 'date':
        return sorted.sort((a, b) => isAsc ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime())
      case 'ticker':
        return sorted.sort((a, b) => isAsc ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker))
      case 'type':
        return sorted.sort((a, b) => isAsc ? a.type.localeCompare(b.type) : b.type.localeCompare(a.type))
      case 'shares':
        return sorted.sort((a, b) => isAsc ? a.shares - b.shares : b.shares - a.shares)
      case 'price':
        return sorted.sort((a, b) => isAsc ? a.pricePerShare - b.pricePerShare : b.pricePerShare - a.pricePerShare)
      case 'fees':
        return sorted.sort((a, b) => isAsc ? a.fees - b.fees : b.fees - a.fees)
      case 'total':
        return sorted.sort((a, b) => isAsc ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount)
      default:
        return sorted
    }
  }, [])

  const sortedTransactions = useMemo(() => getSortedTransactions(stockTransactions, sortColumn, sortDirection), [stockTransactions, sortColumn, sortDirection, getSortedTransactions])

  const distributionData = portfolioMetrics.tickers.map(([ticker, data]) => ({
    name: ticker,
    value: data.cost,
    shares: data.shares,
    avgPrice: data.avgPrice
  }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.ticker.trim()) return

    const totalAmount = formData.shares * formData.pricePerShare + formData.fees

    if (editingTransaction) {
      setStockTransactions(
        stockTransactions.map(tx =>
          tx.id === editingTransaction.id
            ? {
                id: tx.id,
                ticker: formData.ticker.toUpperCase(),
                date: formData.date,
                type: formData.type,
                shares: formData.shares,
                pricePerShare: formData.pricePerShare,
                fees: formData.fees,
                totalAmount
              }
            : tx
        )
      )
    } else {
      const newTx: StockTransaction = {
        id: generateUUID(),
        ticker: formData.ticker.toUpperCase(),
        date: formData.date,
        type: formData.type,
        shares: formData.shares,
        pricePerShare: formData.pricePerShare,
        fees: formData.fees,
        totalAmount
      }

      setStockTransactions([...stockTransactions, newTx])
    }

    setIsModalOpen(false)
    setEditingTransaction(null)
    setFormData({
      ticker: '',
      date: new Date().toISOString().split('T')[0],
      type: 'buy',
      shares: 0,
      pricePerShare: 0,
      fees: 0,
      totalAmount: 0
    })
  }

  const handleOpenModal = (transaction?: StockTransaction) => {
    if (transaction) {
      setEditingTransaction(transaction)
      setFormData({
        ticker: transaction.ticker,
        date: transaction.date,
        type: transaction.type,
        shares: transaction.shares,
        pricePerShare: transaction.pricePerShare,
        fees: transaction.fees,
        totalAmount: transaction.totalAmount
      })
    } else {
      setEditingTransaction(null)
      setFormData({
        ticker: '',
        date: new Date().toISOString().split('T')[0],
        type: 'buy',
        shares: 0,
        pricePerShare: 0,
        fees: 0,
        totalAmount: 0
      })
    }
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    setStockTransactions(stockTransactions.filter(tx => tx.id !== id))
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
            Gestor de Acciones
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Gestiona tu cartera de acciones
          </p>
        </div>
        <Button variant="primary" onClick={() => handleOpenModal()}>
          <Plus size={20} className="inline mr-2" />
          Nueva Transacción
        </Button>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Valor Total Cartera"
          value={formatCurrency(Math.round(portfolioMetrics.totalValue))}
          subtitle="Precio actual"
          color="text-indigo-600"
        />
        <MetricCard
          title="Inversión Neta"
          value={formatCurrency(Math.round(portfolioMetrics.totalInvestment))}
          subtitle="Capital empleado"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Ganancia No Realizada"
          value={formatCurrency(Math.round(portfolioMetrics.unrealizedGains))}
          subtitle="P&L actual"
          color={portfolioMetrics.unrealizedGains >= 0 ? 'text-emerald-500' : 'text-rose-500'}
        />
        <MetricCard
          title="Tickers"
          value={portfolioMetrics.tickers.length}
          subtitle="Acciones únicas"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Transacciones"
          value={stockTransactions.length}
          subtitle="Total realizadas"
          color="text-slate-900 dark:text-white"
        />
      </div>

      {/* Distribución y Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución */}
        <Card title="Distribución por Ticker" className="overflow-hidden">
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
                  {distributionData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              Sin acciones en cartera
            </p>
          )}
        </Card>

        {/* Resumen de Tickers */}
        <Card title="Resumen de Tickers">
          <div className="space-y-2">
            {portfolioMetrics.tickers.length > 0 ? (
              portfolioMetrics.tickers.map(([ticker, data]) => (
                <div key={ticker} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold dark:text-white">{ticker}</span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{data.shares} acciones</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Precio Medio: {formatCurrency(Math.round(data.avgPrice))}</span>
                    <span className="font-bold dark:text-white">Inversión: {formatCurrency(Math.round(data.cost))}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-600 dark:text-slate-400 py-8">
                Sin acciones aún
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Tabla de Transacciones */}
      <Card title="Historial de Transacciones" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th 
                  onClick={() => {
                    if (sortColumn === 'date') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('date')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-2">
                    Fecha
                    {sortColumn === 'date' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'ticker') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('ticker')
                      setSortDirection('asc')
                    }
                  }}
                  className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-2">
                    Ticker
                    {sortColumn === 'ticker' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'type') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('type')
                      setSortDirection('asc')
                    }
                  }}
                  className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-2">
                    Tipo
                    {sortColumn === 'type' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'shares') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('shares')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Acciones
                    {sortColumn === 'shares' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'price') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('price')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Precio
                    {sortColumn === 'price' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'fees') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('fees')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Comisión
                    {sortColumn === 'fees' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'total') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('total')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Total
                    {sortColumn === 'total' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="py-3 px-4 font-semibold dark:text-white">{formatDate(tx.date)}</td>
                  <td className="py-3 px-4 font-bold dark:text-white">{tx.ticker}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      tx.type === 'buy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200'
                    }`}>
                      {tx.type === 'buy' ? '▲ Compra' : '▼ Venta'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{tx.shares}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-600 dark:text-slate-300">{formatCurrency(Math.round(tx.pricePerShare))}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{formatCurrency(Math.round(tx.fees))}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{formatCurrency(Math.round(tx.totalAmount))}</td>
                  <td className="py-3 px-4 text-center space-x-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleOpenModal(tx)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    >
                      <Edit3 size={14} className="text-blue-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    >
                      <Trash2 size={14} className="text-rose-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stockTransactions.length === 0 && (
          <p className="text-center text-slate-600 dark:text-slate-400 py-8">
            Sin transacciones aún
          </p>
        )}
      </Card>

      {/* Modal de Nueva Transacción */}
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
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          <Select
            label="Tipo de Transacción"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'buy' | 'sell' })}
            options={[
              { value: 'buy', label: 'Compra' },
              { value: 'sell', label: 'Venta' }
            ]}
          />

          <Input
            label="Número de Acciones"
            type="number"
            value={formData.shares}
            onChange={(e) => setFormData({ ...formData, shares: parseFloat(e.target.value) })}
            step="0.01"
            min="0"
            required
          />

          <Input
            label="Precio por Acción (€)"
            type="number"
            value={formData.pricePerShare}
            onChange={(e) => setFormData({ ...formData, pricePerShare: parseFloat(e.target.value) })}
            step="0.01"
            min="0"
            required
          />

          <Input
            label="Comisión (€)"
            type="number"
            value={formData.fees}
            onChange={(e) => setFormData({ ...formData, fees: parseFloat(e.target.value) })}
            step="0.01"
            min="0"
          />

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
