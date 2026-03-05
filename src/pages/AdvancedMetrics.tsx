import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWealth } from '../context/WealthContext';
import { Card } from '../components/ui/Card';
import { MetricCard } from '../components/ui/MetricCard';
import {
  calculateXIRR,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  calculateTWRR,
  CashFlow
} from '../utils/advancedMetrics';

export default function AdvancedMetrics() {
  const { assets, history, darkMode } = useWealth();

  // Procesamiento de datos para Métricas Avanzadas (memoized)
  const metricsData = useMemo(() => {
    if (!history || history.length === 0) {
      return null;
    }

    // 1. Agrupar historial por mes para obtener totales consolidados
    // HistoryEntry tiene month: YYYY-MM
    const monthlyDataMap = new Map<string, { nav: number; contribution: number }>();

    // Ignoramos el activo 'Cash' para rentabilidad si así se desea,
    // pero XIRR total suele incluir Cash. Por consistencia con el Dashboard, excluiremos Cash del ROI.
    const nonCashAssets = assets.filter(a => a.name !== 'Cash');
    const nonCashAssetIds = new Set(nonCashAssets.map(a => a.id));

    history.forEach(entry => {
      if (nonCashAssetIds.has(entry.assetId)) {
        const existing = monthlyDataMap.get(entry.month) || { nav: 0, contribution: 0 };
        existing.nav += (entry.nav || 0);
        existing.contribution += (entry.contribution || 0);
        monthlyDataMap.set(entry.month, existing);
      }
    });

    // Ordenar cronológicamente
    const sortedMonths = Array.from(monthlyDataMap.keys()).sort();

    if (sortedMonths.length === 0) return null;

    const navSeries: number[] = [];
    const contributionSeries: number[] = [];
    const chartData: any[] = [];
    const cashFlows: CashFlow[] = [];

    sortedMonths.forEach((month) => {
      const data = monthlyDataMap.get(month)!;
      navSeries.push(data.nav);

      // La "contribution" en HistoryEntry es históricamente una aportación acumulada o del mes
      // Dependiendo de cómo lo guarde WealthHub, asumo que `contribution` en historial es *acumulada* o *del mes*.
      // Si es la aportación mensual, se usa directo. Si es acumulada, sacamos el delta.
      // Basado en el código de WealthHub, contribution en HistoryEntry suele ser la aportación de ESE mes para ese activo.
      contributionSeries.push(data.contribution);

      // Preparar CashFlows para XIRR
      // Nota: En XIRR las aportaciones son negativas (salida de dinero de tu bolsillo hacia la cartera).
      // Parsear mes a fecha: YYYY-MM-01
      const date = new Date(`${month}-01T00:00:00`);

      if (data.contribution > 0) {
        cashFlows.push({ amount: -data.contribution, date });
      }

      chartData.push({
        month,
        nav: data.nav,
        invested: data.contribution
      });
    });

    // Añadir el Valor Final (positivo) al final de los CashFlows para el XIRR
    if (navSeries.length > 0 && cashFlows.length > 0) {
      const lastMonth = sortedMonths[sortedMonths.length - 1];
      const lastDate = new Date(`${lastMonth}-28T00:00:00`); // Fines de mes aprox
      const currentNav = navSeries[navSeries.length - 1];
      cashFlows.push({ amount: currentNav, date: lastDate });
    }

    // Cálculos Finales
    const xirrValue = calculateXIRR(cashFlows, 0.1);
    const twrrValue = calculateTWRR(navSeries, contributionSeries);
    const sharpeRatio = calculateSharpeRatio(navSeries, 0.03); // Asumiendo 3% Risk Free Rate
    const { maxDrawdownPct, drawdownSeries } = calculateMaxDrawdown(navSeries);

    // Adjuntar la serie de drawdown al chartData
    drawdownSeries.forEach((dd, i) => {
      chartData[i].drawdown = dd * 100; // Porcentaje visual -25%
    });

    return {
      xirr: xirrValue !== null ? (xirrValue * 100).toFixed(2) : 'N/A',
      twrr: (twrrValue * 100).toFixed(2),
      sharpe: sharpeRatio !== null ? sharpeRatio.toFixed(2) : 'N/A',
      maxDrawdown: (maxDrawdownPct * 100).toFixed(2),
      chartData
    };
  }, [history, assets]);

  if (!metricsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-slate-600 dark:text-slate-400">Sin datos suficientes para calcular métricas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">
          Métricas Avanzadas
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Análisis de rentabilidad temporal y gestión de riesgo de la cartera.
        </p>
      </header>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tasa Interna de Retorno (XIRR)"
          value={metricsData.xirr !== 'N/A' ? `${metricsData.xirr}%` : 'Calculando...'}
          subtitle="Rentabilidad anualizada penalizando/premiando el timing"
          color="text-indigo-600 dark:text-indigo-400"
        />
        <MetricCard
          title="Time-Weighted Return (TWRR)"
          value={`${metricsData.twrr}%`}
          subtitle="Rentabilidad aislada del efecto de aportaciones/retiros"
          color="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          title="Ratio de Sharpe"
          value={metricsData.sharpe}
          subtitle="Rendimiento ajustado por volatilidad (Risk-free 3%)"
          color="text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          title="Maximum Drawdown"
          value={`${metricsData.maxDrawdown}%`}
          subtitle="Máxima caída desde el pico histórico"
          color="text-rose-600 dark:text-rose-400"
        />
      </div>

      {/* Gráfico de Drawdown */}
      <Card title="Evolución del Drawdown (Caídas desde picos)">
        <div className="h-[400px] -ml-4 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metricsData.chartData} margin={{ top: 20, right: 30, bottom: 20, left: 40 }}>
              <defs>
                <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
              <XAxis
                dataKey="month"
                stroke={darkMode ? '#94a3b8' : '#64748b'}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke={darkMode ? '#94a3b8' : '#64748b'}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                  border: `1px solid ${darkMode ? '#475569' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '12px'
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#e11d48"
                strokeWidth={2}
                fill="url(#colorDrawdown)"
                name="Drawdown"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Glosario Educativo */}
      <Card title="¿Qué significan estas métricas?">
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <p>
            <strong>XIRR (Tasa Interna de Retorno Extendida):</strong> Calcula el rendimiento anualizado de tu cartera teniendo en cuenta las fechas exactas de tus aportaciones y retiros. Es la medida más precisa de "cuánto" dinero has generado por tu capacidad para elegir cuándo invertir.
          </p>
          <p>
            <strong>TWRR (Time-Weighted Rate of Return):</strong> Elimina el sesgo de los flujos de caja externos. Mide exclusivamente la habilidad de los activos de la cartera para generar rentabilidad, independientemente de si aportaste más dinero en el peor o mejor momento. Útil para comparar con índices de referencia (benchmarks).
          </p>
          <p>
            <strong>Ratio de Sharpe:</strong> Mide el rendimiento excedente (por encima de una tasa libre de riesgo, estimada en 3%) por cada unidad de volatilidad asumida. Un ratio mayor a 1.0 se considera bueno, ya que indica que estás recibiendo rendimientos adecuados por el riesgo que corres.
          </p>
          <p>
            <strong>Maximum Drawdown:</strong> Es la métrica de riesgo principal en la gestión de capital. Representa la mayor pérdida porcentual sufrida por tu cartera desde su punto más alto (pico) hasta su punto más bajo antes de que se establezca un nuevo máximo. Te dice "¿cuál es el peor sufrimiento que he experimentado?".
          </p>
        </div>
      </Card>
    </div>
  );
}
