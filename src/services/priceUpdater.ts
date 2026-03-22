import { Asset, HistoryEntry, StockTransaction, BitcoinTransaction } from '../types'
import { config } from '../config'

export interface FetchPricesResult {
  success: boolean
  updatedHistory: HistoryEntry[]
  message: string
  errors: string[]
}

/**
 * Función centralizada para actualizar precios de activos
 * Delegada totalmente al backend para mantener single source of truth.
 */
export async function fetchAndUpdatePrices(
  _assets: Asset[],
  history: HistoryEntry[],
  _stockTransactions: StockTransaction[] = [],
  _bitcoinTransactions: BitcoinTransaction[] = []
): Promise<FetchPricesResult> {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    console.log(`🔄 Iniciando actualización de NAVs vía Backend server para ${year}-${month}...`)

    const syncResponse = await fetch(
      `${config.backendUrl}/api/portfolio/sync-month?year=${year}&month=${month}`,
      { method: 'POST' }
    )

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      throw new Error(`Error HTTP sync ${syncResponse.status}: ${errorText}`)
    }

    const syncResult = await syncResponse.json()

    if (!syncResult.success) {
      throw new Error(syncResult.message || 'Error interno durante el sync de precios')
    }

    console.log('📥 Descargando historial consolidado desde Source of Truth en Backend...')
    const historyResponse = await fetch(`${config.backendUrl}/api/history`)
    
    if (!historyResponse.ok) {
      throw new Error(`Error HTTP al descargar el historial consolidado: ${historyResponse.status}`)
    }

    const updatedHistory: HistoryEntry[] = await historyResponse.json()

    let message = `✅ ACTUALIZACIÓN EN SERVIDOR COMPLETADA\n`
    message += `╔════════════════════════════════════════╗\n`
    message += `║  Activos procesados: ${syncResult.prices?.length || 0}                     ║\n`
    if (syncResult.lastBusinessDay) {
        message += `║  Fecha valor: ${syncResult.lastBusinessDay}                    ║\n`
    }
    message += `╚════════════════════════════════════════╝\n\n`
    message += `El NAV y los participaciones han sido recalculados de forma segura mediante los componentes del broker y guardados en la BD de forma inmutable.`

    return {
      success: true,
      updatedHistory,
      message,
      errors: syncResult.errors || []
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error fetching prices from backend:', errorMessage)

    const message = 
      `❌ ERROR DE CONEXIÓN O VALIDACIÓN\n╔════════════════════════════════════════╗\n\n` +
      `No se pudo sincronizar el historial con la Base de Datos.\n\n` +
      `Servidor Backend: ${config.backendUrl}\n` +
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
