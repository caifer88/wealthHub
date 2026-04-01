import React, { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Asset, HistoryEntry, AssetCategory } from '../types'
import { Trash2, Edit3, Shield, Info, BarChart2, Briefcase } from 'lucide-react'
import { formatCurrencyDecimals, generateUUID } from '../utils'
import { api } from '../services/api'
import { CATEGORY_META } from '../hooks/useAllocation'

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
    category: AssetCategory.FUND_INDEX as string,
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

  const categories = Object.values(AssetCategory)
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
    '#f59e0b', '#10b981', '#0ea5e9', '#0f1010',
    '#64748b'
  ]
  const riskLevels = ['Bajo', 'Medio', 'Alto']

  useEffect(() => {
    if (isOpen) {
      if (asset) {
        setFormData({
          name: asset.name,
          category: asset.category || AssetCategory.FUND_INDEX,
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
          category: AssetCategory.FUND_INDEX,
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
        ticker: formData.ticker || null,
        participations: formData.participations,
        meanCost: formData.meanCost
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
      if (!asset) onClose() // Cierra si es nuevo
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
        <div className="flex space-x-6 border-b border-slate-200 dark:border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'history' 
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BarChart2 size={16} />
            Historial Mensual
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'details' 
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Info size={16} />
            Configuración del Activo
          </button>
        </div>
      )}

      {activeTab === 'details' || !asset ? (
        <form onSubmit={handleAssetSubmit} className="space-y-6">
          
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/60 ring-1 ring-black/5 dark:ring-white/5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-2">
              <Briefcase size={16} className="text-indigo-500"/>
              Información Principal
            </h3>
            
            <Input
              label="Nombre del Activo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Tesla, Bitcoin, Fondo de Pensiones..."
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select
                label="Categoría"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                options={categories.map(c => ({ 
                  value: c, 
                  label: CATEGORY_META[c] ? `${CATEGORY_META[c].icon}  ${CATEGORY_META[c].label}` : c 
                }))}
              />

              <div className="flex flex-col">
                 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nivel de Riesgo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Shield size={16} /></span>
                  <select
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-indigo-500 transition-colors"
                    value={formData.riskLevel}
                    onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
                  >
                    {riskLevels.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Color de Referencia
              </label>
              <div className="flex gap-2 flex-wrap bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {colors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-9 h-9 rounded-full border-2 transition-all duration-200 ${formData.color === color ? 'border-slate-900 dark:border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                      }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-white dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 ring-1 ring-black/5 dark:ring-white/5">
            <h3 className="col-span-full text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2">
              Identificadores
            </h3>
            <Input
              label="ISIN (para fondos)"
              value={formData.isin}
              onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
              placeholder="Ej: ES0165151004"
            />

            <Input
              label="Ticker (acciones y cripto)"
              value={formData.ticker}
              onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
              placeholder="Ej: AAPL, BTC-EUR"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-white dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 ring-1 ring-black/5 dark:ring-white/5">
             <h3 className="col-span-full text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2">
              Posición y Coste (Opcional)
            </h3>
            <Input
              label="Participaciones / Títulos"
              type="number"
              value={formData.participations}
              onChange={(e) => setFormData({ ...formData, participations: parseFloat(e.target.value) || 0 })}
              step="0.00001"
              min="0"
              placeholder="Ej: 100.5"
            />

            <Input
              label="Precio Medio Compra (€)"
              type="number"
              value={formData.meanCost}
              onChange={(e) => setFormData({ ...formData, meanCost: parseFloat(e.target.value) || 0 })}
              step="0.01"
              min="0"
              placeholder="Ej: 25.50"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer group bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/30 dark:hover:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isArchived}
                  onChange={(e) => setFormData({ ...formData, isArchived: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 cursor-pointer"
                />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
                  Archivar Activo
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Oculta este activo de los listados principales y asume que la posición está cerrada.
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
            <Button variant="secondary" onClick={onClose} type="button" className="px-6">
              Cancelar
            </Button>
            <Button variant="primary" type="submit" className="px-8 shadow-md">
              {asset ? 'Guardar Cambios' : 'Crear Activo'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="max-h-[50vh] overflow-y-auto rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/95 backdrop-blur z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="text-left font-semibold py-3 px-4 text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">Mes</th>
                  <th className="text-right font-semibold py-3 px-4 text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">Valoración</th>
                  <th className="text-right font-semibold py-3 px-4 text-indigo-600 dark:text-indigo-400 uppercase text-xs tracking-wider">Net Flow</th>
                  <th className="text-right font-semibold py-3 px-4 hidden sm:table-cell text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">Part.</th>
                  <th className="text-center font-semibold py-3 px-4 text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {assetHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                          <BarChart2 size={24} className="text-slate-400" />
                        </div>
                        <p>No hay registros históricos para este activo.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assetHistory.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-4 font-medium dark:text-slate-200">{formatMonth(entry.month)}</td>
                      <td className="py-3 px-4 text-right font-bold dark:text-white">{formatCurrencyDecimals(entry.nav, 2)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${entry.contribution > 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : entry.contribution < 0 ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'text-slate-500'}`}>
                          {entry.contribution > 0 ? '+' : ''}{formatCurrencyDecimals(entry.contribution, 2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right hidden sm:table-cell text-slate-600 dark:text-slate-400">
                        {entry.participations > 0 ? entry.participations.toLocaleString('es-ES', { maximumFractionDigits: 3 }) : '-'}
                      </td>
                      <td className="py-3 px-4 flex justify-center gap-2 items-center">
                        <button
                          onClick={() => handleEditHistory(entry)}
                          className="p-1.5 focus:outline-none hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar"
                        >
                          <Edit3 size={16} className="text-slate-600 dark:text-slate-400 hover:text-indigo-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(entry.id, entry.month)}
                          className="p-1.5 focus:outline-none hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Eliminar"
                        >
                          <Trash2 size={16} className="text-rose-500 hover:text-rose-600 dark:text-rose-400" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-5">
            <Button variant="secondary" onClick={onClose} className="px-6">
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
          title={`Editar Registro: ${formatMonth(editingHistory.month)}`}
          size="sm"
        >
          <form onSubmit={handleSaveHistory} className="space-y-5">
            <Input
              label="Valor Total (NAV) en €"
              type="number"
              value={historyForm.nav}
              onChange={(e) => setHistoryForm({ ...historyForm, nav: e.target.value })}
              step="0.01"
              required
            />
            <Input
              label="Flujo Neto (Aportación/Retirada) en €"
              type="number"
              value={historyForm.contribution}
              onChange={(e) => setHistoryForm({ ...historyForm, contribution: e.target.value })}
              step="0.01"
            />
            <details className="text-sm bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 group mt-2 transition-all">
              <summary className="font-bold cursor-pointer text-slate-700 dark:text-slate-300 flex items-center outline-none">
                <span className="flex-1">Datos Adicionales Avanzados</span>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Input
                  label="Participaciones / Títulos"
                  type="number"
                  value={historyForm.participations}
                  onChange={(e) => setHistoryForm({ ...historyForm, participations: e.target.value })}
                  step="0.0001"
                />
                <Input
                  label="Valor Liquidativo Unitario (Precio)"
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
            
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
              <Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)} type="button" className="px-5">Cancelar</Button>
              <Button variant="primary" type="submit" className="px-6 shadow-md">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  )
}
