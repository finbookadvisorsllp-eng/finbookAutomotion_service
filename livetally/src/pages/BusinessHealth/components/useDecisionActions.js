// Shared act / snooze / dismiss mutations for the Decision Ledger.
// On success, invalidates every Business Health query for the active company so
// the Command Center, Decisions page and nav badges refresh together.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bhActDecision, bhSnoozeDecision, bhDismissDecision } from '../../../api'

export function useDecisionActions() {
  const qc = useQueryClient()
  const invalidate = () =>
    qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('bh') })

  const act = useMutation({ mutationFn: (d) => bhActDecision(d.decisionId), onSuccess: invalidate })
  const snooze = useMutation({ mutationFn: (d) => bhSnoozeDecision(d.decisionId), onSuccess: invalidate })
  const dismiss = useMutation({ mutationFn: (d) => bhDismissDecision(d.decisionId), onSuccess: invalidate })

  return {
    onAct: (d) => act.mutate(d),
    onSnooze: (d) => snooze.mutate(d),
    onDismiss: (d) => dismiss.mutate(d),
    busy: act.isPending || snooze.isPending || dismiss.isPending,
  }
}
