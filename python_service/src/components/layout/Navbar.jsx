import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bell,
  ChevronDown,
  Menu,
  Moon,
  Sun,
  RefreshCw,
  HelpCircle,
  CheckCircle2,
  Search,
  ArrowLeft,
  Building2,
  Calendar
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/useAppStore'

function Navbar({
  isDark,
  mode,
  onModeToggle,
  companies,
  selectedCompany,
  onCompanyChange,
  onMobileNavToggle,
}) {
  const location = useLocation()
  const approvalCenterView = useAppStore((s) => s.approvalCenterView)
  const isApprovalDetail = location.pathname.startsWith('/automation/approval-center') && approvalCenterView === 'detail'

  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFy, setSelectedFy] = useState(localStorage.getItem('selectedFy') || 'FY 2023-24')
  const [isFyOpen, setIsFyOpen] = useState(false)

  const dropdownRef = useRef(null)
  const fyDropdownRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsCompanyOpen(false)
      }
      if (fyDropdownRef.current && !fyDropdownRef.current.contains(event.target)) {
        setIsFyOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => c.toLowerCase().includes(q))
  }, [companies, searchQuery])

  const handleCompanySelect = (company) => {
    onCompanyChange(company)
    setSearchQuery('')
    setIsCompanyOpen(false)
  }

  const handleFyChange = (fy) => {
    localStorage.setItem('selectedFy', fy)
    setSelectedFy(fy)
    window.dispatchEvent(new Event('fy-changed'))
  }

  return (
    <header
      className="flex items-center justify-between gap-4 px-4 border-b shrink-0 flex-wrap sm:flex-nowrap py-2.5"
      style={{
        borderColor: 'var(--app-border)',
        backgroundColor: 'var(--app-panel-bg)',
        minHeight: '56px',
        height: '56px',
      }}
    >
      {/* Left side: Company & FY dropdowns */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={onMobileNavToggle}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border shrink-0"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: 'var(--app-control-bg)',
          }}
          aria-label="Open navigation"
        >
          <Menu size={16} />
        </button>

        {isApprovalDetail ? (
          <button
            type="button"
            onClick={() => useAppStore.getState().setApprovalCenterView('list')}
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-extrabold text-[12.5px] transition-all ml-1"
          >
            <ArrowLeft size={14} className="stroke-[2.5]" /> Back to Approval Center
          </button>
        ) : (
          <>
            {/* Company Dropdown Selector */}
            <div className="flex flex-col items-start">
              <span className="text-[9px] font-extrabold text-[var(--app-muted)] uppercase tracking-widest leading-none mb-1 opacity-80">Company</span>
              <div className="relative" ref={dropdownRef}>
                <motion.button
                  whileHover={{ scale: 1.01, borderColor: 'var(--app-accent)' }}
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  onClick={() => setIsCompanyOpen((p) => !p)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-all shadow-sm"
                  style={{
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-heading)',
                    backgroundColor: 'var(--app-control-bg)',
                  }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-500 shrink-0">
                    <Building2 size={11} strokeWidth={2.5} />
                  </div>
                  <span className="truncate max-w-[155px] tracking-wide text-slate-800 dark:text-slate-200">{selectedCompany || 'Select Company'}</span>
                  <ChevronDown size={12} className="text-[var(--app-muted)] shrink-0 ml-0.5" />
                </motion.button>
 
                <AnimatePresence>
                  {isCompanyOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 z-50 mt-1 w-[250px] rounded-xl border p-2 shadow-2xl glass-surface"
                      style={{ borderColor: 'var(--app-border)' }}
                    >
                      <div
                        className="mb-2 flex items-center gap-2 rounded-lg border px-2 py-1.5"
                        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
                      >
                        <Search size={12} style={{ color: 'var(--app-muted)' }} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search company…"
                          className="w-full bg-transparent text-[11px] outline-none"
                          style={{ color: 'var(--app-heading)' }}
                        />
                      </div>
                      <div className="themed-scrollbar max-h-[200px] overflow-y-auto space-y-0.5">
                        {filteredCompanies.length ? (
                          filteredCompanies.map((company) => {
                            const active = company === selectedCompany
                            return (
                              <button
                                type="button"
                                key={company}
                                onClick={() => handleCompanySelect(company)}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-[var(--app-control-hover)]"
                                style={{
                                  color: active ? 'var(--app-accent)' : 'var(--app-heading)',
                                  backgroundColor: active ? 'var(--app-accent-soft)' : 'transparent',
                                  fontWeight: active ? 600 : 500,
                                }}
                              >
                                <span className="truncate">{company}</span>
                                {active && (
                                  <span
                                    className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse"
                                    style={{ backgroundColor: 'var(--app-accent)' }}
                                  />
                                )}
                              </button>
                            )
                          })
                        ) : (
                          <p className="px-2 py-3 text-center text-[11px]" style={{ color: 'var(--app-muted)' }}>
                            No company found
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
 
            {/* Financial Year Dropdown Selector */}
            <div className="flex flex-col items-start">
              <span className="text-[9px] font-extrabold text-[var(--app-muted)] uppercase tracking-widest leading-none mb-1 opacity-80">Financial Year</span>
              <div className="relative" ref={fyDropdownRef}>
                <motion.button
                  whileHover={{ scale: 1.01, borderColor: 'var(--app-accent)' }}
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  onClick={() => setIsFyOpen((p) => !p)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-all shadow-sm"
                  style={{
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-heading)',
                    backgroundColor: 'var(--app-control-bg)',
                  }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 shrink-0">
                    <Calendar size={11} strokeWidth={2.5} />
                  </div>
                  <span className="truncate tracking-wide text-slate-800 dark:text-slate-200">{selectedFy}</span>
                  <ChevronDown size={12} className="text-[var(--app-muted)] shrink-0 ml-0.5" />
                </motion.button>
 
                <AnimatePresence>
                  {isFyOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 z-50 mt-1 w-[130px] rounded-xl border p-1 shadow-2xl glass-surface"
                      style={{ borderColor: 'var(--app-border)' }}
                    >
                      {['FY 2023-24', 'FY 2024-25'].map((fy) => {
                        const active = fy === selectedFy
                        return (
                          <button
                            type="button"
                            key={fy}
                            onClick={() => {
                              handleFyChange(fy)
                              setIsFyOpen(false)
                            }}
                            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-[var(--app-control-hover)]"
                            style={{
                              color: active ? 'var(--app-accent)' : 'var(--app-heading)',
                              backgroundColor: active ? 'var(--app-accent-soft)' : 'transparent',
                            }}
                          >
                            {fy}
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right side: Status indicators & utilities */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-end">
        {/* Tally Status Pill */}
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-1 text-[11px] font-medium shadow-sm bg-[var(--app-control-bg)]"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
            <CheckCircle2 size={12} strokeWidth={2.5} />
          </div>
          <div className="leading-none text-left">
            <div className="text-[9px] font-semibold text-[var(--app-muted)]">Tally Status</div>
            <div className="text-[10px] font-bold text-emerald-500 mt-0.5">Connected</div>
          </div>
        </div>

        {/* Sync Status Pill */}
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-1 text-[11px] font-medium shadow-sm bg-[var(--app-control-bg)]"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
            <RefreshCw size={11} strokeWidth={2.5} />
          </div>
          <div className="leading-none text-left">
            <div className="text-[9px] font-semibold text-[var(--app-muted)]">Sync Status</div>
            <div className="text-[10px] font-bold text-emerald-500 mt-0.5">Synced</div>
          </div>
        </div>

        {/* Theme Toggle */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={onModeToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors bg-[var(--app-control-bg)]"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
          }}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={13} /> : <Moon size={13} />}
        </motion.button>

        {/* Notifications */}
        <button
          type="button"
          className="relative h-8 w-8 items-center justify-center rounded-lg border bg-[var(--app-control-bg)]"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
          }}
          aria-label="Notifications"
        >
          <Bell size={13} />
          <span
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8.5px] font-bold text-white bg-red-500"
          >
            3
          </span>
        </button>

        {/* Help */}
        <button
          type="button"
          className="h-8 w-8 items-center justify-center rounded-lg border bg-[var(--app-control-bg)]"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
          }}
          aria-label="Help"
        >
          <HelpCircle size={13} />
        </button>

        {/* Profile Avatar */}
        <div className="flex items-center gap-1 cursor-pointer ml-1 select-none">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-[12px] text-white shrink-0"
            style={{
              backgroundColor: '#1E293B',
            }}
          >
            R
          </div>
          <ChevronDown size={12} className="text-[var(--app-muted)] shrink-0" />
        </div>
      </div>
    </header>
  )
}

export default Navbar
