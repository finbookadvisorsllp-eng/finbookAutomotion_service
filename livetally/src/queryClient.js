// Shared TanStack Query client for the whole LiveTally app.
//
// This is the client-side half of the caching strategy: it gives every report a
// stale-while-revalidate cache, deduplicates concurrent identical requests, and
// keeps results in memory so re-visiting a page (or switching back to it) serves
// instantly from cache instead of re-firing the whole aggregation. The backend
// TTL cache handles cross-user reuse; this handles per-session navigation.
import { QueryClient } from '@tanstack/react-query'

// Sensible defaults tuned for FY-scoped financial reports, which change only on a
// Tally sync. Individual queries can override staleTime/gcTime as needed.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min: don't refetch a report on every re-mount
      gcTime: 30 * 60 * 1000,     // 30 min: keep cached data around for quick re-visits
      refetchOnWindowFocus: false, // financial data doesn't need focus-refetch
      retry: 1,
    },
  },
})

// Per-report cache tuning. Import and spread into a useQuery/useApiQuery call.
export const CACHE_TIMES = {
  // Master data (companies, financial years) — changes only on sync.
  master: { staleTime: 30 * 60 * 1000, gcTime: 120 * 60 * 1000 },
  // Financial statements (P&L / BS / TB) — FY-scoped, rarely change.
  statement: { staleTime: 10 * 60 * 1000, gcTime: 60 * 60 * 1000 },
  // Dashboard overview — current-day freshness expected.
  dashboard: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  // Paginated voucher drill-downs — more dynamic.
  drilldown: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
}

export default queryClient
