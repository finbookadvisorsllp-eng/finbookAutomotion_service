// CFO Desk — rebuilt around the Findings Engine (CFO_REASONING_MODEL.md).
// One prioritized brief leads (worst first, BLUF); category tabs are an optional
// drill-down that reads "checked — all clear" when clean, never blank. Every
// finding is actionable inline: ask the CFO, open the evidence report, or mark it
// handled (so the desk stops repeating itself). The engine does the numbers; here
// we only present the finished, ranked list.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Compass, ShieldAlert, BookText, BarChart3, Sparkles, ArrowRight, ChevronDown,
  AlertOctagon, AlertTriangle, TrendingUp, Info, ShieldCheck, CheckCircle2,
  ExternalLink, Check, ListChecks,
} from 'lucide-react'
import { useApiQuery } from '../../hooks/useApiQuery'
import { CACHE_TIMES } from '../../queryClient'
import { aiCfoBrief } from '../../api'
import { getCompanyId } from '../../api/client'
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates'
import { formatINR } from '../../data/mockData'

const SEV = {
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.10)', label: 'Critical', icon: AlertOctagon },
  warning: { color: '#d97706', bg: 'rgba(217,119,6,0.10)', label: 'Watch', icon: AlertTriangle },
  positive: { color: '#16a34a', bg: 'rgba(22,163,74,0.10)', label: 'Upside', icon: TrendingUp },
  info: { color: '#1e7bff', bg: 'rgba(30,123,255,0.10)', label: 'FYI', icon: Info },
}
const CAT = {
  planning: { label: 'Planning', icon: Compass, desc: 'Where the business is headed — forecasts, budgets, cash.' },
  risk: { label: 'Risk', icon: ShieldAlert, desc: 'What could hurt the business, and how big it is.' },
  record_keeping: { label: 'Record-keeping', icon: BookText, desc: 'Whether this month\'s numbers can be trusted.' },
  reporting: { label: 'Reporting', icon: BarChart3, desc: 'How the business actually performed.' },
}
const CARD = { background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', boxShadow: 'var(--theme-kpi-shadow)' }
const REPORT_ROUTE = {
  pl: '/reports/pl', receivables: '/reports/outstanding', payables: '/reports/outstanding',
  cashflow: '/reports/cf', sales: '/sales', gst: '/reports/gst', inventory: '/inventory',
}

const M = (v) => (v == null ? '—' : formatINR(v, true))
const pctText = (v) => (v == null ? 'n/a' : `${v > 0 ? '+' : ''}${v}%`)
const evidenceRoute = (e) => (e && e.report ? REPORT_ROUTE[e.report] || null : null)

// Client-side "handled" memory so a finding the owner has dealt with stops
// reappearing. Keyed by company + FY. (Outcome tracking can later hook the
// Business Health Decision Ledger; this is the lightweight first version.)
function readHandled(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { return new Set() }
}
function useHandled(fy) {
  const key = `cfo_handled:${getCompanyId()}:${fy || 'na'}`
  const [state, setState] = useState(() => ({ key, ids: readHandled(key) }))
  // Reconcile during render when the company/FY key changes (the React-recommended
  // way to reset state from a prop — no effect, no cascading render).
  if (state.key !== key) setState({ key, ids: readHandled(key) })
  const ids = state.ids
  const save = (s) => {
    try { localStorage.setItem(key, JSON.stringify([...s])) } catch { /* ignore */ }
    setState({ key, ids: new Set(s) })
  }
  return {
    has: (id) => ids.has(id),
    add: (id) => { const s = new Set(ids); s.add(id); save(s) },
    clear: () => save(new Set()),
    size: ids.size,
  }
}

export default function CFODesk({ fy, onAsk }) {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useApiQuery(
    ['ai-cfo', 'brief', fy], () => aiCfoBrief(fy), { enabled: !!fy, ...CACHE_TIMES.dashboard })
  const [view, setView] = useState('brief')          // 'brief' | category key
  const [expanded, setExpanded] = useState(null)      // finding id
  const handled = useHandled(fy)

  if (loading) return <Loading label="Your CFO is reviewing the books…" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  const { brief = {}, findings = [], categories = {} } = data || {}
  if (!data) {
    return <EmptyState title="CFO desk not ready"
      hint="Once this company has synced transactions for the selected financial year, your CFO's brief appears here." />
  }

  const topFindings = (brief.findings || []).filter((f) => !handled.has(f.id))
  const cardProps = (f, i) => ({
    key: f.id, finding: f, index: i, onAsk, navigate,
    expanded: expanded === f.id, onToggle: () => setExpanded((e) => (e === f.id ? null : f.id)),
    onHandled: () => handled.add(f.id),
  })

  return (
    <div className="space-y-4 pb-3">
      {/* ── Filter bar: Top priorities + category drill-down ── */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <FilterChip active={view === 'brief'} onClick={() => setView('brief')}
          icon={ListChecks} label="Top priorities"
          badge={topFindings.length || null} tone="var(--theme-accent)" />
        {Object.entries(CAT).map(([key, c]) => {
          const s = categories[key] || {}
          const sev = s.worstSeverity ? SEV[s.worstSeverity] : null
          return (
            <FilterChip key={key} active={view === key} onClick={() => setView(key)}
              icon={c.icon} label={c.label}
              clean={s.clean && !s.insufficient}
              badge={s.count || null} tone={sev ? sev.color : 'var(--theme-text-muted)'} />
          )
        })}
      </div>

      {view === 'brief'
        ? <BriefView brief={brief} topFindings={topFindings} cardProps={cardProps} handled={handled} />
        : <CategoryView catKey={view} findings={findings} handled={handled} cardProps={cardProps} />}
    </div>
  )
}

// ─────────────────────────── Brief (the lead) ───────────────────────────
function BriefView({ brief, topFindings, cardProps, handled }) {
  const tone = SEV[brief.tone] || { color: '#16a34a', bg: 'rgba(22,163,74,0.10)', icon: ShieldCheck }
  const Icon = tone.icon
  const allClear = brief.count === 0
  const clearedByUser = brief.count > 0 && topFindings.length === 0

  return (
    <div className="space-y-4">
      {/* Headline hero (BLUF) */}
      <div className="rounded-2xl p-5 flex items-start gap-4" style={{ ...CARD, borderLeft: `3px solid ${tone.color}` }}>
        <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: tone.bg, color: tone.color }}>
          <Icon size={22} strokeWidth={2.3} />
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] mb-1" style={{ color: 'var(--theme-text-muted)' }}>
            Your CFO's brief
          </div>
          <p className="text-[19px] md:text-[22px] font-black leading-tight tracking-tight" style={{ color: 'var(--theme-text-main)' }}>
            {allClear || clearedByUser
              ? 'No material issues need your attention right now.'
              : brief.headline}
          </p>
          <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--theme-text-muted)' }}>
            {allClear
              ? 'Your CFO scanned the books and found nothing material this period — the fundamentals look stable.'
              : clearedByUser
                ? 'You\'ve handled everything flagged this period. New findings will appear as your books change.'
                : `Your CFO scanned the books and flagged ${brief.count} thing${brief.count === 1 ? '' : 's'} worth your attention — most important first.`}
          </p>
        </div>
      </div>

      {/* Top findings, worst first (staged reveal) */}
      {topFindings.map((f, i) => <FindingCard {...cardProps(f, i)} />)}

      <HandledFooter handled={handled} />
    </div>
  )
}

