import React, { useState, useMemo, useCallback } from 'react'
import { Trash2, Plus, Edit3, ArrowUp, ArrowDown } from 'lucide-react'
import { useWealth } from '../context/WealthContext'
import { Card } from '../components/ui/Card'
import { MetricCard } from '../components/ui/MetricCard'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, formatDate, generateUUID, isCurrentMonth, getMonthFromDate } from '../utils'
import type { Transaction } from '../types'

interface FormData {
  date: string
  type: 'buy' | 'sell'
  amountEUR: number
  meanPrice: number
}

const INITIAL_FORM_DATA: FormData = {
  date: new Date().toISOString().split('T')[0],
  type: 'buy',
  amountEUR: 0,
  meanPrice: 0
}

export default function Bitcoin() {
  const { transactions, setTransactions, assets, history } = useWealth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [sortColumn, setSortColumn] = useState<'date' | 'type' | 'amount' | 'cost' | 'meanPrice'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA)

  // Encontrar el activo de Bitcoin para obtener su NAV del historial
  const btcAsset = useMemo(() => {
    return assets.find(a => a.name.toLowerCase().includes('bitcoin') || a.category === 'Crypto')
  }, [assets])

  const validTransactions = useMemo(() => {
    if (!btcAsset) return []
    return transactions.filter((t: any) => t.assetId === btcAsset.id)
  }, [transactions, btcAsset])
  
  // Obtener el último NAV para el activo de Bitcoin
  const assetLatestNAV = useMemo(() => {
    if (!btcAsset || !history) return 0
    const assetHistory = history.filter((h: any) => h.assetId === btcAsset.id)
    if (assetHistory.length === 0) return 0
    // Ordenar por mes (descendente) y obtener el último
    const sorted = [...assetHistory].sort((a, b) => b.month.localeCompare(a.month))
    return sorted[0].nav || 0
  }, [btcAsset, history])
  
  // Portfolio calculations con coste base real
  let currentBtcShares = 0
  let currentBtcCost = 0
  
  validTransactions.forEach((tx: any) => {
     if (tx.type === 'buy') {
        currentBtcShares += (tx.quantity || 0)
        currentBtcCost += (tx.totalAmount || 0)
     } else {
        const avg = currentBtcShares > 0 ? currentBtcCost / currentBtcShares : 0
        currentBtcShares -= (tx.quantity || 0)
        currentBtcCost -= ((tx.quantity || 0) * avg)
     }
  })
  
  const totalBTC = currentBtcShares
  const totalInvested = currentBtcCost
  const meanPrice = totalBTC > 0 ? totalInvested / totalBTC : 0
  
  const currentBTCValue = assetLatestNAV > 0 
    ? assetLatestNAV 
    : (totalBTC * (validTransactions[validTransactions.length - 1]?.pricePerUnit || 0))
    
  const unrealizedGain = currentBTCValue - totalInvested

  // Función para ordenar transacciones
  const getSortedTransactions = useCallback((txs: Transaction[], column: 'date' | 'type' | 'amount' | 'cost' | 'meanPrice', direction: 'asc' | 'desc') => {
    const sorted = [...txs]
    const isAsc = direction === 'asc'
    
    switch (column) {
      case 'date':
        return sorted.sort((a, b) => {
          const timeA = new Date(a.date || '').getTime()
          const timeB = new Date(b.date || '').getTime()
          return isAsc ? timeA - timeB : timeB - timeA
        })
      case 'type':
        return sorted.sort((a, b) => {
          const cmp = (a.type || '').localeCompare(b.type || '')
          return isAsc ? cmp : -cmp
        })
      case 'amount':
        return sorted.sort((a, b) => {
          const diff = (a.quantity || 0) - (b.quantity || 0)
          return isAsc ? diff : -diff
        })
      case 'cost':
        return sorted.sort((a, b) => {
          const diff = (a.totalAmount || 0) - (b.totalAmount || 0)
          return isAsc ? diff : -diff
        })
      case 'meanPrice':
        return sorted.sort((a, b) => {
          const diff = (a.pricePerUnit || 0) - (b.pricePerUnit || 0)
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

  const createTransaction = useCallback((data: FormData): Transaction => {
    const amountBTC = data.amountEUR / data.meanPrice
    return {
      id: generateUUID(),
      assetId: btcAsset?.id || 'a4',
      ticker: btcAsset?.ticker || 'BTC-EUR',
      date: data.date,
      type: data.type,
      quantity: amountBTC,
      fees: 0,
      totalAmount: data.amountEUR,
      pricePerUnit: data.meanPrice
    }
  }, [btcAsset])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (formData.amountEUR <= 0 || formData.meanPrice <= 0) return

    // Validación: solo permitir editar transacciones del mes actual
    if (editingTransaction && !isCurrentMonth(getMonthFromDate(editingTransaction.date || ''))) {
      alert('No se pueden editar transacciones de meses anteriores')
      return
    }
    
    // Si no estamos editando, solo permitir crear transacciones del mes actual
    if (!editingTransaction && !isCurrentMonth(getMonthFromDate(formData.date))) {
      alert('Solo se pueden crear transacciones del mes actual')
      return
    }

    if (editingTransaction) {
      setTransactions(transactions.map((t: any) =>
        t.id === editingTransaction.id ? { ...createTransaction(formData), id: t.id } : t
      ))
    } else {
      setTransactions([...transactions, createTransaction(formData)])
    }
    
    setIsModalOpen(false)
    setEditingTransaction(null)
    setFormData(INITIAL_FORM_DATA)
  }, [formData, editingTransaction, transactions, createTransaction, setTransactions])

  const handleOpenModal = useCallback((transaction?: Transaction) => {
    // Solo permitir editar transacciones del mes actual
    if (transaction && !isCurrentMonth(getMonthFromDate(transaction.date || ''))) {
      return
    }
    
    if (transaction) {
      setEditingTransaction(transaction)
      setFormData({
        date: transaction.date,
        type: transaction.type,
        amountEUR: transaction.totalAmount,
        meanPrice: transaction.pricePerUnit
      })
    } else {
      setEditingTransaction(null)
      setFormData(INITIAL_FORM_DATA)
    }
    setIsModalOpen(true)
  }, [])

  const handleDelete = useCallback((id: string) => {
    const transaction = transactions.find((t: any) => t.id === id)
    
    // Solo permitir eliminar transacciones del mes actual
    if (transaction && !isCurrentMonth(getMonthFromDate(transaction.date || ''))) {
      alert('No se pueden eliminar transacciones de meses anteriores')
      return
    }
    
    if (confirm('¿Está seguro de que desea eliminar esta transacción?')) {
      setTransactions(transactions.filter((t: any) => t.id !== id))
    }
  }, [transactions, setTransactions])

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

      {/* Tabla de Transacciones */}
      <Card title="Historial de Transacciones">
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
                    if (sortColumn === 'meanPrice') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('meanPrice')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Precio Medio
                    {sortColumn === 'meanPrice' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
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
                  <td className="py-3 px-4 font-semibold dark:text-white">{formatDate(tx.date || '')}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      tx.type === 'buy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200'
                    }`}>
                      {tx.type === 'buy' ? '▲ Compra' : '▼ Venta'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{(tx.quantity || 0).toFixed(6)}</td>
                  <td className="py-3 px-4 text-right font-bold dark:text-white">{formatCurrency(Math.round(tx.totalAmount || 0))}</td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600">{formatCurrency(Math.round(tx.pricePerUnit || 0))}</td>
                  <td className="py-3 px-4 text-center flex gap-2 justify-center">
                    {isCurrentMonth(getMonthFromDate(tx.date || '')) ? (
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
            label="Cantidad (EUR)"
            type="number"
            value={formData.amountEUR}
            onChange={(e) => setFormData({ ...formData, amountEUR: parseFloat(e.target.value) })}
            step="0.01"
            min="0"
            required
          />

          <Input
            label="Precio Medio (EUR)"
            type="number"
            value={formData.meanPrice}
            onChange={(e) => setFormData({ ...formData, meanPrice: parseFloat(e.target.value) })}
            step="0.01"
            min="0"
            required
          />

          {formData.amountEUR > 0 && formData.meanPrice > 0 && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong>BTC a recibir:</strong> {(formData.amountEUR / formData.meanPrice).toFixed(6)} BTC
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
