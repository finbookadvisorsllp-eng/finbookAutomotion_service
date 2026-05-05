import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChevronDown, Moon, Search, Sun, UserCircle2 } from 'lucide-react'

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
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return companies
    return companies.filter((company) => company.toLowerCase().includes(normalizedQuery))
  }, [companies, searchQuery])

  const handleCompanySelect = (company) => {
    onCompanyChange(company)
    setSearchQuery('')
    setIsCompanyOpen(false)
  }

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-2 lg:flex-nowrap shadow-sm"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
    >
      <div className="flex min-w-[170px] items-center gap-2 group cursor-pointer">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-black text-lg transition-transform group-hover:rotate-12 shadow-[0_4px_10px_rgba(0,0,0,0.1)]" style={{ background: 'var(--app-accent-gradient)' }}>
          A
        </div>
        <span className="text-[22px] font-black leading-none tracking-tighter" style={{ color: 'var(--app-heading)' }}>
          finbook.ai
        </span>
      </div>

      <div className="flex items-center justify-center">
        <span
          className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
        >
          Tally Connector
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <div className="relative w-[185px] overflow-hidden rounded-md border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: 'var(--app-danger-border)', backgroundColor: 'var(--app-danger-bg)', color: 'var(--app-danger-text)' }}>
          <div className="flex justify-center">
            <span className="inline-block whitespace-nowrap text-center [animation:marqueeRightToLeft_8s_linear_infinite]">{subscriptionMessage}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onModeToggle}
          className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: 'var(--app-control-bg)',
          }}
          aria-label="Toggle dark and light mode"
        >
          {isDark ? <Sun size={13} /> : <Moon size={13} />}
          {mode === 'dark' ? 'Light' : 'Dark'}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsCompanyOpen((prev) => !prev)}
            className="inline-flex h-7 min-w-[160px] items-center justify-between gap-1 rounded-md border px-2 text-[11px] font-medium"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-heading)',
              backgroundColor: 'var(--app-control-bg)',
            }}
          >
            <span className="truncate">{selectedCompany || 'Select a company'}</span>
            <ChevronDown size={14} />
          </button>

          {isCompanyOpen && (
            <div
              className="absolute right-0 z-20 mt-1 w-[250px] rounded-md border p-2 shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
            >
              <div
                className="mb-2 flex items-center gap-2 rounded-md border px-2 py-1.5"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
              >
                <Search size={14} style={{ color: 'var(--app-text)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search company..."
                  className="w-full bg-transparent text-xs outline-none placeholder:text-[#7d8aa3]"
                  style={{ color: 'var(--app-heading)' }}
                />
              </div>
              <div className="themed-scrollbar max-h-[180px] overflow-y-auto">
                {filteredCompanies.length ? (
                  filteredCompanies.map((company) => (
                    <button
                      type="button"
                      key={company}
                      onClick={() => handleCompanySelect(company)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs"
                      style={{
                        color: company === selectedCompany ? 'var(--app-accent)' : 'var(--app-heading)',
                        backgroundColor: company === selectedCompany ? 'var(--app-accent-soft)' : 'transparent',
                      }}
                    >
                      {company}
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-1 text-xs" style={{ color: 'var(--app-text)' }}>
                    No company found
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <span
          className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-semibold"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
        >
          Total Credits +{credits}
        </span>

        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: isDark ? 'var(--app-control-bg)' : 'transparent',
          }}
          aria-label="Notifications"
        >
          <Bell size={13} />
        </button>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: isDark ? 'var(--app-control-bg)' : 'transparent',
          }}
          aria-label="Profile"
        >
          <UserCircle2 size={14} />
        </button>
      </div>
    </header>
  )
}

export default Navbar
