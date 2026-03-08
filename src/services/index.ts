import { Asset, HistoryEntry, BitcoinTransaction, StockTransaction } from '../types'
import { jsPDF } from 'jspdf'
export { fetchAndUpdatePrices } from './priceUpdater'

export const exportService = {
  exportJSON(
    assets: Asset[],
    history: HistoryEntry[],
    bitcoinTransactions: BitcoinTransaction[],
    stockTransactions: StockTransaction[]
  ) {
    const backupData = {
      assets,
      history,
      bitcoinTransactions,
      stockTransactions,
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
    bitcoinTransactions: BitcoinTransaction[]
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

    // Transacciones Bitcoin
    if (bitcoinTransactions.length > 0) {
      yPos += 10
      pdf.setFontSize(11)
      pdf.text('Transacciones Bitcoin:', 20, yPos)
      yPos += 10

      bitcoinTransactions.forEach(tx => {
        if (yPos > pageHeight - bottomMargin) {
          pdf.addPage()
          yPos = 20
        }
        const line = `${tx.date}: ${tx.type} - ${tx.amountBTC} BTC @ €${tx.meanPrice}`
        pdf.text(line, 25, yPos)
        yPos += 7
      })
    }

    pdf.save('wealthhub_report.pdf')
  }
}
