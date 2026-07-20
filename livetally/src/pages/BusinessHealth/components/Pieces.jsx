// Business Health — shared presentational components.
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Minus, ExternalLink, Check, Clock, X,
} from 'lucide-react'
import {
  BAND_COLOR, GRADE_COLOR, scoreColor,
  fmtMoney, evidenceRoute, CONFIDENCE_LABEL, EFFORT_LABEL,
} from './ui'
import { PILLAR_INFO, BAND_VERDICT, isMissingValue, DRIVER_GAP } from './explain'
import { FormulaLine, FixLine, Term } from './ExplainUI'

const CARD = {
  background: 'var(--theme-kpi-bg)',
  border: '1px solid var(--aicfo-border)',
  borderRadius: 14,
  boxShadow: 'var(--theme-kpi-shadow)',
}

// ─────────────────────────── Score ring ───────────────────────────
export function ScoreRing({ value, grade, label, size = 96 }) {
  const color = GRADE_COLOR[grade] || scoreColor(value)
  const pct = value == null ? 0 : value
  const ring = `conic-gradient(${color} ${pct * 3.6}deg, var(--theme-kpi-border) 0deg)`
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full" style={{ background: ring }} />
      <div className="absolute rounded-full flex flex-col items-center justify-center"
        style={{ inset: size * 0.09, background: 'var(--theme-kpi-bg)' }}>
        <span className="font-black leading-none" style={{ fontSize: size * 0.3, color: 'var(--theme-text-main)' }}>
          {value ?? '—'}
        </span>
        {grade && <span className="font-bold leading-none mt-0.5" style={{ fontSize: size * 0.13, color }}>{grade}</span>}
      </div>
      {label && <span className="sr-only">{label}</span>}
    </div>
  )
}

// ─────────────────────────── Small primitives ───────────────────────────
export function TrendDelta({ value, goodDirection = 'up' }) {
  if (value == null || value === 0) {
    return <span className="inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>
      <Minus size={11} /> 0</span>
  }
  const up = value > 0
  const good = (up ? 'up' : 'down') === goodDirection
  const color = good ? '#16a34a' : '#dc2626'
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-extrabold" style={{ color }}>
      <Icon size={12} strokeWidth={2.6} />{value > 0 ? `+${value}` : value}
    </span>
  )
}

export function Chip({ children, color = 'var(--theme-text-muted)', bg = 'transparent', title }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg, border: '1px solid var(--aicfo-border)' }}>
      {children}
    </span>
  )
}

export function CoverageBadge({ coverage }) {
  if (coverage == null) return null
  const proxy = coverage < 100
  return (
    <Chip color={proxy ? '#d97706' : '#16a34a'}
      bg={proxy ? 'rgba(217,119,6,0.10)' : 'rgba(22,163,74,0.10)'}
      title={proxy ? 'Part of this pillar uses a labelled proxy' : 'Fully reconciled to reports'}>
      {coverage}% reconciled
    </Chip>
  )
}

// ─────────────────────────── Pillar meter ───────────────────────────
// Each pillar reads like the reference: what it measures → how it's computed →
// the actual numbers (with a reason when one can't be computed) → what to do.
export function PillarMeter({ pillar }) {
  const color = scoreColor(pillar.score)
  const info = PILLAR_INFO[pillar.key] || {}
  const verdict = BAND_VERDICT[pillar.band] || BAND_VERDICT.unknown
  const vColor = BAND_COLOR[pillar.band] || BAND_COLOR.unknown
  const weak = pillar.band === 'watch' || pillar.band === 'critical'

  return (
    <div className="p-4 flex flex-col gap-2.5" style={{ ...CARD }}>
      {/* Title + verdict + score */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13.5px] font-extrabold" style={{ color: 'var(--theme-text-main)' }}>{pillar.label}</div>
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded mt-1"
            style={{ color: vColor, background: `${vColor}1a` }}>
            {verdict.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: 'var(--theme-text-muted)', background: 'var(--theme-kpi-border)' }}>
            {pillar.weight} pts
          </span>
          <span className="text-[18px] font-black tabular-nums" style={{ color }}>{pillar.score ?? '—'}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--theme-kpi-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pillar.score ?? 0}%`, background: color }} />
      </div>

      {/* What it measures */}
      {info.meaning && (
        <p className="text-[11.5px] leading-snug" style={{ color: 'var(--theme-text-muted)' }}>{info.meaning}</p>
      )}

      {/* How it's measured */}
      <FormulaLine formula={info.formula} />

      {/* The actual numbers, with a reason when one is missing */}
      <div className="space-y-1.5">
        {(pillar.drivers || []).map((d, i) => {
          const missing = isMissingValue(d.value)
          return (
            <div key={i}>
              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                <span style={{ color: 'var(--theme-text-muted)' }}><Term>{d.label}</Term></span>
                <span className="font-bold tabular-nums shrink-0" style={{ color: missing ? '#d97706' : 'var(--theme-text-main)' }}>{d.value}</span>
              </div>
              {missing && DRIVER_GAP[d.label] ? (
                <p className="text-[10px] leading-snug mt-0.5" style={{ color: '#d97706' }}>{DRIVER_GAP[d.label]}</p>
              ) : d.detail ? (
                <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--theme-text-muted)', opacity: 0.85 }}>{d.detail}</p>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* What to do (only when the pillar is weak) */}
      {weak && info.fix && <FixLine>{info.fix}</FixLine>}

      <div><CoverageBadge coverage={pillar.coverage} /></div>
    </div>
  )
}

// ─────────────────────────── Decision card ───────────────────────────
const OUTCOME = {
  improved: { c: '#16a34a', t: 'Improved' },
  'no-change': { c: '#d97706', t: 'No change yet' },
  worsened: { c: '#dc2626', t: 'Worsened' },
}

export function DecisionCard({ decision: d, onAct, onSnooze, onDismiss, busy }) {
  const navigate = useNavigate()
  const route = evidenceRoute(d.evidence)
  const impact = d.rupeeImpact
  const isRisk = d.kind === 'risk'
  const accent = isRisk ? '#dc2626' : '#1e7bff'
  const outcome = d.outcome?.verdict ? OUTCOME[d.outcome.verdict] : null
  const acted = d.status === 'acted'

  return (
    <div className="p-4 flex flex-col gap-2" style={{ ...CARD, borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13.5px] font-extrabold leading-tight" style={{ color: 'var(--theme-text-main)' }}>
          {d.title}
        </span>
        {impact != null && (
          <span className="text-[12px] font-black whitespace-nowrap" style={{ color: isRisk ? '#dc2626' : '#16a34a' }}>
            {isRisk ? 'at risk ' : '~'}{fmtMoney(impact)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip color={accent} bg={isRisk ? 'rgba(220,38,38,0.08)' : 'rgba(30,123,255,0.08)'}>{isRisk ? 'Risk' : 'Opportunity'}</Chip>
        {d.confidence && <Chip title={CONFIDENCE_LABEL[d.confidence]}>{d.confidence}</Chip>}
        {d.effort && <Chip title={EFFORT_LABEL[d.effort]}>{d.effort} effort</Chip>}
        {outcome && <Chip color={outcome.c} bg={`${outcome.c}1a`}>{outcome.t}</Chip>}
      </div>

      <p className="text-[11.5px] leading-snug" style={{ color: 'var(--theme-text-muted)' }}>{d.detail}</p>
      {d.actionText && (
        <p className="text-[11.5px] font-semibold leading-snug" style={{ color: 'var(--theme-text-main)' }}>
          → {d.actionText}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-0.5">
        {route ? (
          <button onClick={() => navigate(route)}
            className="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer" style={{ color: 'var(--theme-accent)' }}>
            <ExternalLink size={12} /> Evidence
          </button>
        ) : <span />}
        {!acted && (onAct || onSnooze || onDismiss) && (
          <div className="flex items-center gap-1.5">
            {onAct && (
              <button disabled={busy} onClick={() => onAct(d)}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-40 transition"
                style={{ color: '#050505', background: 'linear-gradient(135deg,#b6ff00,#1e7bff)' }}>
                <Check size={12} strokeWidth={3} /> I did this
              </button>
            )}
            {onSnooze && (
              <button disabled={busy} onClick={() => onSnooze(d)} title="Snooze 7 days"
                className="p-1.5 rounded-lg cursor-pointer disabled:opacity-40 hover:bg-black/5 transition" style={{ color: 'var(--theme-text-muted)' }}>
                <Clock size={14} />
              </button>
            )}
            {onDismiss && (
              <button disabled={busy} onClick={() => onDismiss(d)} title="Dismiss"
                className="p-1.5 rounded-lg cursor-pointer disabled:opacity-40 hover:bg-black/5 transition" style={{ color: 'var(--theme-text-muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {acted && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: '#16a34a' }}>
            <Check size={12} strokeWidth={3} /> Done
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Section header ───────────────────────────
export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>{children}</h2>
      {right}
    </div>
  )
}
