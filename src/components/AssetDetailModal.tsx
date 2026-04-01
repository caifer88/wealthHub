import React, { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Asset, HistoryEntry } from '../types'
import { Trash2, Edit3 } from 'lucide-react'
import { formatCurrencyDecimals, generateUUID } from '../utils'
import { api } from '../services/api'

interface AssetDetailModalProps {
  isOpen: boolean
  onClose: () => void
  asset: Asset | null
  history: HistoryEntry[]
  refetchData: () => Promise<void>
}

export function AssetDetailModal({
  isOpen,
  onClose,
  asset,
  history,
  refetchData
}: AssetDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')
  const [formData, setFormData] = useState({
    name: '',
    category: 'Fund',
    color: '#6366f1',
    riskLevel: 'Medio',
    isArchived: false,
    isin: '',
    ticker: '',
    participations: 0,
    meanCost: 0
  })

  const [editingHistory, setEditingHistory] = useState<HistoryEntry | null>(null)
  const [historyForm, setHistoryForm] = useState({
    nav: '',
    contribution: '',
    participations: '',
    liquidNavValue: '',
    meanCost: ''
  })
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  const categories = ['Fund', 'Cash', 'Crypto', 'Stocks', 'Plan de pensiones']
  const colors = ['#6366f1', '#0f1010', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
  const riskLevels = ['Bajo', 'Medio', 'Alto']

  useEffect(() => {
    if (isOpen) {
      if (asset) {
        setFormData({
          name: asset.name,
          category: asset.category,
          color: asset.color,
          riskLevel: asset.riskLevel || 'Medio',
          isArchived: asset.isArchived || false,
          isin: asset.isin || '',
          ticker: asset.ticker || '',
          participations: asset.participations || 0,
          meanCost: asset.meanCost || 0
        })
        setActiveTab('history') // Por defecto a historial si existe el activo
      } else {
        setFormData({
          name: '',
          category: 'Fund',
          color: '#6366f1',
          riskLevel: 'Medio',
          isArchived: false,
          isin: '',
          ticker: '',
          participations: 0,
          meanCost: 0
        })
        setActiveTab('details') // Obligatorio detalles para uno nuevo
      }
    } else {
        setActiveTab('details')
    }
  }, [isOpen, asset])

  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        color: formData.color,
        riskLevel: formData.riskLevel,
        isArchived: formData.isArchived,
        isin: formData.isin || null,
        ticker: formData.ticker || null
      } as any

      if (asset) {
        await api.updateAsset(asset.id, payload)
      } else {
        await api.createAsset({
          id: generateUUID(),
          ...payload
        } as any)
      }

      await refetchData()
      if (!asset) onClose() // Cierra si es nuevo porque ya no necesitamos tab de historial
      else alert("Detalles actualizados correctamente")
    } catch (error) {
      console.error("Error saving asset", error)
      alert("Error guardando el activo")
    }
  }

  const formatMonth = (monthStr: string) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const [year, month] = monthStr.split('-')
    return `${months[parseInt(month) - 1]} ${year}`
  }

  const assetHistory = asset 
    ? history.filter(h => h.asset_id === asset.id).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
    : []

  const handleEditHistory = (entry: HistoryEntry) => {
    setEditingHistory(entry)
    setHistoryForm({
      nav: entry.nav ? entry.nav.toString() : '',
      contribution: entry.contribution ? entry.contribution.toString() : '',
      participations: entry.participations ? entry.participations.toString() : '',
      liquidNavValue: entry.liquidNavValue ? entry.liquidNavValue.toString() : '',
      meanCost: entry.meanCost ? entry.meanCost.toString() : ''
    })
    setIsHistoryModalOpen(true)
  }

  const handleSaveHistory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingHistory || !asset) return

    try {
      const nav = parseFloat(historyForm.nav || '0') || 0
      const contribution = parseFloat(historyForm.contribution || '0') || 0
      const participations = parseFloat(historyForm.participations || '0') || editingHistory.participations || 0
      const liquidNavValue = parseFloat(historyForm.liquidNavValue || '0') || 0
      const meanCost = parseFloat(historyForm.meanCost || '0') || editingHistory.meanCost || 0
      
      await api.updateHistory(editingHistory.id, {
        id: editingHistory.id,
        month: editingHistory.month,
        asset_id: editingHistory.asset_id,
        participations: !isNaN(participations) ? participations : 0,
        liquid_nav_value: !isNaN(liquidNavValue) ? liquidNavValue : 0,
        nav: !isNaN(nav) ? nav : 0,
        contribution: !isNaN(contribution) ? contribution : 0,
        mean_cost: !isNaN(meanCost) ? meanCost : 0,
        snapshot_date: `${editingHistory.month}-01`
      })

      await refetchData()
      setIsHistoryModalOpen(false)
      setEditingHistory(null)
    } catch (error) {
      console.error("Error updating history", error)
      alert("Error actualizando el registro")
    }
  }

  const handleDeleteHistory = async (id: string, month: string) => {
    if (confirm(`¿Eliminar de forma permanente el registro histórico de ${formatMonth(month)}?`)) {
      try {
        await api.deleteHistory(id)
        await refetchData()
      } catch (error) {
        console.error("Error deleting history", error)
        alert("Error eliminando registro")
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={asset ? asset.name : 'Nuevo Activo'}
      size="xl"
    >
      {asset && (
        <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'history' 
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Historial Mensual
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'details' 
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Detalles del Activo
          </button>
        </div>
      )}

      {activeTab === 'details' || !asset ? (
        <form onSubmit={handleAssetSubmit} className="space-y-4">
          <Input
            label="Nombre del Activo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Tesla, Bitcoin, Fondo de Pensiones"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Categoría"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={categories.map(c => ({ value: c, label: c }))}
            />

            <Select
              label="Nivel de Riesgo"
              value={formData.riskLevel}
              onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
              options={riskLevels.map(r => ({ value: r, label: r }))}
            />
          </div>

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
                  className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-slate-900 dark:border-white' : 'border-slate-300'
                    }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <Input
              label="Número de Participaciones"
              type="number"
              value={formData.participations}
              onChange={(e) => setFormData({ ...formData, participations: parseFloat(e.target.value) || 0 })}
              step="0.00001"
              min="0"
              placeholder="Ej: 100.5"
            />

            <Input
              label="Coste Medio por Participación (€)"
              type="number"
              value={formData.meanCost}
              onChange={(e) => setFormData({ ...formData, meanCost: parseFloat(e.target.value) || 0 })}
              step="0.01"
              min="0"
              placeholder="Ej: 25.50"
            />
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isArchived}
                onChange={(e) => setFormData({ ...formData, isArchived: e.target.checked })}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Archivar (posición cerrada)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={onClose} type="button">
              Cerrar
            </Button>
            <Button variant="primary" type="submit">
              {asset ? 'Actualizar Detalles' : 'Crear Activo'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-950 z-10">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left font-semibold py-2">Mes</th>
                  <th className="text-right font-semibold py-2">NAV</th>
                  <th className="text-right font-semibold py-2 text-indigo-500">Aportación</th>
                  <th className="text-right font-semibold py-2 hidden sm:table-cell">Part.</th>
                  <th className="text-center font-semibold py-2 px-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {assetHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Este activo aún no tiene movimientos históricos registrados.
                    </td>
                  </tr>
                ) : (
                  assetHistory.map(entry => (
                    <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="py-2.5 font-medium dark:text-white">{formatMonth(entry.month)}</td>
                      <td className="py-2.5 text-right font-bold dark:text-white">{formatCurrencyDecimals(entry.nav, 2)}</td>
                      <td className="py-2.5 text-right text-indigo-600 dark:text-indigo-400 font-semibold">{formatCurrencyDecimals(entry.contribution, 2)}</td>
                      <td className="py-2.5 text-right hidden sm:table-cell dark:text-slate-300">
                        {entry.participations > 0 ? entry.participations.toLocaleString('es-ES', { maximumFractionDigits: 3 }) : '-'}
                      </td>
                      <td className="py-2.5 flex justify-center gap-1.5 h-full items-center mt-1">
                        <button
                          onClick={() => handleEditHistory(entry)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
                          title="Editar"
                        >
                          <Edit3 size={14} className="text-slate-600 dark:text-slate-400 hover:text-indigo-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(entry.id, entry.month)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
                          title="Eliminar"
                        >
                          <Trash2 size={14} className="text-rose-400 hover:text-rose-600" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" onClick={onClose}>
              Cerrar Panel
            </Button>
          </div>
        </div>
      )}

      {/* Sub-modal de edición de historial puntual */}
      {isHistoryModalOpen && editingHistory && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Editar Historial: ${formatMonth(editingHistory.month)}`}
          size="sm"
        >
          <form onSubmit={handleSaveHistory} className="space-y-4">
            <Input
              label="NAV (€)"
              type="number"
              value={historyForm.nav}
              onChange={(e) => setHistoryForm({ ...historyForm, nav: e.target.value })}
              step="0.01"
              required
            />
            <Input
              label="Aportación del mes (€)"
              type="number"
              value={historyForm.contribution}
              onChange={(e) => setHistoryForm({ ...historyForm, contribution: e.target.value })}
              step="0.01"
            />
            <details className="text-sm border border-slate-200 dark:border-slate-800 rounded-lg p-3 group">
              <summary className="font-semibold cursor-pointer text-slate-700 dark:text-slate-300">Campos Avanzados</summary>
              <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Input
                  label="Participaciones"
                  type="number"
                  value={historyForm.participations}
                  onChange={(e) => setHistoryForm({ ...historyForm, participations: e.target.value })}
                  step="0.0001"
                />
                <Input
                  label="NAV Liquidativo Unitario"
                  type="number"
                  value={historyForm.liquidNavValue}
                  onChange={(e) => setHistoryForm({ ...historyForm, liquidNavValue: e.target.value })}
                  step="0.01"
                />
                <Input
                  label="Coste Medio Unitario"
                  type="number"
                  value={historyForm.meanCost}
                  onChange={(e) => setHistoryForm({ ...historyForm, meanCost: e.target.value })}
                  step="0.01"
                />
              </div>
            </details>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)} type="button">Cancelar</Button>
              <Button variant="primary" type="submit">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  )
}
