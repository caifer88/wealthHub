import { Asset, HistoryEntry, StockTransaction } from '../types'
import { formatCurrencyDecimals, generateUUID } from '../utils'
import { config } from '../config'

interface PriceResult {
  assetId: string
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
 * Mantiene consistencia entre las pestañas de Activos e Historial
 */
export async function fetchAndUpdatePrices(
  assets: Asset[],
  history: HistoryEntry[],
  stockTransactions: StockTransaction[] = []
): Promise<FetchPricesResult> {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const monthStr = `${year}-${String(month).padStart(2, '0')}`

    console.log(`🔄 Iniciando actualización de NAVs para ${monthStr}`)

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

    if (!result.success) {
      throw new Error(result.message || 'Error desconocido')
    }

    // Crear mapa de precios
    const priceMap = new Map(result.prices.map((p: any) => [p.assetId, p]))

    // Helper: Obtener el última entrada anterior de un activo
    const getLastEntry = (assetId: string, beforeMonth?: string) => {
      const entries = history.filter(h => h.assetId === assetId)
      if (beforeMonth) {
        entries.filter(h => h.month < beforeMonth)
      }
      if (entries.length === 0) return null
      return entries.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
    }

    // Helper: Calcular valor de Interactive Brokers desde transacciones de acciones
    const calculateInteractiveBrokersValue = (): { value: number; tickerDetails: Array<{ticker: string; value: number; shares: number}> } => {
      const ibTransactions = stockTransactions.filter(tx => tx.broker === 'Interactive Brokers')
      const tickerMap = new Map<string, { shares: number; totalCost: number }>()

      for (const tx of ibTransactions) {
        const existing = tickerMap.get(tx.ticker) || { shares: 0, totalCost: 0 }
        if (tx.type === 'buy') {
          existing.shares += tx.shares
          existing.totalCost += tx.totalAmount
        } else {
          existing.shares -= tx.shares
          existing.totalCost -= tx.totalAmount
        }
        tickerMap.set(tx.ticker, existing)
      }

      let totalValue = 0
      const tickerDetails: Array<{ticker: string; value: number; shares: number}> = []
      
      for (const [ticker, data] of tickerMap.entries()) {
        if (data.shares > 0) {
          // Intentar encontrar el activo correspondiente para obtener el precio actual
          const tickerAsset = assets.find(a => a.ticker === ticker)
          let tickerValue = 0
          
          if (tickerAsset) {
            const fetchedPrice = priceMap.get(tickerAsset.id) as any
            if (fetchedPrice && fetchedPrice.price > 0) {
              tickerValue = data.shares * fetchedPrice.price
            } else {
              const lastHistory = getLastEntry(tickerAsset.id)
              if (lastHistory && lastHistory.liquidNavValue > 0) {
                tickerValue = data.shares * lastHistory.liquidNavValue
              } else {
                // Fallback: usar el precio medio de compra
                tickerValue = data.shares * (data.totalCost / data.shares)
              }
            }
          } else {
            // Si no existe activo, usar el precio medio de compra
            tickerValue = data.shares * (data.totalCost / data.shares)
          }
          
          totalValue += tickerValue
          tickerDetails.push({
            ticker,
            value: tickerValue,
            shares: data.shares
          })
        }
      }
      
      return { value: totalValue, tickerDetails }
    }

    // Procesar todos los activos activos
    const newHistoryEntries = assets
      .filter(asset => !asset.archived)
      .map((asset) => {
        const price = priceMap.get(asset.id) as any
        const participations = asset.participations || 0

        // Obtener la entrada existente para este mes
        const existingEntry = history.find(h => h.month === monthStr && h.assetId === asset.id)

        // Obtener la última entrada registrada de meses anteriores
        const lastEntry = getLastEntry(asset.id)

        // Helper para validar si un precio es válido (no NaN, no null, no undefined, > 0)
        const isValidPrice = (p: any): boolean => {
          return p && 
                 p.price !== undefined && 
                 p.price !== null && 
                 !isNaN(p.price) && 
                 p.price > 0
        }

        // Lógica para determinar liquidNavValue
        let liquidNavValue: number = 0

        if (asset.name === 'Interactive Brokers') {
          // Para Interactive Brokers: calcular desde transacciones de acciones abiertas
          const ibCalc = calculateInteractiveBrokersValue()
          liquidNavValue = ibCalc.value > 0 ? 1 : 0
          // Si no hay valor, mantener el anterior
          if (liquidNavValue === 0 && lastEntry && lastEntry.liquidNavValue > 0) {
            liquidNavValue = lastEntry.liquidNavValue
          }
        } else if (asset.name === 'Cash') {
          // Para Cash: siempre usar el último valor conocido
          if (lastEntry && lastEntry.liquidNavValue > 0) {
            liquidNavValue = lastEntry.liquidNavValue
          } else if (existingEntry && existingEntry.liquidNavValue > 0) {
            liquidNavValue = existingEntry.liquidNavValue
          }
        } else if (isValidPrice(price)) {
          // Si hay precio nuevo válido del backend, usar ese
          liquidNavValue = price.price
        } else if (existingEntry && existingEntry.liquidNavValue > 0) {
          // Si no hay precio nuevo válido pero existe entrada anterior en el mismo mes, mantener el liquidNavValue
          liquidNavValue = existingEntry.liquidNavValue
        } else if (lastEntry && lastEntry.liquidNavValue > 0) {
          // Si no hay nada válido anterior, mantener el último valor conocido de cualquier mes
          liquidNavValue = lastEntry.liquidNavValue
        } else {
          // Si no hay ni precio ni entrada anterior, usar 0
          liquidNavValue = 0
        }

        // Validación final: asegurar que liquidNavValue no sea NaN
        if (isNaN(liquidNavValue)) {
          liquidNavValue = lastEntry ? lastEntry.liquidNavValue : 0
        }

        // Calcular NAV según el tipo de activo
        let nav: number
        if (asset.name === 'Interactive Brokers') {
          const ibCalc = calculateInteractiveBrokersValue()
          nav = ibCalc.value
          // Si Interactive Brokers no tiene valor, usa el anterior
          if (nav === 0 && lastEntry && lastEntry.nav > 0) {
            nav = lastEntry.nav
          }
        } else if (asset.name === 'Cash') {
          nav = liquidNavValue
        } else {
          nav = participations * liquidNavValue
        }

        // Validación final de NAV: no permitir NaN
        if (isNaN(nav)) {
          // Si el NAV calculado es NaN, usar el anterior
          nav = existingEntry ? existingEntry.nav : (lastEntry ? lastEntry.nav : 0)
        }
        
        // Doble validación: si liquidNavValue es NaN después de todo, usar el anterior
        if (isNaN(liquidNavValue) && lastEntry) {
          liquidNavValue = lastEntry.liquidNavValue > 0 ? lastEntry.liquidNavValue : 0
        } else if (isNaN(liquidNavValue)) {
          liquidNavValue = 0
        }

        // Mantener aportación anterior
        let contribution: number
        if (existingEntry) {
          contribution = existingEntry.contribution
        } else {
          contribution = 0
        }

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

    // Build detailed message with updated assets info
    const successLines: string[] = []
    const sourceGroups: { [key: string]: string[] } = {}

    // Update history (merge with existing)
    const updatedHistory = [...history]
    for (const newEntry of newHistoryEntries) {
      const asset = assets.find(a => a.id === newEntry.assetId)

      const existingIndex = updatedHistory.findIndex(
        h => h.month === newEntry.month && h.assetId === newEntry.assetId
      )

      let oldValue = existingIndex >= 0 ? updatedHistory[existingIndex].nav : 0
      let isUpdate = existingIndex >= 0

      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = newEntry
      } else {
        updatedHistory.push(newEntry)
      }

      // Build detail string for this asset
      if (asset) {
        const identifier = asset.ticker || asset.isin || asset.name
        const priceData = result.prices.find((p: PriceResult) => p.assetId === newEntry.assetId)
        const source = priceData?.source || 'unknown'
        const sourceLabels: Record<string, string> = {
          'yfinance': '📈 Yahoo Finance',
          'binance_api': '🔗 Binance API',
          'ft_markets': '📰 FT Markets',
          'user_input': '📝 Manual',
          'fund_scraper': '🔍 Web Scraper',
          'morningstar': '⭐ Morningstar'
        }
        const sourceLabel = sourceLabels[source] || source

        const changeInfo = isUpdate
          ? `${formatCurrencyDecimals(oldValue, 2)} → ${formatCurrencyDecimals(newEntry.nav, 2)}`
          : `Nuevo: ${formatCurrencyDecimals(newEntry.nav, 2)}`

        const line = `${asset.name} (${identifier})\n    Participaciones: ${newEntry.participations}\n    Liquidativo: ${formatCurrencyDecimals(newEntry.liquidNavValue, 2)}\n    NAV: ${formatCurrencyDecimals(newEntry.nav, 2)}\n    Cambio: ${changeInfo}\n    Fuente: ${sourceLabel}`
        successLines.push(line)

        // Group by source for summary
        if (!sourceGroups[sourceLabel]) {
          sourceGroups[sourceLabel] = []
        }
        sourceGroups[sourceLabel].push(asset.name)

        console.log(`✅ ${asset.name}: ${changeInfo} (${sourceLabel})`)
      }
    }

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

    console.log(`✅ Actualización completada: ${result.prices.length} activos procesados`)

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
