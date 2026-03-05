// Tipos de datos para el cálculo de XIRR
export interface CashFlow {
  amount: number; // Negativo para aportaciones (salidas), Positivo para valor actual o retiros (entradas)
  date: Date;
}

// Diferencia en años entre dos fechas
const getYearsDifference = (d1: Date, d2: Date): number => {
  return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
};

// Ecuación NPV (Net Present Value) para XIRR
const calculateNPV = (rate: number, cashFlows: CashFlow[]): number => {
  if (cashFlows.length === 0) return 0;
  const startDate = cashFlows[0].date;
  return cashFlows.reduce((acc, cf) => {
    const years = getYearsDifference(startDate, cf.date);
    return acc + cf.amount / Math.pow(1 + rate, years);
  }, 0);
};

// Derivada de NPV para XIRR (Newton-Raphson)
const calculateNPVDerivative = (rate: number, cashFlows: CashFlow[]): number => {
  if (cashFlows.length === 0) return 0;
  const startDate = cashFlows[0].date;
  return cashFlows.reduce((acc, cf) => {
    const years = getYearsDifference(startDate, cf.date);
    if (years === 0) return acc; // Derivada de constante es 0
    return acc - (years * cf.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
};

/**
 * Calcula la Tasa Interna de Retorno Extendida (XIRR).
 * @param cashFlows Lista de flujos de caja con cantidad y fecha. El primer flujo asume el inicio.
 * @param guess Estimación inicial (por defecto 0.1, es decir 10%).
 * @returns El ratio XIRR (ej. 0.15 para 15%). Devuelve null si no converge o hay error.
 */
export const calculateXIRR = (cashFlows: CashFlow[], guess: number = 0.1): number | null => {
  if (cashFlows.length < 2) return null;

  // Asegurar que las fechas estén ordenadas
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Verificar que hay al menos un flujo positivo y uno negativo (requisito matemático)
  const hasPositive = sortedFlows.some(cf => cf.amount > 0);
  const hasNegative = sortedFlows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const npv = calculateNPV(rate, sortedFlows);
    const npvDerivative = calculateNPVDerivative(rate, sortedFlows);

    // Evitar división por cero si la derivada es muy pequeña
    if (Math.abs(npvDerivative) < 1e-10) {
      return null;
    }

    const newRate = rate - npv / npvDerivative;

    // Criterio de parada
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate; // x100 para porcentaje lo hará el que llame
    }

    rate = newRate;
  }

  return null; // No convergió
};

/**
 * Calcula el Maximum Drawdown de una serie histórica de valores.
 * @param navHistory Array de valores cronológicos (NAV o patrimonio total).
 * @returns { maxDrawdownPct: number, drawdownSeries: number[] }
 * maxDrawdownPct: El porcentaje máximo de caída (ej. -0.25 para -25%).
 * drawdownSeries: Array histórico de drawdowns paso a paso, útil para gráficos.
 */
export const calculateMaxDrawdown = (navHistory: number[]): { maxDrawdownPct: number, drawdownSeries: number[] } => {
  if (navHistory.length === 0) return { maxDrawdownPct: 0, drawdownSeries: [] };

  let peak = navHistory[0];
  let maxDrawdownPct = 0;
  const drawdownSeries: number[] = [];

  for (const nav of navHistory) {
    if (nav > peak) {
      peak = nav;
    }

    // Drawdown actual como porcentaje (negativo)
    const currentDrawdownPct = peak > 0 ? (nav - peak) / peak : 0;
    drawdownSeries.push(currentDrawdownPct);

    // Actualizar maxDrawdownPct (guardando el valor más negativo)
    if (currentDrawdownPct < maxDrawdownPct) {
      maxDrawdownPct = currentDrawdownPct;
    }
  }

  return { maxDrawdownPct, drawdownSeries };
};

/**
 * Calcula el Sharpe Ratio aproximado basado en retornos mensuales históricos.
 * Asume una tasa libre de riesgo.
 * @param navHistory Array de valores de cartera mensuales (cronológicos).
 * @param annualRiskFreeRate Tasa libre de riesgo anual (ej. 0.03 para 3%).
 * @returns El Sharpe Ratio anualizado.
 */
export const calculateSharpeRatio = (navHistory: number[], annualRiskFreeRate: number = 0.03): number | null => {
  if (navHistory.length < 2) return null;

  // Calcular retornos mensuales
  const monthlyReturns: number[] = [];
  for (let i = 1; i < navHistory.length; i++) {
    const prev = navHistory[i - 1];
    const curr = navHistory[i];
    if (prev > 0) {
      monthlyReturns.push((curr - prev) / prev);
    } else {
      monthlyReturns.push(0);
    }
  }

  if (monthlyReturns.length === 0) return null;

  // Media de retornos mensuales
  const meanMonthlyReturn = monthlyReturns.reduce((acc, r) => acc + r, 0) / monthlyReturns.length;

  // Desviación estándar de retornos mensuales (Volatilidad mensual)
  const variance = monthlyReturns.reduce((acc, r) => acc + Math.pow(r - meanMonthlyReturn, 2), 0) / (monthlyReturns.length - 1 || 1);
  const monthlyVolatility = Math.sqrt(variance);

  // Anualizar retornos y volatilidad (suponiendo 12 meses)
  const annualizedReturn = meanMonthlyReturn * 12;
  const annualizedVolatility = monthlyVolatility * Math.sqrt(12);

  if (annualizedVolatility === 0) return null;

  // Ratio de Sharpe = (Retorno de cartera - Retorno libre de riesgo) / Volatilidad
  return (annualizedReturn - annualRiskFreeRate) / annualizedVolatility;
};

// Calcula Time-Weighted Return (TWRR)
// El TWRR asume que partimos el periodo histórico en subperiodos cada vez que hay flujo de caja
// Pero en una aproximación mensual simple, multiplicamos los retornos encadenados (1+r1)*(1+r2)...
export const calculateTWRR = (navHistory: number[], contributions: number[]): number => {
  if (navHistory.length < 2 || navHistory.length !== contributions.length) return 0;

  let twrrMultiplier = 1;

  // Asumimos que la primera entrada es el inicio y su contribution es el balance inicial
  for (let i = 1; i < navHistory.length; i++) {
    const beginValue = navHistory[i - 1];
    const endValue = navHistory[i];
    // Contribution del mes actual
    const cashFlow = contributions[i];

    // Evitar divisiones por 0 si no había balance inicial
    if (beginValue + cashFlow > 0) {
      // Retorno del subperiodo = (Valor Final - Flujo de Caja) / (Valor Inicial) - 1
      // Si el flujo de caja ocurrió durante el mes, la convención estándar varía (inicio o fin de mes).
      // Aquí asumimos que las aportaciones mensuales se hacen a inicio de mes:
      // Subperiod Return HPR = End Value / (Begin Value + CashFlow)
      const hpr = endValue / (beginValue + cashFlow);
      twrrMultiplier *= hpr;
    }
  }

  return twrrMultiplier - 1; // Devuelve ej. 0.25 para 25%
};
