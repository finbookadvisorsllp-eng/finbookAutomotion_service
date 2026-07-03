// useApiQuery — cached data fetching built on TanStack Query.
//
// Drop-in replacement for `useApi` with the same return shape
// ({ data, loading, error, refetch }) so migrating a page is mechanical, but with
// stale-while-revalidate caching, request deduplication and background refetch.
//
// Every cache entry is automatically scoped to the active company, so switching
// companies can never surface another company's cached data. Callers pass a
// stable key describing the request (report name + params), e.g.
//   useApiQuery(['dashboard', fy], () => getDashboard(fy), { enabled: !!fy })
import { useQuery } from '@tanstack/react-query'
import { getCompanyId } from '../api/client'

export function useApiQuery(key, fn, options = {}) {
  const { enabled = true, ...rest } = options
  const keyParts = Array.isArray(key) ? key : [key]
  // Scope to the active company so cache entries never collide across tenants.
  const queryKey = ['company', getCompanyId(), ...keyParts]

  const query = useQuery({ queryKey, queryFn: fn, enabled, ...rest })

  return {
    ...query,
    data: query.data,
    // isLoading is true only on the first load with no cached data; background
    // refetches keep the previous data on screen (stale-while-revalidate).
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

export default useApiQuery
