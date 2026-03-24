import React, { useState, useMemo } from 'react'
import { Trash2, Edit3, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { useWealth } from '../context/WealthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatCurrency, isCurrentMonth, formatCurrencyDecimals } from '../utils'
import { fetchAndUpdatePrices } from '../services/priceUpdater'
import type { HistoryEntry } from '../types'
import { api } from '../services/api'

export default function History() {
  const { assets, history, refetchData, stockTransactions, bitcoinTransactions } = useWealth()
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null)
  const [isFetchingPrices, setIsFetchingPrices] = useState(false)
  const [fetchMessage, setFetchMessage] = useState('')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    nav: '',
    contribution: '',
    participations: '',
    liquidNavValue: '',
    meanCost: ''
  })

  // Función para convertir mes en formato "2024-01" a "Enero 2024"
  const formatMonthDisplay = (monthStr: string): string => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const [year, month] = monthStr.split('-')
    const monthIndex = parseInt(month) - 1
    return `${months[monthIndex]} ${year}`
  }

  // Group history by year
  const groupedByYear = useMemo(() => {
    const groups: Record<string, Record<string, typeof history>> = {}

    history.forEach(entry => {
      const [year] = entry.month.split('-')
      if (!groups[year]) {
        groups[year] = {}
      }
      if (!groups[year][entry.month]) {
        groups[year][entry.month] = []
      }
      groups[year][entry.month].push(entry)
    })

    return groups
  }, [history])

  const years = Object.keys(groupedByYear).sort().reverse()
  const displayYear = selectedYear || years[0]
  const monthsData = groupedByYear[displayYear] || {}

  const handleOpenModal = (entry: HistoryEntry) => {
    // Solo permitir editar registros del mes actual
    if (!isCurrentMonth(entry.month)) {
      return
    }
    
    setEditingEntry(entry)
    const nav = (entry.nav && !isNaN(entry.nav)) ? entry.nav : 0
    const contribution = (entry.contribution && !isNaN(entry.contribution)) ? entry.contribution : 0
    const participations = (entry.participations && !isNaN(entry.participations)) ? entry.participations : 0
    const liquidNavValue = (entry.liquidNavValue && !isNaN(entry.liquidNavValue)) ? entry.liquidNavValue : 0
    const meanCost = (entry.meanCost && !isNaN(entry.meanCost)) ? entry.meanCost : 0
    
    setFormData({
      nav: nav > 0 ? nav.toString() : '',
      contribution: contribution > 0 ? contribution.toString() : '',
      participations: participations > 0 ? participations.toString() : '',
      liquidNavValue: liquidNavValue > 0 ? liquidNavValue.toString() : '',
      meanCost: meanCost > 0 ? meanCost.toString() : ''
    })
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingEntry) return

    const runUpdate = async () => {
      try {
        const nav = parseFloat(formData.nav || '0') || 0
        const contribution = parseFloat(formData.contribution || '0') || 0
        const participations = parseFloat(formData.participations || '0') || editingEntry.participations || 0
        const liquidNavValue = parseFloat(formData.liquidNavValue || '0') || 0
        const meanCost = parseFloat(formData.meanCost || '0') || editingEntry.meanCost || 0
        
        await api.updateHistory(editingEntry.id, {
          id: editingEntry.id,
          month: editingEntry.month,
          asset_id: editingEntry.asset_id,
          participations: !isNaN(participations) ? participations : 0,
          liquid_nav_value: !isNaN(liquidNavValue) ? liquidNavValue : 0,
          nav: !isNaN(nav) ? nav : 0,
          contribution: !isNaN(contribution) ? contribution : 0,
          mean_cost: !isNaN(meanCost) ? meanCost : 0,
          snapshot_date: `${editingEntry.month}-01`
        });

        await refetchData();

        setIsModalOpen(false);
        setEditingEntry(null);
      } catch (error) {
        console.error("Error updating history", error);
        alert("Error actualizando el historial");
      }
    };
    
    runUpdate();
  }

  const handleDelete = (id: string) => {
    const entry = history.find(e => e.id === id)
    
    if (entry && !isCurrentMonth(entry.month)) {
      alert('No se pueden eliminar registros de meses anteriores')
      return
    }
    
    if (confirm('¿Está seguro de que desea eliminar este registro?')) {
      const runDelete = async () => {
        try {
          await api.deleteHistory(id);
          await refetchData();
        } catch (error) {
          console.error("Error deleting history", error);
          alert("Error eliminando registro");
        }
      };
      runDelete();
    }
  }

  const handleFetchPrices = async () => {
    try {
      setIsFetchingPrices(true)
      setFetchMessage('Obteniendo precios...')

      const result = await fetchAndUpdatePrices(assets, history, stockTransactions, bitcoinTransactions)
      
      if (result.success) {
        await refetchData();
        setFetchMessage(result.message)
      } else {
        setFetchMessage(`❌ ERROR EN LA ACTUALIZACIÓN\n╔════════════════════════════════════════╗\n\n${result.message}\n\n╚════════════════════════════════════════╝`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setFetchMessage(
        `❌ ERROR\n╔════════════════════════════════════════╗\n\n${errorMessage}\n\n╚════════════════════════════════════════╝`
      )
    } finally {
      setIsFetchingPrices(false)
      setTimeout(() => setFetchMessage(''), 12000)
    }
  }

  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }))
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
            Historial de Patrimonio
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Evolución mensual de tus activos
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={handleFetchPrices}
            disabled={isFetchingPrices}
          >
            <RefreshCw size={16} className={`mr-2 ${isFetchingPrices ? 'animate-spin' : ''}`} />
            {isFetchingPrices ? 'Actualizando...' : 'Actualizar NAV'}
          </Button>
        </div>
      </header>

      {years.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year === displayYear ? null : year)}
              className={`px-4 py-2 rounded-2xl font-semibold transition-colors ${
                year === displayYear
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {fetchMessage && (
        <Card className={`border-l-4 ${
          fetchMessage.includes('✅') 
            ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20' 
            : 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
        }`}>
          <div className={`${
            fetchMessage.includes('✅') ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
          } whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed`}>
            {fetchMessage}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(monthsData).map(([month, monthEntries]) => {
          
          const groupedEntries: Array<{entry: HistoryEntry, asset?: any, displayName: string}> = []
          const subEntriesMap: Record<string, Array<{entry: HistoryEntry, asset?: any, displayName: string}>> = {}

          monthEntries.forEach(entry => {
            const asset = assets.find(a => a.id === entry.asset_id)
            let isSub = false
            let parentId: string | null = null
            let displayName = asset ? asset.name : 'N/A'

            // Caso 1: Acciones sueltas reportadas por la sincronización (ej. ticker-AAPL)
            if (entry.asset_id.startsWith('ticker-')) {
              const ticker = entry.asset_id.replace('ticker-', '')
              isSub = true
              displayName = ticker

              // Buscar a qué broker pertenece revisando las transacciones de acciones
              const tx = stockTransactions.find(t => t.ticker === ticker)
              if (tx && tx.broker) {
                const brokerAsset = assets.find(a => a.name === tx.broker)
                if (brokerAsset) parentId = brokerAsset.id
              }
              // Fallback en caso de no encontrar broker pero tener a Interactive Brokers en la cartera
              if (!parentId) {
                const ib = assets.find(a => a.name === 'Interactive Brokers')
                if (ib) parentId = ib.id
              }
            } 
            // Caso 2: Activo normal registrado pero que internamente depende de un bróker
            else if (asset && asset.ticker) {
              const tx = stockTransactions.find(t => t.ticker === asset.ticker)
              if (tx && tx.broker) {
                const brokerAsset = assets.find(a => a.name === tx.broker)
                if (brokerAsset) {
                  isSub = true
                  parentId = brokerAsset.id
                  displayName = asset.ticker
                }
              }
            }

            if (isSub && parentId) {
              if (!subEntriesMap[parentId]) subEntriesMap[parentId] = []
              subEntriesMap[parentId].push({ entry, asset, displayName })
            } else {
              groupedEntries.push({ entry, asset, displayName })
            }
          })

          // Calcular totales usando exclusivamente groupedEntries (se ignoran las sub-acciones)
          const monthTotal = groupedEntries.reduce((sum, item) => sum + item.entry.nav, 0)
          
          const cashAsset = assets.find(a => a.name === 'Cash')
          const monthInvested = groupedEntries
            .filter(item => !cashAsset || item.entry.asset_id !== cashAsset.id)
            .reduce((sum, item) => sum + item.entry.contribution, 0)
          
          const isCurrentMonthDisplayed = isCurrentMonth(month)

          return (
            <Card key={month} title={formatMonthDisplay(month)} className="!p-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Total</p>
                    <p className="text-lg font-black dark:text-white">{formatCurrency(Math.round(monthTotal))}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Invertido</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(Math.round(monthInvested))}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-1.5 px-2 font-bold text-slate-600 dark:text-slate-400">Activo</th>
                        <th className="text-right py-1.5 px-2 font-bold text-slate-600 dark:text-slate-400">Aportaciones</th>
                        <th className="text-right py-1.5 px-2 font-bold text-slate-600 dark:text-slate-400">NAV</th>
                        {isCurrentMonthDisplayed && <th className="text-center py-1.5 px-2 font-bold text-slate-600 dark:text-slate-400">Acc.</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedEntries.map(({ entry, asset, displayName }) => {
                        const subEntries = subEntriesMap[entry.asset_id] || []
                        const hasSubEntries = subEntries.length > 0
                        const rowId = `${month}-${entry.asset_id}`
                        const isExpanded = expandedRows[rowId]

                        return (
                          <React.Fragment key={entry.id}>
                            <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                              <td className="py-1.5 px-2 font-semibold dark:text-white">
                                <div className="flex items-center gap-2">
                                  {/* 1. Punto de color (o espacio vacío) siempre alineado a la izquierda */}
                                  {asset ? (
                                    <div 
                                      className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: asset.color }}
                                    />
                                  ) : (
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-transparent" />
                                  )}
                                  
                                  {/* 2. Nombre del activo */}
                                  <span className="truncate">{displayName}</span>

                                  {/* 3. Botón desplegable a la derecha del nombre */}
                                  {hasSubEntries && (
                                    <button
                                      onClick={() => toggleRow(rowId)}
                                      className="ml-1 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center"
                                      title={isExpanded ? "Ocultar acciones" : "Mostrar acciones"}
                                    >
                                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-right font-bold dark:text-white">
                                {formatCurrencyDecimals(entry.contribution, 2)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-bold dark:text-white">
                                {formatCurrencyDecimals(entry.nav, 2)}
                              </td>
                              {isCurrentMonthDisplayed && (
                                <td className="py-1.5 px-2 text-center flex gap-0.5 justify-center">
                                  <button
                                    onClick={() => handleOpenModal(entry)}
                                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Editar"
                                  >
                                    <Edit3 size={12} className="text-blue-500" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={12} className="text-rose-500" />
                                  </button>
                                </td>
                              )}
                            </tr>

                            {/* Acciones hijas (dentro del Broker) */}
                            {isExpanded && subEntries.map((sub) => (
                              <tr key={sub.entry.id} className="border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20">
                                <td className="py-1.5 px-2 pl-8 font-medium text-slate-500 dark:text-slate-400">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-slate-400">└</span>
                                    {sub.displayName}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 text-right text-slate-500 dark:text-slate-400 font-medium">
                                  {/* Las acciones individuales no muestran contribution normalmente para evitar ruido */}
                                  -
                                </td>
                                <td className="py-1.5 px-2 text-right text-slate-500 dark:text-slate-400 font-medium">
                                  {formatCurrencyDecimals(sub.entry.nav, 2)}
                                </td>
                                {isCurrentMonthDisplayed && (
                                  <td className="py-1.5 px-2 text-center flex gap-0.5 justify-center">
                                    <button
                                      onClick={() => handleDelete(sub.entry.id)}
                                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                      title="Eliminar posición"
                                    >
                                      <Trash2 size={10} className="text-rose-400" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {groupedEntries.length === 0 && (
                  <p className="text-center text-slate-500 dark:text-slate-400 text-xs py-3">
                    Sin registros
                  </p>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {history.length === 0 && (
        <Card>
          <p className="text-center text-slate-600 dark:text-slate-400 py-8">
            Sin datos de historial aún
          </p>
        </Card>
      )}

      {/* Modal de Edición */}
      {editingEntry && (
        <Modal
          isOpen={isModalOpen}
          title="Editar Registro"
          onClose={() => setIsModalOpen(false)}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <p className="text-sm font-semibold dark:text-white mb-4">
                {assets.find(a => a.id === editingEntry.asset_id)?.name || editingEntry.asset_id.replace('ticker-', '')}
              </p>
              
              <div className="space-y-3">
                <Input
                  label="NAV (€)"
                  type="number"
                  value={formData.nav}
                  onChange={(e) => setFormData({ ...formData, nav: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />

                <Input
                  label="Aportación (€)"
                  type="number"
                  value={formData.contribution}
                  onChange={(e) => setFormData({ ...formData, contribution: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />

                <Input
                  label="Participaciones"
                  type="number"
                  value={formData.participations}
                  onChange={(e) => setFormData({ ...formData, participations: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />

                <Input
                  label="Valor NAV Liquidativo (€)"
                  type="number"
                  value={formData.liquidNavValue}
                  onChange={(e) => setFormData({ ...formData, liquidNavValue: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />

                <Input
                  label="Coste Medio"
                  type="number"
                  value={formData.meanCost}
                  onChange={(e) => setFormData({ ...formData, meanCost: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Actualizar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}