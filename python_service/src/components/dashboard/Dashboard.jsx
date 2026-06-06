import { Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Navbar from '../layout/Navbar'
import Sidebar from '../layout/Sidebar'
import { LABEL_TO_PATH, PATH_TO_LABEL } from '../../routes/routePaths'
import { useAppStore } from '../../stores/useAppStore'
import { fetchCompanies } from '../companies/api'


// Modern SaaS design tokens — Linear / Vercel inspired.
// Light mode: warm neutrals, indigo→violet brand. Dark mode: deep cool slate.
const brandTheme = {
  light: {
    appBg: '#FAFAFB',
    panelBg: '#FFFFFF',
    contentBg: '#F6F7F9',
    sidebarBg: '#FFFFFF',
    border: '#ECEEF2',
    heading: '#0B0B12',
    text: '#5B6478',
    muted: '#8A93A6',
    tableHeadBg: '#F6F7F9',
    rowBorder: '#F1F2F5',
    rowHover: '#F6F7F9',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.08)',
    accentGradient: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #38BDF8 100%)',
    controlBg: '#FFFFFF',
    controlHover: '#F6F7F9',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText: '#B91C1C',
  },
  dark: {
    appBg: '#07070A',
    panelBg: 'rgba(15, 16, 22, 0.72)',
    contentBg: '#0A0A0F',
    sidebarBg: 'rgba(13, 14, 20, 0.72)',
    border: 'rgba(255, 255, 255, 0.08)',
    heading: '#e2bf22ff',
    text: '#ffffffff',
    muted: '#cfcfd5ff',
    tableHeadBg: 'rgba(255, 255, 255, 0.03)',
    rowBorder: 'rgba(255, 255, 255, 0.06)',
    rowHover: 'rgba(255, 255, 255, 0.04)',
    accent: '#60A5FA',
    accentSoft: 'rgba(96, 165, 250, 0.14)',
    accentGradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #7DD3FC 100%)',
    controlBg: 'rgba(255, 255, 255, 0.03)',
    controlHover: 'rgba(255, 255, 255, 0.06)',
    dangerBg: 'rgba(239, 68, 68, 0.12)',
    dangerBorder: 'rgba(239, 68, 68, 0.30)',
    dangerText: '#FCA5A5',
  },
}

function Dashboard({
  subscriptionMessage = 'Your subscription expires in 8 days',
  credits = 372,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeItem = PATH_TO_LABEL[location.pathname] ?? 'User Data'
  const handleItemClick = (label) => {
    const path = LABEL_TO_PATH[label]
    if (path) navigate(path)
  }

  // Theme + tenant scope live in the global store so any feature can read them
  // without prop-drilling, and axios picks up the selected company automatically.
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const companies = useAppStore((s) => s.companies)
  const selectedCompany = useAppStore((s) => s.selectedCompany)
  const setSelectedCompany = useAppStore((s) => s.setSelectedCompany)
  const setCompanies = useAppStore((s) => s.setCompanies)

  // Dynamically load company list from the database
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const list = await fetchCompanies()
        if (list && list.length > 0) {
          const names = list.map((c) => c.name)
          setCompanies(names)
          
          // Fallback if current selected company is empty, not in database list, or matches old mocks
          if (
            !selectedCompany ||
            !names.includes(selectedCompany) ||
            ['Data Uncyclable', 'Finolax Advisors', 'Greenline Ventures', 'Apex Holdings'].includes(selectedCompany)
          ) {
            setSelectedCompany(names[0])
          }
        }
      } catch (err) {
        console.error('Failed to load companies dynamically:', err)
      }
    }
    loadCompanies()
  }, [setCompanies, setSelectedCompany, selectedCompany])


  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const theme = brandTheme[mode]
  const isDark = mode === 'dark'

  // Close mobile drawer when navigating
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [mobileNavOpen])

  return (
    <div
      className={`min-h-screen  relative overflow-hidden ${isDark ? 'dark' : ''}`}
      style={{
        backgroundColor: theme.appBg,
        color: theme.heading,
        '--app-panel-bg': theme.panelBg,
        '--app-content-bg': theme.contentBg,
        '--app-sidebar-bg': theme.sidebarBg,
        '--app-border': theme.border,
        '--app-heading': theme.heading,
        '--app-text': theme.text,
        '--app-muted': theme.muted,
        '--app-accent': theme.accent,
        '--app-accent-soft': theme.accentSoft,
        '--app-accent-gradient': theme.accentGradient,
        '--app-table-head-bg': theme.tableHeadBg,
        '--app-row-border': theme.rowBorder,
        '--app-row-hover': theme.rowHover,
        '--app-control-bg': theme.controlBg,
        '--app-control-hover': theme.controlHover,
        '--app-danger-bg': theme.dangerBg,
        '--app-danger-border': theme.dangerBorder,
        '--app-danger-text': theme.dangerText,
      }}
    >
      {/* Ambient background — subtle grid + soft brand orbs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 app-grid-bg opacity-60" />
        <div
          className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
            animation: 'softPulse 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-[10%] right-[-8%] h-[480px] w-[480px] rounded-full blur-[120px]"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(56,189,248,0.14) 0%, transparent 70%)',
            animation: 'softPulse 18s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[20%] h-[420px] w-[420px] rounded-full blur-[120px]"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(96,165,250,0.16) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(29,78,216,0.10) 0%, transparent 70%)',
            animation: 'softPulse 16s ease-in-out infinite',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-xl h-screen flex flex-col md:rounded-2xl border relative z-10 glass-surface"
        style={{
          borderColor: theme.border,
          boxShadow: isDark
            ? '0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 24px 60px -24px rgba(15,23,42,0.18), 0 1px 0 rgba(15,23,42,0.02)',
        }}
      >
        <Navbar
          isDark={isDark}
          mode={mode}
          onModeToggle={toggleMode}
          companies={companies}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
          subscriptionMessage={subscriptionMessage}
          credits={credits}
          onMobileNavToggle={() => setMobileNavOpen((p) => !p)}
        />

        <div className="flex flex-1 relative overflow-hidden">
          {/* Desktop sidebar */}
          <div className="hidden md:flex h-full">
            <Sidebar
              activeItem={activeItem}
              onItemClick={handleItemClick}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
              isDark={isDark}
            />
          </div>

          {/* Mobile drawer */}
          <AnimatePresence>
            {mobileNavOpen && (
              <>
                <motion.div
                  key="mobile-nav-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setMobileNavOpen(false)}
                  className="absolute inset-0 z-30 bg-black/30 md:hidden backdrop-blur-sm"
                />
                <motion.div
                  key="mobile-nav-drawer"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  className="absolute left-0 top-0 bottom-0 z-40 md:hidden h-full"
                >
                  <Sidebar
                    activeItem={activeItem}
                    onItemClick={handleItemClick}
                    collapsed={false}
                    onToggle={() => setMobileNavOpen(false)}
                    isDark={isDark}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col overflow-hidden">
            <main
              className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 md:p-5"
              style={{ backgroundColor: 'transparent' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeItem}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full flex flex-col"
                >
                  <Suspense fallback={<div className="h-full flex items-center justify-center text-xs font-semibold uppercase tracking-widest" style={{ color: theme.muted }}>Loading…</div>}>
                    <Outlet context={{ isDark }} />
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>

            <footer
              className="px-4 py-2.5 text-[11.5px] font-semibold text-center border-t"
              style={{
                borderColor: theme.border,
                color: theme.muted,
                backgroundColor: 'transparent',
              }}
            >
              © {new Date().getFullYear()} Finbook Advisors. All rights reserved.
            </footer>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard
