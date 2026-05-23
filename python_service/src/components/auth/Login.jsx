import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppStore } from '../../stores/useAppStore'

// Auth scaffold. Issues a local stub token until the backend /auth/login is live.
// Swap the stub for a real axios call (api.post('/auth/login', ...)) once the
// endpoint exists — the rest of the flow (token storage, redirect) stays the same.
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAppStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname ?? '/'

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Email and password required')
      return
    }
    setSubmitting(true)
    try {
      // TODO: replace with `await api.post('/auth/login', { email, password })`
      await new Promise((r) => setTimeout(r, 400))
      setAuth({ token: 'dev-stub-token', user: { email } })
      toast.success('Signed in')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err?.message ?? 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4"
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
          <p className="text-xs text-slate-500 mt-1">Finbook Advisors workspace</p>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="you@company.com"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
