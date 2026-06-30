import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FileText, Clock, Download, Upload, Sparkles, Settings } from 'lucide-react'
import api from '../../lib/axios'
import { useAppStore } from '../../stores/useAppStore'
import Select from '../ui/Select'
import Button from '../ui/Button'
import StatCard from '../ui/StatCard'
import HeroDoodle from '../ui/HeroDoodle'
import ThinkingLoader from '../ui/ThinkingLoader'
import BusinessTimeline from '../ui/BusinessTimeline'
import { VoucherSourcesCard, PipelineCard, AiInsightsCard, ApprovalWorkflowCard } from './widgets'

const KPIS = [
  { label: 'Total Vouchers', value: '25,648', icon: FileText, delta: { value: '12.5%', dir: 'up' }, insight: 'AI confidence 97% · trending up' },
  { label: 'Pending Approval', value: '32', icon: Clock, delta: { value: '8.3%', dir: 'up' }, insight: 'AI confidence 88% · 6 auto-approvable' },
  { label: 'Imported Today', value: '1,037', icon: Download, delta: { value: '15.2%', dir: 'up' }, insight: 'AI confidence 99% · 2 need review' },
  { label: 'Exported to Tally', value: '96', icon: Upload, delta: { value: '9.1%', dir: 'up' }, insight: 'AI confidence 94% · no failures' },
]

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} style={{ color: 'var(--app-accent)' }} />
      <h2 className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--app-heading)' }}>{children}</h2>
    </div>
  )
}

export default function DashboardTable() {
  const selectedCompany = useAppStore((s) => s.selectedCompany)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedFy, setSelectedFy] = useState(localStorage.getItem('selectedFy') || 'FY 2023-24')
  const [partyFilter, setPartyFilter] = useState('All')
  const [partyType, setPartyType] = useState('All')
  const soon = () => toast.info('Coming soon')

  useEffect(() => {
    const onFy = () => setSelectedFy(localStorage.getItem('selectedFy') || 'FY 2023-24')
    window.addEventListener('fy-changed', onFy)
    return () => window.removeEventListener('fy-changed', onFy)
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const params = {}
        const y = selectedFy.split('-')[0].replace(/\D/g, '')
        if (y) { params.startDate = `20${y}-04-01`; params.endDate = `20${parseInt(y) + 1}-03-31` }
        if (partyFilter !== 'All') params.partyLedger = partyFilter
        const res = await api.get('/companies/current/dashboard-summary', { params })
        if (active && res.data?.success) setData(res.data.data)
      } catch (err) {
        console.error('Error fetching dashboard summary:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [selectedCompany, selectedFy, partyFilter])

  if (loading) return <div className="h-full flex items-center justify-center"><ThinkingLoader /></div>

  const partyRows = data?.partyRows || []
  const cities = ['All', ...new Set(partyRows.map((r) => r.city).filter(Boolean))]

  const hr = new Date().getHours()
  const tod = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : hr < 21 ? 'evening' : 'night'
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Greeting hero */}
      <div className="relative overflow-hidden rounded-2xl border p-4 md:p-5 mb-3 shrink-0"
        style={{ borderColor: 'var(--app-border)', background: 'linear-gradient(120deg, var(--app-accent-soft) 0%, transparent 58%), var(--app-panel-bg)', boxShadow: 'var(--app-shadow)' }}>
        <div className="absolute -right-12 -top-20 h-60 w-60 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, var(--app-accent-soft) 0%, transparent 70%)' }} />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>{today}</p>
            <h1 className="text-[26px] md:text-[34px] font-black tracking-tight leading-tight mt-1" style={{ color: 'var(--app-heading)' }}>
              {greet}, <span style={{ background: 'var(--app-accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Anjalee Bisen</span>
            </h1>
            <p className="text-[12px] md:text-[13px] font-medium mt-2 flex items-center gap-2 flex-wrap" style={{ color: 'var(--app-muted)' }}>
              <span className="inline-flex items-center gap-1"><Sparkles size={13} className="text-[var(--app-accent)]" /> 12 vouchers need review</span>
              <span className="opacity-40">·</span>
              <span><b style={{ color: 'var(--app-heading)' }}>40</b> ready to export</span>
              <span className="opacity-40 hidden sm:inline">·</span>
              <span className="hidden sm:inline">Tally connected</span>
            </p>
          </div>
          <HeroDoodle tod={tod} className="w-28 h-24 md:w-44 md:h-36 shrink-0" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end justify-end gap-1.5 flex-wrap md:flex-nowrap mb-2 shrink-0">
        <Select value={partyFilter} options={['All', ...(data?.partyLedgersList || [])]} onChange={setPartyFilter} placeholder="Party Ledger" align="right" searchable />
        <Select value={partyType} options={['All', 'Customer', 'Supplier']} onChange={setPartyType} align="right" />
        <Select value={'All'} options={cities} onChange={() => { }} align="right" searchable />
        <Button variant="primary" size="md" icon={Settings} className="shrink-0" onClick={soon}>Customize</Button>
      </div>

      {/* Modular widget grid */}
      <div className="flex-1 overflow-y-auto pr-1 pb-2 space-y-3 themed-scrollbar">
        <div className="space-y-1.5">
          <SectionLabel icon={FileText}>Business overview</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {KPIS.map((k, i) => <StatCard key={k.label} index={i} {...k} />)}
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionLabel icon={Sparkles}>Your business story</SectionLabel>
          <BusinessTimeline />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <VoucherSourcesCard onMore={soon} />
          <PipelineCard onMore={soon} />
          <AiInsightsCard onMore={soon} />
        </div>

        <ApprovalWorkflowCard onMore={soon} />
      </div>
    </div>
  )
}
