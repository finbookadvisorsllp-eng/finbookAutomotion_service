// Business Impact — "how much better is this business since it joined?"
// The retention/sales headline: overall health before→after, every vital's
// movement from the onboarding baseline, and the realised ₹ impact of the
// decisions the owner actually acted on. All grounded — the backend never
// fabricates a day-1 it didn't measure, and only counts value that actually moved.
import { useNavigate } from 'react-router-dom'
import { Sparkles, ShieldCheck, ArrowRight, Check, Trophy } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApiQuery'
import { CACHE_TIMES } from '../../queryClient'
import { useDateRange } from '../../context/DateContext'
import { bhImpact } from '../../api'
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates'
import { ScoreRing, SectionTitle } from './components/Pieces'
import { fmtVital, fmtMoney } from './components/ui'

const GOOD = '#16a34a'
const BAD = '#dc2626'

// One before→after tile. Colour comes from `good` (semantic), not the value sign.
function ImpactStat({ m }) {
  const flat = m.direction === 'flat' || m.good == null
  const color = flat ? 'var(--theme-text-muted)' : (m.good ? GOOD : BAD)
  const deltaLabel = m.deltaPct != null
    ? `${m.deltaPct > 0 ? '+' : ''}${m.deltaPct}%`
    : (flat ? '—' : (m.direction === 'up' ? '↑' : '↓'))
  return (
    <div className="p-4 rounded-2xl relative overflow-hidden"
      style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', boxShadow: 'var(--theme-kpi-shadow)' }}>
      <span className="absolute top-3 right-3 text-[11px] font-black px-1.5 py-0.5 rounded-md tabular-nums"
        style={{ color, background: `${color}1a` }}>
        {deltaLabel}
      </span>
      <div className="text-[11px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>{m.label}</div>
      <div className="text-[23px] font-black leading-tight mt-1.5 tabular-nums" style={{ color: 'var(--theme-text-main)' }}>
        {fmtVital(m.to, m.unit)}
      </div>
      <div className="text-[11.5px] font-semibold mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
        was <span className="tabular-nums" style={{ color: 'var(--theme-text-main)' }}>{fmtVital(m.from, m.unit)}</span>
      </div>
    </div>
  )
}

