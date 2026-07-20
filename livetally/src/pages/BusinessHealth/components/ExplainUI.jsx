// Business Health — presentational pieces for the explanation layer.
// All grounded: they only render text the engines produced or fixed definitions
// from explain.js. No figure originates here.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calculator, Lightbulb, HelpCircle, ChevronDown, Info,
  AlertTriangle, Sparkles, ShieldCheck, ExternalLink,
} from 'lucide-react'
import { glossaryOf } from './explain'
import { SEV_COLOR, SEV_BG, evidenceRoute } from './ui'

// ── Term: a jargon word with a plain-language tooltip on hover ──
export function Term({ children, define }) {
  const tip = define || glossaryOf(children)
  if (!tip) return <>{children}</>
  return (
    <span title={tip}
      className="underline decoration-dotted underline-offset-2 cursor-help"
      style={{ textDecorationColor: 'var(--theme-text-muted)' }}>
      {children}
    </span>
  )
}

// ── "How it's measured: <formula>" — the definition line ──
export function FormulaLine({ formula }) {
  if (!formula) return null
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-snug rounded-lg px-2 py-1.5"
      style={{ background: 'var(--theme-kpi-border)', color: 'var(--theme-text-muted)' }}>
      <Calculator size={12} className="shrink-0 mt-0.5" />
      <span><span className="font-bold" style={{ color: 'var(--theme-text-main)' }}>How it’s measured:</span> {formula}</span>
    </div>
  )
}

// ── "Why" line (grounded reason) ──
export function WhyLine({ children, tone = 'muted' }) {
  if (!children) return null
  const color = tone === 'bad' ? '#dc2626' : tone === 'good' ? '#16a34a' : 'var(--theme-text-muted)'
  return (
    <div className="flex items-start gap-1.5 text-[11.5px] leading-snug">
      <Info size={12} className="shrink-0 mt-0.5" style={{ color }} />
      <span style={{ color: 'var(--theme-text-muted)' }}>{children}</span>
    </div>
  )
}

// ── "→ What to do: <fix>" — the action line ──
export function FixLine({ children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-1.5 text-[11.5px] font-semibold leading-snug rounded-lg px-2 py-1.5"
      style={{ background: 'rgba(30,123,255,0.08)', color: 'var(--theme-text-main)' }}>
      <Lightbulb size={12} className="shrink-0 mt-0.5" style={{ color: '#1e7bff' }} />
      <span><span className="font-black" style={{ color: '#1e7bff' }}>Do this:</span> {children}</span>
    </div>
  )
}

// ── Expandable "Why & what to do" used on decision / risk / opportunity cards ──
export function ExplainToggle({ why, action, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!why && !action) return null
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer transition"
        style={{ color: 'var(--theme-accent)' }}>
        <HelpCircle size={12} /> Why & what to do
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          <WhyLine>{why}</WhyLine>
          <FixLine>{action}</FixLine>
        </div>
      )}
    </div>
  )
}

// ── "How to read this" — a dismissable legend for first-time users ──
export function HowToRead() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)' }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer">
        <span className="inline-flex items-center gap-2 text-[12px] font-extrabold" style={{ color: 'var(--theme-text-main)' }}>
          <HelpCircle size={14} style={{ color: 'var(--theme-accent)' }} /> New here? How to read Business Health
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--theme-text-muted)' }} />
      </button>
      {open && (
        <div className="px-4 pb-4 grid gap-2.5 sm:grid-cols-2 text-[11.5px] leading-snug" style={{ color: 'var(--theme-text-muted)' }}>
          <p><b style={{ color: 'var(--theme-text-main)' }}>Score (0–100):</b> one number for the whole business, graded A–E. It’s a weighted blend of the five pillars below.</p>
          <p><b style={{ color: 'var(--theme-text-main)' }}>Pillars:</b> the five things that make up the score. Each shows how it’s measured, why it’s at that level, and what to do.</p>
          <p><b style={{ color: 'var(--theme-text-main)' }}>Do this week:</b> the highest-value actions right now, ranked by rupees. Mark one done and we track whether it worked.</p>
          <p><b style={{ color: 'var(--theme-text-main)' }}>Every number is grounded:</b> it reconciles to the same reports (P&L, Cash Flow, Outstanding) — nothing here is invented.</p>
        </div>
      )}
    </div>
  )
}

// ── AI Insight card — narrative summary with an honest "grounded" fallback ──
const INSIGHT_ICON = { risk: AlertTriangle, opportunity: Lightbulb, positive: ShieldCheck, milestone: Sparkles, anomaly: AlertTriangle }

