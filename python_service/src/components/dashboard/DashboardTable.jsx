import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import api from '../../lib/axios'
import { useAppStore } from '../../stores/useAppStore'
import {
  FileText,
  Clock,
  Cpu,
  FileSpreadsheet,
  BarChart3,
  CheckSquare,
  Code,
  Database,
  Sparkles,
  AlertTriangle,
  Info,
  Lightbulb,
  Droplet,
  Settings,
  ChevronDown,
  ArrowRight
} from 'lucide-react'

// Custom Dropdown Component matching the TallyPro design system
function DashboardDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const clickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', clickOutside)
    return () => document.removeEventListener('mousedown', clickOutside)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-9 px-3 rounded-lg border flex items-center justify-between gap-1.5 text-[12px] font-semibold transition-colors hover:bg-[var(--app-row-hover)]"
        style={{
          borderColor: 'var(--app-border)',
          backgroundColor: 'var(--app-control-bg)',
          color: 'var(--app-heading)',
          minWidth: '120px'
        }}
      >
        <span className="truncate">{value === 'All' ? label : value}</span>
        <ChevronDown size={13} className="text-[var(--app-muted)] shrink-0" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-30 max-h-60 overflow-y-auto w-44 rounded-xl border p-1 shadow-2xl glass-surface"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-[var(--app-row-hover)]"
              style={{
                color: value === opt ? 'var(--app-accent)' : 'var(--app-heading)',
                backgroundColor: value === opt ? 'var(--app-accent-soft)' : 'transparent',
              }}
            >
              {opt === 'All' ? `All ${label}s` : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardTable() {
  const selectedCompany = useAppStore((s) => s.selectedCompany)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filter States
  const [selectedPartyFilter, setSelectedPartyFilter] = useState('All')
  const [partyType, setPartyType] = useState('All')
  const [ledgerGroup, setLedgerGroup] = useState('All')
  const [selectedCity, setSelectedCity] = useState('All')
  const [selectedFy, setSelectedFy] = useState(localStorage.getItem('selectedFy') || 'FY 2023-24')

  // Listen to top navbar financial year changes
  useEffect(() => {
    const handleFyChanged = () => {
      setSelectedFy(localStorage.getItem('selectedFy') || 'FY 2023-24')
    }
    window.addEventListener('fy-changed', handleFyChanged)
    return () => window.removeEventListener('fy-changed', handleFyChanged)
  }, [])

  // Fetch dashboard summary
  useEffect(() => {
    let active = true
    const loadData = async () => {
      setLoading(true)
      try {
        const params = {}
        if (selectedFy) {
          const startYear = selectedFy.split('-')[0].replace(/\D/g, '')
          if (startYear) {
            params.startDate = `20${startYear}-04-01`
            params.endDate = `20${parseInt(startYear) + 1}-03-31`
          }
        }
        if (selectedPartyFilter !== 'All') {
          params.partyLedger = selectedPartyFilter
        }

        const response = await api.get('/companies/current/dashboard-summary', { params })
        if (active && response.data?.success) {
          setData(response.data.data)
        }
      } catch (err) {
        console.error('Error fetching dashboard summary:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [selectedCompany, selectedFy, selectedPartyFilter])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--app-accent)] border-r-transparent"></div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">Loading dashboard data...</span>
        </div>
      </div>
    )
  }

  const partyRows = data?.partyRows || []
  const uniqueCities = ['All', ...new Set(partyRows.map(r => r.city).filter(Boolean))]

  // Donut circles math
  const donutSources = [
    { label: 'BasicManninn', pct: 38.5, val: '9,872', color: '#2563EB', bg: 'bg-[#2563EB]' },
    { label: 'Voucher', pct: 28.4, val: '7,287', color: '#10B981', bg: 'bg-[#10B981]' },
    { label: 'Connomers', pct: 14.6, val: '3,745', color: '#8B5CF6', bg: 'bg-[#8B5CF6]' },
    { label: 'Budget', pct: 10.2, val: '2,615', color: '#F59E0B', bg: 'bg-[#F59E0B]' },
    { label: 'Others', pct: 8.3, val: '2,129', color: '#9CA3AF', bg: 'bg-[#9CA3AF]' },
  ]

  const c = 314.16
  let cumulativePercent = 0
  const donutCircles = donutSources.map((src, index) => {
    const dash = (src.pct / 100) * c
    const offset = - (cumulativePercent / 100) * c
    cumulativePercent += src.pct
    return (
      <circle
        key={index}
        cx="60"
        cy="60"
        r="50"
        fill="transparent"
        stroke={src.color}
        strokeWidth="12"
        strokeDasharray={`${dash} ${c}`}
        strokeDashoffset={offset}
      />
    )
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Dashboard Title & Inline Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-2 shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight" style={{ color: 'var(--app-heading)' }}>
            Dashboard
          </h1>
          <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--app-muted)' }}>
            Overview of your business operations and performance
          </p>
        </div>

        {/* Dropdowns Row */}
        <div className="flex items-center gap-1.5 flex-wrap md:flex-nowrap">
          <DashboardDropdown
            label="Party Ledger"
            value={selectedPartyFilter}
            options={['All', ...(data?.partyLedgersList || [])]}
            onChange={setSelectedPartyFilter}
          />
          <DashboardDropdown
            label="Party Type"
            value={partyType}
            options={['All', 'Customer', 'Supplier']}
            onChange={setPartyType}
          />
          <DashboardDropdown
            label="Ledger Group"
            value={ledgerGroup}
            options={['All', 'Sundry Debtors', 'Sundry Creditors']}
            onChange={setLedgerGroup}
          />
          <DashboardDropdown
            label="City"
            value={selectedCity}
            options={uniqueCities}
            onChange={setSelectedCity}
          />

          <button
            type="button"
            className="h-9 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-bold text-white transition-colors bg-blue-600 hover:bg-blue-700 shrink-0 shadow-sm"
          >
            <Settings size={12} className="shrink-0" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-1 themed-scrollbar">
        
        {/* Section: Business Overview Card Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BarChart3 size={13} className="text-blue-600" />
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--app-heading)' }}>
              BUSINESS OVERVIEW
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Card 1: Total Vouchers */}
            <div
              className="rounded-xl border p-2.5 flex items-center justify-between bg-blue-50/85 hover:bg-blue-100/60 border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-900/30 dark:hover:bg-blue-950/30 shadow-sm relative overflow-hidden transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-blue-600 text-white shrink-0">
                    <FileText size={11} />
                  </div>
                  <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-200">Total Vouchers</span>
                </div>
                <h3 className="text-[18px] font-extrabold text-blue-950 dark:text-blue-50 mt-1 leading-none">
                  25,648
                </h3>
                <span className="inline-block text-[10px] font-bold text-emerald-600 mt-1">
                  ↑ 12.5% vs last month
                </span>
              </div>
              <div className="w-16 h-8 shrink-0 flex items-center justify-end">
                {/* Custom Sparkline Chart */}
                <svg viewBox="0 0 100 40" className="w-full h-full text-blue-600 dark:text-blue-400">
                  <path
                    d="M 5 35 Q 25 15 45 28 T 85 10 T 95 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 2: Pending Approval */}
            <div
              className="rounded-xl border p-2.5 flex flex-col justify-between bg-purple-50/85 hover:bg-purple-100/60 border-purple-200/80 dark:bg-purple-950/20 dark:border-purple-900/30 dark:hover:bg-purple-950/30 shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-purple-600 text-white shrink-0">
                    <Clock size={11} />
                  </div>
                  <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-200">Pending Approval</span>
                </div>
                <h3 className="text-[18px] font-extrabold text-purple-950 dark:text-purple-50 mt-1 leading-none">
                  32
                </h3>
              </div>
              <span className="inline-block text-[10px] font-bold text-amber-600 mt-1">
                ↑ 8.3% vs last month
              </span>
            </div>

            {/* Card 3: OCR Documents Processed */}
            <div
              className="rounded-xl border p-2.5 flex flex-col justify-between bg-emerald-50/85 hover:bg-emerald-100/60 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:hover:bg-emerald-950/30 shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-emerald-600 text-white shrink-0">
                    <Cpu size={11} />
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">OCR Documents Processed</span>
                </div>
                <h3 className="text-[18px] font-extrabold text-emerald-950 dark:text-emerald-50 mt-1 leading-none">
                  1,037
                </h3>
              </div>
              <span className="inline-block text-[10px] font-bold text-emerald-600 mt-1">
                ↑ 15.2% vs last month
              </span>
            </div>

            {/* Card 4: Excel Rows Uploaded */}
            <div
              className="rounded-xl border p-2.5 flex flex-col justify-between bg-amber-50/85 hover:bg-amber-100/60 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/30 dark:hover:bg-amber-950/30 shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-amber-600 text-white shrink-0">
                    <FileSpreadsheet size={11} />
                  </div>
                  <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">Excel Rows Uploaded</span>
                </div>
                <h3 className="text-[18px] font-extrabold text-amber-950 dark:text-amber-50 mt-1 leading-none">
                  1,334
                </h3>
              </div>
              <span className="inline-block text-[10px] font-bold text-emerald-600 mt-1">
                ↑ 9.1% vs last month
              </span>
            </div>
          </div>
        </div>

        {/* Section: Analytics & Company Overview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
          
          {/* Column 1: Analytics / Voucher Sources Donut */}
          <div
            className="rounded-xl border p-2.5 flex flex-col justify-between bg-[var(--app-panel-bg)] shadow-sm"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-purple-500/10 text-purple-500 shrink-0">
                  <BarChart3 size={11} />
                </div>
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--app-text)]">
                  ANALYTICS
                </h2>
              </div>

              <h3 className="text-[13px] font-bold text-[var(--app-heading)] mb-2.5">
                Voucher Creation Sources
              </h3>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {/* Donut SVG */}
                <div className="relative w-20 h-20 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
                    {donutCircles}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[12px] font-extrabold text-[var(--app-heading)] leading-none">
                      25,648
                    </span>
                    <span className="text-[6px] font-bold uppercase tracking-wider text-[var(--app-muted)] mt-0.5">
                      Total
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 flex flex-col gap-1 w-full">
                  {donutSources.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[10px] font-semibold">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.bg}`} />
                        <span className="text-[var(--app-text)] truncate">{item.label}</span>
                      </div>
                      <span className="text-[var(--app-heading)] ml-1">
                        {item.pct}% <span className="text-[9px] font-medium text-[var(--app-muted)]">({item.val})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button className="text-[11px] font-bold text-blue-600 mt-2.5 flex items-center gap-1 hover:underline text-left">
              <span>View Details</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Column 2: Company Overview Grid */}
          <div
            className="rounded-xl border p-2.5 flex flex-col justify-between bg-[var(--app-panel-bg)] shadow-sm"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-blue-500/10 text-blue-500 shrink-0">
                  <CheckSquare size={11} />
                </div>
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--app-text)]">
                  Company Overview
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Total Tests', val: '25,648', icon: CheckSquare, iconColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400', cardBg: 'bg-blue-50/80 border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-900/30' },
                  { label: 'Softwares', val: '12.39%', icon: Code, iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400', cardBg: 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/30' },
                  { label: 'Company Costs', val: '32', icon: Database, iconColor: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-600/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400', cardBg: 'bg-purple-50/80 border-purple-200/80 dark:bg-purple-950/20 dark:border-purple-900/30' },
                  { label: 'Total Corpuinirs', val: '36.29%', icon: Database, iconColor: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-600/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400', cardBg: 'bg-orange-50/80 border-orange-200/80 dark:bg-orange-950/20 dark:border-orange-900/30' }
                ].map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-2 flex items-center justify-between shadow-sm transition-all ${item.cardBg}`}
                    >
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase block truncate">
                          {item.label}
                        </span>
                        <span className="text-[13px] font-extrabold text-[var(--app-heading)] block mt-0.5 leading-none">
                          {item.val}
                        </span>
                      </div>
                      <div className={`h-5.5 w-5.5 rounded-lg flex items-center justify-center ${item.iconBg} shrink-0`}>
                        <Icon size={11} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bottom Wide Costs Indicator */}
              <div
                className="border rounded-xl p-2 mt-1.5 flex items-center justify-between bg-rose-50/80 border-rose-200/80 dark:bg-rose-950/20 dark:border-rose-900/30 shadow-sm"
              >
                <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase">
                  Total Company Costs
                </span>
                <span className="text-[14px] font-extrabold text-rose-900 dark:text-rose-100">
                  0
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: AI Insights & Recommendations */}
          <div
            className="rounded-xl border p-2.5 flex flex-col justify-between bg-[var(--app-panel-bg)] shadow-sm"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-blue-500/10 text-blue-500 shrink-0">
                  <Sparkles size={11} />
                </div>
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--app-text)]">
                  AI Insights & Recommendations
                </h2>
              </div>

              <div className="space-y-1.5">
                {[
                  { text: 'Alerts for corner & recommendations', desc: '3 new alerts', icon: AlertTriangle, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-500/20' },
                  { text: 'AI Insights & recommendations', desc: '5 insights available', icon: Info, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-500/20' },
                  { text: 'AI Insights & approval', desc: '2 pending approvals', icon: Lightbulb, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-500/20' },
                  { text: 'Now Alerts', desc: 'No new alerts', icon: Droplet, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-500/20' }
                ].map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={idx}
                      className="border rounded-xl p-2 flex items-start gap-2 bg-blue-50/15 border-blue-100/50 hover:bg-blue-50/35 dark:bg-blue-950/10 dark:border-blue-900/10 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      <div className={`h-6.5 w-6.5 rounded-lg flex items-center justify-center ${item.bg} ${item.color} shrink-0 mt-0.5`}>
                        <Icon size={12} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[10.5px] font-bold text-[var(--app-heading)] truncate">
                          {item.text}
                        </h4>
                        <p className="text-[9.5px] font-semibold text-[var(--app-muted)] mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button className="text-[11px] font-bold text-blue-600 mt-2.5 flex items-center gap-1 hover:underline text-left">
              <span>View All Insights</span>
              <ArrowRight size={12} />
            </button>
          </div>

        </div>

        {/* Section: Operations & Processing */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Settings size={13} className="text-blue-600" />
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--app-heading)' }}>
              OPERATIONS & PROCESSING
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            
            {/* Box 1: Approval Workflow */}
            <div
              className="rounded-xl border p-2.5 flex flex-col justify-between bg-[var(--app-panel-bg)] shadow-sm"
              style={{ borderColor: 'var(--app-border)' }}
            >
              <div>
                <h3 className="text-[12px] font-bold text-[var(--app-heading)] mb-2">
                  Approval Workflow
                </h3>

                <div className="relative flex items-center justify-between w-full mt-3.5 px-2">
                  {/* Timeline lines */}
                  <div className="absolute left-[15%] right-[15%] top-[9px] h-1 bg-gray-250 dark:bg-gray-700 -z-10" style={{ height: '3px' }} />
                  <div className="absolute left-[15%] w-[35%] top-[9px] h-1 bg-purple-500 -z-10" style={{ height: '3px' }} />
                  <div className="absolute left-[50%] w-[35%] top-[9px] h-1 bg-blue-500 -z-10" style={{ height: '3px' }} />
                  
                  {/* Pending */}
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] text-[var(--app-muted)] font-bold mb-1">Pending</span>
                    <div className="h-4.5 w-4.5 rounded-full bg-purple-500 flex items-center justify-center text-white border-[3px] border-white dark:border-slate-900 shadow-sm" />
                    <span className="text-[13px] font-extrabold text-[var(--app-heading)] mt-1">12</span>
                  </div>

                  {/* Under Review */}
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] text-[var(--app-muted)] font-bold mb-1">Under Review</span>
                    <div className="h-4.5 w-4.5 rounded-full bg-blue-500 flex items-center justify-center text-white border-[3px] border-white dark:border-slate-900 shadow-sm" />
                    <span className="text-[13px] font-extrabold text-[var(--app-heading)] mt-1">5</span>
                  </div>

                  {/* Approved */}
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] text-[var(--app-muted)] font-bold mb-1">Approved</span>
                    <div className="h-4.5 w-4.5 rounded-full bg-emerald-500 flex items-center justify-center text-white border-[3px] border-white dark:border-slate-900 shadow-sm" />
                    <span className="text-[13px] font-extrabold text-[var(--app-heading)] mt-1">18</span>
                  </div>
                </div>
              </div>

              <button className="text-[11px] font-bold text-blue-600 mt-3 flex items-center gap-1 hover:underline text-left">
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {/* Box 2: OCR Processing Center */}
            <div
              className="rounded-xl border p-2.5 flex flex-col justify-between bg-[var(--app-panel-bg)] shadow-sm"
              style={{ borderColor: 'var(--app-border)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-bold text-[var(--app-heading)]">
                    OCR Processing Center
                  </h3>
                  <button className="text-[10px] font-bold text-blue-600 hover:underline">
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'OCR Processing', pct: '100%', color: 'bg-emerald-500' },
                    { label: 'Progress', pct: '50%', color: 'bg-blue-500' },
                    { label: 'Banking Classification', pct: '25%', color: 'bg-blue-500' },
                    { label: 'Monitors', pct: '10%', color: 'bg-blue-500' }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] font-bold text-[var(--app-text)]">
                        <span>{item.label}</span>
                        <span>{item.pct}</span>
                      </div>
                      <div className="w-full bg-gray-150 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: item.pct }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Box 3: Banking Classification */}
            <div
              className="rounded-xl border p-2.5 flex flex-col justify-between bg-[var(--app-panel-bg)] shadow-sm"
              style={{ borderColor: 'var(--app-border)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-bold text-[var(--app-heading)]">
                    Banking Classification
                  </h3>
                  <button className="text-[10px] font-bold text-blue-600 hover:underline">
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Progress', pct: '75%', color: 'bg-blue-500' },
                    { label: 'Banking Classification', pct: '40%', color: 'bg-blue-500' },
                    { label: 'CoordClintes', pct: '30%', color: 'bg-blue-500' },
                    { label: 'Bankinires price', pct: '40%', color: 'bg-blue-500' }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] font-bold text-[var(--app-text)]">
                        <span>{item.label}</span>
                        <span>{item.pct}</span>
                      </div>
                      <div className="w-full bg-gray-150 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: item.pct }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
