import { Asset, HistoryEntry, Transaction } from '../types'
import { jsPDF } from 'jspdf'
import { config } from '../config'
export { fetchAndUpdatePrices } from './priceUpdater'

export const apiService = {
  async saveData(
    assets: Asset[],
    history: HistoryEntry[],
    transactions: Transaction[]
  ) {
    
    const dataToSend = {
      assets,
      history,
      transactions,
      lastUpdated: new Date().toISOString()
    }

    return fetch(`${config.backendUrl}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataToSend)
    })
  },

  async fetchData() {
    const response = await fetch(`${config.backendUrl}/data`)
    return response.json()
  }
}

export const exportService = {
  exportJSON(
    assets: Asset[],
    history: HistoryEntry[],
    transactions: Transaction[]
  ) {
    const backupData = {
      assets,
      history,
      transactions,
      exportedAt: new Date().toISOString()
    }

    const dataStr = JSON.stringify(backupData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wealthhub_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  exportPDF(
    assets: Asset[],
    history: HistoryEntry[],
    transactions: Transaction[]
  ) {
    const pdf = new jsPDF()
    pdf.setFontSize(16)
    pdf.text('WealthHub - Reporte de Patrimonio', 20, 20)

    let yPos = 40
    const pageHeight = pdf.internal.pageSize.height
    const bottomMargin = 20

    pdf.setFontSize(12)
    pdf.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 20, yPos)
    yPos += 20

    // Resumen de activos
    pdf.setFontSize(11)
    pdf.text('Activos:', 20, yPos)
    yPos += 10

    assets.forEach(asset => {
      if (yPos > pageHeight - bottomMargin) {
        pdf.addPage()
        yPos = 20
      }
      // Obtener NAV del mes actual del historial
      const assetHistory = history.filter(h => h.assetId === asset.id)
      const nav = assetHistory.length > 0 
        ? assetHistory[assetHistory.length - 1].nav 
        : 0
      pdf.text(`${asset.name}: €${nav.toLocaleString('es-ES')}`, 25, yPos)
      yPos += 7
    })

    // Transacciones
    const cryptoAssets = assets.filter(a => a.category === 'Crypto')
    const cryptoIds = cryptoAssets.map(a => a.id)
    const cryptoTransactions = transactions.filter(t => cryptoIds.includes(t.assetId))

    if (cryptoTransactions.length > 0) {
      yPos += 10
      pdf.setFontSize(11)
      pdf.text('Transacciones Crypto:', 20, yPos)
      yPos += 10

      cryptoTransactions.forEach(tx => {
        if (yPos > pageHeight - bottomMargin) {
          pdf.addPage()
          yPos = 20
        }
        const tickerStr = tx.ticker ? ` ${tx.ticker}` : ''
        const line = `${tx.date}: ${tx.type} - ${tx.quantity}${tickerStr} @ €${tx.pricePerUnit}`
        pdf.text(line, 25, yPos)
        yPos += 7
      })
    }

    pdf.save('wealthhub_report.pdf')
  }
}
