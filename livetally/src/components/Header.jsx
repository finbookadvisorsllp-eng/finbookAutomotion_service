import { useState } from 'react'
import { Menu, Bell, Download, Plug, Calendar, ChevronDown, CheckCircle2, Plus, Moon, Sun } from 'lucide-react'
import { company, notifications } from '../data/mockData'

export default function Header({ collapsed, onToggleSidebar, isDarkMode, toggleTheme }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length

  const syncTimeAgo = () => {
    const now  = new Date()
    const sync = new Date(company.lastSync)
    const diffH = Math.round((now - sync) / 36e5)
    if (diffH < 1) return 'Just now'
    if (diffH === 1) return '1h ago'
    return `${diffH}h ago`
  }

  // Theme aware accent colors
  const accentColor = isDarkMode ? '#B6FF00' : '#2563eb'
  const accentLight = isDarkMode ? 'rgba(182, 255, 0, 0.1)' : 'rgba(37, 99, 235, 0.1)'
  const accentHover = isDarkMode ? 'rgba(182, 255, 0, 0.2)' : 'rgba(37, 99, 235, 0.15)'
  const hoverBg = isDarkMode ? 'rgba(182, 255, 0, 0.12)' : 'rgba(0, 0, 0, 0.04)'

  // Shared glass-button style (theme aware)
  const glassBtn = {
    bg: 'var(--theme-card-bg)',
    border: '1px solid var(--theme-card-border)',
    hover: hoverBg,
    text: 'var(--theme-text-main)',
    muted: 'var(--theme-text-muted)',
  }

  return (
    <header
      className={`app-header flex items-center gap-3 lg:gap-4 px-4 lg:px-6 ${collapsed ? 'collapsed' : ''}`}
      style={{ fontFamily: "'Nunito', 'Inter', system-ui, sans-serif" }}
    >
      {/* Sidebar Toggle */}
      <button
        onClick={onToggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 transition-all duration-150 active:scale-95"
        style={{ background: glassBtn.bg, border: glassBtn.border, color: glassBtn.text }}
        onMouseEnter={e => e.currentTarget.style.background = glassBtn.hover}
        onMouseLeave={e => e.currentTarget.style.background = glassBtn.bg}
        title="Toggle sidebar"
      >
        <Menu size={18} strokeWidth={2.2} />
      </button>

      {/* Company Switcher */}
      <div className="relative">
        <button
          onClick={() => setCompanyOpen(!companyOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-150 max-w-[160px] sm:max-w-[220px]"
          style={{ background: glassBtn.bg, border: glassBtn.border, color: glassBtn.text }}
          onMouseEnter={e => e.currentTarget.style.background = glassBtn.hover}
          onMouseLeave={e => e.currentTarget.style.background = glassBtn.bg}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', fontFamily: 'inherit' }}
          >
            SE
          </div>
          <span className="text-xs font-bold truncate hidden sm:block" style={{ color: glassBtn.text }}>
            {company.shortName}
          </span>
          <span className="text-xs font-bold truncate sm:hidden" style={{ color: glassBtn.text }}>SE</span>
          <ChevronDown size={13} style={{ color: glassBtn.muted }} />
        </button>

        {companyOpen && (
          <div
            className="absolute top-full left-0 mt-2 w-64 rounded-2xl z-50 py-2 animate-fade-in overflow-hidden"
            style={{
              background: 'var(--theme-card-bg)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--theme-card-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            {company.companies.map(c => (
              <button key={c.id} onClick={() => setCompanyOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2 transition-colors text-left group"
                style={{ color: 'var(--theme-text-main)' }}
                onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0"
                  style={{ background: c.color }}>
                  {c.name[0]}
                </div>
                <span className="text-[13px] font-bold" style={{ color: 'var(--theme-text-main)' }}>{c.name}</span>
              </button>
            ))}
            <div className="mx-3 my-2 h-px" style={{ background: 'var(--theme-card-border)' }} />
            <button className="w-full flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-left transition-colors"
              style={{ color: '#1E7BFF' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(30, 123, 255, 0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Plus size={15} /> Add Company
            </button>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls Row */}
      <div className="flex items-center gap-2.5 lg:gap-3">

        {/* FY Selector */}
        <button
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12.5px] font-bold transition-all duration-150"
          style={{ background: glassBtn.bg, border: glassBtn.border, color: glassBtn.text }}
          onMouseEnter={e => e.currentTarget.style.background = glassBtn.hover}
          onMouseLeave={e => e.currentTarget.style.background = glassBtn.bg}
        >
          <Calendar size={13} style={{ color: glassBtn.muted }} />
          FY {company.financialYear}
        </button>

        {/* Sync Badge */}
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all duration-150"
          style={{ background: accentLight, border: `1px solid ${accentHover}` }}
          onMouseEnter={e => e.currentTarget.style.background = accentHover}
          onMouseLeave={e => e.currentTarget.style.background = accentLight}
        >
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accentColor }}></span>
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: accentColor }}></span>
          </div>
          <span className="text-xs font-bold hidden lg:inline" style={{ color: accentColor }}>Synced · {syncTimeAgo()}</span>
        </div>

        {/* Export */}
        <button
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150"
          style={{ background: glassBtn.bg, border: glassBtn.border, color: glassBtn.text }}
          onMouseEnter={e => e.currentTarget.style.background = glassBtn.hover}
          onMouseLeave={e => e.currentTarget.style.background = glassBtn.bg}
        >
          <Download size={13} style={{ color: glassBtn.muted }} /> Export
        </button>

        {/* Connect Tally */}
        <button
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-150 hover:-translate-y-0.5"
          style={{
            background: accentColor,
            color: isDarkMode ? 'black' : 'white',
            boxShadow: `0 3px 12px ${accentLight}`,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = `0 5px 18px ${accentHover}`}
          onMouseLeave={e => e.currentTarget.style.boxShadow = `0 3px 12px ${accentLight}`}
        >
          <Plug size={13} />
          <span className="hidden lg:inline">Connect Tally</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
          style={{ background: glassBtn.bg, border: glassBtn.border, color: glassBtn.text }}
          onMouseEnter={e => e.currentTarget.style.background = glassBtn.hover}
          onMouseLeave={e => e.currentTarget.style.background = glassBtn.bg}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
            style={{ background: glassBtn.bg, border: glassBtn.border, color: glassBtn.text }}
            onMouseEnter={e => e.currentTarget.style.background = glassBtn.hover}
            onMouseLeave={e => e.currentTarget.style.background = glassBtn.bg}
          >
            <Bell size={16} strokeWidth={2.2} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-72 sm:w-80 rounded-2xl z-50 animate-fade-in overflow-hidden"
              style={{
                background: 'var(--theme-card-bg)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--theme-card-border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--theme-card-border)' }}>
                <span className="text-sm font-black" style={{ color: 'var(--theme-text-main)' }}>Notifications</span>
                <button
                  className="text-[11px] font-bold px-2 py-1 rounded-lg transition-colors"
                  style={{ color: accentColor, background: accentLight }}
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className="px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid var(--theme-card-border)',
                      background: !n.read ? accentLight : 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = accentHover}
                    onMouseLeave={e => e.currentTarget.style.background = !n.read ? accentLight : 'transparent'}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {!n.read ? (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor, boxShadow: `0 0 0 4px ${accentLight}` }} />
                        ) : (
                          <CheckCircle2 size={12} style={{ color: '#94a3b8' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${!n.read ? 'font-bold' : 'font-semibold'}`}
                          style={{ color: !n.read ? 'var(--theme-text-main)' : 'var(--theme-text-muted)' }}>
                          {n.message}
                        </p>
                        <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--theme-text-light)' }}>{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--theme-card-border)' }}>
                <button className="text-xs font-bold transition-colors" style={{ color: '#1E7BFF' }}>
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
