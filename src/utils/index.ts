// Re-export formatters
export * from './formatters'

// Utilidades matemáticas

export const calculateCompoundInterest = (
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  months: number
): { capitalInvested: number; totalValue: number; monthLabel: string; monthIndex: number }[] => {
  const results = []
  const monthlyRate = annualRate / 12 / 100

  let totalCapital = principal
  let totalValue = principal

  for (let i = 0; i < months; i++) {
    // Add monthly contribution
    totalCapital += monthlyContribution
    totalValue = totalCapital

    // Apply compound interest
    for (let j = 0; j < i; j++) {
      totalValue = (totalValue + monthlyContribution) * (1 + monthlyRate)
    }

    const currentDate = new Date()
    currentDate.setMonth(currentDate.getMonth() + i)
    const monthLabel = currentDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })

    results.push({
      capitalInvested: totalCapital,
      totalValue: totalCapital + (totalCapital * (monthlyRate * i)),
      monthLabel,
      monthIndex: i
    })
  }

  return results
}

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Obtiene el mes actual en formato "YYYY-MM"
export const getCurrentMonth = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// Verifica si un mes es el mes actual
export const isCurrentMonth = (monthStr: string): boolean => {
  return monthStr === getCurrentMonth()
}

// Extrae el mes de una fecha en formato "YYYY-MM-DD" -> "YYYY-MM"
export const getMonthFromDate = (dateStr: string): string => {
  return dateStr.slice(0, 7)
}

// Obtiene las participaciones actuales (del último mes en el histórico)
export const getCurrentParticipations = (assetId: string, history: any[]): number => {
  const assetHistory = history.filter(h => h.assetId === assetId)
  
  if (assetHistory.length === 0) return 0
  
  // Obtener la última entrada por fecha
  const lastEntry = [...assetHistory].sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
  return lastEntry?.participations || 0
}

// Calcula el coste medio correcto basado en el último registro del histórico del activo
export const calculateMeanCost = (assetId: string, history: any[]): number => {
  const assetHistory = history.filter(h => h.assetId === assetId)
  
  if (assetHistory.length === 0) return 0
  
  // Obtener la última entrada por fecha
  const lastEntry = [...assetHistory].sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
  
  return lastEntry?.meanCost || 0
}

// Extrae el total invertido (sumando todas las aportaciones históricas)
export const calculateTotalInvested = (assetId: string, history: any[]): number => {
  const assetHistory = history.filter(h => h.assetId === assetId)
  return assetHistory.reduce((sum, h) => sum + (h.contribution || 0), 0)
}
