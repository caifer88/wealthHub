import React, { useState, useMemo, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Trash2, Plus, Edit3, ArrowUp, ArrowDown } from 'lucide-react'
import { useWealth } from '../context/WealthContext'
import { useStockPortfolio } from '../hooks'
import { Card } from '../components/ui/Card'
import { MetricCard } from '../components/ui/MetricCard'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, formatUSD, formatDate, generateUUID } from '../utils'
import type { StockTransaction } from '../types'
import { api } from '../services/api'

export default function Stocks() {
  const { stockTransactions, refetchData, assets, eurUsdRate } = useWealth()
  const { portfolio, loading: portfolioLoading, error: portfolioError, refetch: refetchPortfolio } = useStockPortfolio()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<StockTransaction | null>(null)
  const [sortColumn, setSortColumn] = useState<'transactionDate' | 'ticker' | 'type' | 'quantity' | 'price' | 'fees' | 'total'>('transactionDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
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
    exchangeRateEurUsd: 1.08
  })
  
  // EUR/USD rate for converting transaction amounts (stored in USD) to EUR
  const fxRate = eurUsdRate > 0 ? eurUsdRate : 1.08 // fallback

  // Portfolio metrics now come from backend through the hook
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

    // Transform backend DTO to frontend display format
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

  const sortedTransactions = useMemo(() => getSortedTransactions(stockTransactions, sortColumn, sortDirection), [stockTransactions, sortColumn, sortDirection, getSortedTransactions])

  const distributionData = portfolioMetrics.tickers.map(([ticker, data]) => ({
    name: ticker,
    value: data.costEUR,
    shares: data.shares,
    avgPrice: data.avgPriceEUR
  }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.ticker.trim()) return

    const runUpdate = async () => {
      try {
        const totalAmount = formData.quantity * formData.pricePerUnit + formData.fees;
        
        // Find asset id
        const searchTicker = formData.ticker.trim().toUpperCase();
        const tickerAsset = assets.find(a => 
          (a.ticker && a.ticker.trim().toUpperCase() === searchTicker) || 
          (a.name && a.name.trim().toUpperCase() === searchTicker)
        );
        const fbAsset = assets.find(a => a.name === 'Interactive Brokers' || a.category === 'Stocks');
        const assetId = tickerAsset ? tickerAsset.id : (fbAsset ? fbAsset.id : undefined);

        const txData = {
          ticker: searchTicker,
          transactionDate: formData.transactionDate,
          type: formData.type,
          quantity: formData.quantity,
          pricePerUnit: formData.pricePerUnit,
          fees: formData.fees,
          totalAmount: totalAmount,
          currency: formData.currency,
          assetId: assetId,
          exchangeRateEurUsd: formData.exchangeRateEurUsd
        };

        if (editingTransaction) {
          await api.updateTransaction(editingTransaction.id, txData);
        } else {
          await api.createTransaction({
            id: generateUUID(),
            ...txData
          });
        }

        // Refetch both context data and portfolio data
        await refetchData();
        await refetchPortfolio();

        setIsModalOpen(false);
        setEditingTransaction(null);
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
          exchangeRateEurUsd: fxRate
        });
      } catch (error) {
        console.error("Error saving stock transaction", error);
        alert("Error guardando la transacción");
      }
    };
    
    runUpdate();
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
        exchangeRateEurUsd: fxRate
      })
    }
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar esta transacción?')) {
      const runDelete = async () => {
        try {
          await api.deleteTransaction(id);
          await refetchData();
          await refetchPortfolio();
        } catch (error) {
          console.error("Error deleting stock transaction", error);
          alert("Error eliminando la transacción");
        }
      };
      runDelete();
    }
  }

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

      {/* Métricas (all in EUR) */}
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
          subtitle={portfolioLoading ? 'Cargando...' : `P&L actual (${portfolioMetrics.totalInvestment > 0 ? (portfolioMetrics.unrealizedGains / portfolioMetrics.totalInvestment * 100).toFixed(1) + '%' : '0%'})`}
          color={portfolioMetrics.unrealizedGains >= 0 ? 'text-emerald-500' : 'text-rose-500'}
        />
        <MetricCard
          title="Tickers"
          value={portfolioLoading ? 'Cargando...' : portfolioMetrics.tickers.length}
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
                    <span className="text-sm text-slate-600 dark:text-slate-400">{data.shares.toLocaleString('es-ES', { maximumFractionDigits: 4 })} acciones</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Precio Medio: {formatUSD(data.avgPriceUSD)} ({formatCurrency(Math.round(data.avgPriceEUR))})
                    </span>
                    <span className="font-bold dark:text-white">Inversión: {formatCurrency(Math.round(data.costEUR))}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-600 dark:text-slate-400">Valor actual: {formatCurrency(Math.round(data.currentValue))}</span>
                    <span className="text-slate-600 dark:text-slate-400">Precio: {formatCurrency(Math.round(data.lastPrice))}/acción</span>
                  </div>
                  {/* P&L per ticker */}
                  <div className="flex justify-between items-center text-sm mt-1 border-t border-slate-200 dark:border-slate-700 pt-1">
                    <span className="text-slate-600 dark:text-slate-400">P&L Actual:</span>
                    <span className={`font-bold ${data.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                       {data.unrealizedGain >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(Math.round(data.unrealizedGain)))} ({data.unrealizedGainPercent.toFixed(1)}%)
                    </span>
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

      {/* Tabla de Transacciones (amounts in USD) */}
      <Card title="Historial de Transacciones" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th 
                  onClick={() => {
                    if (sortColumn === 'transactionDate') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('transactionDate')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-2">
                    Fecha
                    {sortColumn === 'transactionDate' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
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
                    if (sortColumn === 'quantity') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('quantity')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Acciones
                    {sortColumn === 'quantity' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
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
                >
                  <div className="flex items-center justify-end gap-2">
                    Precio ($)
                    {sortColumn === 'price' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">
                  Ratio (€/$)
                </th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">
                  Inversión (€)
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
                    Comisión ($)
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
                    Total ($)
                    {sortColumn === 'total' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="py-3 px-4 font-semibold dark:text-white">{formatDate(tx.transactionDate)}</td>
                  <td className="py-3 px-4 font-bold dark:text-white">{tx.ticker}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      tx.type === 'BUY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200'
                    }`}>
                      {tx.type === 'BUY' ? '▲ Compra' : '▼ Venta'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{tx.quantity}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-600 dark:text-slate-300">{formatUSD(tx.pricePerUnit)}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{(tx.exchangeRateEurUsd || 1.08).toFixed(4)}</td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(tx.totalAmount / (tx.exchangeRateEurUsd || 1.08))}
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{formatUSD(tx.fees)}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{formatUSD(tx.totalAmount)}</td>
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
            label="Tipo de Cambio (1€ = X$)"
            type="number"
            value={formData.exchangeRateEurUsd}
            onChange={(e) => setFormData({ ...formData, exchangeRateEurUsd: parseFloat(e.target.value) || 1.08 })}
            step="0.0001"
            min="0.0001"
            required
          />
          <p className="text-xs text-slate-500 mt-1 italic">
            * Ratio aplicado para calcular el coste base real en euros.
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
