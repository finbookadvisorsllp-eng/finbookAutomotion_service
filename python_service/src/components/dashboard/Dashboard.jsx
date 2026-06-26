import { Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Navbar from '../layout/Navbar'
import Sidebar from '../layout/Sidebar'
import { LABEL_TO_PATH, PATH_TO_LABEL } from '../../routes/routePaths'
import { useAppStore } from '../../stores/useAppStore'
import { fetchCompanies } from '../companies/api'


// Design tokens now live in src/styles/index.css (:root / .dark) so every
// component shares one source of truth. This shell only toggles the .dark class.
function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeItem = PATH_TO_LABEL[location.pathname] ?? 'Dashboard'
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
  const approvalCenterView = useAppStore((s) => s.approvalCenterView)

  const isApprovalDetail = location.pathname.startsWith('/automation/approval-center') && approvalCenterView === 'detail'
  const isCompactHeader = isApprovalDetail || location.pathname === '/sales/new' || location.pathname === '/' || location.pathname === '/automation/ai-processing'

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
      className={`h-screen overflow-hidden relative ${isDark ? 'dark' : ''}`}
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-heading)' }}
    >
      {/* Ambient background — faint grid + one soft brand glow (kept light) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 app-grid-bg opacity-50" />
        <div
          className="absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full blur-[130px]"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)',
            animation: 'softPulse 18s ease-in-out infinite',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden h-full flex flex-row border relative z-10 glass-surface"
        style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}
      >
        {/* Desktop sidebar (full height, on the left) */}
        <div className="hidden md:flex h-full">
          <Sidebar
            activeItem={activeItem}
            onItemClick={handleItemClick}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((prev) => !prev)}
            isDark={isDark}
          />
        </div>

        {/* Right side panel: Navbar on top, Main content on bottom */}
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <Navbar
            isDark={isDark}
            mode={mode}
            onModeToggle={toggleMode}
            companies={companies}
            selectedCompany={selectedCompany}
            onCompanyChange={setSelectedCompany}
            onMobileNavToggle={() => setMobileNavOpen((p) => !p)}
          />

          <main
            className={`flex-1 flex flex-col overflow-hidden ${location.pathname === '/automation/ai-processing' ? 'p-0' : isCompactHeader ? 'p-2 pb-0.5' : 'p-3 sm:p-4 md:p-5'}`}
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
                <Suspense fallback={<div className="h-full flex items-center justify-center text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>Loading…</div>}>
                  <Outlet context={{ isDark }} />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile drawer overlays the entire layout */}
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
      </motion.div>
    </div>
  )
}

export default Dashboard
