// Health Score panel — the five pillars (each explained: how it's measured, why
// it's at that level, what to do) plus a Score Simulator. The simulator slides the
// REAL levers an owner controls (collect receivables, top up cash, improve margin)
// — not the pillar scores themselves — and the deterministic backend re-scores, so
// the preview always matches the real model and shows which pillars actually move.
import { useState, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApiQuery'
import { CACHE_TIMES } from '../../queryClient'
import { useDateRange } from '../../context/DateContext'
import { bhScore, bhSimulate } from '../../api'
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates'
import { ScoreRing, PillarMeter, CoverageBadge, SectionTitle } from './components/Pieces'
import { fmtMoney, GRADE_COLOR } from './components/ui'
import { explainOverall } from './components/explain'

// A red→green band bar with a marker at `value`, matching the reference look.
function ScoreBar({ value }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="relative h-2.5 rounded-full"
      style={{ background: 'linear-gradient(90deg,#dc2626 0%,#ea580c 25%,#d97706 45%,#65a30d 72%,#16a34a 100%)' }}>
      <div className="absolute -top-1 w-4.5 h-4.5 rounded-full border-2"
        style={{ left: `calc(${v}% - 9px)`, width: 18, height: 18, background: 'var(--theme-kpi-bg)', borderColor: 'var(--theme-text-main)' }} />
    </div>
  )
}

