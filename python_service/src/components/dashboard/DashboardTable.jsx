import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} style={{ color: 'var(--app-accent)' }} />
      <h2 className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--app-heading)' }}>{children}</h2>
    </div>
  )
}

export default function DashboardTable() {
  const navigate = useNavigate()
  const selectedCompany = useAppStore((s) => s.selectedCompany)
  const currentUser = useAppStore((s) => s.user)
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
  const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'User'

  const totalVouchersStr = typeof data?.totalVouchers === 'number' ? data.totalVouchers.toLocaleString('en-IN') : (data?.totalVouchers || '0')
  const pendingApprovalStr = typeof data?.pendingApproval === 'number' ? data.pendingApproval.toLocaleString('en-IN') : (data?.pendingApproval || '0')
  const importedTodayStr = typeof data?.ocrDocumentsProcessed === 'number' ? data.ocrDocumentsProcessed.toLocaleString('en-IN') : (data?.ocrDocumentsProcessed || '0')
  const postedToTallyStr = typeof data?.postedToTally === 'number' ? data.postedToTally.toLocaleString('en-IN') : (data?.postedToTally || '0')

  const kpis = [
    { label: 'Total Vouchers', value: totalVouchersStr, icon: FileText, delta: { value: 'Live', dir: 'up' }, insight: 'Click to view all sales invoices', onClick: () => navigate('/sales/invoices') },
    { label: 'Pending Approval', value: pendingApprovalStr, icon: Clock, delta: { value: 'Active', dir: 'up' }, insight: 'Click to open approval center', onClick: () => navigate('/automation/approval-center') },
    { label: 'Imported Today', value: importedTodayStr, icon: Download, delta: { value: 'Live', dir: 'up' }, insight: 'Click to open OCR processing', onClick: () => navigate('/automation/ai-processing') },
    { label: 'Exported to Tally', value: postedToTallyStr, icon: Upload, delta: { value: 'Synced', dir: 'up' }, insight: 'Click to open Tally connector', onClick: () => navigate('/tally/connector') },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Greeting hero - compact & sleek */}
      <div className="relative overflow-hidden rounded-xl border px-3.5 py-2.5 mb-2 shrink-0"
        style={{ borderColor: 'var(--app-border)', background: 'linear-gradient(120deg, var(--app-accent-soft) 0%, transparent 58%), var(--app-panel-bg)', boxShadow: 'var(--app-shadow)' }}>
        <div className="absolute -right-12 -top-20 h-40 w-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, var(--app-accent-soft) 0%, transparent 70%)' }} />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>{today}</p>
            <h1 className="text-[18px] md:text-[22px] font-black tracking-tight leading-snug mt-0.5" style={{ color: 'var(--app-heading)' }}>
              {greet}, <span style={{ background: 'var(--app-accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{userName}</span>
            </h1>
            <p className="text-[11px] md:text-[12px] font-medium mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--app-muted)' }}>
              <span onClick={() => navigate('/automation/approval-center')} className="inline-flex items-center gap-1 cursor-pointer hover:underline hover:text-[var(--app-accent)]">
                <Sparkles size={12} className="text-[var(--app-accent)]" /> {data?.pendingApproval || 0} vouchers need review
              </span>
              <span className="opacity-40">·</span>
              <span onClick={() => navigate('/tally/connector')} className="cursor-pointer hover:underline hover:text-[var(--app-accent)]">
                <b style={{ color: 'var(--app-heading)' }}>{data?.postedToTally || 0}</b> ready to export
              </span>
              <span className="opacity-40 hidden sm:inline">·</span>
              <span onClick={() => navigate('/tally/connector')} className="hidden sm:inline cursor-pointer hover:underline hover:text-[var(--app-accent)]">Tally connected</span>
            </p>
          </div>
          <HeroDoodle tod={tod} className="w-20 h-16 md:w-24 md:h-20 shrink-0 cursor-pointer" onClick={() => navigate('/automation/approval-center')} />
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
            {kpis.map((k, i) => (
              <div key={k.label} onClick={k.onClick} className="cursor-pointer transition-transform hover:-translate-y-0.5">
                <StatCard index={i} {...k} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionLabel icon={Sparkles}>Your business story</SectionLabel>
          <BusinessTimeline data={data} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <VoucherSourcesCard data={data} onMore={() => navigate('/sales/invoices')} />
          <PipelineCard data={data} onMore={() => navigate('/automation/approval-center')} />
          <AiInsightsCard data={data} onMore={() => navigate('/automation/approval-center')} />
        </div>

        <ApprovalWorkflowCard data={data} onMore={() => navigate('/automation/approval-center')} />
      </div>
    </div>
  )
}
