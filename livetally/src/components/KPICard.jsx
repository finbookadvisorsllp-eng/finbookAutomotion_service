import { formatINR } from '../data/mockData'
import { TrendingUp, TrendingDown } from 'lucide-react'

// Per-variant accent colors — light only, dark preserved via Tailwind overrides
const VARIANT = {
  sales: {
    iconBg: 'bg-blue-50 dark:bg-[rgba(182,255,0,0.1)]',
    iconColor: 'text-blue-600 dark:text-[#B6FF00]',
  },
  purchase: {
    iconBg: 'bg-indigo-50 dark:bg-[rgba(30,123,255,0.1)]',
    iconColor: 'text-indigo-600 dark:text-[#1E7BFF]',
  },
  receivables: {
    iconBg: 'bg-amber-50 dark:bg-[rgba(255,242,0,0.1)]',
    iconColor: 'text-amber-600 dark:text-[#FFF200]',
  },
  payables: {
    iconBg: 'bg-rose-50 dark:bg-[rgba(255,51,102,0.1)]',
    iconColor: 'text-rose-600 dark:text-[#FF3366]',
  },
  cash: {
    iconBg: 'bg-emerald-50 dark:bg-[rgba(182,255,0,0.1)]',
    iconColor: 'text-emerald-600 dark:text-[#B6FF00]',
  },
  profit: {
    iconBg: 'bg-violet-50 dark:bg-[rgba(30,123,255,0.1)]',
    iconColor: 'text-violet-600 dark:text-[#1E7BFF]',
  },
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
    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/50 dark:border-none dark:text-[#B6FF00] dark:bg-[rgba(182,255,0,0.15)]'
    : 'text-rose-700 bg-rose-50 border border-rose-200/50 dark:border-none dark:text-[#FF3366] dark:bg-[rgba(255,51,102,0.15)]'

  return (
    <div
      onClick={onClick}
      className="cursor-pointer group transition-all duration-200 erp-card erp-card-hover p-4 flex flex-col justify-between min-h-[112px]"
    >
      {/* ── Top Row: Icon + Label (Left) & Trend Pill (Right) ── */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${cfg.iconBg} ${cfg.iconColor}`}
          >
            {icon}
          </div>
          <p
            className="text-[12px] font-medium text-slate-500 dark:text-slate-400 truncate leading-tight"
          >
            {label}
          </p>
        </div>

        {/* Trend Pill on top right — guaranteed zero overflow at 100% zoom */}
        <div className="flex items-center gap-1 shrink-0">
          {warning && (
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 dark:text-[#050505] dark:bg-[#FFF200] rounded-full px-1.5 py-0.5">
              ⚠
            </span>
          )}
          <span
            className={`inline-flex items-center gap-0.5 rounded-md font-semibold px-1.5 py-0.5 text-[11px] leading-none ${trendClass}`}
          >
            <TrendIcon size={10} strokeWidth={2.5} />
            {Math.abs(change)}%
          </span>
        </div>
      </div>

      {/* ── Bottom Row: Large Metric Value & Subtitle ── */}
      <div className="mt-2.5">
        <p
          className="text-[17px] sm:text-[18px] font-bold tracking-tight text-slate-900 dark:text-white leading-none truncate tabular-nums"
        >
          {formatINR(current)}
        </p>
        {data.subtitle && (
          <p className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 mt-1 truncate">
            {data.subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
