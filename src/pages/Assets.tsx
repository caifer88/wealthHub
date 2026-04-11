import { useState, useCallback } from 'react'
import { Plus, Archive, ArchiveX, RefreshCw } from 'lucide-react'
import { useWealthData } from '../hooks'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MetricCard } from '../components/ui/MetricCard'
import { formatCurrency, formatCurrencyDecimals } from '../utils'
import type { Asset } from '../types'
import { useAssetMetrics } from '../hooks/useAssetMetrics'
import { getCategoryMeta } from '../hooks/useAllocation'
import { AssetDetailModal } from '../components/AssetDetailModal'
import { BulkUpdateModal } from '../components/BulkUpdateModal'
import { fetchAndUpdatePrices } from '../services/priceUpdater'

// Componente para renderizar la tarjeta de cada activo separando su lógica hook.
const AssetCard = ({ 
  asset, 
  onAssetClick, 
  totalNAV, 
  assets,
  history,
  stockTransactions,
  bitcoinTransactions
}: { 
  asset: Asset, 
  onAssetClick: (asset: Asset) => void,
  totalNAV: number,
  assets: Asset[],
  history: any[],
  stockTransactions: any[],
  bitcoinTransactions: any[]
}) => {
  
  const {
    currentValue,
    gainPercent,
    gain,
    hasPositions,
    positionsData
  } = useAssetMetrics(asset, assets, history, stockTransactions, bitcoinTransactions)

  const valueToDisplay = currentValue
  const gainToDisplay = gain
  const gainPercentDisplay = gainPercent

  if (asset.name === 'Cash') {
    return (
      <Card 
        className="overflow-hidden transition-all hover:shadow-lg flex flex-col justify-center items-center py-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 cursor-pointer"
        onClick={() => onAssetClick(asset)}
      >
        <div className="text-center">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Efectivo Disponible</p>
          <p className="text-4xl font-black dark:text-white">{formatCurrency(Math.round(currentValue))}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-lg cursor-pointer ${asset.isArchived ? 'opacity-50' : ''}`}
      onClick={() => onAssetClick(asset)}
    >
      {/* Header compacto */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: asset.color }} />
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-bold truncate ${asset.isArchived ? 'line-through text-slate-400' : 'dark:text-white'}`}>
              {asset.name}
            </h3>
            {(asset.isin || asset.ticker) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {asset.isin || asset.ticker}
              </p>
            )}
          </div>
        </div>
        {/* Category Badge */}
        {(() => {
          const m = getCategoryMeta(asset.category)
          return (
            <span className={`flex-shrink-0 ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${m.color} ${m.textColor}`}>
              {m.label}
            </span>
          )
        })()}
      </div>

      {/* Valor de mercado principal y ROI Global */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-center">
        <div className="flex justify-between items-end mb-1">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase">Valor de Mercado</p>
          {!hasPositions && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gainToDisplay >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {gainToDisplay >= 0 ? '↑' : '↓'} {gainPercentDisplay.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-black dark:text-white tracking-tight">{formatCurrencyDecimals(valueToDisplay, 2)}</p>
        
        {hasPositions && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-1">
            <span className="font-semibold text-slate-400 dark:text-slate-500">Incluye: </span>
            {positionsData.map(p => p.ticker).join(', ')}
          </p>
        )}
      </div>

      {/* Porcentaje de cartera */}
      {!asset.isArchived && totalNAV > 0 && (
        <div className="px-5 py-2 flex justify-between items-center text-xs bg-white dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">% Cartera</p>
          <div className="flex items-center gap-2">
             <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full" 
                  style={{ width: `${Math.min(((valueToDisplay / totalNAV) * 100), 100)}%` }} 
                />
             </div>
             <p className="font-bold text-slate-700 dark:text-slate-300">
               {((valueToDisplay / totalNAV) * 100).toFixed(1)}%
             </p>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function Assets() {
  const { metrics, assets, refetchData, history, stockTransactions, bitcoinTransactions } = useWealthData()
  const [showArchived, setShowArchived] = useState(false)
  const [sortColumn] = useState<'name' | 'category' | 'value' | 'percentage'>('name')
  const [sortDirection] = useState<'asc' | 'desc'>('asc')
  
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false)
  const [isFetchingPrices, setIsFetchingPrices] = useState(false)

  const handleFetchPrices = async () => {
    try {
      setIsFetchingPrices(true)
      const result = await fetchAndUpdatePrices(assets, history, stockTransactions, bitcoinTransactions)
      if (result.success) {
        await refetchData()
      } else {
        alert(`Error al actualizar precios: ${result.message}`)
      }
    } catch (error) {
      alert("Error desconocido al actualizar precios.")
    } finally {
      setIsFetchingPrices(false)
    }
  }

  const displayedAssets = showArchived ? assets : assets.filter((a: Asset) => !a.isArchived)

  // Simplificamos calculo de NAV Global. 
  // Para las tarjetas usamos Metric del backend si existe, o iteramos para sumar.
  const globalTotalNAV = metrics?.totalNAV ?? 0

  const getSortedAssets = useCallback((assetList: Asset[], column: string, direction: string) => {
    // Para simplificar la UI, usamos las mismas cards que internamente auto-resuelven su hook.
    // Esto significa que ordenar por "value" requeriría calcular el NAV aquí. 
    // Como la ordenación de esta vista base era local, la dejaremos en orden alfabético para la Master-View limpia.
    const sorted = [...assetList]
    const isAsc = direction === 'asc'

    switch (column) {
      case 'name':
        return sorted.sort((a: Asset, b: Asset) => isAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
      case 'category':
        return sorted.sort((a: Asset, b: Asset) => isAsc ? a.category.localeCompare(b.category) : b.category.localeCompare(a.category))
      default:
        return sorted
    }
  }, [])

  const sortedAssetValues = getSortedAssets(displayedAssets, sortColumn, sortDirection)

  const handleOpenDetail = (asset?: Asset) => {
    setSelectedAsset(asset || null)
    setIsDetailModalOpen(true)
  }

  const getArchivedCount = (): number => {
    return assets.filter((a: Asset) => a.isArchived).length
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
            Gestión de Activos
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Administra tu cartera y consulta históricos por activo
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={handleFetchPrices}
            disabled={isFetchingPrices}
            className="whitespace-nowrap"
          >
            <RefreshCw size={18} className={`inline mr-2 ${isFetchingPrices ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Update Navs</span>
          </Button>
          <Button variant="secondary" onClick={() => setIsBulkUpdateModalOpen(true)} className="whitespace-nowrap">
            Registrar Mes
          </Button>
          <Button variant="primary" onClick={() => handleOpenDetail()} className="whitespace-nowrap">
            <Plus size={20} className="inline sm:mr-2" />
            <span className="hidden sm:inline">Nuevo Activo</span>
          </Button>
        </div>
      </header>

      {/* Métricas Globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Patrimonio"
          value={formatCurrency(Math.round(globalTotalNAV))}
          subtitle="Valor actual NAV"
        />
        <MetricCard
          title="Activos"
          value={displayedAssets.length}
          subtitle="Número de activos"
        />
      </div>

      {getArchivedCount() > 0 && (
        <div className="flex justify-end mt-2 mb-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            {showArchived ? (
              <>
                <ArchiveX size={16} />
                <span>Ocultar archivados ({getArchivedCount()})</span>
              </>
            ) : (
              <>
                <Archive size={16} />
                <span>Mostrar archivados ({getArchivedCount()})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Vista de Activos - Grid de tarjetas Maestro */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {sortedAssetValues.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400 mb-4">No hay activos para mostrar</p>
                <Button variant="primary" onClick={() => handleOpenDetail()}>
                  <Plus size={16} className="mr-2" />
                  Crear primer activo
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          sortedAssetValues.map(asset => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              onAssetClick={handleOpenDetail} 
              totalNAV={globalTotalNAV}
              assets={assets}
              history={history}
              stockTransactions={stockTransactions}
              bitcoinTransactions={bitcoinTransactions}
            />
          ))
        )}
      </div>

      {/* Modal / Drawer Expandido de Detalles del Activo */}
      <AssetDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        asset={selectedAsset}
        history={history}
        refetchData={refetchData}
      />

      {/* Modal de Actualización en Lote (Sustituto rápido de la antigua pestaña General) */}
      <BulkUpdateModal
        isOpen={isBulkUpdateModalOpen}
        onClose={() => setIsBulkUpdateModalOpen(false)}
        assets={assets}
        history={history}
        refetchData={refetchData}
      />
    </div>
  )
}
