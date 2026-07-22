import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import axios from 'axios'
import { Mail, Lock, Loader2, ShieldCheck, Zap, BarChart3 } from 'lucide-react'

import { useAppStore } from '../../stores/useAppStore'
import { authApi } from '../../services/authApi'
import Button from '../ui/Button'
import OpenDoodle from '../ui/OpenDoodle'

// Auth scaffold. Issues a local stub token until the backend /auth/login is live.
// Swap the stub for a real axios call (api.post('/auth/login', ...)) once the
// endpoint exists — the rest of the flow (token storage, redirect) stays the same.
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAppStore((s) => s.setAuth)
  const setOrg = useAppStore((s) => s.setOrg)
  const setCompanies = useAppStore((s) => s.setCompanies)
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
      const res = await authApi.login(email, password)
      const { token, refreshToken, user, organizations } = res.data

      if (!organizations || organizations.length === 0) {
        throw new Error('No workspaces linked to this account')
      }

      const targetOrg = organizations[0]
      const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2'
      const baseAuthUrl = rawBaseUrl.replace('/api/v2', '/api').replace('/v2', '')
      
      const orgSelectRes = await axios.post(
        `${baseAuthUrl}/auth/switch-organization`,
        { organizationId: targetOrg.id },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const { token: orgToken, refreshToken: orgRefresh, organization } = orgSelectRes.data.data
      const base64Url = orgToken.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const claims = JSON.parse(window.atob(base64))
      const expiry = claims ? claims.exp * 1000 : null

      setAuth({
        token: orgToken,
        refreshToken: orgRefresh,
        user,
        tokenExpiresAt: expiry,
        role: claims?.role,
        permissions: claims?.permissions,
      })

      setOrg({
        orgId: organization.id,
        orgDbName: organization.dbName,
        orgName: organization.displayName || organization.name,
      })

      setCompanies(organizations)

      toast.success('Signed in')
      navigate('/home', { replace: true })
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? 'Sign in failed')
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

  const [showRegister, setShowRegister] = useState(false)
  const [regSubmitting, setRegSubmitting] = useState(false)
  const [regForm, setRegForm] = useState({
    businessName: '',
    industry: '',
    gstNo: '',
    panNo: '',
    address: '',
    locality: '',
    state: 'Madhya Pradesh',
    city: '',
    country: 'India',
    adminName: '',
    email: '',
    phone: '',
    password: '',
  })

  const handleRegChange = (key, value) => {
    setRegForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (!regForm.businessName || !regForm.email || !regForm.password) {
      toast.error('Business Name, Admin Email, and Admin Password are required')
      return
    }
    setRegSubmitting(true)
    try {
      await authApi.registerOrganization(regForm)
      toast.success('Organization created & Admin account provisioned! Please sign in.')
      setEmail(regForm.email)
      setPassword(regForm.password)
      setShowRegister(false)
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? 'Registration failed')
    } finally {
      setRegSubmitting(false)
    }
  }

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
      <div className="flex-1 flex items-center justify-center p-6 relative z-10 overflow-y-auto">
        {!showRegister ? (
          <motion.form
            key="login-form"
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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

            <div className="pt-3 border-t text-center" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[12px]" style={{ color: 'var(--app-muted)' }}>Need a new company workspace? </span>
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="text-[12px] font-bold hover:underline"
                style={{ color: 'var(--app-accent)' }}
              >
                Create Company
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.form
            key="register-form"
            onSubmit={handleRegisterSubmit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg rounded-2xl border p-6 space-y-3.5 max-h-[90vh] overflow-y-auto"
            style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow)' }}
          >
            <div>
              <h1 className="text-[19px] font-extrabold tracking-tight" style={{ color: 'var(--app-heading)' }}>Create New Company</h1>
              <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--app-muted)' }}>
                Register a new company workspace to be managed under Administration
              </p>
            </div>

            {/* 1. Basic Info Section */}
            <div className="p-3.5 rounded-xl border space-y-2.5" style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-1.5 text-[var(--app-accent)] font-bold border-b pb-1" style={{ borderColor: 'var(--app-border)' }}>
                <span className="text-[11px] uppercase tracking-wider font-extrabold">🏢 1. Basic Info</span>
              </div>

              <div>
                <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Business Name *</label>
                <input
                  type="text" required value={regForm.businessName} onChange={(e) => handleRegChange('businessName', e.target.value)}
                  placeholder="e.g. Acme Corp Industries" className="w-full h-9 rounded-lg border px-3 text-[13px] font-medium outline-none" style={field}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Admin Email ID *</label>
                  <input
                    type="email" required value={regForm.email} onChange={(e) => handleRegChange('email', e.target.value)}
                    placeholder="admin@company.com" className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Admin Password *</label>
                  <input
                    type="password" required value={regForm.password} onChange={(e) => handleRegChange('password', e.target.value)}
                    placeholder="••••••••" className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Industry</label>
                  <select
                    value={regForm.industry} onChange={(e) => handleRegChange('industry', e.target.value)}
                    className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  >
                    <option value="">Select Industry</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Retail">Retail</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Services">Services</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Phone Number</label>
                  <input
                    type="text" value={regForm.phone} onChange={(e) => handleRegChange('phone', e.target.value)}
                    placeholder="+91 9876543210" className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>GST No. (Optional)</label>
                  <input
                    type="text" value={regForm.gstNo} onChange={(e) => handleRegChange('gstNo', e.target.value)}
                    placeholder="e.g. 23AAFFF..." className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>PAN No. (Optional)</label>
                  <input
                    type="text" value={regForm.panNo} onChange={(e) => handleRegChange('panNo', e.target.value)}
                    placeholder="e.g. AAFFF..." className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  />
                </div>
              </div>
            </div>

            {/* 2. Address & Location Section */}
            <div className="p-3.5 rounded-xl border space-y-2.5" style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-1.5 text-[var(--app-accent)] font-bold border-b pb-1" style={{ borderColor: 'var(--app-border)' }}>
                <span className="text-[11px] uppercase tracking-wider font-extrabold">📍 2. Address & Location</span>
              </div>

              <div>
                <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Address</label>
                <input
                  type="text" value={regForm.address} onChange={(e) => handleRegChange('address', e.target.value)}
                  placeholder="e.g. 101, Business Park" className="w-full h-9 rounded-lg border px-3 text-[13px] font-medium outline-none" style={field}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Locality</label>
                  <input
                    type="text" value={regForm.locality} onChange={(e) => handleRegChange('locality', e.target.value)}
                    placeholder="e.g. Vijay Nagar" className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>City</label>
                  <input
                    type="text" value={regForm.city} onChange={(e) => handleRegChange('city', e.target.value)}
                    placeholder="e.g. Indore" className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>State</label>
                  <select
                    value={regForm.state} onChange={(e) => handleRegChange('state', e.target.value)}
                    className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  >
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase block mb-1" style={{ color: 'var(--app-muted)' }}>Country</label>
                  <select
                    value={regForm.country} onChange={(e) => handleRegChange('country', e.target.value)}
                    className="w-full h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none" style={field}
                  >
                    <option value="India">India</option>
                  </select>
                </div>
              </div>
            </div>

            <Button type="submit" variant="cta" size="md" disabled={regSubmitting} className="w-full">
              {regSubmitting ? <><Loader2 size={14} className="animate-spin" /> Creating Company…</> : 'Create Company'}
            </Button>

            <div className="pt-3 border-t text-center" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[12px]" style={{ color: 'var(--app-muted)' }}>Already have an account? </span>
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="text-[12px] font-bold hover:underline"
                style={{ color: 'var(--app-accent)' }}
              >
                Sign in
              </button>
            </div>
          </motion.form>
        )}
      </div>
    </div>
  )
}
