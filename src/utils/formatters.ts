// src/utils/formatters.ts
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
