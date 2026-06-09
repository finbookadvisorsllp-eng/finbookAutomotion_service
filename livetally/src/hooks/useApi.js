// useApi — run an async API call with loading/error/data state.
// Re-runs whenever a value in `deps` changes (e.g. the selected financial year).
import { useState, useEffect, useCallback } from 'react'

export function useApi(fn, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      setData(result)
      return result
    } catch (e) {
      setError(e)
      return null
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (skip) return
    let alive = true
    setLoading(true)
    setError(null)
    fn()
      .then((r) => { if (alive) setData(r) })
      .catch((e) => { if (alive) setError(e) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, refetch: run }
}

export default useApi