// ─────────────────────────── Category drill-down ───────────────────────────
function CategoryView({ catKey, findings, handled, cardProps }) {
  const c = CAT[catKey]
  const items = findings.filter((f) => f.category === catKey && f.dataStatus === 'ok' && !handled.has(f.id))
  const insufficient = findings.filter((f) => f.category === catKey && f.dataStatus === 'insufficient')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
          style={{ background: 'var(--theme-kpi-border)', color: 'var(--theme-accent)' }}>
          <c.icon size={17} />
        </span>
        <div>
          <h3 className="text-[15px] font-black tracking-tight">{c.label}</h3>
          <p className="text-[11.5px]" style={{ color: 'var(--theme-text-muted)' }}>{c.desc}</p>
        </div>
      </div>

      {items.length > 0
        ? items.map((f, i) => <FindingCard {...cardProps(f, i)} />)
        : insufficient.length > 0
          ? insufficient.map((f) => <InsufficientCard key={f.id} finding={f} />)
          : <AllClear label={c.label} />}

      <HandledFooter handled={handled} />
    </div>
  )
}

function AllClear({ label }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-3" style={{ ...CARD }}>
      <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
        style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>
        <CheckCircle2 size={20} />
      </span>
      <div>
        <p className="text-[13.5px] font-extrabold" style={{ color: 'var(--theme-text-main)' }}>Checked — all clear</p>
        <p className="text-[12px]" style={{ color: 'var(--theme-text-muted)' }}>
          No material {label.toLowerCase()} issues this period. Your CFO looked and found nothing worth flagging.
        </p>
      </div>
    </div>
  )
}