export default function HealthScore() {
  const { fy } = useDateRange()
  const { data, loading, error, refetch } = useApiQuery(
    ['bh', 'score', fy], () => bhScore(fy), { enabled: !!fy, ...CACHE_TIMES.statement })

  if (loading) return <Loading label="Scoring your business…" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (!data || data.overall == null) {
    return <EmptyState title="Not enough data to score"
      hint="This company needs synced transactions for the selected year before a health score can be computed." />
  }

  const { overall, grade, label, coverage, pillars = [], simInputs } = data
  const why = explainOverall(data)

  return (
    <div className="space-y-5">
      {/* Overall + simulator */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl p-5"
          style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', boxShadow: 'var(--theme-kpi-shadow)' }}>
          <div className="flex items-center gap-5">
            <ScoreRing value={overall} grade={grade} size={104} />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                Overall health
              </p>
              <p className="text-[22px] font-black" style={{ color: 'var(--theme-text-main)' }}>{label}</p>
              <div className="mt-2"><CoverageBadge coverage={coverage} /></div>
            </div>
          </div>
          <div className="mt-4">
            <ScoreBar value={overall} />
            <div className="flex justify-between mt-1.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
              <span>Critical</span><span>At risk</span><span>Fair</span><span>Healthy</span><span>Excellent</span>
            </div>
          </div>
          {why && (
            <p className="text-[12px] leading-snug mt-3 pt-3" style={{ color: 'var(--theme-text-muted)', borderTop: '1px dashed var(--aicfo-border)' }}>
              <span className="font-bold" style={{ color: 'var(--theme-text-main)' }}>Why this score:</span> {why}
            </p>
          )}
        </div>

        <ScoreSimulator key={`${fy}:${simInputs?.cashBank}:${simInputs?.receivablesTotal}:${simInputs?.netMargin}`}
          fy={fy} base={simInputs} baseOverall={overall} baseGrade={grade} basePillars={pillars} />
      </div>

      {/* Pillars */}
      <div>
        <SectionTitle>The five pillars — what makes up your score</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pillars.map((p) => <PillarMeter key={p.key} pillar={p} />)}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Score Simulator ───────────────────────────
const SLIDERS = [
  { key: 'cashBank', label: 'Cash & bank', hint: 'Top up or draw down cash', money: true },
  { key: 'receivablesTotal', label: 'Receivables to collect', hint: 'Drag down = you collected it', money: true },
  { key: 'netMargin', label: 'Net margin', hint: 'Profit left per ₹100 of sales', unit: '%' },
]

function ScoreSimulator({ fy, base, baseOverall, baseGrade, basePillars = [] }) {
  const seed = {
    cashBank: base?.cashBank ?? 0,
    receivablesTotal: base?.receivablesTotal ?? 0,
    netMargin: base?.netMargin ?? 0,
  }
  const [vals, setVals] = useState(seed)
  const [debounced, setDebounced] = useState(null)

  // Debounce slider changes before hitting /simulate. (The component is remounted
  // via `key` when the baseline changes, so no reset effect is needed.)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(vals), 250)
    return () => clearTimeout(t)
  }, [vals])

  const dirty = debounced && (
    debounced.cashBank !== seed.cashBank ||
    debounced.receivablesTotal !== seed.receivablesTotal ||
    debounced.netMargin !== seed.netMargin)

  const { data: sim } = useApiQuery(
    ['bh', 'simulate', fy, JSON.stringify(debounced)],
    () => bhSimulate(debounced, fy),
    { enabled: !!fy && !!dirty, staleTime: 5 * 60 * 1000, keepPreviousData: true })

  const projected = dirty && sim ? sim.overall : baseOverall
  const projGrade = dirty && sim ? sim.grade : baseGrade
  const delta = dirty && sim ? sim.delta : 0

  // Which pillars actually moved (base → projected).
  const baseByKey = Object.fromEntries(basePillars.map((p) => [p.key, p]))
  const movers = (dirty && sim?.pillars ? sim.pillars : [])
    .map((p) => ({ ...p, base: baseByKey[p.key]?.score }))
    .filter((p) => p.score != null && p.base != null && p.score !== p.base)

  const range = (key) => {
    const b = Math.abs(seed[key]) || 100
    if (key === 'netMargin') return { min: -20, max: 40, step: 0.5 }
    return { min: 0, max: Math.round(b * 2.5) || 100, step: Math.max(1, Math.round(b / 100)) }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', boxShadow: 'var(--theme-kpi-shadow)' }}>
      <SectionTitle right={
        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--theme-accent)' }}>
          <SlidersHorizontal size={12} /> Interactive
        </span>
      }>Score simulator — try a "what if"</SectionTitle>

      {/* current → projected + band bar */}
      <div className="flex items-end justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>{baseOverall}</span>
          <span className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>→</span>
          <span className="text-[30px] font-black leading-none" style={{ color: GRADE_COLOR[projGrade] || 'var(--theme-text-main)' }}>{projected}</span>
          <span className="text-[12px] font-bold" style={{ color: GRADE_COLOR[projGrade] }}>{projGrade}</span>
        </div>
        <span className="text-[12px] font-black tabular-nums px-2 py-0.5 rounded-md"
          style={{ color: delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : 'var(--theme-text-muted)',
                   background: delta ? `${delta > 0 ? '#16a34a' : '#dc2626'}1a` : 'transparent' }}>
          {delta > 0 ? '+' : ''}{delta || 0} vs now
        </span>
      </div>
      <div className="mb-4"><ScoreBar value={projected} /></div>

      {/* sliders (real levers) */}
      <div className="space-y-3.5">
        {SLIDERS.map((s) => {
          const r = range(s.key)
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11.5px] font-bold" style={{ color: 'var(--theme-text-main)' }}>{s.label}</span>
                <span className="text-[11px] font-black tabular-nums" style={{ color: 'var(--theme-accent)' }}>
                  {s.money ? fmtMoney(vals[s.key]) : `${vals[s.key]}${s.unit || ''}`}
                </span>
              </div>
              <input type="range" min={r.min} max={r.max} step={r.step} value={vals[s.key]}
                onChange={(e) => setVals((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
                className="w-full accent-[#1e7bff] cursor-pointer" aria-label={s.label} />
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{s.hint}</p>
            </div>
          )
        })}
      </div>

      {/* which pillars move */}
      {movers.length > 0 && (
        <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: '1px dashed var(--aicfo-border)' }}>
          <p className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>Pillars that move</p>
          {movers.map((p) => {
            const up = p.score > p.base
            return (
              <div key={p.key} className="flex items-center justify-between text-[11.5px]">
                <span style={{ color: 'var(--theme-text-muted)' }}>{p.label}</span>
                <span className="font-bold tabular-nums" style={{ color: up ? '#16a34a' : '#dc2626' }}>
                  {p.base} → {p.score} ({up ? '+' : ''}{p.score - p.base})
                </span>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] mt-3" style={{ color: 'var(--theme-text-muted)' }}>
        Drag to preview a "what if" — collect receivables, top up cash, or lift margin. Fully deterministic; nothing in your books is changed.
      </p>
    </div>
  )
}
