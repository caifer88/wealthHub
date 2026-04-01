import React from 'react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  color?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  color = 'text-slate-900 dark:text-white'
}) => (
  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
    <p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
      {title}
    </p>
    <p className={`text-2xl font-black tracking-tight tabular-nums ${color} mb-1`}>
      {value}
    </p>
    {subtitle && (
      <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    )}
  </div>
)
