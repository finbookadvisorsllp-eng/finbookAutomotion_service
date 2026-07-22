// AI CFO summary widget for the Dashboard (Phase 7). A compact banner showing the
// financial health score + the single most important insight, with a CTA into the
// full AI CFO chat. Self-contained: fetches its own data so it drops in with one
// line. Everything shown is deterministic + reconciled (same report figures).
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ArrowRight, AlertTriangle, ShieldCheck, Lightbulb, Sparkles } from 'lucide-react'
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
  const ring = `conic-gradient(${color} ${pct * 3.6}deg, var(--theme-card-border) 0deg)`

  return (
    <button
      onClick={() => navigate('/ai-cfo')}
      className="w-full text-left erp-card erp-card-hover px-5 py-4 flex items-center gap-4 transition-all group"
      style={{
        borderLeft: '3px solid var(--theme-accent)',
      }}
    >
      {/* Brand + health ring */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
             style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#ffffff' }}>
          <Bot size={20} strokeWidth={2} />
        </div>
        {score && (
          <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
            <div className="w-full h-full rounded-full" style={{ background: ring }} />
            <div className="absolute inset-[3px] rounded-full flex items-center justify-center"
                 style={{ background: 'var(--theme-card-bg)' }}>
              <span className="text-[12px] font-bold" style={{ color }}>{score.overall ?? '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Headline + top insight */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>AI CFO</span>
          {score && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                  style={{ background: 'var(--theme-accent-light)', color: 'var(--theme-accent)' }}>
              {score.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 min-w-0">
          {top ? (
            <>
              <Icon size={13} className="shrink-0"
                    style={{ color: top.severity === 'danger' ? '#f43f5e' : top.severity === 'warning' ? '#f59e0b' : 'var(--theme-accent)' }} />
              <span className="text-[13px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                {top.detail}
              </span>
            </>
          ) : (
            <span className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              Ask about profit, cash, sales or collections — grounded in your books.
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <span className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-xl transition-all"
            style={{ background: 'var(--theme-accent)', color: '#ffffff' }}>
        <Sparkles size={13} strokeWidth={2} />
        Ask AI CFO <ArrowRight size={13} strokeWidth={2} className="group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
