import { useState, useMemo } from 'react'
import { Trash2, Edit3, RefreshCw } from 'lucide-react'
import { useWealth } from '../context/WealthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatCurrency, generateUUID, isCurrentMonth, getCurrentMonth, formatCurrencyDecimals } from '../utils'
import { config } from '../config'
import type { HistoryEntry } from '../types'

export default function History() {
  const { assets, history, setHistory } = useWealth()
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null)
  const [isFetchingPrices, setIsFetchingPrices] = useState(false)
  const [fetchMessage, setFetchMessage] = useState('')
  const [entries, setEntries] = useState<Array<{ assetId: string; nav: string; contribution: string; participations?: string; liquidNavValue?: string; meanCost?: string }>>([
    { assetId: '', nav: '', contribution: '', participations: '', liquidNavValue: '', meanCost: '' }
  ])

  // Función para convertir mes en formato "2024-01" a "Enero 2024"
  const formatMonthDisplay = (monthStr: string): string => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const [year, month] = monthStr.split('-')
    const monthIndex = parseInt(month) - 1
    return `${months[monthIndex]} ${year}`
  }

  // Obtiene el mes anterior al mes actual
  const getPreviousMonth = (): string => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    
    if (month === 0) {
      return `${year - 1}-12`
    }
    return `${year}-${String(month).padStart(2, '0')}`
  }

  // Obtiene los activos del mes anterior con NAV > 0
  const getPreviousMonthAssets = () => {
    const prevMonth = getPreviousMonth()
    return history
      .filter(entry => entry.month === prevMonth && entry.nav > 0)
      .map(entry => ({
        assetId: entry.assetId,
        nav: entry.nav.toString(),
        contribution: '0'
      }))
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

  const handleOpenModal = (entry?: HistoryEntry) => {
    // Solo permitir editar registros del mes actual
    if (entry && !isCurrentMonth(entry.month)) {
      return
    }
    
    if (entry) {
      setEditingEntry(entry)
      setEntries([{
        assetId: entry.assetId,
        nav: entry.nav.toString(),
        contribution: entry.contribution.toString(),
        participations: entry.participations?.toString() || '',
        liquidNavValue: entry.liquidNavValue?.toString() || '',
        meanCost: entry.meanCost?.toString() || ''
      }])
    } else {
      setEditingEntry(null)
      // Auto-llenar con activos del mes anterior
      const prevMonthAssets = getPreviousMonthAssets()
      setEntries(prevMonthAssets.length > 0 ? prevMonthAssets : [{ assetId: '', nav: '', contribution: '', participations: '', liquidNavValue: '', meanCost: '' }])
    }
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar que haya al menos un activo con assetId
    const validEntries = entries.filter(entry => entry.assetId && entry.nav)
    if (validEntries.length === 0) {
      alert('Debe añadir al menos un activo con NAV')
      return
    }
    
    if (editingEntry) {
      // Editar - solo debe haber una entrada
      const entry = validEntries[0]
      const asset = assets.find(a => a.id === entry.assetId)
      setHistory(history.map(h =>
        h.id === editingEntry.id
          ? {
              id: h.id,
              month: getCurrentMonth(),
              assetId: entry.assetId || '',
              participations: parseFloat(entry.participations || '0') || asset?.participations || 0,
              liquidNavValue: parseFloat(entry.liquidNavValue || '0') || 0,
              nav: parseFloat(entry.nav || '0') || 0,
              contribution: parseFloat(entry.contribution || '0') || 0,
              meanCost: parseFloat(entry.meanCost || '0') || asset?.meanCost || 0
            }
          : h
      ))
    } else {
      // Crear nuevas entradas
      const newEntries = validEntries.map(entry => {
        const asset = assets.find(a => a.id === entry.assetId)
        return {
          id: generateUUID(),
          month: getCurrentMonth(),
          assetId: entry.assetId || '',
          participations: parseFloat(entry.participations || '0') || asset?.participations || 0,
          liquidNavValue: parseFloat(entry.liquidNavValue || '0') || 0,
          nav: parseFloat(entry.nav || '0') || 0,
          contribution: parseFloat(entry.contribution || '0') || 0,
          meanCost: parseFloat(entry.meanCost || '0') || asset?.meanCost || 0
        }
      })
      
      // Eliminar entradas previas del mes actual para ese asset
      const otherMonthEntries = history.filter(h => 
        !getCurrentMonth().match(h.month) || 
        !newEntries.some(ne => ne.assetId === h.assetId && h.month === getCurrentMonth())
      )
      
      setHistory([...otherMonthEntries, ...newEntries])
    }

    setIsModalOpen(false)
    setEditingEntry(null)
  }

  const handleDelete = (id: string) => {
    const entry = history.find(e => e.id === id)
    
    // Solo permitir eliminar registros del mes actual
    if (entry && !isCurrentMonth(entry.month)) {
      alert('No se pueden eliminar registros de meses anteriores')
      return
    }
    
    if (confirm('¿Está seguro de que desea eliminar este registro?')) {
      setHistory(history.filter(entry => entry.id !== id))
    }
  }

  const handleAddEntry = () => {
    setEntries([...entries, { assetId: '', nav: '', contribution: '' }])
  }

  const handleRemoveEntry = (idx: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== idx))
    }
  }

  const handleEntryChange = (idx: number, field: string, value: string) => {
    const newEntries = [...entries]
    newEntries[idx] = { ...newEntries[idx], [field]: value }
    setEntries(newEntries)
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

      const result: any = await response.json()
      console.log('Respuesta del servidor:', result)

      if (result.success) {
        // Convert prices to history entries
        const monthStr = `${year}-${String(month).padStart(2, '0')}`
        const priceMap = new Map(result.prices.map((p: any) => [p.assetId, p]))
        
        // Procesar todos los activos activos
        const newHistoryEntries = assets
          .filter(asset => !asset.archived)
          .map((asset) => {
            const price = priceMap.get(asset.id) as any
            const participations = asset.participations || 0
            
            // Obtener la entrada existente para este mes
            const existingEntry = history.find(h => h.month === monthStr && h.assetId === asset.id)
            
            // Para Cash, obtener la entrada más reciente (cualquier mes)
            const lastCashEntry = asset.name === 'Cash' 
              ? history.filter(h => h.assetId === asset.id).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
              : null
            
            // Si tiene precio nuevo del backend, usar ese; si no, usar el anterior
            let liquidNavValue: number
            if (price && price.price !== undefined && price.price !== null) {
              liquidNavValue = price.price
            } else if (existingEntry) {
              // Si no hay precio nuevo pero existe entrada anterior en el mismo mes, mantener el liquidNavValue
              liquidNavValue = existingEntry.liquidNavValue
            } else if (asset.name === 'Cash' && lastCashEntry) {
              // Para Cash, mantener el último valor conocido
              liquidNavValue = lastCashEntry.liquidNavValue
            } else {
              // Si no hay ni precio ni entrada anterior, usar 0
              liquidNavValue = 0
            }
            
            // Para Cash, el nav es directamente el liquidNavValue (no participations * liquidNavValue)
            const nav = asset.name === 'Cash' ? liquidNavValue : (participations * liquidNavValue)
            const contribution = existingEntry ? existingEntry.contribution : 0
            
            return {
              id: existingEntry?.id || generateUUID(),
              month: monthStr,
              assetId: asset.id,
              participations: participations,
              liquidNavValue: liquidNavValue,
              nav: nav,
              contribution: contribution,
              meanCost: asset.meanCost || 0
            }
          })

        // Update history (merge with existing)
        const updatedHistory = [...history]
        for (const newEntry of newHistoryEntries) {
          const existingIndex = updatedHistory.findIndex(
            h => h.month === newEntry.month && h.assetId === newEntry.assetId
          )
          
          if (existingIndex >= 0) {
            updatedHistory[existingIndex] = newEntry
          } else {
            updatedHistory.push(newEntry)
          }
        }

        setHistory(updatedHistory)
        setFetchMessage(`✅ Actualización completada\n\n${newHistoryEntries.length} activos actualizados`)
        console.log('✅ NAVs actualizados correctamente')
      } else {
        throw new Error(result.message || 'Error desconocido')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setFetchMessage(`❌ Error al actualizar precios:\n${errorMessage}`)
      console.error('❌ Error:', errorMessage)
    } finally {
      setIsFetchingPrices(false)
    }
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
          <Button variant="primary" onClick={() => handleOpenModal()}>
            + Nuevo Registro
          </Button>
        </div>
      </header>

      {/* Selector de año */}
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

      {/* Mensaje de estado de actualización */}
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

      {/* Historial por mes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(monthsData).map(([month, monthEntries]) => {
          const monthTotal = monthEntries.reduce((sum, e) => sum + e.nav, 0)
          // Excluir Cash del cálculo de "Invertido"
          const cashAsset = assets.find(a => a.name === 'Cash')
          const monthInvested = monthEntries
            .filter(e => !cashAsset || e.assetId !== cashAsset.id)
            .reduce((sum, e) => sum + e.contribution, 0)
          
          const isCurrentMonthDisplayed = isCurrentMonth(month)

          return (
            <Card key={month} title={formatMonthDisplay(month)} className="!p-4">
              <div className="space-y-3">
                {/* Métricas compactas */}
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

                {/* Tabla compacta */}
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
                      {monthEntries.map((entry) => {
                        const asset = assets.find(a => a.id === entry.assetId)
                        return (
                          <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                            <td className="py-1.5 px-2 font-semibold dark:text-white">
                              {asset ? (
                                <div className="flex items-center gap-1.5">
                                  <div 
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: asset.color }}
                                  ></div>
                                  <span className="truncate">{asset.name}</span>
                                </div>
                              ) : (
                                'N/A'
                              )}
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
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {monthEntries.length === 0 && (
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
      <Modal
        isOpen={isModalOpen}
        title={editingEntry ? 'Editar Registro' : 'Nuevo Registro'}
        onClose={() => setIsModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {entries.map((entry, idx) => (
              <div key={idx} className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                    Activo {idx + 1}
                  </label>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(idx)}
                      className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                
                <Select
                  label="Selecciona activo"
                  value={entry.assetId}
                  onChange={(e) => handleEntryChange(idx, 'assetId', e.target.value)}
                  options={assets.filter(a => !a.archived).map(a => ({ value: a.id, label: a.name }))}
                />

                <Input
                  label="NAV (€)"
                  type="number"
                  value={entry.nav}
                  onChange={(e) => handleEntryChange(idx, 'nav', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />

                <Input
                  label="Aportación (€)"
                  type="number"
                  value={entry.contribution}
                  onChange={(e) => handleEntryChange(idx, 'contribution', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            ))}
          </div>

          {!editingEntry && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddEntry}
              className="w-full"
            >
              + Añadir otro activo
            </Button>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingEntry ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
