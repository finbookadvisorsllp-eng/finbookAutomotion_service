import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, PieChart, Workflow, Sparkles, Activity, FileText, Clock, Eye, CheckCircle2, Upload } from 'lucide-react'
import Card from '../ui/Card'
import OpenDoodle from '../ui/OpenDoodle'
import useCountUp from '../ui/useCountUp'

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

// Map source label to route
const SOURCE_ROUTES = {
  'Manual Entry': '/sales/new',
  'OCR Upload': '/automation/ai-processing',
  'Excel Import': '/bulk-upload',
  'Excel Upload': '/bulk-upload',
  'Banking Upload': '/fund-flow/cash-payment',
  'API / Other': '/automation/text-to-entry'
}

export function VoucherSourcesCard({ data, onMore }) {
  const navigate = useNavigate()
  const sourcesList = data?.voucherSources || [
    { label: 'Manual Entry', pct: '0%', count: '0', colorHex: 'var(--app-accent)' },
    { label: 'OCR Upload', pct: '0%', count: '0', colorHex: '#10B981' },
    { label: 'Excel Import', pct: '0%', count: '0', colorHex: '#F59E0B' },
    { label: 'Banking Upload', pct: '0%', count: '0', colorHex: '#8B5CF6' },
    { label: 'API / Other', pct: '0%', count: '0', colorHex: '#EF4444' },
  ]
  const totalStr = typeof data?.totalVouchers === 'number' ? data.totalVouchers.toLocaleString('en-IN') : (data?.totalVouchers || '0')
  const C = 314.16
  let acc = 0

  return (
    <Widget icon={PieChart} title="Voucher Sources" action={<MoreLink onClick={onMore} />}>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0 cursor-pointer" onClick={() => navigate('/sales/invoices')}>
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--app-row-border)" strokeWidth="12" />
            {sourcesList.map((s, i) => {
              const numPct = parseFloat(s.pct) || 0
              const dash = (numPct / 100) * C
              const off = -(acc / 100) * C
              acc += numPct
              return <circle key={i} cx="60" cy="60" r="50" fill="none" stroke={s.colorHex || 'var(--app-accent)'} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${Math.max(dash - 4, 0)} ${C}`} strokeDashoffset={off} />
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-extrabold tabular-nums" style={{ color: 'var(--app-heading)' }}>{totalStr}</span>
            <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>Total</span>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5">
          {sourcesList.map((s) => {
            const targetRoute = SOURCE_ROUTES[s.label] || '/sales/invoices'
            return (
              <li key={s.label} onClick={() => navigate(targetRoute)} className="flex items-center justify-between text-[11px] font-semibold cursor-pointer hover:opacity-80">
                <span className="flex items-center gap-1.5 min-w-0"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.colorHex || 'var(--app-accent)' }} /><span className="truncate" style={{ color: 'var(--app-text)' }}>{s.label}</span></span>
                <span className="tabular-nums ml-1" style={{ color: 'var(--app-heading)' }}>{s.pct}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </Widget>
  )
}

const PIPELINE_ROUTES = {
  'Import queue': '/bulk-upload',
  'OCR processing': '/automation/ai-processing',
  'Validation & Review': '/automation/approval-center',
  'Export to Tally': '/tally/connector'
}

export function PipelineCard({ data, onMore }) {
  const navigate = useNavigate()
  const total = data?.totalVouchers || 1
  const posted = data?.postedToTally || 0
  const ocr = data?.ocrDocumentsProcessed || 0
  const pending = data?.pendingApproval || 0

  const pipeline = [
    { label: 'Import queue', pct: total > 0 ? 100 : 0, tone: '#10B981' },
    { label: 'OCR processing', pct: total > 0 ? Math.min(100, Math.round((ocr / total) * 100)) : 0, tone: 'var(--app-accent)' },
    { label: 'Validation & Review', pct: total > 0 ? Math.min(100, Math.round((pending / total) * 100)) : 0, tone: 'var(--app-accent)' },
    { label: 'Export to Tally', pct: total > 0 ? Math.min(100, Math.round((posted / total) * 100)) : 0, tone: 'var(--app-accent)' },
  ]

  return (
    <Widget icon={Workflow} title="Import / Export Pipeline" action={<MoreLink onClick={onMore} />}>
      <div className="space-y-3 mt-0.5">
        {pipeline.map((p) => {
          const targetRoute = PIPELINE_ROUTES[p.label] || '/automation/approval-center'
          return (
            <div key={p.label} onClick={() => navigate(targetRoute)} className="space-y-1 cursor-pointer hover:opacity-80">
              <div className="flex justify-between text-[11px] font-bold">
                <span style={{ color: 'var(--app-text)' }}>{p.label}</span>
                <span className="tabular-nums" style={{ color: 'var(--app-heading)' }}>{p.pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-row-border)' }}>
                <motion.div className="h-full rounded-full" style={{ backgroundColor: p.tone }} initial={{ width: 0 }} animate={{ width: `${p.pct}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </div>
          )
        })}
      </div>
    </Widget>
  )
}

