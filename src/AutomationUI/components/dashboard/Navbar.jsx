import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bell,
  ChevronDown,
  Command,
  Moon,
  Search,
  Sparkles,
  Sun,
  UserCircle2,
} from 'lucide-react'

function Navbar({
  isDark,
  mode,
  onModeToggle,
  companies,
  selectedCompany,
  onCompanyChange,
  subscriptionMessage,
  credits,
}) {
  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [globalQuery, setGlobalQuery] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsCompanyOpen(false)
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

  return (
    <header
      className="flex items-center justify-between gap-4 px-5 py-3 border-b"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'transparent' }}
    >
      {/* Brand */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="flex min-w-[170px] items-center gap-2.5 cursor-pointer select-none"
      >
        <div
          className="relative h-9 w-9 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg"
          style={{ background: 'var(--app-accent-gradient)' }}
        >
          <span className="relative z-10">f</span>
          <div className="absolute inset-0 rounded-xl bg-white/10 mix-blend-overlay" />
        </div>
        <div className="leading-none">
          <div className="text-[18px] font-semibold tracking-tight" style={{ color: 'var(--app-heading)' }}>
            finbook<span style={{ color: 'var(--app-accent)' }}>.ai</span>
          </div>
          <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--app-muted)' }}>
            Customer workspace
          </div>
        </div>
      </motion.div>

      {/* Global search — command-palette style */}
      <div className="hidden md:flex flex-1 max-w-[460px]">
        <label
          className="group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 transition-all focus-within:shadow-sm"
          style={{
            borderColor: 'var(--app-border)',
            backgroundColor: 'var(--app-control-bg)',
          }}
        >
          <Search size={15} style={{ color: 'var(--app-muted)' }} />
          <input
            type="text"
            value={globalQuery}
            onChange={(e) => setGlobalQuery(e.target.value)}
            placeholder="Search invoices, vouchers, parties…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:opacity-60"
            style={{ color: 'var(--app-heading)' }}
          />
          <span
            className="hidden sm:inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-muted)',
              backgroundColor: 'transparent',
            }}
          >
            <Command size={10} /> K
          </span>
        </label>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        {/* Subscription marquee */}
        <div
          className="hidden lg:flex relative w-[200px] overflow-hidden rounded-lg border px-2.5 py-1 text-[10.5px] font-medium"
          style={{
            borderColor: 'var(--app-danger-border)',
            backgroundColor: 'var(--app-danger-bg)',
            color: 'var(--app-danger-text)',
          }}
        >
          <Sparkles size={11} className="shrink-0 mr-1.5" />
          <div className="flex justify-center overflow-hidden flex-1">
            <span className="inline-block whitespace-nowrap [animation:marqueeRightToLeft_10s_linear_infinite]">
              {subscriptionMessage}
            </span>
          </div>
        </div>

        {/* Theme toggle */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={onModeToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border focus-ring transition-colors"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: 'var(--app-control-bg)',
          }}
          aria-label="Toggle theme"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mode}
              initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
              transition={{ duration: 0.22 }}
              className="flex"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        {/* Company picker */}
        <div className="relative" ref={dropdownRef}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setIsCompanyOpen((p) => !p)}
            className="inline-flex h-8 min-w-[170px] items-center justify-between gap-2 rounded-lg border px-2.5 text-[12px] font-medium focus-ring"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-heading)',
              backgroundColor: 'var(--app-control-bg)',
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: 'var(--app-accent-gradient)' }}
              />
              <span className="truncate">{selectedCompany || 'Select company'}</span>
            </div>
            <ChevronDown size={13} style={{ color: 'var(--app-muted)' }} />
          </motion.button>

          <AnimatePresence>
            {isCompanyOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 z-30 mt-2 w-[260px] rounded-xl border p-2 shadow-2xl glass-surface"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <div
                  className="mb-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                  style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
                >
                  <Search size={13} style={{ color: 'var(--app-muted)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search company…"
                    className="w-full bg-transparent text-xs outline-none"
                    style={{ color: 'var(--app-heading)' }}
                  />
                </div>
                <div className="themed-scrollbar max-h-[220px] overflow-y-auto">
                  {filteredCompanies.length ? (
                    filteredCompanies.map((company) => {
                      const active = company === selectedCompany
                      return (
                        <button
                          type="button"
                          key={company}
                          onClick={() => handleCompanySelect(company)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors hover:bg-[var(--app-control-hover)]"
                          style={{
                            color: active ? 'var(--app-accent)' : 'var(--app-heading)',
                            backgroundColor: active ? 'var(--app-accent-soft)' : 'transparent',
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          <span className="truncate">{company}</span>
                          {active && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: 'var(--app-accent-gradient)' }}
                            />
                          )}
                        </button>
                      )
                    })
                  ) : (
                    <p className="px-2 py-3 text-center text-xs" style={{ color: 'var(--app-muted)' }}>
                      No company found
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Credits */}
        <span
          className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold"
          style={{
            borderColor: 'var(--app-border)',
            backgroundColor: 'var(--app-accent-soft)',
            color: 'var(--app-accent)',
          }}
        >
          <Sparkles size={11} />
          {credits} credits
        </span>

        {/* Notifications */}
        <button
          type="button"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border focus-ring"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: 'var(--app-control-bg)',
          }}
          aria-label="Notifications"
        >
          <Bell size={14} />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-[var(--app-panel-bg)]" />
        </button>

        {/* Profile */}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border pl-1 pr-2 focus-ring"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: 'var(--app-control-bg)',
          }}
          aria-label="Profile"
        >
          <span
            className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
            style={{ background: 'var(--app-accent-gradient)' }}
          >
            FA
          </span>
          <ChevronDown size={12} style={{ color: 'var(--app-muted)' }} />
        </button>
      </div>
    </header>
  )
}

export default Navbar