export function AIInsight({ briefing, loading }) {
  return (
    <div className="rounded-2xl p-4 h-full flex flex-col"
      style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={15} style={{ color: 'var(--theme-accent)' }} />
        <span className="text-[12px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--theme-text-main)' }}>AI Insight</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] animate-pulse" style={{ color: 'var(--theme-text-muted)' }}>
          <Sparkles size={14} /> Reading your books…
        </div>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed flex-1" style={{ color: 'var(--theme-text-main)' }}>
            {briefing?.text || 'Summary unavailable right now.'}
          </p>
          <p className="text-[10px] font-semibold mt-2 inline-flex items-center gap-1" style={{ color: briefing?.degraded ? '#d97706' : 'var(--theme-text-muted)' }}>
            <ShieldCheck size={11} />
            {briefing?.degraded ? 'Grounded plain-language summary (AI model offline) — figures are exact.' : 'Grounded in your live reports — figures are exact.'}
          </p>
        </>
      )}
    </div>
  )
}

// ── Recommendations — "what you need to do" to lift the score ──
// Sits under the AI Insight: the insight says what's happening, this says what to
// do about it. Each line is tied to the pillar that's dragging the score down.
export function Recommendations({ items = [], onOpenScore }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl p-4 text-[12px] flex items-center gap-2"
        style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', color: 'var(--theme-text-muted)' }}>
        <ShieldCheck size={14} style={{ color: '#16a34a' }} />
        Nothing structural to fix — every pillar is holding up. Keep working the actions above.
      </div>
    )
  }
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--aicfo-border)' }}>
      {items.map((r, i) => {
        const color = r.band === 'critical' ? '#dc2626' : '#d97706'
        return (
          <div key={r.key} className="flex items-start gap-3 px-4 py-3"
            style={{ background: 'var(--theme-kpi-bg)', borderTop: i ? '1px solid var(--aicfo-border)' : 'none' }}>
            <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5"
              style={{ color: '#050505', background: 'linear-gradient(135deg,#b6ff00,#1e7bff)' }}>
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded"
                  style={{ color, background: `${color}1a` }}>
                  {r.pillar} · {r.score}
                </span>
              </div>
              <p className="text-[12.5px] font-semibold leading-snug mt-1" style={{ color: 'var(--theme-text-main)' }}>
                {r.text}
              </p>
              {r.meaning && (
                <p className="text-[10.5px] leading-snug mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{r.meaning}</p>
              )}
            </div>
          </div>
        )
      })}
      {onOpenScore && (
        <button onClick={onOpenScore}
          className="w-full text-left px-4 py-2 text-[11px] font-bold cursor-pointer"
          style={{ background: 'var(--theme-kpi-bg)', borderTop: '1px solid var(--aicfo-border)', color: 'var(--theme-accent)' }}>
          See the full pillar breakdown →
        </button>
      )}
    </div>
  )
}

// ── "What we noticed" — the grounded insight stream (/insights) ──
export function InsightList({ items = [], limit = 5 }) {
  const navigate = useNavigate()
  if (!items.length) return null
  return (
    <div className="space-y-2">
      {items.slice(0, limit).map((it) => {
        const color = SEV_COLOR[it.severity] || SEV_COLOR.info
        const Icon = INSIGHT_ICON[it.type] || Lightbulb
        const route = evidenceRoute(it.evidence)
        return (
          <div key={it.id} className="rounded-xl p-3"
            style={{ background: SEV_BG[it.severity] || SEV_BG.info, border: '1px solid var(--aicfo-border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={13} style={{ color }} />
              <span className="text-[12px] font-extrabold flex-1" style={{ color: 'var(--theme-text-main)' }}>{it.title}</span>
              {route && (
                <button onClick={() => navigate(route)} title="Open the report this comes from"
                  className="inline-flex items-center gap-1 text-[10px] font-bold cursor-pointer" style={{ color: 'var(--theme-accent)' }}>
                  <ExternalLink size={11} /> Evidence
                </button>
              )}
            </div>
            <p className="text-[11px] leading-snug" style={{ color: 'var(--theme-text-muted)' }}>{it.detail}</p>
            {it.provenance && (
              <p className="text-[9px] font-semibold mt-1 uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)', opacity: 0.7 }}>
                {it.provenance}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab bar for the Business Health hub ──
export function TabBar({ tabs, active, onSelect }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
      {tabs.map((t) => {
        const on = t.id === active
        const Icon = t.icon
        return (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold px-3.5 py-2 rounded-xl cursor-pointer transition whitespace-nowrap"
            style={on
              ? { color: '#050505', background: 'linear-gradient(135deg,#b6ff00,#1e7bff)', boxShadow: '0 4px 14px rgba(30,123,255,0.25)' }
              : { color: 'var(--theme-text-muted)', border: '1px solid var(--aicfo-border)', background: 'var(--theme-kpi-bg)' }}>
            {Icon && <Icon size={14} strokeWidth={2.4} />}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
