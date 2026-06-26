import { motion } from 'motion/react'
import { History, Sun, CalendarClock } from 'lucide-react'

// Narrative strip: Yesterday → Today → Tomorrow with mock AI summaries.
const COLS = [
  { key: 'y', label: 'Yesterday', icon: History, items: ['Imported 128 vouchers', 'Exported 96 to Tally', 'Mapped 4 new ledgers'] },
  { key: 't', label: 'Today', icon: Sun, accent: true, items: ['12 drafts pending review', '40 vouchers ready to export', 'Tally connected — synced 2h ago'] },
  { key: 'm', label: 'Tomorrow', icon: CalendarClock, items: ['230 vouchers queued for import', '3 masters need mapping', 'Scheduled Tally sync at 9 AM'] },
]

export default function BusinessTimeline() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
      {COLS.map((col, ci) => {
        const Icon = col.icon
        return (
          <motion.div
            key={col.key}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: ci * 0.06 }}
            className="rounded-xl border p-3"
            style={{ borderColor: col.accent ? 'var(--app-accent)' : 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow)' }}
          >
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="h-5 w-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
                <Icon size={12} strokeWidth={2.2} />
              </span>
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: col.accent ? 'var(--app-accent)' : 'var(--app-heading)' }}>{col.label}</h3>
            </div>
            <ul className="space-y-1.5">
              {col.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-[11.5px] font-medium" style={{ color: 'var(--app-text)' }}>
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--app-accent)' }} />
                  {it}
                </li>
              ))}
            </ul>
          </motion.div>
        )
      })}
    </div>
  )
}
