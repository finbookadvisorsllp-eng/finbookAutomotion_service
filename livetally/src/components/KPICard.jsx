import {
  LineChart, Line, ResponsiveContainer, Tooltip
} from 'recharts'
import { formatINR } from '../data/mockData'

const VARIANT_CONFIG = {
  sales:       { bar: 'kpi-bar-sales',       iconBg: 'bg-blue-50',   iconColor: 'text-blue-600' },
  purchase:    { bar: 'kpi-bar-purchase',    iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
  receivables: { bar: 'kpi-bar-receivables', iconBg: 'bg-amber-50',  iconColor: 'text-amber-600' },
  payables:    { bar: 'kpi-bar-payables',    iconBg: 'bg-red-50',    iconColor: 'text-red-500' },
  cash:        { bar: 'kpi-bar-cash',        iconBg: 'bg-emerald-50',iconColor: 'text-emerald-600' },
  profit:      { bar: 'kpi-bar-profit',      iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
}

const SPARK_COLORS = {
  sales: '#2563eb', purchase: '#7c3aed', receivables: '#f59e0b',
  payables: '#ef4444', cash: '#10b981', profit: '#6366f1',
}

export default function KPICard({ data, onClick }) {
  const { label, current, change, trend, icon, variant, subtitle, warning, sparkData } = data
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.sales
  const lineColor = SPARK_COLORS[variant] || '#2563eb'
  const sparkPoints = sparkData.map((v, i) => ({ i, v }))

  const isPositiveTrend = (variant === 'receivables' || variant === 'payables')
    ? trend === 'down'
    : trend === 'up'

  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-xl border border-slate-100 p-4 sm:p-5 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-slate-200 transition-all duration-200 overflow-hidden animate-slide-up group"
    >
      {/* Accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${cfg.bar}`} />

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${cfg.iconBg} ${cfg.iconColor} shrink-0`}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="text-[22px] font-extrabold text-slate-900 tracking-tight mb-2 leading-none">
        {formatINR(current)}
      </div>

      {/* Change + period */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`flex items-center gap-1 text-[12px] font-bold ${isPositiveTrend ? 'text-emerald-600' : 'text-red-500'}`}>
          {isPositiveTrend ? '↑' : '↓'} {Math.abs(change)}%
        </span>
        <span className="text-[12px] text-slate-400 font-medium">{subtitle}</span>
        {warning && (
          <span className="ml-auto text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
            ⚠ {warning}
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-12 -mx-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkPoints}>
            <Line
              type="monotone" dataKey="v"
              stroke={lineColor} strokeWidth={2.5}
              dot={false} activeDot={{ r: 4, fill: lineColor }}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => active && payload?.length ? (
                <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-700 shadow-md">
                  {payload[0].value}
                </div>
              ) : null}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
