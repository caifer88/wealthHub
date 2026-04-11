import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Trash2, Plus, Edit3, ArrowUp, ArrowDown } from 'lucide-react'
import { useWealthData } from '../hooks'
import { Card } from '../components/ui/Card'
import { MetricCard } from '../components/ui/MetricCard'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, formatDate, generateUUID, isCurrentMonth, getMonthFromDate } from '../utils'
import type { BitcoinTransaction, Asset, HistoryEntry } from '../types'
import { config } from '../config'
import { api } from '../services/api'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ZAxis
} from 'recharts'

interface FormData {
  transactionDate: string
  type: 'BUY' | 'SELL'
  amountBtc: number
  priceEurPerBtc: number
}

const INITIAL_FORM_DATA: FormData = {
  transactionDate: new Date().toISOString().split('T')[0],
  type: 'BUY',
  amountBtc: 0,
  priceEurPerBtc: 0
}

export default function Bitcoin() {
  const { bitcoinTransactions, refetchData, assets, history } = useWealthData()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<BitcoinTransaction | null>(null)
  const [sortColumn, setSortColumn] = useState<'transactionDate' | 'type' | 'amount' | 'cost' | 'priceEurPerBtc'>('transactionDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA)
  
  // Estado para el gráfico
  const [historicalPrices, setHistoricalPrices] = useState<{date: string, price: number}[]>([])
  const [isLoadingChart, setIsLoadingChart] = useState(false)

  const validTransactions = bitcoinTransactions

  // Obtener precios históricos al montar el componente
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setIsLoadingChart(true)
        const res = await fetch(`${config.backendUrl}/api/bitcoin/historical-prices`)
        if (res.ok) {
          const data = await res.json()
          setHistoricalPrices(data)
        }
      } catch (error) {
        console.error('Error fetching historical BTC prices', error)
      } finally {
        setIsLoadingChart(false)
      }
    }
    fetchPrices()
  }, [])

  // Preparar datos fusionados para el ComposedChart (Línea de precio + Puntos de compra)
  const chartData = useMemo(() => {
    const data: any[] = []
    
    // 1. Añadir el historial de precios
    historicalPrices.forEach(hp => {
      data.push({
        time: new Date(hp.date).getTime(),
        dateStr: hp.date,
        price: hp.price,
      })
    })

    // 2. Añadir las compras como puntos sueltos
    validTransactions.filter((tx: BitcoinTransaction) => tx.type === 'BUY').forEach((tx: BitcoinTransaction) => {
      if (!tx.transactionDate || !tx.amountBtc) return
      data.push({
        time: new Date(tx.transactionDate).getTime(),
        dateStr: tx.transactionDate,
        buyPrice: tx.priceEurPerBtc,
        amountBTC: tx.amountBtc,
        cost: tx.totalAmountEur
      })
    })

    // Ordenar cronológicamente todo el conjunto
    return data.sort((a: any, b: any) => a.time - b.time)
  }, [historicalPrices, validTransactions])


  const btcAsset = useMemo(() => {
    return assets.find((a: Asset) => a.name.toLowerCase().includes('bitcoin') || a.category === 'Crypto')
  }, [assets])
  
  const assetLatestNAV = useMemo(() => {
    if (!btcAsset || !history) return 0
    const assetHistory = history.filter((h: HistoryEntry) => h.asset_id === btcAsset.id)
    if (assetHistory.length === 0) return 0
    const sorted = [...assetHistory].sort((a: HistoryEntry, b: HistoryEntry) => b.month.localeCompare(a.month))
    return sorted[0].nav || 0
  }, [btcAsset, history])
  
  let currentBtcShares = 0
  let currentBtcCost = 0
  
  validTransactions.forEach((tx: BitcoinTransaction) => {
     if (tx.type === 'BUY') {
        currentBtcShares += (tx.amountBtc || 0)
        currentBtcCost += (tx.totalAmountEur || 0)
     } else {
        const avg = currentBtcShares > 0 ? currentBtcCost / currentBtcShares : 0
        currentBtcShares -= (tx.amountBtc || 0)
        currentBtcCost -= ((tx.amountBtc || 0) * avg)
     }
  })
  
  const totalBTC = currentBtcShares
  const totalInvested = currentBtcCost
  const meanPrice = totalBTC > 0 ? totalInvested / totalBTC : 0
  
  const currentBTCValue = assetLatestNAV > 0 
    ? assetLatestNAV 
    : (totalBTC * (validTransactions[validTransactions.length - 1]?.priceEurPerBtc || 0))
    
  const unrealizedGain = currentBTCValue - totalInvested

  const getSortedTransactions = useCallback((txs: BitcoinTransaction[], column: 'transactionDate' | 'type' | 'amount' | 'cost' | 'priceEurPerBtc', direction: 'asc' | 'desc') => {
    const sorted = [...txs]
    const isAsc = direction === 'asc'
    
    switch (column) {
      case 'transactionDate':
        return sorted.sort((a, b) => {
          const timeA = new Date(a.transactionDate || '').getTime()
          const timeB = new Date(b.transactionDate || '').getTime()
          return isAsc ? timeA - timeB : timeB - timeA
        })
      case 'type':
        return sorted.sort((a, b) => {
          const cmp = (a.type || '').localeCompare(b.type || '')
          return isAsc ? cmp : -cmp
        })
      case 'amount':
        return sorted.sort((a, b) => {
          const diff = (a.amountBtc || 0) - (b.amountBtc || 0)
          return isAsc ? diff : -diff
        })
      case 'cost':
        return sorted.sort((a, b) => {
          const diff = (a.totalAmountEur || 0) - (b.totalAmountEur || 0)
          return isAsc ? diff : -diff
        })
      case 'priceEurPerBtc':
        return sorted.sort((a, b) => {
          const diff = (a.priceEurPerBtc || 0) - (b.priceEurPerBtc || 0)
          return isAsc ? diff : -diff
        })
      default:
        return sorted
    }
  }, [])

  const sortedTransactions = useMemo(
    () => getSortedTransactions(validTransactions, sortColumn, sortDirection),
    [validTransactions, sortColumn, sortDirection, getSortedTransactions]
  )

  const createTransaction = useCallback((data: FormData): Partial<BitcoinTransaction> => {
    const amountBtc = data.amountBtc
    return {
      id: generateUUID(),
      transactionDate: data.transactionDate,
      type: data.type,
      amountBtc,
      totalAmountEur: data.amountBtc * data.priceEurPerBtc,
      priceEurPerBtc: data.priceEurPerBtc
    }
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (formData.amountBtc <= 0 || formData.priceEurPerBtc <= 0) return

    if (editingTransaction && !isCurrentMonth(getMonthFromDate(editingTransaction.transactionDate || ''))) {
      alert('No se pueden editar transacciones de meses anteriores')
      return
    }
    
    if (!editingTransaction && !isCurrentMonth(getMonthFromDate(formData.transactionDate))) {
      alert('Solo se pueden crear transacciones del mes actual')
      return
    }

    const runUpdate = async () => {
      try {
        const txData = createTransaction(formData);
        
        const btcAsset = assets.find((a: Asset) => a.name.toLowerCase().includes('bitcoin') || a.category === 'Crypto')
        const assetId = btcAsset ? btcAsset.id : undefined;

        const backendPayload = {
            id: txData.id,
            assetId: assetId,
            transactionDate: txData.transactionDate,
            type: txData.type,
            amountBtc: txData.amountBtc,
            priceEurPerBtc: txData.priceEurPerBtc,
            feesEur: 0,
            totalAmountEur: txData.totalAmountEur,
            exchangeRateUsdEur: 0, // Se obtiene automáticamente del backend según la fecha
        };

        if (editingTransaction) {
          await api.updateBitcoinTransaction(editingTransaction.id, backendPayload as any);
        } else {
          await api.createBitcoinTransaction(backendPayload as any);
        }
        
        await refetchData();
        
        setIsModalOpen(false);
        setEditingTransaction(null);
        setFormData(INITIAL_FORM_DATA);
      } catch (error) {
        console.error("Error saving transaction", error);
        alert("Error guardando la transacción");
      }
    };
    
    runUpdate();
  }, [formData, editingTransaction, createTransaction, refetchData, assets])

  const handleOpenModal = useCallback((transaction?: BitcoinTransaction) => {
    if (transaction && !isCurrentMonth(getMonthFromDate(transaction.transactionDate || ''))) {
      return
    }
    
    if (transaction) {
      setEditingTransaction(transaction)
      setFormData({
        transactionDate: transaction.transactionDate,
        type: transaction.type,
        amountBtc: transaction.amountBtc,
        priceEurPerBtc: transaction.priceEurPerBtc
      })
    } else {
      setEditingTransaction(null)
      setFormData(INITIAL_FORM_DATA)
    }
    setIsModalOpen(true)
  }, [])

  const handleDelete = useCallback((id: string) => {
    const transaction = bitcoinTransactions.find((t: BitcoinTransaction) => t.id === id)
    
    if (transaction && !isCurrentMonth(getMonthFromDate(transaction.transactionDate || ''))) {
      alert('No se pueden eliminar transacciones de meses anteriores')
      return
    }
    
    if (confirm('¿Está seguro de que desea eliminar esta transacción?')) {
      const runDelete = async () => {
        try {
          await api.deleteBitcoinTransaction(id);
          await refetchData();
        } catch (error) {
          console.error("Error deleting transaction", error);
          alert("Error eliminando la transacción");
        }
      };
      runDelete();
    }
  }, [bitcoinTransactions, refetchData])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingTransaction(null)
  }, [])

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
            Gestor de Bitcoin
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Gestiona tu cartera de Bitcoin
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
          title="BTC Balance"
          value={`${totalBTC.toFixed(4)}`}
          subtitle="Bitcoin poseído"
          color="text-amber-600"
        />
        <MetricCard
          title="Coste Total"
          value={formatCurrency(Math.round(totalInvested))}
          subtitle="Invertido acumulado"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Precio Medio"
          value={formatCurrency(Math.round(meanPrice))}
          subtitle="Por Bitcoin"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Transacciones"
          value={validTransactions.length}
          subtitle="Compras realizadas"
          color="text-slate-900 dark:text-white"
        />
        <MetricCard
          title="Ganancia/Pérdida"
          value={formatCurrency(Math.round(unrealizedGain))}
          subtitle="No realizada"
          color={unrealizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500'}
        />
      </div>

      {/* Gráfico Temporal */}
      <Card title="Evolución y Compras (Últimos 5 años)">
        <div className="h-[400px] w-full mt-4">
          {isLoadingChart ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis 
                  dataKey="time" 
                  type="number" 
                  scale="time"
                  domain={['dataMin', 'dataMax']} 
                  tickFormatter={(tick) => {
                    return new Date(tick).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                  }}
                  stroke="#888888"
                  fontSize={12}
                  tickMargin={10}
                />
                <YAxis 
                  yAxisId="price"
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`}
                  stroke="#888888"
                  fontSize={12}
                  tickMargin={10}
                />
                {/* ZAxis controla el tamaño del punto entre el rango mínimo y máximo de área [30, 600] */}
                <ZAxis dataKey="amountBTC" range={[30, 800]} />
                
                <RechartsTooltip 
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  formatter={(value: number, name: string, props: any) => {
                    if (name === 'Precio BTC (€)') return [formatCurrency(value), name]
                    if (name === 'Compra') {
                      const p = props.payload
                      return [
                        `${formatCurrency(value)} (${p.amountBTC.toFixed(4)} BTC = ${formatCurrency(p.cost)})`, 
                        name
                      ]
                    }
                    return [value, name]
                  }}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                
                <Line 
                  yAxisId="price"
                  type="monotone" 
                  dataKey="price" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false} 
                  name="Precio BTC (€)" 
                  connectNulls={true}
                />
                <Scatter 
                  yAxisId="price"
                  dataKey="buyPrice" 
                  fill="#10b981" 
                  name="Compra" 
                  shape="circle"
                  fillOpacity={0.8}
                  stroke="#fff"
                  strokeWidth={1}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              No hay datos históricos disponibles
            </div>
          )}
        </div>
      </Card>

      {/* Tabla de Transacciones */}
      <Card title="Historial de Transacciones">
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
                    if (sortColumn === 'amount') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('amount')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Cantidad (BTC)
                    {sortColumn === 'amount' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'cost') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('cost')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Coste Total
                    {sortColumn === 'cost' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'priceEurPerBtc') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('priceEurPerBtc')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Precio Medio
                    {sortColumn === 'priceEurPerBtc' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map(tx => {
                if (!tx || !tx.id) return null
                return (
                <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="py-3 px-4 font-semibold dark:text-white">{formatDate(tx.transactionDate || '')}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      tx.type === 'BUY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200'
                    }`}>
                      {tx.type === 'BUY' ? '▲ Compra' : '▼ Venta'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{(tx.amountBtc || 0).toFixed(6)}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{formatCurrency(Math.round(tx.totalAmountEur || 0))}</td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600">{formatCurrency(Math.round(tx.priceEurPerBtc || 0))}</td>
                  <td className="py-3 px-4 text-center flex gap-2 justify-center">
                    {isCurrentMonth(getMonthFromDate(tx.transactionDate || '')) ? (
                      <>
                        <button
                          onClick={() => handleOpenModal(tx)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit3 size={14} className="text-blue-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} className="text-rose-500" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Mes anterior
                      </span>
                    )}
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>

        {sortedTransactions.length === 0 && (
          <p className="text-center text-slate-600 dark:text-slate-400 py-8">
            Sin transacciones aún
          </p>
        )}
      </Card>

      {/* Modal de Nueva/Editar Transacción */}
      <Modal
        isOpen={isModalOpen}
        title={editingTransaction ? 'Editar Transacción Bitcoin' : 'Nueva Transacción Bitcoin'}
        onClose={handleCloseModal}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
            label="Cantidad (BTC)"
            type="number"
            value={formData.amountBtc}
            onChange={(e) => setFormData({ ...formData, amountBtc: parseFloat(e.target.value) || 0 })}
            step="0.000001"
            min="0"
            required
          />

          <Input
            label="Precio por BTC (EUR)"
            type="number"
            value={formData.priceEurPerBtc}
            onChange={(e) => setFormData({ ...formData, priceEurPerBtc: parseFloat(e.target.value) || 0 })}
            step="0.01"
            min="0"
            required
          />

          {formData.amountBtc > 0 && formData.priceEurPerBtc > 0 && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong>Coste Total (EUR):</strong> {(formData.amountBtc * formData.priceEurPerBtc).toFixed(2)} EUR
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}