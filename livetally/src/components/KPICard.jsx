import { formatINR } from '../data/mockData'
import { TrendingUp, TrendingDown } from 'lucide-react'

// Per-variant classes
const VARIANT = {
  sales: { colorClass: 'bg-blue-100 text-blue-600 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00]' },
  purchase: { colorClass: 'bg-indigo-100 text-indigo-600 dark:bg-[rgba(30,123,255,0.1)] dark:text-[#1E7BFF]' },
  receivables: { colorClass: 'bg-amber-100 text-amber-600 dark:bg-[rgba(255,242,0,0.1)] dark:text-[#FFF200]' },
  payables: { colorClass: 'bg-red-100 text-red-600 dark:bg-[rgba(255,51,102,0.1)] dark:text-[#FF3366]' },
  cash: { colorClass: 'bg-emerald-100 text-emerald-600 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00]' },
  profit: { colorClass: 'bg-indigo-100 text-indigo-600 dark:bg-[rgba(30,123,255,0.1)] dark:text-[#1E7BFF]' },
}

export default function KPICard({ data, onClick }) {
  const { label, current, change, trend, icon, variant, warning } = data
  const cfg = VARIANT[variant] ?? VARIANT.sales

  // Green = good: sales/purchase/profit up, receivables/payables down
  const isGood = (variant === 'receivables' || variant === 'payables')
    ? trend === 'down'
    : trend === 'up'

  const TrendIcon = isGood ? TrendingUp : TrendingDown
  const trendClass = isGood
    ? 'text-emerald-600 bg-emerald-50 dark:text-[#B6FF00] dark:bg-[rgba(182,255,0,0.15)]'
    : 'text-red-600 bg-red-50 dark:text-[#FF3366] dark:bg-[rgba(255,51,102,0.15)]'

  return (
    <div
      onClick={onClick}
      className="animate-slide-up cursor-pointer group transition-all duration-200"
      style={{
        background: 'var(--theme-kpi-bg)',
        borderRadius: 8,
        padding: '6px 8px',
        border: '1px solid var(--theme-kpi-border)',
        boxShadow: 'var(--theme-kpi-shadow)',
        minHeight: 46, // ~33% reduction from 68px
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = 'var(--theme-kpi-shadow-hover)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'var(--theme-kpi-shadow)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* ── Top row: icon + label + warning ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Icon circle */}
          <div
            className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 text-[10px] ${cfg.colorClass}`}
          >
            {icon}
          </div>

          {/* Label */}
          <p
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: 'var(--theme-text-muted)',
              lineHeight: 1,
              fontFamily: "'Nunito','Inter',system-ui,sans-serif",
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </p>
        </div>

        {warning && (
          <span
              className="text-[8px] font-extrabold text-amber-700 bg-amber-100 dark:text-[#050505] dark:bg-[#FFF200] rounded-full px-1 py-[1px] font-sans"
            >
              ⚠
          </span>
        )}
      </div>

      {/* ── Bottom row: Value + Trend ── */}
      <div className="flex items-end justify-between">
        {/* Value */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: 'var(--theme-text-main)',
            lineHeight: 1,
            letterSpacing: '-0.01em',
            fontFamily: "'Nunito','Inter',system-ui,sans-serif",
          }}
        >
          {formatINR(current)}
        </p>

        {/* Trend + Subtitle */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`flex items-center justify-center rounded-sm font-extrabold px-1 py-0.5 ${trendClass}`}
            style={{ fontSize: 9, lineHeight: 1 }}
          >
            <TrendIcon size={9} strokeWidth={3} className="mr-0.5" />
            {Math.abs(change)}%
          </span>
          {data.subtitle && (
            <span style={{ fontSize: 7.5, color: 'var(--theme-text-muted)', fontWeight: 700, lineHeight: 1 }}>
              {data.subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
