// AI CFO summary widget for the Dashboard (Phase 7). A compact banner showing the
// financial health score + the single most important insight, with a CTA into the
// full AI CFO chat. Self-contained: fetches its own data so it drops in with one
// line. Everything shown is deterministic + reconciled (same report figures).
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ArrowRight, AlertTriangle, ShieldCheck, Lightbulb } from 'lucide-react'
import { aiCfoHealthScore, aiCfoInsights } from '../api'

const GRADE_COLOR = { A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', E: '#dc2626', '—': '#94a3b8' }
const SEV_ICON = { danger: AlertTriangle, warning: AlertTriangle, info: Lightbulb, success: ShieldCheck }

export default function AICFOWidget({ fy }) {
  const navigate = useNavigate()
  const [score, setScore] = useState(null)
  const [insights, setInsights] = useState([])

  useEffect(() => {
    if (!fy) return
    let alive = true
    aiCfoHealthScore(fy).then(d => alive && setScore(d)).catch(() => {})
    aiCfoInsights(fy).then(d => alive && setInsights(d || [])).catch(() => {})
    return () => { alive = false }
  }, [fy])

  const top = insights[0]
  const color = GRADE_COLOR[score?.grade] || '#94a3b8'
  const Icon = SEV_ICON[top?.severity] || Lightbulb
  const pct = score?.overall == null ? 0 : score.overall
  const ring = `conic-gradient(${color} ${pct * 3.6}deg, var(--theme-kpi-border) 0deg)`

  return (
    <button
      onClick={() => navigate('/ai-cfo')}
      className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all group"
      style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--theme-kpi-border)', boxShadow: 'var(--theme-kpi-shadow)' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--theme-kpi-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--theme-kpi-shadow)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Brand + health ring */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505' }}>
          <Bot size={17} strokeWidth={2.4} />
        </div>
        {score && (
          <div className="relative shrink-0" style={{ width: 34, height: 34 }}>
            <div className="w-full h-full rounded-full" style={{ background: ring }} />
            <div className="absolute inset-[3px] rounded-full flex items-center justify-center"
                 style={{ background: 'var(--theme-kpi-bg)' }}>
              <span className="text-[11px] font-black" style={{ color }}>{score.overall ?? '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Headline + top insight */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-black" style={{ color: 'var(--theme-text-main)' }}>AI CFO</span>
          {score && (
            <span className="text-[10px] font-extrabold px-1.5 py-px rounded-full"
                  style={{ background: 'var(--theme-kpi-border)', color }}>
              {score.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          {top ? (
            <>
              <Icon size={12} className="shrink-0"
                    style={{ color: top.severity === 'danger' ? '#dc2626' : top.severity === 'warning' ? '#d97706' : 'var(--theme-accent)' }} />
              <span className="text-[11.5px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                {top.detail}
              </span>
            </>
          ) : (
            <span className="text-[11.5px]" style={{ color: 'var(--theme-text-muted)' }}>
              Ask about profit, cash, sales or collections — grounded in your books.
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <span className="shrink-0 flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--theme-accent)', color: 'var(--theme-bg)' }}>
        Ask AI CFO <ArrowRight size={13} strokeWidth={2.6} className="group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
