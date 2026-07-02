import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Mail, Lock, Loader2, ShieldCheck, Zap, BarChart3 } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import Button from '../ui/Button'
import OpenDoodle from '../ui/OpenDoodle'

// Auth scaffold. Issues a local stub token until the backend /auth/login is live.
// Swap the stub for a real axios call (api.post('/auth/login', ...)) once the
// endpoint exists — the rest of the flow (token storage, redirect) stays the same.
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAppStore((s) => s.setAuth)
  const mode = useAppStore((s) => s.mode)
  const isDark = mode === 'dark'
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

  const field = {
    backgroundColor: 'var(--app-control-bg)',
    borderColor: 'var(--app-border)',
    color: 'var(--app-heading)',
  }

  const features = [
    { icon: Zap, title: 'Automated voucher entry', desc: 'OCR, bulk upload & AI processing into Tally.' },
    { icon: ShieldCheck, title: 'Approval workflows', desc: 'Review and approve before pushing to books.' },
    { icon: BarChart3, title: 'Live dashboards', desc: 'Real-time business overview across companies.' },
  ]

  return (
    <div className={`min-h-screen flex relative overflow-hidden ${isDark ? 'dark' : ''}`} style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-heading)' }}>
      <div className="absolute inset-0 app-grid-bg opacity-30 pointer-events-none" />

      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative z-10 border-r" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full" style={{ color: 'var(--app-accent)', fill: 'var(--app-accent)' }}>
              <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center"><div className="h-3 w-3 border-2 border-white rotate-45" /></div>
          </div>
          <span className="text-[18px] font-extrabold tracking-tight" style={{ color: 'var(--app-heading)' }}>TallyHub</span>
        </div>

        <div className="space-y-6">
          <OpenDoodle name="strolling" float className="w-48 h-36 -ml-2" tint="var(--app-accent)" />
          <h2 className="text-[28px] font-extrabold tracking-tight leading-tight max-w-md" style={{ color: 'var(--app-heading)' }}>
            The automation layer for your accounting practice.
          </h2>
          <div className="space-y-4 max-w-sm">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
                  <f.icon size={16} strokeWidth={2.2} />
                </span>
                <div>
                  <h3 className="text-[13px] font-bold" style={{ color: 'var(--app-heading)' }}>{f.title}</h3>
                  <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--app-muted)' }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--app-muted)' }}>© {new Date().getFullYear()} Finbook Advisors</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm rounded-2xl border p-7 space-y-5"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow)' }}
        >
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight" style={{ color: 'var(--app-heading)' }}>Welcome back</h1>
            <p className="text-[12px] mt-1" style={{ color: 'var(--app-muted)' }}>Sign in to your Finbook Advisors workspace</p>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Email</span>
            <div className="relative mt-1.5">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted)' }} />
              <input
                type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full h-10 rounded-lg border pl-9 pr-3 text-[13px] font-medium outline-none transition-all focus:ring-4 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                style={field}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Password</span>
            <div className="relative mt-1.5">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted)' }} />
              <input
                type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 rounded-lg border pl-9 pr-3 text-[13px] font-medium outline-none transition-all focus:ring-4 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                style={field}
              />
            </div>
          </label>

          <Button type="submit" variant="cta" size="md" disabled={submitting} className="w-full">
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Signing in…</> : 'Sign in'}
          </Button>
        </motion.form>
      </div>
    </div>
  )
}
