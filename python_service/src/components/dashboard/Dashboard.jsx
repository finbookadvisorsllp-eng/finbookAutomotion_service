import { Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Navbar from '../layout/Navbar'
import Sidebar from '../layout/Sidebar'
import { LABEL_TO_PATH, PATH_TO_LABEL } from '../../routes/routePaths'
import { useAppStore } from '../../stores/useAppStore'
import { fetchCompanies } from '../companies/api'
import { authApi } from '../../services/authApi'
import { toast } from 'sonner'

import CompanionBar from '../ui/CompanionBar'
import SearchOverlay from '../ui/SearchOverlay'
import PetalField from '../ui/PetalField'


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
  const orgId = useAppStore((s) => s.orgId)
  const setAuth = useAppStore((s) => s.setAuth)
  const setOrg = useAppStore((s) => s.setOrg)
  const approvalCenterView = useAppStore((s) => s.approvalCenterView)

  const isApprovalDetail = location.pathname.startsWith('/automation/approval-center') && approvalCenterView === 'detail'
  const isCompactHeader = isApprovalDetail || location.pathname === '/sales/new' || location.pathname === '/' || location.pathname === '/automation/ai-processing' || location.pathname === '/automation/text-to-entry'

  const handleCompanyChange = async (targetOrgId) => {
    try {
      const res = await authApi.selectOrg(targetOrgId)
      const { token: orgToken, refreshToken: orgRefresh, organization } = res.data
      const base64Url = orgToken.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const claims = JSON.parse(window.atob(base64))
      const expiry = claims ? claims.exp * 1000 : null

      setAuth({
        token: orgToken,
        refreshToken: orgRefresh,
        user: useAppStore.getState().user,
        tokenExpiresAt: expiry,
        role: claims?.role,
        permissions: claims?.permissions,
      })

      setOrg({
        orgId: organization.id,
        orgDbName: organization.dbName,
        orgName: organization.displayName || organization.name,
      })

      toast.success(`Switched workspace to ${organization.displayName || organization.name}`)
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (err) {
      toast.error('Failed to switch workspace')
    }
  }

  const selectOptions = (companies || []).map((org) => ({
    value: org.id,
    label: org.displayName || org.name,
  }))



  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
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

  // ERP shell: flat, clean white workspace. No ambient glow / blur orbs /
  // glassmorphism (the style guide bans heavy gradients + excessive animation).
  return (
    <div
      className={`h-screen overflow-hidden relative ${isDark ? 'dark' : ''}`}
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-heading)' }}
    >
      <div
        className="overflow-hidden h-full flex flex-row border relative z-10"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
      >
        {/* Desktop sidebar (full height, on the left) */}
        <div className="hidden md:flex h-full">
          <Sidebar
            activeItem={activeItem}
            onItemClick={handleItemClick}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            isDark={isDark}
          />
        </div>

        {/* Right side panel: Navbar on top, Main content on bottom */}
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <Navbar
            isDark={isDark}
            mode={mode}
            onModeToggle={toggleMode}
            companies={selectOptions}
            selectedCompany={orgId}
            onCompanyChange={handleCompanyChange}
            onMobileNavToggle={() => setMobileNavOpen((p) => !p)}
          />


          <main
            className={`relative flex-1 flex flex-col overflow-hidden ${['/automation/ai-processing', '/automation/text-to-entry'].includes(location.pathname) ? 'p-0' : isCompactHeader ? 'p-2 pb-0.5' : 'p-3 sm:p-4 md:p-5'}`}
            style={{ backgroundColor: 'var(--app-content-bg)' }}
          >
            <PetalField />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeItem}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 h-full flex flex-col"
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
      </div>

      {/* Ambient AI companion + ⌘K search overlay */}
      <CompanionBar />
      <SearchOverlay />
    </div>
  )
}

export default Dashboard
