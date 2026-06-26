import { motion } from 'motion/react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

// Minimalist KPI card: neutral surface, single accent icon chip, semantic delta.
// Replaces the multi-color tinted dashboard cards.
//   delta: { value: '12.5%', dir: 'up' | 'down' }
//   right: optional node (sparkline) rendered on the right
export default function StatCard({ label, value, icon: Icon, delta, right, index = 0 }) {
  const up = delta?.dir !== 'down'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-xl border p-3 flex items-start justify-between gap-2 transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {Icon && (
            <span
              className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
            >
              <Icon size={12} strokeWidth={2.2} />
            </span>
          )}
          <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--app-muted)' }}>{label}</span>
        </div>
        <h3 className="text-[20px] font-extrabold mt-1.5 leading-none tracking-tight" style={{ color: 'var(--app-heading)' }}>
          {value}
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
    </motion.div>
  )
}
