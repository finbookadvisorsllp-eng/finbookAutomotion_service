import { useState, useEffect } from 'react'
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
  ArrowRight
} from 'lucide-react'
import Select from '../ui/Select'
import StatCard from '../ui/StatCard'
import Button from '../ui/Button'

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
        <div className="flex items-end gap-1.5 flex-wrap md:flex-nowrap">
          <Select value={selectedPartyFilter} options={['All', ...(data?.partyLedgersList || [])]} onChange={setSelectedPartyFilter} placeholder="Party Ledger" align="right" searchable />
          <Select value={partyType} options={['All', 'Customer', 'Supplier']} onChange={setPartyType} align="right" />
          <Select value={ledgerGroup} options={['All', 'Sundry Debtors', 'Sundry Creditors']} onChange={setLedgerGroup} align="right" />
          <Select value={selectedCity} options={uniqueCities} onChange={setSelectedCity} align="right" searchable />
          <Button variant="primary" size="md" icon={Settings} className="shrink-0">Customize</Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-1 themed-scrollbar">
        
        {/* Section: Business Overview Card Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BarChart3 size={13} className="text-[var(--app-accent)]" />
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--app-heading)' }}>
              BUSINESS OVERVIEW
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard index={0} label="Total Vouchers" value="25,648" icon={FileText} delta={{ value: '12.5%', dir: 'up' }}
              right={(
                <svg viewBox="0 0 100 40" className="w-16 h-8" style={{ color: 'var(--app-accent)' }}>
                  <path d="M 5 35 Q 25 15 45 28 T 85 10 T 95 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              )}
            />
            <StatCard index={1} label="Pending Approval" value="32" icon={Clock} delta={{ value: '8.3%', dir: 'up' }} />
            <StatCard index={2} label="OCR Documents Processed" value="1,037" icon={Cpu} delta={{ value: '15.2%', dir: 'up' }} />
            <StatCard index={3} label="Excel Rows Uploaded" value="1,334" icon={FileSpreadsheet} delta={{ value: '9.1%', dir: 'up' }} />
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
                <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0">
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

            <button className="text-[11px] font-bold text-[var(--app-accent)] mt-2.5 flex items-center gap-1 hover:underline text-left">
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
                <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0">
                  <CheckSquare size={11} />
                </div>
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--app-text)]">
                  Company Overview
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Total Tests', val: '25,648', icon: CheckSquare },
                  { label: 'Softwares', val: '12.39%', icon: Code },
                  { label: 'Company Costs', val: '32', icon: Database },
                  { label: 'Total Corpuinirs', val: '36.29%', icon: Database }
                ].map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={idx}
                      className="border rounded-xl p-2 flex items-center justify-between transition-all hover:bg-[var(--app-row-hover)]"
                      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
                    >
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase block truncate">
                          {item.label}
                        </span>
                        <span className="text-[13px] font-extrabold text-[var(--app-heading)] block mt-0.5 leading-none">
                          {item.val}
                        </span>
                      </div>
                      <div className="h-5.5 w-5.5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
                        <Icon size={11} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bottom Wide Costs Indicator */}
              <div
                className="border rounded-xl p-2 mt-1.5 flex items-center justify-between"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
              >
                <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--app-muted)' }}>
                  Total Company Costs
                </span>
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--app-heading)' }}>
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
                <div className="h-4.5 w-4.5 rounded-md flex items-center justify-center bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0">
                  <Sparkles size={11} />
                </div>
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--app-text)]">
                  AI Insights & Recommendations
                </h2>
              </div>

              <div className="space-y-1.5">
                {[
                  { text: 'Alerts for corner & recommendations', desc: '3 new alerts', icon: AlertTriangle, color: 'text-[var(--app-accent)]', bg: 'bg-[var(--app-accent-soft)]'},
                  { text: 'AI Insights & recommendations', desc: '5 insights available', icon: Info, color: 'text-[var(--app-accent)]', bg: 'bg-[var(--app-accent-soft)]'},
                  { text: 'AI Insights & approval', desc: '2 pending approvals', icon: Lightbulb, color: 'text-[var(--app-accent)]', bg: 'bg-[var(--app-accent-soft)]'},
                  { text: 'Now Alerts', desc: 'No new alerts', icon: Droplet, color: 'text-[var(--app-accent)]', bg: 'bg-[var(--app-accent-soft)]'}
                ].map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={idx}
                      className="border rounded-xl p-2 flex items-start gap-2 transition-colors hover:bg-[var(--app-row-hover)]"
                      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
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

            <button className="text-[11px] font-bold text-[var(--app-accent)] mt-2.5 flex items-center gap-1 hover:underline text-left">
              <span>View All Insights</span>
              <ArrowRight size={12} />
            </button>
          </div>

        </div>

        {/* Section: Operations & Processing */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Settings size={13} className="text-[var(--app-accent)]" />
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
                  <div className="absolute left-[15%] right-[15%] top-[9px] h-1 -z-10" style={{ height: '3px', backgroundColor: 'var(--app-row-border)' }} />
                  <div className="absolute left-[15%] w-[35%] top-[9px] h-1 bg-amber-500 -z-10" style={{ height: '3px' }} />
                  <div className="absolute left-[50%] w-[35%] top-[9px] h-1 -z-10" style={{ height: '3px', backgroundColor: 'var(--app-accent)' }} />
                  
                  {/* Pending */}
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] text-[var(--app-muted)] font-bold mb-1">Pending</span>
                    <div className="h-4.5 w-4.5 rounded-full bg-amber-500 flex items-center justify-center text-white border-[3px] border-white dark:border-slate-900 shadow-sm" />
                    <span className="text-[13px] font-extrabold text-[var(--app-heading)] mt-1">12</span>
                  </div>

                  {/* Under Review */}
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] text-[var(--app-muted)] font-bold mb-1">Under Review</span>
                    <div className="h-4.5 w-4.5 rounded-full flex items-center justify-center text-white border-[3px] border-white dark:border-slate-900 shadow-sm" style={{ backgroundColor: 'var(--app-accent)' }} />
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

              <button className="text-[11px] font-bold text-[var(--app-accent)] mt-3 flex items-center gap-1 hover:underline text-left">
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
                  <button className="text-[10px] font-bold text-[var(--app-accent)] hover:underline">
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'OCR Processing', pct: '100%', color: 'bg-emerald-500' },
                    { label: 'Progress', pct: '50%', color: 'bg-[var(--app-accent)]' },
                    { label: 'Banking Classification', pct: '25%', color: 'bg-[var(--app-accent)]' },
                    { label: 'Monitors', pct: '10%', color: 'bg-[var(--app-accent)]' }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] font-bold text-[var(--app-text)]">
                        <span>{item.label}</span>
                        <span>{item.pct}</span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-row-border)' }}>
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
                  <button className="text-[10px] font-bold text-[var(--app-accent)] hover:underline">
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Progress', pct: '75%', color: 'bg-[var(--app-accent)]' },
                    { label: 'Banking Classification', pct: '40%', color: 'bg-[var(--app-accent)]' },
                    { label: 'CoordClintes', pct: '30%', color: 'bg-[var(--app-accent)]' },
                    { label: 'Bankinires price', pct: '40%', color: 'bg-[var(--app-accent)]' }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] font-bold text-[var(--app-text)]">
                        <span>{item.label}</span>
                        <span>{item.pct}</span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-row-border)' }}>
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
