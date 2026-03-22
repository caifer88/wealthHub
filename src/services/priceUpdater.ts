import { Asset, HistoryEntry, StockTransaction, BitcoinTransaction } from '../types' // Añade BitcoinTransaction
import { formatCurrencyDecimals } from '../utils'
import { config } from '../config'

interface PriceResult {
  asset_id: string
  price: number
  source: string
}

export interface FetchPricesResult {
  success: boolean
  updatedHistory: HistoryEntry[]
  message: string
  errors: string[]
}

/**
 * Función centralizada para actualizar precios de activos
 * Ahora hace un simple POST al backend, delegando toda la lógica de negocio.
 * Mantiene consistencia entre las pestañas de Activos e Historial
 */
export async function fetchAndUpdatePrices(
  assets: Asset[],
  history: HistoryEntry[],
  _stockTransactions: StockTransaction[] = [],
  _bitcoinTransactions: BitcoinTransaction[] = []
): Promise<FetchPricesResult> {
  try {
    console.log(`🔄 Iniciando sincronización de NAVs en el backend`)

    // Call the new sync endpoint
    const response = await fetch(`${config.backendUrl}/api/portfolio/sync-month`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Error HTTP ${response.status}:`, errorText)
      throw new Error(`Error HTTP ${response.status}: ${errorText || 'Sin detalles disponibles'}`)
    }

    const result: any = await response.json()
    console.log('Respuesta de sincronización del servidor:', result)

    if (!result.success) {
      throw new Error(result.message || 'Error desconocido')
    }

    // Now fetch the updated history
    console.log(`📥 Descargando historial actualizado...`)
    const historyResponse = await fetch(`${config.backendUrl}/api/history`)

    if (!historyResponse.ok) {
      throw new Error(`Error HTTP al descargar historial ${historyResponse.status}`)
    }
    
    const updatedHistoryData = await historyResponse.json()
    const updatedHistory: HistoryEntry[] = updatedHistoryData

    // Build detail string for updated assets
    const successLines: string[] = []
    const sourceGroups: { [key: string]: string[] } = {}

    // Find the month we just synced (from updatedHistory, latest month)
    const latestMonth = updatedHistory.length > 0
      ? [...new Set(updatedHistory.map(h => h.month))].sort().reverse()[0]
      : null

    if (latestMonth) {
      const newEntries = updatedHistory.filter(h => h.month === latestMonth)
      for (const newEntry of newEntries) {
        // Skip ticker virtual assets in the summary for cleaner UI
        if (newEntry.asset_id && newEntry.asset_id.startsWith('ticker-')) continue;

        const asset = assets.find(a => a.id === newEntry.asset_id)
        if (asset && !asset.archived) {
          const identifier = asset.ticker || asset.isin || asset.name
          const priceData = result.prices.find((p: PriceResult) => p.asset_id === newEntry.asset_id)
          const source = priceData?.source || (asset.name === 'Cash' ? 'Efectivo (Arrastre)' : 'Arrastre / Calculado')
          const sourceLabels: Record<string, string> = {
            'yfinance': '📈 Yahoo Finance',
            'yfinance_aggregated': '📊 Agregado',
            'binance_api': '🔗 Binance API',
            'ft_markets': '📰 FT Markets',
            'user_input': '📝 Manual',
            'fund_scraper': '🔍 Web Scraper',
            'morningstar': '⭐ Morningstar'
          }
          const sourceLabel = sourceLabels[source] || source

          // Find previous value
          const oldEntry = history.find(h => h.month === latestMonth && h.asset_id === newEntry.asset_id)
          const oldValue = oldEntry ? oldEntry.nav : 0
          const isUpdate = !!oldEntry

          const changeInfo = isUpdate
            ? `${formatCurrencyDecimals(oldValue, 2)} → ${formatCurrencyDecimals(newEntry.nav, 2)}`
            : `Nuevo: ${formatCurrencyDecimals(newEntry.nav, 2)}`

          const line = `${asset.name} (${identifier})\n    Participaciones: ${newEntry.participations}\n    Liquidativo: ${formatCurrencyDecimals(newEntry.liquidNavValue, 2)}\n    NAV: ${formatCurrencyDecimals(newEntry.nav, 2)}\n    Cambio: ${changeInfo}\n    Fuente: ${sourceLabel}`
          successLines.push(line)

          if (!sourceGroups[sourceLabel]) {
            sourceGroups[sourceLabel] = []
          }
          sourceGroups[sourceLabel].push(asset.name)
        }
      }
    }

    let message = `✅ ACTUALIZACIÓN COMPLETADA\n`
    message += `╔════════════════════════════════════════╗\n`
    message += `║  Fecha: ${result.lastBusinessDay}                      ║\n`
    message += `║  Activos procesados: ${successLines.length}                ║\n`
    message += `╚════════════════════════════════════════╝\n\n`

    message += successLines.join('\n\n')

    message += `\n\n───────────────────────────────────────\n`
    message += `RESUMEN POR FUENTE:\n\n`
    Object.entries(sourceGroups).forEach(([source, assetList]) => {
      message += `${source}: ${assetList.join(', ')}\n`
    })

    const errors: string[] = []
    if (result.errors && result.errors.length > 0) {
      message += `\n───────────────────────────────────────\n`
      message += `⚠️ ADVERTENCIAS:\n\n`
      result.errors.forEach((error: string) => {
        message += `• ${error}\n`
        errors.push(error)
      })
      console.warn('Errores en la actualización:', result.errors)
    }

    console.log(`✅ Actualización completada y sincronizada exitosamente`)

    return {
      success: true,
      updatedHistory,
      message,
      errors
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error fetching prices:', errorMessage)

    const message = 
      `❌ ERROR DE CONEXIÓN\n╔════════════════════════════════════════╗\n\n` +
      `No se pudo conectar al backend\n\n` +
      `Servidor: ${config.backendUrl}\n` +
      `Error: ${errorMessage}\n\n` +
      `╚════════════════════════════════════════╝`

    return {
      success: false,
      updatedHistory: history,
      message,
      errors: [errorMessage]
    }
  }
}
