import { ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react'
import useCountUp from './useCountUp'

// Flat ERP KPI card: neutral surface, accent icon, semantic delta, count-up
// value. No tilt / hover-lift / hover-shadow — functional, not decorative.
export default function StatCard({ label, value, icon: Icon, delta, right, insight }) {
  const up = delta?.dir !== 'down'
  const display = useCountUp(value)

  return (
    <div
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
      className="rounded-xl border p-3 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {Icon && (
              <span className="h-5 w-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
                <Icon size={12} strokeWidth={2.2} />
              </span>
            )}
            <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--app-muted)' }}>{label}</span>
          </div>
          <h3 className="text-[20px] font-extrabold mt-1.5 leading-none tracking-tight tabular-nums" style={{ color: 'var(--app-heading)' }}>
            {display}
          </h3>
          {delta && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold mt-1.5 ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {delta.value}
              <span className="font-medium" style={{ color: 'var(--app-muted)' }}>vs last month</span>
            </span>
          )}
        </div>
        {right && <div className="shrink-0 flex items-center">{right}</div>}
      </div>
      {insight && (
        <div className="pt-2 border-t flex items-start gap-1.5" style={{ borderColor: 'var(--app-border)' }}>
          <Sparkles size={10} className="mt-0.5 shrink-0" style={{ color: 'var(--app-accent)' }} />
          <span className="text-[9.5px] font-medium leading-snug" style={{ color: 'var(--app-muted)' }}>{insight}</span>
        </div>
      )}
    </div>
  )
}
