// Status pill. `tone` picks semantic color; status meaning only — never brand.
// statusTone() maps the common voucher statuses used across panels.
const TONES = {
  neutral: 'bg-slate-500/10 text-slate-500 border-slate-500/15',
  accent: 'border border-[var(--app-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]',
  success: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  warning: 'bg-amber-500/12 text-amber-600 border-amber-500/20 dark:text-amber-400',
  danger: 'bg-rose-500/12 text-rose-600 border-rose-500/20 dark:text-rose-400',
}

export function statusTone(status = '') {
  const s = status.toLowerCase()
  if (['approved', 'success', 'paid', 'completed', 'active', 'synced', 'connected'].some((k) => s.includes(k))) return 'success'
  if (['pending', 'review', 'draft', 'processing', 'partial'].some((k) => s.includes(k))) return 'warning'
  if (['rejected', 'failed', 'overdue', 'error', 'inactive'].some((k) => s.includes(k))) return 'danger'
  return 'neutral'
}

export default function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {dot && <span className="h-1 w-1 rounded-full bg-current" />}
      {children}
    </span>
  )
}
