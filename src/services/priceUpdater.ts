import { Asset, HistoryEntry, StockTransaction, BitcoinTransaction } from '../types' // Añade BitcoinTransaction
import { formatCurrencyDecimals, generateUUID } from '../utils'
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
 * Mantiene consistencia entre las pestañas de Activos e Historial
 */
export async function fetchAndUpdatePrices(
  assets: Asset[],
  history: HistoryEntry[],
  stockTransactions: StockTransaction[] = [],
  bitcoinTransactions: BitcoinTransaction[] = [] // <--- Nuevo parámetro añadido
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
    const priceMap = new Map(result.prices.map((p: any) => [p.asset_id, p]))

    // Helper: Obtener el última entrada anterior de un activo
    const getLastEntry = (asset_id: string, beforeMonth?: string) => {
      let entries = history.filter(h => h.asset_id === asset_id)
      if (beforeMonth) {
        entries = entries.filter(h => h.month < beforeMonth)
      }
      if (entries.length === 0) return null
      return entries.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
    }

    // Helper: Calcular valor de un broker desde transacciones de acciones
    const calculateBrokerValue = (brokerName: string): { value: number; tickerDetails: Array<{ticker: string; value: number; shares: number}> } => {
      const brokerTransactions = stockTransactions.filter(tx => tx.broker === brokerName)
      const tickerMap = new Map<string, { shares: number; totalCost: number }>()

      for (const tx of brokerTransactions) {
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
              // Obtener la última entrada anterior al mes actual
              const lastHistory = getLastEntry(tickerAsset.id, monthStr)
              if (lastHistory && lastHistory.liquidNavValue > 0) {
                tickerValue = data.shares * lastHistory.liquidNavValue
              } else {
                // Fallback: usar el precio medio de compra
                tickerValue = data.shares * (data.totalCost / data.shares)
              }
            }
          } else {
            // Si no existe activo, intentar usar el precio del ticker desde priceMap o historial
            const fakeasset_id = `ticker-${ticker.trim().toUpperCase()}`
            const fetchedPrice = priceMap.get(fakeasset_id) as any
            if (fetchedPrice && fetchedPrice.price > 0) {
              tickerValue = data.shares * fetchedPrice.price
            } else {
              const lastHistory = getLastEntry(fakeasset_id, monthStr)
              if (lastHistory && lastHistory.liquidNavValue > 0) {
                tickerValue = data.shares * lastHistory.liquidNavValue
              } else {
                tickerValue = data.shares * (data.totalCost / data.shares)
              }
            }
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

        // Obtener la entrada existente para este mes
        const existingEntry = history.find(h => h.month === monthStr && h.asset_id === asset.id)

        // Obtener la última entrada registrada de meses anteriores (excluyendo el mes actual)
        const lastEntry = getLastEntry(asset.id, monthStr)

        // 🟢 FIX 1: Priorizar las participaciones y coste medio del último historial
        let participations = existingEntry?.participations ?? lastEntry?.participations ?? asset.participations ?? 0;
        const meanCost = existingEntry?.meanCost ?? lastEntry?.meanCost ?? asset.meanCost ?? 0;

        // 🟢 FIX 2: Para Bitcoin, las participaciones son siempre la suma de las transacciones
        const isBitcoin = asset.category?.toUpperCase() === 'CRYPTO' || asset.ticker?.toUpperCase() === 'BTC';
        
        if (isBitcoin && bitcoinTransactions.length > 0) {
          let totalBtc = 0;
          bitcoinTransactions.forEach(tx => {
            if (tx.type === 'buy') totalBtc += (tx.amountBTC || 0);
            else if (tx.type === 'sell') totalBtc -= (tx.amountBTC || 0);
          });
          if (totalBtc > 0) {
            participations = totalBtc; // Usamos el total real (~0.254)
          }
        }

        // Helper para validar si un precio es válido (no NaN, no null, no undefined, > 0)
        const isValidPrice = (p: any): boolean => {
          return p && 
                 p.price !== undefined && 
                 p.price !== null && 
                 !isNaN(p.price) && 
                 p.price > 0
        }

        // Lógica para determinar liquidNavValue y NAV
        let liquidNavValue: number = 0
        let nav: number = 0

        if (asset.category?.toUpperCase() === 'STOCK') {
          // Si el backend nos envía el precio consolidado (válido), lo usamos directamente
          if (isValidPrice(price)) {
            nav = Number(price.price) // <-- AQUÍ ESTÁ LA CLAVE: Forzamos que sea numérico
            liquidNavValue = nav > 0 ? 1 : 0
          } else {
            // Fallback: calcular desde transacciones de acciones abiertas si el backend falla
            const brokerCalc = calculateBrokerValue(asset.name)
            nav = brokerCalc.value
            liquidNavValue = nav > 0 ? 1 : 0
            
            if (nav === 0) {
              if (existingEntry && existingEntry.nav > 0) {
                nav = existingEntry.nav
                liquidNavValue = existingEntry.liquidNavValue
              } else if (lastEntry && lastEntry.nav > 0) {
                nav = lastEntry.nav
                liquidNavValue = lastEntry.liquidNavValue
              }
            }
          }
        } else if (asset.category?.toUpperCase() === 'CASH') {
          // Para Cash: mantener el último NAV válido
          // Si hay un precio nuevo válido, usarlo (Aunque poco probable para Cash)
          if (isValidPrice(price)) {
            liquidNavValue = price.price
            nav = liquidNavValue
          } else {
            // Si no hay precio nuevo válido, usar el NAV anterior
            if (existingEntry && existingEntry.nav > 0) {
              // Si existe entrada para este mes, mantener el nav actual
              nav = existingEntry.nav
              liquidNavValue = existingEntry.liquidNavValue
            } else if (lastEntry && lastEntry.nav > 0) {
              // Si no hay entrada para este mes, usar el del mes anterior
              nav = lastEntry.nav
              liquidNavValue = lastEntry.liquidNavValue
            } else {
              // Si no hay nada, usar 0
              nav = 0
              liquidNavValue = 0
            }
          }
        } else if (isValidPrice(price)) {
          // Si hay precio nuevo válido del backend, usar ese
          liquidNavValue = price.price
          nav = participations * liquidNavValue
        } else {
          // Si el precio no es válido, mantener el NAV anterior
          if (existingEntry && existingEntry.nav > 0) {
            // Si existe entrada para este mes, mantener el nav actual
            nav = existingEntry.nav
            liquidNavValue = existingEntry.liquidNavValue
          } else if (lastEntry && lastEntry.nav > 0) {
            // Si no hay entrada para este mes, usar el del mes anterior
            nav = lastEntry.nav
            liquidNavValue = lastEntry.liquidNavValue
          } else {
            // Si no hay nada, usar 0
            nav = 0
            liquidNavValue = 0
          }
        }

        // Validación final: asegurar que no sean NaN
        if (isNaN(liquidNavValue)) {
          liquidNavValue = (existingEntry && existingEntry.liquidNavValue > 0) 
            ? existingEntry.liquidNavValue 
            : ((lastEntry && lastEntry.liquidNavValue > 0) ? lastEntry.liquidNavValue : 0)
        }
        if (isNaN(nav)) {
          nav = (existingEntry && existingEntry.nav > 0) 
            ? existingEntry.nav 
            : ((lastEntry && lastEntry.nav > 0) ? lastEntry.nav : 0)
        }

        // Como la aportación es MENSUAL (incremental), un mes nuevo arranca en 0 aportaciones
        let contribution: number
        if (existingEntry) {
          contribution = existingEntry.contribution
        } else {
          contribution = 0
        }

        return {
          id: existingEntry?.id || generateUUID(),
          month: monthStr,
          asset_id: asset.id,
          participations: participations,
          liquidNavValue: liquidNavValue,
          nav: nav,
          contribution: contribution,
          meanCost: meanCost
        }
      })
      
      // 🟢 FIX: Añadir precios de tickers individuales al historial para que la pestaña de Acciones pueda leerlos
      const tickerPrices = result.prices.filter((p: any) => p.asset_id && p.asset_id.startsWith('ticker-'))
      
      for (const p of tickerPrices) {
        if (p.price !== undefined && p.price !== null && !isNaN(p.price) && p.price > 0) {
          const fakeasset_id = p.asset_id
          const existingEntry = history.find(h => h.month === monthStr && h.asset_id === fakeasset_id)
          
          newHistoryEntries.push({
            id: existingEntry?.id || generateUUID(),
            month: monthStr,
            asset_id: fakeasset_id,
            participations: 1,
            liquidNavValue: p.price,
            nav: p.price,
            contribution: 0, // No aplica aportación individual, está agregada en el Broker
            meanCost: p.price
          })
        }
      }
    
    // Build detailed message with updated assets info
    const successLines: string[] = []
    const sourceGroups: { [key: string]: string[] } = {}

    // Update history (merge with existing)
    const updatedHistory = [...history]
    for (const newEntry of newHistoryEntries) {
      const asset = assets.find(a => a.id === newEntry.asset_id)

      const existingIndex = updatedHistory.findIndex(
        h => h.month === newEntry.month && h.asset_id === newEntry.asset_id
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
        const priceData = result.prices.find((p: PriceResult) => p.asset_id === newEntry.asset_id)
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
    message += `║  Fecha: ${result.lastBusinessDay}                      ║\n`
    message += `║  Activos: ${result.prices.length}                            ║\n`
    message += `╚════════════════════════════════════════╝\n\n`

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
