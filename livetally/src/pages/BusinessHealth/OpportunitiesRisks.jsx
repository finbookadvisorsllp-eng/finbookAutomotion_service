// Opportunities & Risks panel — the full ranked lists behind the Overview's top 3.
// Each item explains itself: what it is, why (grounded detail), and — for
// opportunities — the concrete move. Read-only; these feed the Decision Ledger.
import { useNavigate } from 'react-router-dom'
import { Lightbulb, AlertTriangle, ExternalLink } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApiQuery'
import { CACHE_TIMES } from '../../queryClient'
import { useDateRange } from '../../context/DateContext'
import { bhOpportunities, bhRisks } from '../../api'
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates'
import { Chip, SectionTitle } from './components/Pieces'
import { WhyLine, FixLine } from './components/ExplainUI'
import { fmtMoney, evidenceRoute, SEV_COLOR, CONFIDENCE_LABEL, EFFORT_LABEL } from './components/ui'

export default function OpportunitiesRisks() {
  const { fy } = useDateRange()
  const opps = useApiQuery(['bh', 'opportunities', fy], () => bhOpportunities(fy), { enabled: !!fy, ...CACHE_TIMES.dashboard })
  const risks = useApiQuery(['bh', 'risks', fy], () => bhRisks(fy), { enabled: !!fy, ...CACHE_TIMES.dashboard })

  const loading = opps.loading || risks.loading
  const error = opps.error || risks.error

  if (loading) return <Loading label="Scanning your books…" />
  if (error) return <ErrorState message={error.message} onRetry={() => { opps.refetch(); risks.refetch() }} />

  const oppList = opps.data || []
  const riskList = risks.data || []

  return (
    <div className="space-y-6">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
        Everything we found, ranked by rupee impact — opportunities to gain on the left, risks to protect against on the right.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Opportunities ({oppList.length})</SectionTitle>
          {oppList.length ? (
            <div className="space-y-3">
              {oppList.map((o) => <ItemCard key={o.id} item={o} kind="opportunity" />)}
            </div>
          ) : <EmptyState title="No opportunities surfaced" hint="Quantified upside appears here as your books change." />}
        </section>

        <section>
          <SectionTitle>Risks ({riskList.length})</SectionTitle>
          {riskList.length ? (
            <div className="space-y-3">
              {riskList.map((r) => <ItemCard key={r.id} item={r} kind="risk" />)}
            </div>
          ) : <EmptyState title="No risks flagged" hint="Threats to cash, margin and revenue appear here." />}
        </section>
      </div>
    </div>
  )
}

function ItemCard({ item, kind }) {
  const navigate = useNavigate()
  const route = evidenceRoute(item.evidence)
  const isRisk = kind === 'risk'
  const accent = isRisk ? (SEV_COLOR[item.severity] || '#dc2626') : '#1e7bff'
  const amount = isRisk ? item.rupeesAtRisk : item.rupeeImpact

  return (
    <div className="p-4 rounded-2xl flex flex-col gap-2.5" style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)', borderLeft: `3px solid ${accent}`, boxShadow: 'var(--theme-kpi-shadow)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isRisk ? <AlertTriangle size={14} style={{ color: accent }} /> : <Lightbulb size={14} style={{ color: accent }} />}
          <span className="text-[13.5px] font-extrabold leading-tight" style={{ color: 'var(--theme-text-main)' }}>{item.title}</span>
        </div>
        {amount != null && (
          <span className="text-[12px] font-black whitespace-nowrap shrink-0" style={{ color: isRisk ? '#dc2626' : '#16a34a' }}>
            {isRisk ? 'at risk ' : '~'}{fmtMoney(amount)}
          </span>
        )}
      </div>

      {/* Why (grounded detail) */}
      <WhyLine tone={isRisk ? 'bad' : 'good'}>{item.detail}</WhyLine>

      {/* What to do (opportunities carry an explicit action) */}
      {item.actionText && <FixLine>{item.actionText}</FixLine>}

      <div className="flex flex-wrap items-center gap-1.5">
        {item.confidence && <Chip title={CONFIDENCE_LABEL[item.confidence]}>{item.confidence} confidence</Chip>}
        {item.effort && <Chip title={EFFORT_LABEL[item.effort]}>{item.effort} effort</Chip>}
        {isRisk && item.severity && <Chip color={accent} bg={`${accent}1a`}>{item.severity}</Chip>}
        {route && (
          <button onClick={() => navigate(route)}
            className="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer ml-auto" style={{ color: 'var(--theme-accent)' }}>
            <ExternalLink size={12} /> Evidence
          </button>
        )}
      </div>
    </div>
  )
}
