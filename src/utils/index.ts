// Utilidades de formato
export const formatCurrency = (value: number, locale = 'es-ES'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export const formatCurrencyDecimals = (value: number, decimals = 2, locale = 'es-ES'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

export const formatPercentage = (value: number, decimals = 2): string => {
  return `${value.toFixed(decimals)}%`
}

export const formatDate = (date: string | Date, locale = 'es-ES'): string => {
  const d = new Date(date)
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

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
