import { motion } from 'motion/react'
import { ArrowRight, PieChart, Workflow, Sparkles, Activity } from 'lucide-react'
import Card from '../ui/Card'

// ── Shared widget shell ────────────────────────────────────────────────
export function Widget({ icon: Icon, title, action, children, className = '', bodyClass = '' }) {
  return (
    <Card hover className={`p-3.5 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-1.5">
          {Icon && (
            <span className="h-5 w-5 rounded-md flex items-center justify-center" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
              <Icon size={12} strokeWidth={2.2} />
            </span>
          )}
          <h3 className="text-[10.5px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--app-heading)' }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className={`flex-1 ${bodyClass}`}>{children}</div>
    </Card>
  )
}

function MoreLink({ onClick, children = 'View all' }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-0.5 text-[10.5px] font-bold hover:gap-1.5 transition-all" style={{ color: 'var(--app-accent)' }}>
      {children} <ArrowRight size={11} />
    </button>
  )
}

// ── Voucher sources donut ──────────────────────────────────────────────
const SOURCES = [
  { label: 'Manual Entry', pct: 34, val: '8,720', color: 'var(--app-accent)' },
  { label: 'OCR Upload', pct: 28, val: '7,180', color: '#10B981' },
  { label: 'Excel Import', pct: 21, val: '5,386', color: '#8B5CF6' },
  { label: 'Tally Sync', pct: 11, val: '2,821', color: '#F59E0B' },
  { label: 'API', pct: 6, val: '1,541', color: '#94A3B8' },
]

export function VoucherSourcesCard({ onMore }) {
  const C = 314.16
  let acc = 0
  return (
    <Widget icon={PieChart} title="Voucher Sources" action={<MoreLink onClick={onMore} />}>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--app-row-border)" strokeWidth="12" />
            {SOURCES.map((s, i) => {
              const dash = (s.pct / 100) * C
              const off = -(acc / 100) * C
              acc += s.pct
              return <circle key={i} cx="60" cy="60" r="50" fill="none" stroke={s.color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${Math.max(dash - 4, 0)} ${C}`} strokeDashoffset={off} />
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-extrabold tabular-nums" style={{ color: 'var(--app-heading)' }}>25,648</span>
            <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>Total</span>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5">
          {SOURCES.map((s) => (
            <li key={s.label} className="flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 min-w-0"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} /><span className="truncate" style={{ color: 'var(--app-text)' }}>{s.label}</span></span>
              <span className="tabular-nums ml-1" style={{ color: 'var(--app-heading)' }}>{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Widget>
  )
}

// ── Import/Export pipeline ─────────────────────────────────────────────
const PIPELINE = [
  { label: 'Import queue', pct: 100, tone: '#10B981' },
  { label: 'OCR processing', pct: 72, tone: 'var(--app-accent)' },
  { label: 'Validation', pct: 54, tone: 'var(--app-accent)' },
  { label: 'Export to Tally', pct: 38, tone: 'var(--app-accent)' },
]

export function PipelineCard({ onMore }) {
  return (
    <Widget icon={Workflow} title="Import / Export Pipeline" action={<MoreLink onClick={onMore} />}>
      <div className="space-y-3 mt-0.5">
        {PIPELINE.map((p) => (
          <div key={p.label} className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span style={{ color: 'var(--app-text)' }}>{p.label}</span>
              <span className="tabular-nums" style={{ color: 'var(--app-heading)' }}>{p.pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-row-border)' }}>
              <motion.div className="h-full rounded-full" style={{ backgroundColor: p.tone }} initial={{ width: 0 }} animate={{ width: `${p.pct}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </div>
        ))}
      </div>
    </Widget>
  )
}

// ── AI insights ────────────────────────────────────────────────────────
const INSIGHTS = [
  { text: '40 vouchers ready to export', desc: 'Approved & validated', tone: '#10B981' },
  { text: '3 possible duplicates', desc: 'Review before export', tone: '#F59E0B' },
  { text: '4 unmapped ledgers', desc: 'Exports may fail', tone: '#EF4444' },
  { text: '12 drafts pending', desc: 'Awaiting review', tone: 'var(--app-accent)' },
]

export function AiInsightsCard({ onMore }) {
  return (
    <Widget icon={Sparkles} title="AI Insights" action={<MoreLink onClick={onMore} />}>
      <ul className="space-y-1.5">
        {INSIGHTS.map((it, i) => (
          <motion.li key={it.text} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5 rounded-lg border p-2 transition-colors hover:bg-[var(--app-row-hover)]" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}>
            <span className="h-7 w-1 rounded-full shrink-0" style={{ backgroundColor: it.tone }} />
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold truncate" style={{ color: 'var(--app-heading)' }}>{it.text}</p>
              <p className="text-[10px] font-medium" style={{ color: 'var(--app-muted)' }}>{it.desc}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </Widget>
  )
}

// ── Approval workflow ──────────────────────────────────────────────────
const STAGES = [
  { label: 'Draft', val: 12, tone: 'var(--app-muted)' },
  { label: 'Pending', val: 8, tone: '#F59E0B' },
  { label: 'Review', val: 5, tone: 'var(--app-accent)' },
  { label: 'Approved', val: 18, tone: '#10B981' },
  { label: 'Exported', val: 96, tone: '#10B981' },
]

export function ApprovalWorkflowCard({ onMore }) {
  return (
    <Widget icon={Activity} title="Approval Workflow" action={<MoreLink onClick={onMore} />}>
      <div className="flex items-center justify-between gap-1">
        {STAGES.map((s, i) => (
          <div key={s.label} className="flex-1 flex flex-col items-center text-center">
            <span className="text-[18px] font-extrabold tabular-nums leading-none" style={{ color: 'var(--app-heading)' }}>{s.val}</span>
            <span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.tone }} />
            <span className="mt-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>{s.label}</span>
            {i < STAGES.length - 1 && <span className="sr-only">→</span>}
          </div>
        ))}
      </div>
    </Widget>
  )
}