export function AiInsightsCard({ data, onMore }) {
  const navigate = useNavigate()
  const insights = [
    { text: `${data?.postedToTally || 0} vouchers ready to export`, desc: 'Approved & validated', tone: '#10B981', route: '/tally/connector' },
    { text: `${data?.duplicateAlerts || 0} possible duplicates`, desc: 'Review before export', tone: '#F59E0B', route: '/automation/approval-center' },
    { text: `${data?.failedSync || 0} sync alerts`, desc: 'Check sync monitor', tone: '#EF4444', route: '/tally/connector' },
    { text: `${data?.pendingApproval || 0} drafts pending`, desc: 'Awaiting review', tone: 'var(--app-accent)', route: '/automation/approval-center' },
  ]

  return (
    <Widget icon={Sparkles} title="AI Insights" action={<MoreLink onClick={onMore} />}>
      <ul className="space-y-1.5">
        {insights.map((it, i) => (
          <motion.li key={it.text} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => navigate(it.route)}
            className="flex items-center gap-2.5 rounded-lg border p-2 transition-colors hover:bg-[var(--app-row-hover)] cursor-pointer" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}>
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

function StageNode({ s, i, onClick }) {
  const n = useCountUp(String(s.val), 1100)
  return (
    <div onClick={onClick} className="relative z-10 flex flex-col items-center flex-1 cursor-pointer hover:opacity-80">
      <motion.div
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 360, damping: 22 }}
        whileHover={{ scale: 1.1, y: -2 }}
        className="h-11 w-11 rounded-2xl flex items-center justify-center border-2"
        style={{ borderColor: s.tone, color: s.tone, backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow)' }}
      >
        <s.icon size={16} strokeWidth={2.3} />
      </motion.div>
      <span className="mt-2 text-[19px] font-extrabold tabular-nums leading-none" style={{ color: 'var(--app-heading)' }}>{n}</span>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>{s.label}</span>
    </div>
  )
}

export function ApprovalWorkflowCard({ data, onMore }) {
  const navigate = useNavigate()
  const pending = data?.pendingApproval || 0
  const posted = data?.postedToTally || 0

  const stages = [
    { label: 'Draft', val: pending, tone: 'var(--app-muted)', icon: FileText, route: '/sales/new' },
    { label: 'Pending', val: pending, tone: '#F59E0B', icon: Clock, route: '/automation/approval-center' },
    { label: 'Review', val: pending, tone: 'var(--app-accent)', icon: Eye, route: '/automation/approval-center' },
    { label: 'Approved', val: posted, tone: '#10B981', icon: CheckCircle2, route: '/tally/connector' },
    { label: 'Exported', val: posted, tone: '#10B981', icon: Upload, route: '/tally/connector' },
  ]

  return (
    <Widget icon={Activity} title="Approval Workflow" action={<MoreLink onClick={onMore} />}>
      <div className="relative flex items-start justify-between gap-1 pt-1">
        <div className="absolute left-[10%] right-[10%] top-[22px] h-[3px] rounded-full" style={{ backgroundColor: 'var(--app-row-border)' }} />
        <motion.div className="absolute left-[10%] top-[22px] h-[3px] rounded-full" style={{ background: 'var(--app-accent-gradient)' }} initial={{ width: 0 }} animate={{ width: '80%' }} transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }} />
        <motion.div className="absolute top-[19px] h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--app-accent)', boxShadow: '0 0 10px var(--app-accent)' }}
          animate={{ left: ['10%', '90%'], opacity: [0, 1, 1, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
        {stages.map((s, i) => <StageNode key={s.label} s={s} i={i} onClick={() => navigate(s.route)} />)}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t cursor-pointer hover:opacity-80" onClick={() => navigate('/automation/approval-center')} style={{ borderColor: 'var(--app-border)' }}>
        <OpenDoodle name="meditating" className="w-9 h-7 shrink-0" tint="var(--app-accent)" />
        <p className="text-[11px] font-medium" style={{ color: 'var(--app-muted)' }}>
          Live Status — <b style={{ color: 'var(--app-heading)' }}>{posted} approved</b> & <b style={{ color: 'var(--app-heading)' }}>{posted} exported</b> to Tally.
        </p>
      </div>
    </Widget>
  )
}
