import React, { useState, useCallback } from 'react'
import { Trash2, Edit3, Plus, Archive, ArchiveX } from 'lucide-react'
import { useWealth } from '../context/WealthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MetricCard } from '../components/ui/MetricCard'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, generateUUID, calculateMeanCost, calculateTotalInvested, getCurrentParticipations, formatCurrencyDecimals } from '../utils'
import type { Asset } from '../types'

export default function Assets() {
  const { assets, setAssets, history, transactions, saveDataToBackend } = useWealth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [sortColumn] = useState<'name' | 'category' | 'value' | 'percentage'>('name')
  const [sortDirection] = useState<'asc' | 'desc'>('asc')
  const [showArchived, setShowArchived] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: 'Fund',
    color: '#6366f1',
    riskLevel: 'Medio',
    archived: false,
    isin: '',
    ticker: '',
    participations: 0,
    meanCost: 0
  })

  const categories = ['Fund', 'Cash', 'Crypto', 'Stocks', 'Plan de pensiones']
  const colors = ['#6366f1', '#0f1010', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
  const riskLevels = ['Bajo', 'Medio', 'Alto']

  // Show active assets if showArchived is false, otherwise show all
  const displayedAssets = showArchived ? assets : assets.filter(a => !a.archived)
  
  // Get the latest month from history
  const getLatestMonth = (): string | null => {
    if (history.length === 0) return null
    const months = [...new Set(history.map(h => h.month))].sort().reverse()
    return months[0] || null
  }

  // Calculate current NAV from latest history entry for each asset
  const getAssetNAV = (assetId: string): number => {
    const assetHistory = history.filter(h => h.assetId === assetId)
    if (assetHistory.length === 0) return 0
    // Get the last entry by date
    const sorted = [...assetHistory].sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
    return sorted[0].nav || 0
  }

  // Get NAV from the latest month, fallback to most recent if not available
  const getAssetNAVFromLatestMonth = (assetId: string): number => {
    const latestMonth = getLatestMonth()
    if (!latestMonth) return 0
    
    const entryInLatestMonth = history.find(h => h.assetId === assetId && h.month === latestMonth)
    if (entryInLatestMonth) {
      return entryInLatestMonth.nav || 0
    }
    
    // Fallback to most recent if not in latest month
    return getAssetNAV(assetId)
  }

  const getSortedAssets = useCallback((assets: (Asset & { currentNAV: number })[], column: 'name' | 'category' | 'value' | 'percentage', direction: 'asc' | 'desc', totalNav: number) => {
    const sorted = [...assets]
    const isAsc = direction === 'asc'
    
    switch (column) {
      case 'name':
        return sorted.sort((a, b) => isAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
      case 'category':
        return sorted.sort((a, b) => isAsc ? a.category.localeCompare(b.category) : b.category.localeCompare(a.category))
      case 'value':
        return sorted.sort((a, b) => isAsc ? a.currentNAV - b.currentNAV : b.currentNAV - a.currentNAV)
      case 'percentage':
        return sorted.sort((a, b) => {
          const percentA = totalNav > 0 ? (a.currentNAV / totalNav) * 100 : 0
          const percentB = totalNav > 0 ? (b.currentNAV / totalNav) * 100 : 0
          return isAsc ? percentA - percentB : percentB - percentA
        })
      default:
        return sorted
    }
  }, [])

  // Función para calcular el NAV correcto de un activo considerando componentes, usando el último mes
  const getAssetValueWithComponents = (asset: Asset): number => {
    const componentAssets = assets.filter(a => 
      a.name && asset.name && a.name.length < asset.name.length && asset.name.includes(a.name) && a.id !== asset.id
    )
    
    if (componentAssets.length > 0) {
      // Si tiene componentes, retornar la suma
      return componentAssets.reduce((sum, comp) => sum + getAssetNAVFromLatestMonth(comp.id), 0)
    }
    
    // Si no tiene componentes, retornar su NAV directo del último mes
    return getAssetNAVFromLatestMonth(asset.id)
  }

  const assetValues = assets.map(a => ({
    ...a,
    currentNAV: getAssetValueWithComponents(a)
  }))

  const totalNAV = assetValues.filter(a => !a.archived).reduce((sum, a) => {
    const ibAsset = assets.find(parent => parent.name === 'Interactive Brokers' || parent.category === 'Stocks')
    const isIBActive = !!ibAsset
    const isStockInIB = isIBActive && a.ticker && transactions.some((tx: any) => tx.assetId === ibAsset.id && tx.ticker === a.ticker)
    const isComponent = assets.some(parent => parent.name && a.name && parent.name.length > a.name.length && parent.name.includes(a.name) && parent.id !== a.id)
    
    if (isStockInIB || isComponent) return sum
    return sum + a.currentNAV
  }, 0)
  
  const displayedAssetValues = assetValues.filter(showArchived ? () => true : a => !a.archived)
  const sortedAssetValues = getSortedAssets(displayedAssetValues, sortColumn, sortDirection, totalNAV)

  const handleOpenModal = (asset?: Asset) => {
    if (asset) {
      setEditingAsset(asset)
      setFormData({
        name: asset.name,
        category: asset.category,
        color: asset.color,
        riskLevel: asset.riskLevel || 'Medio',
        archived: asset.archived || false,
        isin: asset.isin || '',
        ticker: asset.ticker || '',
        participations: asset.participations || 0,
        meanCost: asset.meanCost || 0
      })
    } else {
      setEditingAsset(null)
      setFormData({
        name: '',
        category: 'Fund',
        color: '#6366f1',
        riskLevel: 'Medio',
        archived: false,
        isin: '',
        ticker: '',
        participations: 0,
        meanCost: 0
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) return

    if (editingAsset) {
      const updatedAssets = assets.map(a =>
        a.id === editingAsset.id
          ? { 
              ...a, 
              name: formData.name,
              category: formData.category,
              color: formData.color,
              riskLevel: formData.riskLevel,
              archived: formData.archived,
              isin: formData.isin || undefined,
              ticker: formData.ticker || undefined,
              participations: formData.participations,
              meanCost: formData.meanCost
            }
          : a
      )
      setAssets(updatedAssets)
      
      // Sync with Backend if archived status changed
      if (editingAsset.archived !== formData.archived) {
        saveDataToBackend(updatedAssets, history, transactions)
      }
    } else {
      const newAsset: Asset = {
        id: generateUUID(),
        name: formData.name,
        category: formData.category,
        color: formData.color,
        riskLevel: formData.riskLevel,
        archived: false,
        isin: formData.isin || undefined,
        ticker: formData.ticker || undefined,
        participations: formData.participations,
        meanCost: formData.meanCost
      }
      setAssets([...assets, newAsset])
    }

    setIsModalOpen(false)
    setEditingAsset(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar este activo?')) {
      const updatedAssets = assets.map(a => a.id === id ? { ...a, archived: true } : a)
      setAssets(updatedAssets)
      saveDataToBackend(updatedAssets, history, transactions)
    }
  }

  const handleToggleArchived = (id: string) => {
    const updatedAssets = assets.map(a => 
      a.id === id ? { ...a, archived: !a.archived } : a
    )
    setAssets(updatedAssets)
    saveDataToBackend(updatedAssets, history, transactions)
  }

  const getArchivedCount = (): number => {
    return assets.filter(a => a.archived).length
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
            Gestión de Activos
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Administra tu cartera de inversión
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => handleOpenModal()}>
            <Plus size={20} className="inline mr-2" />
            Nuevo Activo
          </Button>
        </div>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Patrimonio"
          value={formatCurrency(Math.round(totalNAV))}
          subtitle="Valor actual NAV"
        />
        <MetricCard
          title="Activos"
          value={displayedAssets.length}
          subtitle="Número de activos"
        />
      </div>

      {/* Botón para mostrar/ocultar archivados */}
      {getArchivedCount() > 0 && (
        <div className="flex gap-2">
          <Button 
            variant={showArchived ? "primary" : "secondary"}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? (
              <>
                <Archive size={16} className="mr-2" />
                Ocultar archivados ({getArchivedCount()})
              </>
            ) : (
              <>
                <ArchiveX size={16} className="mr-2" />
                Mostrar archivados ({getArchivedCount()})
              </>
            )}
          </Button>
        </div>
      )}

      {/* Vista de Activos - Grid de tarjetas compactas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedAssetValues.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400 mb-4">No hay activos para mostrar</p>
                <Button variant="primary" onClick={() => handleOpenModal()}>
                  <Plus size={16} className="mr-2" />
                  Crear primer activo
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          sortedAssetValues.map(asset => {
            let participations = getCurrentParticipations(asset.id, history)
            let meanCost = calculateMeanCost(asset.id, history)
            let invested = calculateTotalInvested(asset.id, history)
            
            // 🟢 FIX 1: Si es Bitcoin/Crypto, sobreescribir con los datos de sus transacciones reales
            if (asset.category === 'Crypto' || asset.name.toLowerCase().includes('bitcoin')) {
              let btcShares = 0
              let btcCost = 0
              const cryptoTxs = transactions.filter((t: any) => t.assetId === asset.id)
              cryptoTxs.forEach((tx: any) => {
                if (tx.type === 'buy') {
                  btcShares += (tx.quantity || 0)
                  btcCost += (tx.totalAmount || 0)
                } else {
                  const avg = btcShares > 0 ? btcCost / btcShares : 0
                  btcShares -= (tx.quantity || 0)
                  btcCost -= ((tx.quantity || 0) * avg)
                }
              })
              participations = btcShares
              invested = btcCost
              meanCost = btcShares > 0 ? btcCost / btcShares : 0
            }

            const currentValue = asset.currentNAV
            const liquidNavValue = participations > 0 ? currentValue / participations : 0
            
            // Activo especial: Cash - mostrar solo valor
            if (asset.name === 'Cash') {
              // ... (mantenlo igual)
              return (
                <Card key={asset.id} className="overflow-hidden transition-all hover:shadow-lg flex flex-col justify-center items-center py-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Efectivo Disponible</p>
                    <p className="text-4xl font-black dark:text-white">{formatCurrency(Math.round(currentValue))}</p>
                  </div>
                </Card>
              )
            }
            
            let positionsData: Array<{ticker: string; nav: number; shares: number; avgPrice: number}> = []
            
            if (asset.name === 'Interactive Brokers' || asset.category === 'Stocks') {
              const ibTransactions = transactions.filter((tx: any) => tx.assetId === asset.id)
              const tickerMap = new Map<string, {shares: number; totalCost: number}>()
              
              for (const tx of ibTransactions) {
                if (!tx.ticker) continue
                const existing = tickerMap.get(tx.ticker) || {shares: 0, totalCost: 0}
                if (tx.type === 'buy') {
                  existing.shares += tx.quantity
                  existing.totalCost += tx.totalAmount
                } else {
                  // 🟢 FIX 2: Restar ventas basándose en el precio medio para no corromper la inversión real
                  const avgPrice = existing.shares > 0 ? existing.totalCost / existing.shares : 0
                  existing.shares -= tx.quantity
                  existing.totalCost -= (tx.quantity * avgPrice)
                }
                tickerMap.set(tx.ticker, existing)
              }
              
              for (const [ticker, data] of tickerMap.entries()) {
                if (data.shares > 0) {
                  const searchTicker = ticker.trim().toUpperCase()
                  const tickerAsset = assets.find(a => 
                    (a.ticker && a.ticker.trim().toUpperCase() === searchTicker) || 
                    (a.name && a.name.trim().toUpperCase() === searchTicker)
                  )
                  
                  // BUSCAR PRIMERO EN EL ACTIVO, SI NO, EN EL TICKER VIRTUAL (fakeAssetId)
                  let lastHistory = null
                  if (tickerAsset) {
                    lastHistory = history.filter(h => h.assetId === tickerAsset.id).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
                  }
                  if (!lastHistory) {
                    const fakeAssetId = `ticker-${searchTicker}`
                    lastHistory = history.filter(h => h.assetId === fakeAssetId).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
                  }
                  
                  // --- AQUÍ FALTABA ESTO: CALCULAR EL PRECIO ACTUAL ---
                  let currentPrice = data.totalCost / data.shares
                  
                  if (lastHistory) {
                    if (lastHistory.liquidNavValue > 0) {
                      currentPrice = lastHistory.liquidNavValue
                    } else if (lastHistory.nav > 0 && lastHistory.participations > 0) {
                      currentPrice = lastHistory.nav / lastHistory.participations
                    } else if (lastHistory.nav > 0) {
                      currentPrice = lastHistory.nav / data.shares
                    }
                  }
                  // ---------------------------------------------------
                  
                  const nav = data.shares * currentPrice
                  const avgPrice = data.totalCost / data.shares
                  
                  positionsData.push({ ticker, nav, shares: data.shares, avgPrice })
                }
              }
            } else {
              // Para otros activos, buscar por nombre
              const componentAssets = assets.filter(a => 
                a.name && asset.name && a.name.length < asset.name.length && asset.name.includes(a.name) && a.id !== asset.id
              )
              positionsData = componentAssets.map(comp => ({
                ticker: comp.ticker || comp.isin || comp.name,
                nav: getAssetNAV(comp.id),
                shares: getCurrentParticipations(comp.id, history),
                avgPrice: calculateMeanCost(comp.id, history)
              }))
            }
            
            const hasPositions = positionsData.length > 0
            
            // Usamos el currentValue (que viene directamente del Historial actualizado) 
            const valueToDisplay = currentValue
            const gainToDisplay = valueToDisplay - invested
            const gainPercentDisplay = invested > 0 ? (gainToDisplay / invested) * 100 : 0
            
            return (
              <Card 
                key={asset.id}
                className={`overflow-hidden transition-all hover:shadow-lg ${asset.archived ? 'opacity-50' : ''}`}
              >
                {/* Header compacto */}
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className={`text-base font-bold truncate ${asset.archived ? 'line-through text-slate-400' : 'dark:text-white'}`}>
                    {asset.name}
                  </h3>
                  {(asset.isin || asset.ticker) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {asset.isin || asset.ticker}
                    </p>
                  )}
                </div>

                {/* Valor de mercado principal */}
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Valor de Mercado</p>
                  <p className="text-2xl font-bold dark:text-white">{formatCurrencyDecimals(valueToDisplay, 2)}</p>
                  {hasPositions ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Suma: {positionsData.map(p => p.ticker).join(' + ')}
                    </p>
                  ) : (
                    <p className={`text-sm font-semibold mt-1 ${gainToDisplay >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {gainToDisplay >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(Math.round(gainToDisplay)))} ({gainPercentDisplay.toFixed(1)}%)
                    </p>
                  )}
                </div>

                {/* Métricas en dos columnas O Resumen de posiciones para contenedores */}
                {hasPositions ? (
                  <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">Posiciones Abiertas</p>
                    <div className="space-y-2">
                      {positionsData.map((position) => {
                        const positionInvested = position.shares * position.avgPrice
                        const positionGain = position.nav - positionInvested
                        const positionGainPercent = positionInvested > 0 ? (positionGain / positionInvested) * 100 : 0
                        
                        return (
                          <div key={position.ticker} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                            <div className="flex-1">
                              <p className="text-sm font-semibold dark:text-white">{position.ticker}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {position.shares.toLocaleString('es-ES', { maximumFractionDigits: 4 })} @ {formatCurrencyDecimals(position.avgPrice, 2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold dark:text-white">{formatCurrencyDecimals(position.nav, 2)}</p>
                              <p className={`text-sm font-bold ${positionGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {positionGain >= 0 ? '↑' : '↓'} {positionGainPercent.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Participaciones</p>
                        <p className="text-sm font-bold dark:text-white">{participations.toLocaleString('es-ES', { maximumFractionDigits: 3 })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Coste Medio</p>
                        <p className="text-sm font-bold dark:text-white">{formatCurrencyDecimals(meanCost, 2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Liquidativo</p>
                        <p className="text-sm font-bold dark:text-white">{formatCurrencyDecimals(liquidNavValue, 2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Invertido</p>
                        <p className="text-sm font-bold dark:text-white">{formatCurrency(Math.round(invested))}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Porcentaje de cartera */}
                {!asset.archived && totalNAV > 0 && (
                  <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                    <p className="text-slate-600 dark:text-slate-400">% Cartera</p>
                    <p className="font-bold text-indigo-600">
                      {((valueToDisplay / totalNAV) * 100).toFixed(1)}%
                    </p>
                  </div>
                )}

                {/* Acciones */}
                <div className="px-5 py-2 flex justify-end gap-1 bg-slate-50 dark:bg-slate-900">
                  <button
                    onClick={() => handleOpenModal(asset)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Editar"
                  >
                    <Edit3 size={14} className="text-indigo-600" />
                  </button>
                  <button
                    onClick={() => handleToggleArchived(asset.id)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title={asset.archived ? "Desarchizar" : "Archivar"}
                  >
                    {asset.archived ? (
                      <ArchiveX size={14} className="text-blue-500" />
                    ) : (
                      <Archive size={14} className="text-amber-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} className="text-rose-500" />
                  </button>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Modal de Edición */}
      <Modal
        isOpen={isModalOpen}
        title={editingAsset ? 'Editar Activo' : 'Nuevo Activo'}
        onClose={() => setIsModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre del Activo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Tesla, Bitcoin, Fondo de Pensiones"
            required
          />

          <Select
            label="Categoría"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={categories.map(c => ({ value: c, label: c }))}
          />

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {colors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color ? 'border-slate-900 dark:border-white' : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <Select
            label="Nivel de Riesgo"
            value={formData.riskLevel}
            onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
            options={riskLevels.map(r => ({ value: r, label: r }))}
          />

          <div className="border-t pt-4 space-y-4">

            <Input
              label="Número de Participaciones"
              type="number"
              value={formData.participations}
              onChange={(e) => setFormData({ ...formData, participations: parseFloat(e.target.value) || 0})}
              step="0.00001"
              min="0"
              placeholder="Ej: 100.5"
            />

            <Input
              label="Coste Medio por Participación (€)"
              type="number"
              value={formData.meanCost}
              onChange={(e) => setFormData({ ...formData, meanCost: parseFloat(e.target.value) || 0})}
              step="0.01"
              min="0"
              placeholder="Ej: 25.50"
            />
          </div>

          <div className="border-t pt-4 space-y-4">

            <Input
              label="ISIN (para fondos)"
              value={formData.isin}
              onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
              placeholder="Ej: ES0165151004"
            />

            <Input
              label="Ticker (para acciones y crypto)"
              value={formData.ticker}
              onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
              placeholder="Ej: AAPL, BTC-EUR"
            />
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.archived}
                onChange={(e) => setFormData({ ...formData, archived: e.target.checked })}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Archivar (posición cerrada)
              </span>
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingAsset ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
