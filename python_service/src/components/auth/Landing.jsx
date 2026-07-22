import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { BookOpen, BarChart3, Sparkles, ArrowRight, LogOut, Zap } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { authApi } from '../../services/authApi'

export default function Landing() {
  const navigate = useNavigate()
  const isDark = useAppStore((s) => s.mode === 'dark')
  const logout = useAppStore((s) => s.logout)
  const refreshToken = useAppStore((s) => s.refreshToken)
  const user = useAppStore((s) => s.user)

  const handleLogout = () => {
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => {})
    }
    logout()
    navigate('/login')
  }

  const cards = [
    {
      id: 'accounting',
      title: 'Accounting Entry',
      subtitle: 'Anjalee & Python Services',
      desc: 'Automated OCR processing, bulk spreadsheet uploads, and direct ledger integration into Tally.',
      icon: BookOpen,
      color: 'var(--app-accent)',
      active: true,
      path: '/dashboard',
    },
    {
      id: 'analytics',
      title: 'Report & Analytics',
      subtitle: 'Aman & LiveTally Service',
      desc: 'Real-time financial analytics, instant trial balances, automated P&L generation, and business KPIs.',
      icon: BarChart3,
      color: '#10b981', // Emerald
      active: false,
    },
    {
      id: 'agents',
      title: 'AI Agents',
      subtitle: 'Antigravity AI',
      desc: 'Autonomous ledger classification, verification agents, and smart anomaly detection engines.',
      icon: Sparkles,
      color: '#8b5cf6', // Violet
      active: false,
    },
  ]

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-6 relative overflow-hidden ${
        isDark ? 'dark' : ''
      }`}
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-heading)' }}
    >
      <div className="absolute inset-0 app-grid-bg opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center max-w-7xl w-full mx-auto relative z-10 py-4">
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full"
              style={{ color: 'var(--app-accent)', fill: 'var(--app-accent)' }}
            >
              <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3 w-3 border-2 border-white rotate-45" />
            </div>
          </div>
          <span className="text-[18px] font-extrabold tracking-tight">TallyHub</span>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium hidden sm:inline" style={{ color: 'var(--app-muted)' }}>
              {user.email || user.name}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-bold transition-all hover:bg-red-500/10 hover:border-red-500/30"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-6xl w-full mx-auto relative z-10 py-12">
        <div className="text-center space-y-4 max-w-2xl mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <Zap size={10} /> Central Automation Hub
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[32px] sm:text-[44px] font-extrabold tracking-tight leading-none"
          >
            Select Your Workspace Division
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[14px] sm:text-[15px]"
            style={{ color: 'var(--app-muted)' }}
          >
            Choose a specialized division to launch your financial automation dashboard.
          </motion.p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full px-4">
          {cards.map((card, index) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08, duration: 0.4 }}
                onClick={() => card.active && navigate(card.path)}
                className={`rounded-2xl border p-6 flex flex-col justify-between min-h-[260px] transition-all relative overflow-hidden ${
                  card.active
                    ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] border-[var(--app-accent)] group'
                    : 'opacity-70 border-[var(--app-border)] select-none'
                }`}
                style={{
                  backgroundColor: 'var(--app-panel-bg)',
                  boxShadow: card.active ? 'var(--app-shadow)' : 'none',
                }}
              >
                {/* Glow effect on hover for active card */}
                {card.active && (
                  <div className="absolute -inset-px bg-gradient-to-r from-transparent via-[var(--app-accent-soft)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                )}

                <div className="space-y-4 relative z-10">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: card.active ? 'var(--app-accent-soft)' : 'var(--app-control-bg)',
                      color: card.color,
                    }}
                  >
                    <Icon size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[18px] font-extrabold tracking-tight">{card.title}</h3>
                      {!card.active && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-yellow-500/10 border-yellow-500/20 text-yellow-500">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] font-bold mt-0.5" style={{ color: 'var(--app-muted)' }}>
                      {card.subtitle}
                    </p>
                  </div>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                    {card.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t relative z-10 flex items-center justify-between" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: card.active ? 'var(--app-accent)' : 'var(--app-muted)' }}>
                    {card.active ? 'Enter Workspace' : 'Locked'}
                  </span>
                  {card.active && (
                    <ArrowRight
                      size={15}
                      className="transform group-hover:translate-x-1 transition-transform text-[var(--app-accent)]"
                    />
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto text-center py-4">
        <p className="text-[11px]" style={{ color: 'var(--app-muted)' }}>
          © {new Date().getFullYear()} Finbook Advisors. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
