import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { History, Sun, CalendarClock } from 'lucide-react'

export default function BusinessTimeline({ data }) {
  const navigate = useNavigate()
  const totalVch = data?.totalVouchers || 0
  const pending = data?.pendingApproval || 0
  const posted = data?.postedToTally || 0
  const ocr = data?.ocrDocumentsProcessed || 0

  const cols = [
    {
      key: 'y',
      label: 'Yesterday',
      icon: History,
      route: '/automation/ai-processing',
      items: [
        `Imported ${ocr.toLocaleString('en-IN')} vouchers via OCR`,
        `Exported ${posted.toLocaleString('en-IN')} to Tally`,
        `Database active with ${totalVch.toLocaleString('en-IN')} total entries`
      ]
    },
    {
      key: 't',
      label: 'Today',
      icon: Sun,
      accent: true,
      route: '/automation/approval-center',
      items: [
        `${pending.toLocaleString('en-IN')} drafts pending review`,
        `${posted.toLocaleString('en-IN')} vouchers ready to export`,
        `Tally connected — live synced`
      ]
    },
    {
      key: 'm',
      label: 'Tomorrow',
      icon: CalendarClock,
      route: '/tally/connector',
      items: [
        `Auto-sync queued for new vouchers`,
        `Live ledger mapping check`,
        `Scheduled Tally sync active`
      ]
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
      {cols.map((col, ci) => {
        const Icon = col.icon
        return (
          <motion.div
            key={col.key}
            onClick={() => navigate(col.route)}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: ci * 0.06 }}
            className="rounded-xl border p-3 cursor-pointer hover:border-[var(--app-accent)] transition-colors"
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