function InsufficientCard({ finding }) {
  return (
    <div className="rounded-2xl p-4 flex items-start gap-3" style={{ ...CARD, borderStyle: 'dashed' }}>
      <Info size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--theme-text-muted)' }} />
      <div>
        <p className="text-[13px] font-extrabold" style={{ color: 'var(--theme-text-main)' }}>{finding.title}</p>
        <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--theme-text-muted)' }}>{finding.detail}</p>
        {finding.insufficientReason && (
          <p className="text-[10.5px] mt-1 font-semibold uppercase tracking-wide" style={{ color: '#d97706' }}>
            {finding.insufficientReason}
          </p>
        )}
      </div>
    </div>
  )
}

function HandledFooter({ handled }) {
  if (!handled.size) return null
  return (
    <button onClick={handled.clear}
      className="text-[11px] font-bold cursor-pointer flex items-center gap-1.5" style={{ color: 'var(--theme-text-muted)' }}>
      <Check size={12} /> {handled.size} marked handled · show again
    </button>
  )
}

// ─────────────────────────── Finding card ───────────────────────────
function FindingCard({ finding: f, index = 0, onAsk, navigate, expanded, onToggle, onHandled }) {
  const sev = SEV[f.severity] || SEV.info
  const cat = CAT[f.category]
  const route = evidenceRoute(f.evidence)
  const rupee = rupeeLabel(f)
  const canExpand = (f.category === 'planning' && f.forecast) || (f.category === 'reporting' && f.monthly)

  return (
    <div className="rounded-2xl p-4 aicfo-pop" style={{ ...CARD, borderLeft: `3px solid ${sev.color}`, animationDelay: `${index * 70}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <sev.icon size={15} style={{ color: sev.color }} className="shrink-0" />
          <span className="text-[14px] font-extrabold leading-tight" style={{ color: 'var(--theme-text-main)' }}>{f.title}</span>
        </div>
        {rupee && (
          <span className="text-[12.5px] font-black whitespace-nowrap shrink-0" style={{ color: rupee.color }}>{rupee.text}</span>
        )}
      </div>

      {/* chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {cat && <Chip icon={cat.icon}>{cat.label}</Chip>}
        <Chip color={sev.color} bg={sev.bg}>{sev.label}</Chip>
        {f.confidence && f.confidence !== 'high' && <Chip>{f.confidence} confidence</Chip>}
        {rupee?.sub && <span className="text-[10px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>{rupee.sub}</span>}
      </div>

      <p className="text-[12px] mt-2 leading-snug" style={{ color: 'var(--theme-text-muted)' }}>{f.detail}</p>
      {f.action && (
        <p className="text-[12px] mt-1.5 font-semibold" style={{ color: 'var(--theme-text-main)' }}>→ {f.action}</p>
      )}

      {/* expandable detail (forecast horizon / MoM chart) */}
      {canExpand && expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--aicfo-border)' }}>
          {f.category === 'planning' ? <ForecastBlock f={f} /> : <ReportingBlock f={f} />}
        </div>
      )}

      {/* actions */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button onClick={() => onAsk(`Explain this and what I should do about it: "${f.title}".`)}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition hover:brightness-110"
          style={{ color: '#050505', background: 'linear-gradient(135deg,#b6ff00,#1e7bff)' }}>
          <Sparkles size={13} /> Ask the CFO <ArrowRight size={12} />
        </button>
        {route && (
          <button onClick={() => navigate(route)}
            className="inline-flex items-center gap-1 text-[11.5px] font-bold cursor-pointer" style={{ color: 'var(--theme-accent)' }}>
            <ExternalLink size={12} /> Evidence
          </button>
        )}
        {canExpand && (
          <button onClick={onToggle}
            className="inline-flex items-center gap-1 text-[11.5px] font-bold cursor-pointer" style={{ color: 'var(--theme-text-muted)' }}>
            {expanded ? 'Less' : 'Details'}
            <ChevronDown size={13} className="transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
          </button>
        )}
        <button onClick={onHandled} title="Mark handled — hides it until it materially changes"
          className="inline-flex items-center gap-1 text-[11.5px] font-bold cursor-pointer ml-auto" style={{ color: 'var(--theme-text-muted)' }}>
          <Check size={13} /> Handled
        </button>
      </div>
    </div>
  )
}

function rupeeLabel(f) {
  if (f.rupeeImpact == null) return null
  if (f.severity === 'positive') return { text: `~${M(f.rupeeImpact)}`, sub: 'upside', color: '#16a34a' }
  if (f.category === 'record_keeping') return { text: M(f.rupeeImpact), sub: 'to verify', color: '#d97706' }
  const color = f.severity === 'critical' ? '#dc2626' : '#d97706'
  return { text: M(f.rupeeImpact), sub: 'impact', color }
}

function Chip({ children, icon: Icon, color = 'var(--theme-text-muted)', bg = 'transparent' }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg, border: '1px solid var(--aicfo-border)' }}>
      {Icon && <Icon size={10} />}{children}
    </span>
  )
}

// ─────────────────────────── expand blocks ───────────────────────────
function ForecastBlock({ f }) {
  const fc = f.forecast || {}
  const horizon = fc.horizon || []
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11.5px]">
        <span style={{ color: 'var(--theme-text-muted)' }}>Next month revenue</span>
        <span className="font-black tabular-nums" style={{ color: 'var(--theme-text-main)' }}>
          {M(fc.nextMonthRevenue)} <span className="font-bold text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>· {fc.confidence} confidence</span>
        </span>
      </div>
      {horizon.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {horizon.map((h) => (
            <div key={h.months} className="rounded-xl p-3" style={{ background: 'var(--theme-bg)', border: '1px solid var(--aicfo-border)' }}>
              <div className="text-[10px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>In {h.label}</div>
              {h.reliable ? (
                <>
                  <div className="text-[16px] font-black tabular-nums mt-0.5" style={{ color: 'var(--theme-text-main)' }}>{M(h.revenue)}</div>
                  {h.profit != null && (
                    <div className="text-[10.5px] font-bold" style={{ color: h.profit < 0 ? '#dc2626' : 'var(--theme-text-muted)' }}>
                      profit {M(h.profit)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] font-semibold mt-1 leading-tight" style={{ color: 'var(--theme-text-muted)' }}>
                  not reliable this far
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {fc.caveat && (
        <p className="text-[10.5px] leading-snug" style={{ color: '#d97706' }}>{fc.caveat}</p>
      )}
    </div>
  )
}

function ReportingBlock({ f }) {
  const months = f.monthly || []
  const max = Math.max(1, ...months.map((m) => Math.max(m.revenue || 0, m.expense || 0)))
  const nearZeroNote = [f.revenueMoM, f.expenseMoM, f.profitMoM].some((v) => v == null)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <MoM label="Revenue" v={f.revenueMoM} />
        <MoM label="Expenses" v={f.expenseMoM} />
        <MoM label="Profit" v={f.profitMoM} />
      </div>
      {months.length > 1 && (
        <div className="flex items-end gap-3 h-24 pt-2" style={{ borderTop: '1px solid var(--aicfo-border)' }}>
          {months.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
              <div className="flex gap-1 items-end h-full w-full justify-center">
                <div className="w-2.5 rounded-t" style={{ height: `${(m.revenue / max) * 100}%`, background: '#1e7bff' }} title={`Revenue ${M(m.revenue)}`} />
                <div className="w-2.5 rounded-t" style={{ height: `${(m.expense / max) * 100}%`, background: '#ef4444' }} title={`Expense ${M(m.expense)}`} />
              </div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>{m.month}</span>
            </div>
          ))}
        </div>
      )}
      {nearZeroNote && (
        <p className="text-[10.5px]" style={{ color: 'var(--theme-text-muted)' }}>
          Some month-on-month %s aren't shown because last month's base was near zero — the ₹ change is used instead.
        </p>
      )}
    </div>
  )
}

function MoM({ label, v }) {
  const color = v == null ? 'var(--theme-text-muted)' : v >= 0 ? '#16a34a' : '#dc2626'
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--theme-bg)', border: '1px solid var(--aicfo-border)' }}>
      <div className="text-[10px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>{label} · MoM</div>
      <div className="text-[16px] font-black tabular-nums mt-0.5" style={{ color }}>{pctText(v)}</div>
    </div>
  )
}

// ─────────────────────────── filter chip ───────────────────────────
function FilterChip({ active, onClick, icon: Icon, label, badge, clean, tone }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="inline-flex items-center gap-1.5 text-[12px] font-extrabold px-3 py-1.5 rounded-full cursor-pointer transition"
      style={active
        ? { color: '#050505', background: 'linear-gradient(135deg,#b6ff00,#1e7bff)' }
        : { color: 'var(--theme-text-muted)', border: '1px solid var(--aicfo-border)' }}>
      <Icon size={13} />{label}
      {clean && !active && <CheckCircle2 size={12} style={{ color: '#16a34a' }} />}
      {badge != null && (
        <span className="text-[10px] font-black px-1.5 rounded-full leading-tight"
          style={active ? { background: 'rgba(0,0,0,0.15)' } : { background: tone, color: '#fff' }}>{badge}</span>
      )}
    </button>
  )
}
