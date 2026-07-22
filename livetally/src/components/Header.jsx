import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Menu, Bell, Calendar, ChevronDown, CheckCircle2, Moon, Sun } from 'lucide-react'
import { notifications } from '../data/mockData'
import { useDateRange } from '../context/DateContext'
import { getAllCompanies } from '../api'
import { getCompanyId, setCompanyId } from '../api/client'
import { CACHE_TIMES } from '../queryClient'

const getFyFromRange = (rangeStr) => {
  const match = rangeStr.match(/\(([^)]+)\)/)
  if (!match) return null
  
  const parts = match[1].split(' - ')
  const dateStr = parts[0] // e.g. "1st Apr '26"
  
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1')
  const dateParts = cleaned.trim().split(/\s+/)
  if (dateParts.length !== 3) return null
  
  const monthName = dateParts[1].slice(0, 3).toLowerCase()
  const yearShort = dateParts[2].replace("'", "")
  const year = parseInt(yearShort, 10) + 2000
  
  const months = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  }
  const month = months[monthName]
  if (!month) return null
  
  const startYear = month >= 4 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

export default function Header({ collapsed, onToggleSidebar, isDarkMode, toggleTheme }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const { fy, years, setFy, selectedDateRange, setSelectedDateRange } = useDateRange()

  const companyRef = useRef(null)
  const dateRangeRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (companyRef.current && !companyRef.current.contains(e.target)) {
        setCompanyOpen(false)
      }
      if (dateRangeRef.current && !dateRangeRef.current.contains(e.target)) {
        setDateRangeOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

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

  const dateRanges = useMemo(() => {
    let today = new Date()
    
    // Shift reference date if a specific financial year (fy) is active
    if (fy && fy.includes('-')) {
      const parts = fy.split('-')
      const startYear = parseInt(parts[0], 10)
      const endYear = parseInt(parts[1], 10)
      if (!isNaN(startYear) && !isNaN(endYear)) {
        const currentMonth = today.getMonth()
        const currentDate = today.getDate()
        if (currentMonth >= 3) {
          // April to December -> starts in startYear
          today = new Date(startYear, currentMonth, currentDate)
        } else {
          // January to March -> ends in endYear
          today = new Date(endYear, currentMonth, currentDate)
        }
      }
    }
    
    const getOrdinalSuffix = (day) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1:  return "st";
        case 2:  return "nd";
        case 3:  return "rd";
        default: return "th";
      }
    }

    const formatRangeDate = (d) => {
      const day = d.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const yearShort = String(d.getFullYear()).slice(-2);
      return `${day}${getOrdinalSuffix(day)} ${month} '${yearShort}`;
    }

    const formatWeek = (d) => {
      const day = (d.getDay() + 6) % 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - day);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${formatRangeDate(mon)} - ${formatRangeDate(sun)}`;
    }

    const formatLastWeek = (d) => {
      const day = (d.getDay() + 6) % 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - day - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${formatRangeDate(mon)} - ${formatRangeDate(sun)}`;
    }

    const formatMonth = (d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
    }

    const formatLastMonth = (d) => {
      const start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const end = new Date(d.getFullYear(), d.getMonth(), 0)
      return `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
    }

    const formatQuarter = (d) => {
      const m = d.getMonth();
      let startMonth, endMonth, startYear = d.getFullYear(), endYear = d.getFullYear();
      if (m >= 3 && m <= 5) {
        startMonth = 3; endMonth = 5;
      } else if (m >= 6 && m <= 8) {
        startMonth = 6; endMonth = 8;
      } else if (m >= 9 && m <= 11) {
        startMonth = 9; endMonth = 11;
      } else {
        startMonth = 0; endMonth = 2;
      }
      const start = new Date(startYear, startMonth, 1);
      const end = new Date(endYear, endMonth + 1, 0);
      return `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
    }

    const formatYear = (d) => {
      const m = d.getMonth();
      const startYear = m >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      const start = new Date(startYear, 3, 1);
      const end = new Date(startYear + 1, 2, 31);
      return `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
    }

    const formatLastYear = (d) => {
      const m = d.getMonth();
      const startYear = (m >= 3 ? d.getFullYear() : d.getFullYear() - 1) - 1;
      const start = new Date(startYear, 3, 1);
      const end = new Date(startYear + 1, 2, 31);
      return `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
    }

    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    return [
      `Today (${formatRangeDate(today)})`,
      `Yesterday (${formatRangeDate(yesterday)})`,
      `This Week (${formatWeek(today)})`,
      `Last Week (${formatLastWeek(today)})`,
      `This Month (${formatMonth(today)})`,
      `Last Month (${formatLastMonth(today)})`,
      `This Quarter (${formatQuarter(today)})`,
      `This Year (${formatYear(today)})`,
      `Last Year (${formatLastYear(today)})`
    ]
  }, [fy])

  const unreadCount = notifications.filter(n => !n.read).length

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
      <div className="relative" ref={companyRef}>
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
        <div className="relative hidden md:block" ref={dateRangeRef}>
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
                    onClick={() => {
                      setSelectedDateRange(range)
                      setDateRangeOpen(false)
                      const derivedFy = getFyFromRange(range)
                      if (derivedFy && years.some(y => y.id === derivedFy)) {
                        setFy(derivedFy)
                      }
                    }}
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
        <div className="relative" ref={notifRef}>
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
