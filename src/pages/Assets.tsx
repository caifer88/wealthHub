import React, { useState, useCallback } from 'react'
import { Trash2, Edit3, Plus, ArrowUp, ArrowDown, Archive, ArchiveX, RefreshCw } from 'lucide-react'
import { useWealth } from '../context/WealthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MetricCard } from '../components/ui/MetricCard'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, generateUUID } from '../utils'
import { config } from '../config'
import type { Asset, FetchMonthResponse, PriceData } from '../types'

export default function Assets() {
  const { assets, setAssets, history, setHistory, saveDataToGAS } = useWealth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [sortColumn, setSortColumn] = useState<'name' | 'category' | 'value' | 'percentage'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [showArchived, setShowArchived] = useState(false)
  const [isFetchingPrices, setIsFetchingPrices] = useState(false)
  const [fetchMessage, setFetchMessage] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    category: 'Renta variable',
    color: '#6366f1',
    baseAmount: 0,
    targetAllocation: 0,
    riskLevel: 'Medio',
    archived: false,
    isin: '',
    ticker: ''
  })

  const categories = ['Renta variable', 'Efectivo', 'Crypto', 'Stocks', 'Plan de pensiones']
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
  const riskLevels = ['Bajo', 'Medio', 'Alto']

  // Show active assets if showArchived is false, otherwise show all
  const displayedAssets = showArchived ? assets : assets.filter(a => !a.archived)
  
  // Calculate current NAV from latest history entry for each asset
  const getAssetNAV = (assetId: string): number => {
    const assetHistory = history.filter(h => h.assetId === assetId)
    if (assetHistory.length === 0) return 0
    // Get the last entry by date
    const sorted = [...assetHistory].sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
    return sorted[0].nav || 0
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

  const assetValues = assets.map(a => ({
    ...a,
    currentNAV: getAssetNAV(a.id)
  }))

  const totalNAV = assetValues.filter(a => !a.archived).reduce((sum, a) => sum + a.currentNAV, 0)
  
  const displayedAssetValues = assetValues.filter(showArchived ? () => true : a => !a.archived)
  const sortedAssetValues = getSortedAssets(displayedAssetValues, sortColumn, sortDirection, totalNAV)

  const handleOpenModal = (asset?: Asset) => {
    if (asset) {
      setEditingAsset(asset)
      // Usar el NAV del último mes registrado como baseAmount por defecto, o 0 si no existe o está archived
      const defaultBaseAmount = asset.archived ? 0 : getAssetNAV(asset.id)
      setFormData({
        name: asset.name,
        category: asset.category,
        color: asset.color,
        baseAmount: defaultBaseAmount,
        targetAllocation: asset.targetAllocation || 0,
        riskLevel: asset.riskLevel || 'Medio',
        archived: asset.archived || false,
        isin: asset.isin || '',
        ticker: asset.ticker || ''
      })
    } else {
      setEditingAsset(null)
      setFormData({
        name: '',
        category: 'Renta variable',
        color: '#6366f1',
        baseAmount: 0,
        targetAllocation: 0,
        riskLevel: 'Medio',
        archived: false,
        isin: '',
        ticker: ''
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
              baseAmount: formData.baseAmount,
              targetAllocation: formData.targetAllocation,
              riskLevel: formData.riskLevel,
              archived: formData.archived,
              isin: formData.isin || undefined,
              ticker: formData.ticker || undefined
            }
          : a
      )
      setAssets(updatedAssets)
      
      // Sync with GAS if archived status changed
      if (editingAsset.archived !== formData.archived) {
        saveDataToGAS(updatedAssets, history, [], [])
      }
    } else {
      const newAsset: Asset = {
        id: generateUUID(),
        name: formData.name,
        category: formData.category,
        color: formData.color,
        baseAmount: formData.baseAmount,
        targetAllocation: formData.targetAllocation,
        riskLevel: formData.riskLevel,
        archived: false,
        isin: formData.isin || undefined,
        ticker: formData.ticker || undefined
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
      saveDataToGAS(updatedAssets, history, [], [])
    }
  }

  const handleToggleArchived = (id: string) => {
    const updatedAssets = assets.map(a => 
      a.id === id ? { ...a, archived: !a.archived } : a
    )
    setAssets(updatedAssets)
    saveDataToGAS(updatedAssets, history, [], [])
  }

  const getArchivedCount = (): number => {
    return assets.filter(a => a.archived).length
  }

  const handleFetchPrices = async () => {
    try {
      setIsFetchingPrices(true)
      setFetchMessage('Obteniendo precios...')

      // Get current month and year
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      console.log(`🔄 Iniciando actualización de NAVs para ${year}-${String(month).padStart(2, '0')}`)

      // Call backend API
      const response = await fetch(
        `${config.backendUrl}/fetch-month?year=${year}&month=${month}`
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Error HTTP ${response.status}:`, errorText)
        throw new Error(`Error HTTP ${response.status}: ${errorText || 'Sin detalles disponibles'}`)
      }

      const result: FetchMonthResponse = await response.json()
      console.log('Respuesta del servidor:', result)

      if (result.success) {
        // Convert prices to history entries
        const monthStr = `${year}-${String(month).padStart(2, '0')}`
        const newHistoryEntries = result.prices.map((price) => ({
          id: generateUUID(),
          month: monthStr,
          assetId: price.assetId,
          nav: price.price,
          contribution: price.price
        }))

        // Build detailed message with updated assets info
        const successLines: string[] = []
        const sourceGroups: { [key: string]: string[] } = {}
        
        // Update history (merge with existing)
        const updatedHistory = [...history]
        for (const newEntry of newHistoryEntries) {
          // Find the asset to get its name, ticker, isin
          const asset = assets.find(a => a.id === newEntry.assetId)
          
          // Check if entry for this month/asset already exists to get old value
          const existingIndex = updatedHistory.findIndex(
            h => h.month === newEntry.month && h.assetId === newEntry.assetId
          )
          
          let oldValue = existingIndex >= 0 ? updatedHistory[existingIndex].nav : 0
          let isUpdate = existingIndex >= 0
          
          if (existingIndex >= 0) {
            // Update existing
            updatedHistory[existingIndex] = newEntry
          } else {
            // Add new
            updatedHistory.push(newEntry)
          }

          // Build detail string for this asset
          if (asset) {
            const identifier = asset.ticker || asset.isin || asset.name
            const priceData = result.prices.find(p => p.assetId === newEntry.assetId)
            const source = priceData?.source || 'unknown'
            const sourceLabel = {
              'yfinance': '📈 Yahoo Finance',
              'binance_api': '🔗 Binance API',
              'ft_markets': '📰 FT Markets',
              'user_input': '📝 Manual',
              'fund_scraper': '🔍 Web Scraper',
              'morningstar': '⭐ Morningstar'
            }[source] || source
            
            const changeInfo = isUpdate 
              ? `${formatCurrency(Math.round(oldValue))} → ${formatCurrency(Math.round(newEntry.nav))}`
              : `Nuevo: ${formatCurrency(Math.round(newEntry.nav))}`
            
            const line = `${asset.name} (${identifier})\n    Precio: ${formatCurrency(Math.round(newEntry.nav))}\n    Cambio: ${changeInfo}\n    Fuente: ${sourceLabel}`
            successLines.push(line)
            
            // Group by source for summary
            if (!sourceGroups[sourceLabel]) {
              sourceGroups[sourceLabel] = []
            }
            sourceGroups[sourceLabel].push(asset.name)
            
            console.log(`✅ ${asset.name}: ${changeInfo} (${sourceLabel})`)
          }
        }

        setHistory(updatedHistory)
        
        // Build comprehensive success message with better formatting
        let message = `✅ ACTUALIZACIÓN COMPLETADA\n`
        message += `╔════════════════════════════════════════╗\n`
        message += `║  Fecha: ${result.lastBusinessDay}                     ║\n`
        message += `║  Activos: ${result.prices.length}                              ║\n`
        message += `╚════════════════════════════════════════╝\n\n`
        
        message += `DETALLES POR ACTIVO:\n`
        message += `───────────────────────────────────────\n\n`
        message += successLines.join('\n\n')
        
        // Add summary by source
        message += `\n\n───────────────────────────────────────\n`
        message += `RESUMEN POR FUENTE:\n\n`
        Object.entries(sourceGroups).forEach(([source, assetList]) => {
          message += `${source}: ${assetList.join(', ')}\n`
        })
        
        if (result.errors && result.errors.length > 0) {
          message += `\n───────────────────────────────────────\n`
          message += `⚠️ ADVERTENCIAS:\n\n`
          result.errors.forEach(error => {
            message += `• ${error}\n`
          })
          console.warn('Errores en la actualización:', result.errors)
        }
        
        console.log(`✅ Actualización completada: ${result.prices.length} activos procesados`)
        setFetchMessage(message)
      } else {
        // Show what specifically failed
        let errorMsg = result.message || 'No se obtuvieron precios'
        if (result.errors && result.errors.length > 0) {
          errorMsg += `\n\nDETALLES DE ERRORES:\n`
          result.errors.forEach(e => {
            errorMsg += `• ${e}\n`
          })
          console.error('Errores del servidor:', result.errors)
        }
        console.error('Actualización fallida:', errorMsg)
        setFetchMessage(`❌ ERROR EN LA ACTUALIZACIÓN\n╔════════════════════════════════════════╗\n\n${errorMsg}\n\n╚════════════════════════════════════════╝`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      console.error('Error fetching prices:', {
        error: errorMessage,
        backendUrl: config.backendUrl,
        timestamp: new Date().toISOString()
      })
      setFetchMessage(
        `❌ ERROR DE CONEXIÓN\n╔════════════════════════════════════════╗\n\nNo se pudo conectar al backend\n\nServidor: ${config.backendUrl}\nError: ${errorMessage}\n\n╚════════════════════════════════════════╝`
      )
    } finally {
      setIsFetchingPrices(false)
      // Clear message after 12 seconds
      setTimeout(() => setFetchMessage(''), 12000)
    }
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
          <Button variant="secondary" onClick={handleFetchPrices} disabled={isFetchingPrices}>
            <RefreshCw size={20} className={`inline mr-2 ${isFetchingPrices ? 'animate-spin' : ''}`} />
            {isFetchingPrices ? 'Obteniendo...' : 'Obtener NAV Actual'}
          </Button>
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

      {/* Mensaje de estado del fetch */}
      {fetchMessage && (
        <Card className={`${
          fetchMessage.includes('✅') ? 'border-l-4 border-green-600 bg-green-50 dark:bg-slate-900 dark:border-green-400' : 'border-l-4 border-red-600 bg-red-50 dark:bg-slate-900 dark:border-red-400'
        } p-4`}>
          <div className={`${
            fetchMessage.includes('✅') ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
          } whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed`}>
            {fetchMessage}
          </div>
        </Card>
      )}

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

      {/* Tabla de Activos */}
      <Card title="Lista de Activos" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th 
                  onClick={() => {
                    if (sortColumn === 'name') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('name')
                      setSortDirection('asc')
                    }
                  }}
                  className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-2">
                    Nombre
                    {sortColumn === 'name' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'category') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('category')
                      setSortDirection('asc')
                    }
                  }}
                  className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-2">
                    Categoría
                    {sortColumn === 'category' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'value') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('value')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    Valor
                    {sortColumn === 'value' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortColumn === 'percentage') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortColumn('percentage')
                      setSortDirection('desc')
                    }
                  }}
                  className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    % de Cartera
                    {sortColumn === 'percentage' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedAssetValues.map(asset => (
                <tr 
                  key={asset.id} 
                  className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                    asset.archived ? 'opacity-50 bg-slate-100 dark:bg-slate-900' : ''
                  }`}
                >
                  <td className={`py-3 px-4 font-semibold ${
                    asset.archived ? 'line-through text-slate-400 dark:text-slate-600' : 'dark:text-white'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color, opacity: asset.archived ? 0.5 : 1 }}></div>
                      {asset.name}
                      {asset.archived && <span className="text-xs ml-2 px-2 py-1 bg-slate-300 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300">Archivado</span>}
                    </div>
                  </td>
                  <td className={`py-3 px-4 ${asset.archived ? 'text-slate-400 dark:text-slate-600' : 'text-slate-600 dark:text-slate-400'}`}>{asset.category}</td>
                  <td className={`py-3 px-4 text-right font-bold ${
                    asset.archived ? 'text-slate-400 dark:text-slate-600' : 'dark:text-white'
                  }`}>
                    {formatCurrency(Math.round(asset.currentNAV))}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${
                    asset.archived ? 'text-slate-400 dark:text-slate-600' : 'text-indigo-600'
                  }`}>
                    {totalNAV > 0 && !asset.archived ? ((asset.currentNAV / totalNAV) * 100).toFixed(1) : asset.archived ? '-' : 0}%
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenModal(asset)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit3 size={16} className="text-indigo-600" />
                    </button>
                    <button
                      onClick={() => handleToggleArchived(asset.id)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title={asset.archived ? "Desarchizar" : "Archivar"}
                    >
                      {asset.archived ? (
                        <ArchiveX size={16} className="text-blue-500" />
                      ) : (
                        <Archive size={16} className="text-amber-500" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} className="text-rose-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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

          <Input
            label="Valor Base (€) - NAV del último mes"
            type="number"
            value={formData.baseAmount}
            onChange={(e) => setFormData({ ...formData, baseAmount: parseFloat(e.target.value) || 0})}
            step="0.01"
            min="0"
            required
            placeholder="Coloca 0 si la posición está cerrada"
          />

          <Select
            label="Nivel de Riesgo"
            value={formData.riskLevel}
            onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
            options={riskLevels.map(r => ({ value: r, label: r }))}
          />

          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">
              Identificadores (opcional para obtención automática de precios)
            </h3>

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
                Marcar como archivado (posición cerrada)
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
