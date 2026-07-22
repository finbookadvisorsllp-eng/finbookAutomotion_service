import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Menu, Bell, Download, Plug, Calendar, ChevronDown, CheckCircle2, Moon, Sun } from 'lucide-react'
import { company, notifications } from '../data/mockData'
import { useDateRange } from '../context/DateContext'
import { getAllCompanies } from '../api'
import { getCompanyId, setCompanyId } from '../api/client'
import { CACHE_TIMES } from '../queryClient'

export default function Header({ collapsed, onToggleSidebar, isDarkMode, toggleTheme }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const { selectedDateRange, setSelectedDateRange } = useDateRange()

  // Real company switcher — lists every tenant company, switches the active one.
  // Company list is master data: cached (was re-fetched on every Header render).
  const { data: companiesData } = useQuery({
    queryKey: ['all-companies'],
    queryFn: () => getAllCompanies().catch(() => []),
    ...CACHE_TIMES.master,
  })
  const companies = companiesData || []
  const currentId = getCompanyId()
  const currentCompany = companies.find((c) => c.id === currentId)
  const currentName = currentCompany?.name || 'Select Company'
  const initials = (currentName || 'C').replace(/[^A-Za-z ]/g, '').trim().slice(0, 2).toUpperCase() || 'CO'
  const switchCompany = (id) => {
    setCompanyOpen(false)
    if (id === currentId) return
    setCompanyId(id)        // persists to localStorage; x-company-id header uses it
    // Full reload clears both the React tree and the query cache so every page
    // (migrated to TanStack Query or not) reloads fresh for the new company. Once
    // all pages use useApiQuery this can become queryClient.clear() + re-render.
    window.location.reload()
  }

  const dateRanges = [
    "Today (29th May '26)",
    "Yesterday (28th May '26)",
    "This Week (22nd May '26 - 29th May '26)",
    "Last Week (15th May '26 - 22nd May '26)",
    "This Month (1st May '26 - 31st May '26)",
    "Last Month (1st Apr '26 - 30th Apr '26)",
    "This Quarter (1st Apr '26 - 30th Jun '26)",
    "This Year (1st Apr '26 - 31st Mar '27)",
    "Last Year (1st Apr '25 - 31st Mar '26)"
  ]

  const unreadCount = notifications.filter(n => !n.read).length

  const syncTimeAgo = () => {
    const now = new Date()
    const sync = new Date(company.lastSync)
    const diffH = Math.round((now - sync) / 36e5)
    if (diffH < 1) return 'Just now'
    if (diffH === 1) return '1h ago'
    return `${diffH}h ago`
  }

  // Theme aware accent colors
  const accentColor = isDarkMode ? '#B6FF00' : '#2563eb'
  const accentLight = isDarkMode ? 'rgba(182, 255, 0, 0.1)' : 'rgba(37, 99, 235, 0.08)'
  const accentHover = isDarkMode ? 'rgba(182, 255, 0, 0.2)' : 'rgba(37, 99, 235, 0.12)'
  const hoverBg = isDarkMode ? 'rgba(182, 255, 0, 0.12)' : 'var(--theme-surface-secondary)'

  return (
    <header
      className={`app-header flex items-center gap-3 lg:gap-4 px-4 lg:px-6 ${collapsed ? 'collapsed' : ''}`}
    >
      {/* Sidebar Toggle */}
      <button
        onClick={onToggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-all duration-150 active:scale-95"
        style={{
          background: 'transparent',
          color: 'var(--theme-text-muted)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        title="Toggle sidebar"
      >
        <Menu size={18} strokeWidth={2} />
      </button>

      {/* Company Switcher */}
      <div className="relative">
        <button
          onClick={() => setCompanyOpen(!companyOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-150 max-w-[180px] sm:max-w-[260px] md:max-w-[320px]"
          style={{
            background: 'var(--theme-card-bg)',
            border: '1px solid var(--theme-card-border)',
            color: 'var(--theme-text-main)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-xs)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}
          >
            {initials}
          </div>
          <span className="text-[13px] font-medium truncate hidden sm:block" style={{ color: 'var(--theme-text-main)' }}>
            {currentName}
          </span>
          <span className="text-[13px] font-medium truncate sm:hidden" style={{ color: 'var(--theme-text-main)' }}>{initials}</span>
          <ChevronDown size={13} style={{ color: 'var(--theme-text-light)' }} />
        </button>

        {companyOpen && (
          <div
            className="absolute top-full left-0 mt-2 w-64 z-50 py-2 animate-fade-in overflow-hidden"
            style={{
              background: 'var(--theme-card-bg)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--theme-card-border)',
              boxShadow: 'var(--shadow-xl)',
              borderRadius: 16,
            }}
          >
            <div className="px-4 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-light)' }}>
              Switch Company
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {companies.length === 0 ? (
                <div className="px-4 py-3 text-[12px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>Loading companies…</div>
              ) : companies.map(c => {
                const active = c.id === currentId
                return (
                  <button key={c.id} onClick={() => switchCompany(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                    style={{ color: 'var(--theme-text-main)', background: active ? accentLight : 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = active ? accentLight : hoverBg}
                    onMouseLeave={e => e.currentTarget.style.background = active ? accentLight : 'transparent'}
                  >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: active ? accentColor : 'linear-gradient(135deg,#64748b,#94a3b8)' }}>{(c.name || '?')[0]}</div>
                    <span className="text-[13px] font-medium flex-1 truncate" style={{ color: 'var(--theme-text-main)' }}>{c.name}</span>
                    {active && <CheckCircle2 size={15} style={{ color: accentColor }} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls Row */}
      <div className="flex items-center gap-2.5 lg:gap-3">

        {/* Date Range Selector */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setDateRangeOpen(!dateRangeOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12.5px] font-medium transition-all duration-150"
            style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-card-border)', color: 'var(--theme-text-main)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-xs)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <Calendar size={13} style={{ color: 'var(--theme-text-light)' }} />
            {selectedDateRange}
            <ChevronDown size={13} style={{ color: 'var(--theme-text-light)' }} />
          </button>

          {dateRangeOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-72 z-50 py-2 animate-fade-in overflow-hidden"
              style={{
                background: 'var(--theme-card-bg)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--theme-card-border)',
                boxShadow: 'var(--shadow-xl)',
                borderRadius: 16,
              }}
            >
              <div className="max-h-[60vh] overflow-y-auto">
                {dateRanges.map((range, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setSelectedDateRange(range); setDateRangeOpen(false) }}
                    className="w-full flex items-center px-4 py-2.5 transition-colors text-left"
                    style={{
                      color: selectedDateRange === range ? accentColor : 'var(--theme-text-main)',
                      background: selectedDateRange === range ? accentLight : 'transparent',
                      borderBottom: idx < dateRanges.length - 1 ? '1px solid var(--theme-card-border)' : 'none'
                    }}
                    onMouseEnter={e => {
                      if (selectedDateRange !== range) e.currentTarget.style.background = hoverBg
                    }}
                    onMouseLeave={e => {
                      if (selectedDateRange !== range) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span className="text-[13px] font-medium">{range}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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
          <span className="text-xs font-medium hidden lg:inline" style={{ color: accentColor }}>Synced · {syncTimeAgo()}</span>
        </div>

        {/* Export */}
        <button
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
          style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-card-border)', color: 'var(--theme-text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-xs)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <Download size={13} style={{ color: 'var(--theme-text-light)' }} /> Export
        </button>

        {/* Connect Tally */}
        <button
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
          style={{
            background: accentColor,
            color: isDarkMode ? 'black' : 'white',
            boxShadow: `0 2px 8px ${accentLight}`,
          }}
        >
          <Plug size={13} />
          <span className="hidden lg:inline">Connect Tally</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 active:scale-95"
          style={{ background: 'transparent', color: 'var(--theme-text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.background = hoverBg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 active:scale-95"
            style={{ background: 'transparent', color: 'var(--theme-text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = hoverBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Bell size={16} strokeWidth={2} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                style={{ background: '#f43f5e', border: '2px solid var(--theme-header-bg)' }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-72 sm:w-80 z-50 animate-fade-in overflow-hidden"
              style={{
                background: 'var(--theme-card-bg)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--theme-card-border)',
                boxShadow: 'var(--shadow-xl)',
                borderRadius: 16,
              }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--theme-card-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-main)' }}>Notifications</span>
                <button
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
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
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor, boxShadow: `0 0 0 3px ${accentLight}` }} />
                        ) : (
                          <CheckCircle2 size={12} style={{ color: '#94a3b8' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${!n.read ? 'font-medium' : 'font-normal'}`}
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
                <button className="text-xs font-medium transition-colors" style={{ color: accentColor }}>
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
