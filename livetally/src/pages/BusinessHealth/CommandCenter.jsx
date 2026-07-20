// Overview panel (rendered inside the Business Health hub). Reading order encodes
// priority: verdict + WHY → this week's recommended actions → AI insight →
// what we noticed / what changed → vital signs. One composed /overview call powers
// the core; briefing, score (for the "why") and insights load alongside.
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApiQuery'
import { CACHE_TIMES } from '../../queryClient'
import { useDateRange } from '../../context/DateContext'
import { bhOverview, bhBriefing, bhScore, bhInsights } from '../../api'
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates'
import { ScoreRing, TrendDelta, DecisionCard, SectionTitle } from './components/Pieces'
import { useDecisionActions } from './components/useDecisionActions'
import { fmtMoney } from './components/ui'
import { explainOverall, buildRecommendations } from './components/explain'
import { HowToRead, AIInsight, InsightList, Recommendations } from './components/ExplainUI'

export default function Overview() {
  const { fy } = useDateRange()
  const navigate = useNavigate()
  const actions = useDecisionActions()

  const { data, loading, error, refetch } = useApiQuery(
    ['bh', 'overview', fy], () => bhOverview(fy), { enabled: !!fy, ...CACHE_TIMES.dashboard })
  const { data: briefing, loading: briefingLoading } = useApiQuery(
    ['bh', 'briefing', fy], () => bhBriefing(fy), { enabled: !!fy, staleTime: 5 * 60 * 1000 })
  const { data: scoreData } = useApiQuery(
    ['bh', 'score', fy], () => bhScore(fy), { enabled: !!fy, ...CACHE_TIMES.statement })
  const { data: insights } = useApiQuery(
    ['bh', 'insights', fy, 'all'], () => bhInsights(fy), { enabled: !!fy, ...CACHE_TIMES.dashboard })

  if (loading) return <Loading label="Building your overview…" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (!data || data.score?.overall == null) {
    return <EmptyState title="Not enough data yet"
      hint="Once this company has synced transactions for the selected financial year, your health score and weekly decisions appear here." />
  }

  const { score, verdict, topDecisions = [], whatChanged = [] } = data
  const why = scoreData?.pillars ? explainOverall(scoreData) : null
  const recommendations = buildRecommendations(scoreData)

  return (
    <div className="space-y-5">
      {/* How to read (first-timers) */}
      <HowToRead />

      {/* ── Verdict hero ── */}
      <div className="rounded-2xl p-5 flex items-center gap-5 flex-wrap"
        style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', boxShadow: 'var(--theme-kpi-shadow)' }}>
        <ScoreRing value={score.overall} grade={score.grade} label="Health score" size={104} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
              Health score
            </span>
            {score.trend7d != null && <TrendDelta value={score.trend7d} />}
            <span className="text-[11px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>vs last week</span>
          </div>
          <p className="text-[20px] md:text-[24px] font-black leading-tight" style={{ color: 'var(--theme-text-main)' }}>
            {verdict}
          </p>
          <p className="text-[12px] font-bold mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            {score.label} · {score.grade}
          </p>
          {why && (
            <p className="text-[12.5px] leading-snug mt-2 pt-2" style={{ color: 'var(--theme-text-muted)', borderTop: '1px dashed var(--aicfo-border)' }}>
              <span className="font-bold" style={{ color: 'var(--theme-text-main)' }}>Why this score:</span> {why}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => navigate('/health/score')}
            className="inline-flex items-center gap-1.5 text-[12px] font-extrabold px-3.5 py-2 rounded-xl cursor-pointer transition hover:brightness-110"
            style={{ color: 'var(--theme-accent)', border: '1px solid var(--aicfo-border)' }}>
            View pillars <ArrowRight size={14} />
          </button>
          <button onClick={() => navigate('/health/impact')}
            className="inline-flex items-center gap-1.5 text-[12px] font-extrabold px-3.5 py-2 rounded-xl cursor-pointer transition hover:brightness-110"
            style={{ color: '#050505', background: 'linear-gradient(135deg,#b6ff00,#1e7bff)' }}>
            See your impact <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Do this week (recommended actions) ── */}
      <div>
        <SectionTitle right={
          <button onClick={() => navigate('/health/decisions')}
            className="text-[11px] font-bold cursor-pointer" style={{ color: 'var(--theme-accent)' }}>
            All decisions →
          </button>
        }>Do this week — your top actions</SectionTitle>
        {topDecisions.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {topDecisions.map((d) => (
              <DecisionCard key={d.decisionId} decision={d}
                onAct={actions.onAct} onSnooze={actions.onSnooze} onDismiss={actions.onDismiss} busy={actions.busy} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-[12px]" style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', color: 'var(--theme-text-muted)' }}>
            No open decisions — the fundamentals look steady this week.
          </div>
        )}
      </div>

      {/* ── AI insight + recommendations | what we noticed ── */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="space-y-5">
          <div>
            <SectionTitle right={<span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>AI · grounded</span>}>
              AI insight
            </SectionTitle>
            <AIInsight briefing={briefing} loading={briefingLoading} />
          </div>
          <div>
            <SectionTitle right={<span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>What you need to do</span>}>
              Recommendations
            </SectionTitle>
            <Recommendations items={recommendations} onOpenScore={() => navigate('/health/score')} />
          </div>
        </div>
        <div>
          <SectionTitle>What we noticed</SectionTitle>
          {insights?.length ? (
            <InsightList items={insights} limit={5} />
          ) : (
            <div className="rounded-xl p-4 text-[12px]" style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', color: 'var(--theme-text-muted)' }}>
              Nothing notable flagged this week.
            </div>
          )}
        </div>
      </div>

      {/* ── What changed ── */}
      <div>
        <SectionTitle>What changed since last week</SectionTitle>
        {whatChanged.length ? (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--aicfo-border)' }}>
            {whatChanged.map((w, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5"
                style={{ background: 'var(--theme-kpi-bg)', borderTop: i ? '1px solid var(--aicfo-border)' : 'none' }}>
                <span className="text-[12px] font-bold" style={{ color: 'var(--theme-text-main)' }}>{w.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--theme-text-muted)' }}>
                    {fmtMoney(w.from)} → {fmtMoney(w.to)}
                  </span>
                  <span className="text-[11px] font-extrabold tabular-nums"
                    style={{ color: w.good ? '#16a34a' : '#dc2626' }}>
                    {w.deltaPct != null ? `${w.deltaPct > 0 ? '+' : ''}${w.deltaPct}%` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-[12px]" style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', color: 'var(--theme-text-muted)' }}>
            This is your first tracked week — deltas appear next week.
          </div>
        )}
      </div>
    </div>
  )
}
