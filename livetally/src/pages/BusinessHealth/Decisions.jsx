// Decisions — the Decision Ledger. Filter by status; act / snooze / dismiss with
// optimistic invalidation; acted items show their outcome verdict once the next
// weekly snapshot has measured the tracked metric.
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useDateRange } from '../../context/DateContext'
import { bhDecisions, bhGenerateDecisions } from '../../api'
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates'
import { DecisionCard } from './components/Pieces'
import { useDecisionActions } from './components/useDecisionActions'

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'acted', label: 'Acted' },
  { id: 'snoozed', label: 'Snoozed' },
  { id: 'dismissed', label: 'Dismissed' },
]

export default function Decisions() {
  const { fy } = useDateRange()
  const [tab, setTab] = useState('open')
  const actions = useDecisionActions()
  const qc = useQueryClient()

  const { data, loading, error, refetch } = useApiQuery(
    ['bh', 'decisions', fy, tab], () => bhDecisions(fy, tab), { enabled: !!fy })

  const invalidate = () =>
    qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('bh') })
  const generate = useMutation({ mutationFn: () => bhGenerateDecisions(fy), onSuccess: invalidate })

  // If the owner lands here first (before the Command Center), populate the ledger.
  useEffect(() => {
    if (tab === 'open' && !loading && data && data.length === 0 && !generate.isPending && !generate.isSuccess) {
      generate.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loading, data])

  const controlsFor = (t) => t === 'open'
    ? { onAct: actions.onAct, onSnooze: actions.onSnooze, onDismiss: actions.onDismiss }
    : {}

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
          Your tracked decision ledger — mark one done and we check whether it actually moved the number.
        </p>
        <button onClick={() => generate.mutate()} disabled={generate.isPending}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl cursor-pointer disabled:opacity-40 transition"
          style={{ color: 'var(--theme-accent)', border: '1px solid var(--aicfo-border)' }}>
          <RefreshCw size={13} className={generate.isPending ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="text-[12px] font-extrabold px-3.5 py-1.5 rounded-full cursor-pointer transition"
            style={tab === t.id
              ? { color: '#050505', background: 'linear-gradient(135deg,#b6ff00,#1e7bff)' }
              : { color: 'var(--theme-text-muted)', border: '1px solid var(--aicfo-border)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <Loading label="Loading decisions…" />
        : error ? <ErrorState message={error.message} onRetry={refetch} />
        : !data?.length ? (
          <EmptyState title={`No ${tab} decisions`}
            hint={tab === 'open' ? 'Great — nothing pressing right now. New opportunities and risks appear here as your books change.'
              : `Decisions you mark as ${tab} will collect here.`} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.map((d) => <DecisionCard key={d.decisionId} decision={d} busy={actions.busy} {...controlsFor(tab)} />)}
          </div>
        )}
    </div>
  )
}
