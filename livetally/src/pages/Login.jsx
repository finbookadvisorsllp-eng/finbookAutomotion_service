import { useState } from 'react'

export default function Login({ onLogin, onDemo }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); onLogin() }, 1000)
  }

  const features = [
    { icon: '📊', title: 'Live Business Dashboard', desc: 'All your Tally data, visible in your browser in real-time' },
    { icon: '💸', title: 'Money Due to You', desc: 'Track receivables, aging, and collections at a glance' },
    { icon: '🏦', title: 'Cash & Bank Position', desc: 'Know exactly where your money is, right now' },
    { icon: '📈', title: 'Profit & Loss Simplified', desc: 'Understand your business health without accounting jargon' },
  ]

  // Shared styles
  const inputStyle = (focused) => ({
    width: '100%',
    padding: '14px 18px',
    border: focused ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
    borderRadius: '14px',
    fontSize: '14px',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 500,
    color: '#1e293b',
    backgroundColor: '#ffffff',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: focused ? '0 0 0 4px rgba(59,130,246,0.1)' : 'none',
    boxSizing: 'border-box',
  })

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
    fontFamily: "'Inter', system-ui, sans-serif",
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Left — Brand panel */}
      <div className="hidden lg:flex" style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 64px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: 80, right: 80,
          width: 288, height: 288, borderRadius: '50%',
          opacity: 0.1, border: '1px solid #60a5fa',
        }} />
        <div style={{
          position: 'absolute', bottom: 128, left: 40,
          width: 192, height: 192, borderRadius: '50%',
          opacity: 0.1, border: '1px solid #38bdf8',
        }} />

        <div style={{ position: 'relative', maxWidth: 420, textAlign: 'center' }}>
          {/* Logo */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 900, color: '#fff',
            margin: '0 auto 32px',
            background: 'linear-gradient(135deg,#2563eb,#0ea5e9)',
            boxShadow: '0 16px 40px rgba(37,99,235,0.45)',
          }}>
            TV
          </div>

          <h1 style={{
            fontSize: 38, fontWeight: 900, color: '#fff',
            lineHeight: 1.15, marginBottom: 16, letterSpacing: '-1px',
          }}>
            TallyView<br />
            <span style={{
              background: 'linear-gradient(135deg,#60a5fa,#38bdf8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              by FinBook
            </span>
          </h1>
          <p style={{
            color: '#94a3b8', fontSize: 15, lineHeight: 1.7, marginBottom: 48,
          }}>
            View your Tally data live on the web.<br />
            Sales, purchases, GST, receivables — all in one place.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'left' }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 18,
                  background: 'rgba(37,99,235,0.18)',
                }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginBottom: 2 }}>{f.title}</p>
                  <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{
            marginTop: 48, padding: 20, borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            textAlign: 'left',
          }}>
            <p style={{ color: '#cbd5e1', fontSize: 14, fontStyle: 'italic', lineHeight: 1.6 }}>
              "Finally I can see my business numbers without calling my CA every time. TallyView is exactly what I needed."
            </p>
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 10 }}>— Ramesh Sharma, Sharma Enterprises</p>
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 48px',
        boxSizing: 'border-box',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Mobile Logo */}
          <div className="lg:hidden" style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 900, color: '#fff',
              background: 'linear-gradient(135deg,#2563eb,#0ea5e9)',
            }}>TV</div>
            <div>
              <p style={{ fontWeight: 700, color: '#0f172a', fontSize: 16 }}>TallyView</p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>by FinBook</p>
            </div>
          </div>

          <h2 style={{
            fontSize: 28, fontWeight: 900, color: '#0f172a',
            marginBottom: 6, letterSpacing: '-0.5px',
          }}>Welcome back</h2>
          <p style={{
            fontSize: 14, color: '#94a3b8', marginBottom: 36,
            fontWeight: 500,
          }}>Sign in to view your business data</p>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                placeholder="you@business.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={inputStyle(emailFocused)}
                required
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 8,
              }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                <span style={{
                  fontSize: 12, color: '#2563eb', cursor: 'pointer',
                  fontWeight: 600,
                }}>Forgot?</span>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                style={inputStyle(passFocused)}
                required
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                marginTop: 16,
                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                transition: 'all 0.2s ease',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    display: 'inline-block',
                  }} />
                  Signing in...
                </span>
              ) : 'Sign In →'}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            margin: '24px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* Demo Button */}
          <button
            onClick={onDemo}
            style={{
              width: '100%',
              padding: '14px 20px',
              border: '2px dashed #bfdbfe',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 600,
              color: '#2563eb',
              backgroundColor: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#eff6ff'
              e.currentTarget.style.borderColor = '#60a5fa'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#fff'
              e.currentTarget.style.borderColor = '#bfdbfe'
            }}
          >
            🎮 Explore Demo Dashboard
          </button>

          <p style={{
            textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 18,
          }}>
            No account?{' '}
            <span style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Contact your CA firm</span>
          </p>

          {/* Powered by */}
          <div style={{
            marginTop: 48, paddingTop: 24,
            borderTop: '1px solid #e2e8f0',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 11, color: '#cbd5e1' }}>Powered by FinBook Automation Service</p>
            <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3 }}>Multi-tenant · Secure · CA-ready</p>
          </div>
        </div>
      </div>
    </div>
  )
}