export default function Impact() {
  const { fy } = useDateRange()
  const navigate = useNavigate()

  const { data, loading, error, refetch } = useApiQuery(
    ['bh', 'impact', fy], () => bhImpact(fy), { enabled: !!fy, ...CACHE_TIMES.dashboard })

  if (loading) return <Loading label="Measuring your progress…" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (!data || !data.available) {
    return <EmptyState title="Your impact report is warming up"
      hint="We started tracking this company's health this week. Once a second week of history accrues, this page shows exactly how much healthier your business is since you joined — and the rupee value your AI CFO generated." />
  }

  const { score = {}, metrics = [], drivers = [], realisedImpact = 0,
          headline, baselineDate, justStarted, improvedCount = 0 } = data
  const better = score.pct != null && score.pct > 0

  return (
    <div className="space-y-5">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
        How much better this business is since it joined — tracked from {baselineDate || 'your first snapshot'}.
      </p>

      {/* ── Hero ── */}
      <div className="rounded-2xl p-5 flex items-center gap-5 flex-wrap"
        style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', boxShadow: 'var(--theme-kpi-shadow)' }}>
        <div className="flex flex-col items-center gap-2 shrink-0">
          <ScoreRing value={score.to} grade={score.grade} label="Current health score" size={104} />
          {score.from != null && (
            <div className="flex items-center gap-1.5 text-[13px] font-black tabular-nums">
              <span style={{ color: 'var(--theme-text-muted)' }}>{score.from}</span>
              <span style={{ color: 'var(--theme-text-muted)' }}>→</span>
              <span style={{ color: 'var(--theme-text-main)' }}>{score.to}</span>
              {score.delta != null && score.delta !== 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md"
                  style={{ color: score.delta > 0 ? GOOD : BAD, background: `${score.delta > 0 ? GOOD : BAD}1a` }}>
                  {score.delta > 0 ? '+' : ''}{score.delta} pts
                </span>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--theme-text-muted)' }}>
            Impact since onboarding
          </div>
          <p className="text-[22px] md:text-[26px] font-black leading-tight"
            style={{ color: 'var(--theme-text-main)' }}>
            {better
              ? <>You're <span style={{ background: 'linear-gradient(115deg,#65a30d,#1e7bff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{score.pct}% healthier</span> than day one.</>
              : (justStarted ? 'Your baseline is set.' : 'Your progress so far.')}
          </p>
          <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
            {headline}
          </p>

          {realisedImpact > 0 && (
            <div className="mt-3 pt-3 flex items-baseline gap-3 flex-wrap"
              style={{ borderTop: '1px dashed var(--aicfo-border)' }}>
              <span className="text-[28px] font-black tabular-nums"
                style={{ background: 'linear-gradient(115deg,#b6ff00,#1e7bff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {fmtMoney(realisedImpact)}
              </span>
              <span className="text-[12px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>
                freed &amp; protected by acting on your CFO's decisions
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Before → after vitals ── */}
      {metrics.length > 0 && (
        <div>
          <SectionTitle>Where you started vs. where you are</SectionTitle>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => <ImpactStat key={m.key} m={m} />)}
          </div>
        </div>
      )}

      {/* ── Realised-impact ledger ── */}
      <div>
        <SectionTitle right={
          <button onClick={() => navigate('/health/decisions')}
            className="text-[11px] font-bold cursor-pointer" style={{ color: 'var(--theme-accent)' }}>
            All decisions →
          </button>
        }>How your CFO earned its keep</SectionTitle>

        {drivers.length ? (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--aicfo-border)' }}>
            {drivers.map((d, i) => (
              <div key={d.decisionId || i} className="flex items-center justify-between gap-4 px-4 py-3"
                style={{ background: 'var(--theme-kpi-bg)', borderTop: i ? '1px solid var(--aicfo-border)' : 'none' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-extrabold leading-tight" style={{ color: 'var(--theme-text-main)' }}>
                      {d.title}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ color: GOOD, background: `${GOOD}1a` }}>
                      <Check size={11} strokeWidth={3} /> Improved
                    </span>
                  </div>
                  {d.detail && (
                    <p className="text-[11.5px] mt-1 leading-snug line-clamp-2" style={{ color: 'var(--theme-text-muted)' }}>
                      {d.detail}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[16px] font-black tabular-nums" style={{ color: GOOD }}>
                    +{fmtMoney(d.rupeeImpact)}
                  </div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>realised</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ background: 'var(--theme-kpi-bg)', borderTop: '1px solid var(--aicfo-border)' }}>
              <span className="inline-flex items-center gap-2 text-[12px] font-extrabold" style={{ color: 'var(--theme-text-muted)' }}>
                <Trophy size={14} /> Realised impact from {improvedCount} acted decision{improvedCount === 1 ? '' : 's'}
              </span>
              <span className="text-[19px] font-black tabular-nums"
                style={{ background: 'linear-gradient(115deg,#b6ff00,#1e7bff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                +{fmtMoney(realisedImpact)}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-4 text-[12px] flex items-center gap-2"
            style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', color: 'var(--theme-text-muted)' }}>
            <Sparkles size={14} />
            No realised impact recorded yet. Act on a decision from the
            <button onClick={() => navigate('/health/decisions')} className="font-bold cursor-pointer" style={{ color: 'var(--theme-accent)' }}>
              Decisions
            </button>
            page and, once the metric moves, its rupee value shows up here.
          </div>
        )}
      </div>

      {/* ── Methodology (trust) ── */}
      <div className="rounded-2xl p-4 flex gap-3 items-start"
        style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)' }}>
        <ShieldCheck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--theme-accent)' }} />
        <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
          <b style={{ color: 'var(--theme-text-main)' }}>How this is measured — no invented numbers.</b>{' '}
          Every figure reconciles to the same reports that power your dashboards. The <b>baseline</b> is the first
          health snapshot we captured for this company; “today” is recomputed on each visit. <b>Realised impact</b>{' '}
          counts only decisions you marked done <i>and</i> whose metric actually moved the right way afterwards —
          a decision that didn’t move the number earns ₹0. Movements are directional where bill-wise dates are missing.
        </p>
      </div>

      {/* ── Cross-links ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate('/health')}
          className="inline-flex items-center gap-1.5 text-[12px] font-extrabold px-3.5 py-2 rounded-xl cursor-pointer transition hover:brightness-110"
          style={{ color: 'var(--theme-accent)', border: '1px solid var(--aicfo-border)' }}>
          Command Center <ArrowRight size={14} />
        </button>
        <button onClick={() => navigate('/health/score')}
          className="inline-flex items-center gap-1.5 text-[12px] font-extrabold px-3.5 py-2 rounded-xl cursor-pointer transition hover:brightness-110"
          style={{ color: 'var(--theme-accent)', border: '1px solid var(--aicfo-border)' }}>
          Pillar breakdown <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
