import { lazy } from 'react'

// Wraps React.lazy so a flaky network chunk load retries before failing.
// One reload of the chunk usually fixes a transient fetch error instead of
// white-screening the panel. ponytail: fixed 2 retries / 600ms — bump if a
// route's chunk is large and networks are slow.
export default function lazyRetry(importer, retries = 2, delay = 600) {
  return lazy(async () => {
    let lastErr
    for (let i = 0; i <= retries; i++) {
      try {
        return await importer()
      } catch (err) {
        lastErr = err
        if (i < retries) await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw lastErr
  })
}
