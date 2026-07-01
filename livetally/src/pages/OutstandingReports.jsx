import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Info, Settings, Download, Search, ArrowUpDown, Users } from 'lucide-react'
import { formatINR } from '../data/mockData'
import { useDateRange } from '../context/DateContext'
import { useApi } from '../hooks/useApi'
import Pagination from '../components/Pagination'
import CustomizeAgingModal from '../components/CustomizeAgingModal'
import {
  getReceivables, getPayables, saveAgingConfig, resetAgingConfig,
} from '../api'

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
const STATUS_STYLE = {
  open: 'bg-amber-100 text-amber-700', overdue: 'bg-red-100 text-red-700',
  'due-soon': 'bg-orange-100 text-orange-700', current: 'bg-emerald-100 text-emerald-700',
  advance: 'bg-blue-100 text-blue-700',
}

export default function OutstandingReports() {
  const navigate = useNavigate()
  const { fy } = useDateRange()

  const [reportType, setReportType] = useState('receivables')
  const [viewType, setViewType] = useState('outstanding')
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('outstanding')
  const [order, setOrder] = useState('desc')

  // Reset to page 1 when the report context changes
  useEffect(() => { setPage(1) }, [reportType, search, limit, fy])
  // Debounce search
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 300); return () => clearTimeout(t) }, [searchInput])

  const fetcher = reportType === 'receivables' ? getReceivables : getPayables
  const { data: res, loading, refetch } = useApi(
    () => fetcher(fy, { page, limit, search, sort, order }),
    [reportType, fy, page, limit, search, sort, order],
    { skip: !fy }
  )

  const rows = res?.data || []
  const pagination = res?.pagination || { page: 1, pageSize: limit, totalRecords: 0, totalPages: 0 }
  const meta = res?.meta || {}
  const summary = meta.summary || { total: 0, partyCount: 0, advanceTotal: 0 }
  const aging = meta.aging || { available: false, buckets: [], reason: '' }
  const buckets = meta.buckets || []
  const isReceivable = reportType === 'receivables'

  const agingChart = (aging.buckets || []).map((b, i) => ({
    bucket: b.label, amount: b.amount || 0, color: COLORS[i % COLORS.length],
  }))

  const toggleSort = (key) => {
    if (sort === key) setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
    else { setSort(key); setOrder(key === 'name' || key === 'city' ? 'asc' : 'desc') }
    setPage(1)
  }

  const handleSaveBuckets = async (b) => {
    await saveAgingConfig(b)
    setIsCustomizeOpen(false)
    refetch()
  }
  const handleResetBuckets = async () => { await resetAgingConfig(); refetch() }

  const exportCSV = async () => {
    const all = await fetcher(fy, { page: 1, limit: 500, search, sort, order })
    const data = all?.data || []
    const head = ['Party Name', 'City', 'GSTIN', 'State', 'Outstanding', 'Status']
    const lines = data.map((r) => [r.name, r.city || '', r.gstin || '', r.state || '', r.outstanding, r.status]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [head.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${reportType}_${fy}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Render helper (not a component) so header state never resets during render.
  const sortTh = (k, label, align = 'left') => (
    <th onClick={() => toggleSort(k)}
      className={`py-2.5 px-4 cursor-pointer select-none whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}<ArrowUpDown size={11} className={sort === k ? 'text-blue-600' : 'text-slate-300'} />
      </span>
    </th>
  )

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-800">Outstanding Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Receivables &amp; payables — derived from ledger balances, reconciled with the Balance Sheet</p>
        </div>
        <div className="flex bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-slate-700/50 p-1.5 rounded-2xl shadow-sm">
          <button onClick={() => setReportType('receivables')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${isReceivable ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
            Receivables (To Collect)
          </button>
          <button onClick={() => setReportType('payables')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${!isReceivable ? 'bg-red-50 text-red-600' : 'text-slate-500 hover:text-slate-700'}`}>
            Payables (To Pay)
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-6 flex flex-col justify-center min-h-[160px]">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Total {isReceivable ? 'Receivables' : 'Payables'}</p>
          <p className={`text-[40px] leading-none font-black tracking-tight ${isReceivable ? 'text-blue-600' : 'text-red-500'}`}>{formatINR(summary.total)}</p>
          <p className="text-sm font-semibold text-slate-500 mt-3 flex items-center gap-2">
            <Users size={14} /> Across {summary.partyCount} {isReceivable ? 'customers' : 'vendors'}
            {summary.advanceTotal > 0 && <span className="text-blue-500">· {formatINR(summary.advanceTotal)} advance</span>}
          </p>
        </div>

        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-800">Aging Summary</h2>
            <button onClick={() => setIsCustomizeOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-slate-600 hover:bg-slate-50 border border-slate-200">
              <Settings size={14} /> Customize Buckets
            </button>
          </div>
          {aging.available ? (
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChart} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="bucket" type="category" width={90} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={12}>
                    {agingChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-28 flex items-center gap-3 px-4 rounded-xl bg-amber-50 border border-amber-200">
              <Info size={18} className="text-amber-500 shrink-0" />
              <p className="text-[12px] text-amber-800 font-semibold">
                Age-wise outstanding is unavailable — bill-wise allocations / due dates are not present in the synced Tally data.
                Configured buckets ({buckets.map((b) => b.label).join(', ')}) will populate automatically once <code className="font-bold">billAllocations</code> are synced.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 border-b border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search party or city…"
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-[12px] w-56 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex p-0.5 rounded-lg border border-slate-200 bg-white">
              {['outstanding', 'aging'].map((v) => (
                <button key={v} onClick={() => setViewType(v)}
                  className={`px-3 py-1 rounded-md text-[12px] font-bold capitalize transition-all ${viewType === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{v}</button>
              ))}
            </div>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            <Download size={14} /> Export CSV
          </button>
        </div>

        {viewType === 'aging' && !aging.available && (
          <div className="px-4 py-2 bg-blue-50/60 border-b border-blue-100 text-[11px] text-blue-700 font-medium flex items-center gap-2">
            <Info size={13} /> Per-party aging columns activate when bill-wise data is synced. Outstanding totals below are exact.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                {sortTh('name', isReceivable ? 'Customer' : 'Vendor')}
                {sortTh('city', 'City')}
                {viewType === 'outstanding' && <th className="py-2.5 px-4 whitespace-nowrap">Next Due Date</th>}
                {sortTh('outstanding', isReceivable ? 'Outstanding' : 'Payable', 'right')}
                {viewType === 'aging' && buckets.map((b) => <th key={b.id} className="py-2.5 px-4 text-right whitespace-nowrap">{b.label}</th>)}
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-[12px] text-slate-500 animate-pulse">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="py-10 text-center text-[12px] text-slate-500">No outstanding {isReceivable ? 'receivables' : 'payables'} found.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td onClick={() => navigate(`/reports/pl?ledger=${encodeURIComponent(r.name)}&from=outstanding`)}
                    className="py-2 px-4 text-[12px] font-bold text-blue-600 hover:underline cursor-pointer">{r.name}</td>
                  <td className="py-2 px-4 text-[12px] text-slate-600">{r.city || '—'}</td>
                  {viewType === 'outstanding' && <td className="py-2 px-4 text-[12px] text-slate-500">{r.nextDueDate || '—'}</td>}
                  <td className={`py-2 px-4 text-[12px] font-bold text-right tabular-nums ${isReceivable ? 'text-amber-600' : 'text-red-500'}`}>{formatINR(r.outstanding)}</td>
                  {viewType === 'aging' && buckets.map((b) => <td key={b.id} className="py-2 px-4 text-[12px] text-right text-slate-400">—</td>)}
                  <td className="py-2 px-4">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-black text-[12px] text-slate-800">
                  <td className="py-2 px-4" colSpan={viewType === 'outstanding' ? 3 : 2}>TOTAL ({summary.partyCount} parties)</td>
                  <td className="py-2 px-4 text-right tabular-nums">{formatINR(summary.total)}</td>
                  {viewType === 'aging' && buckets.map((b) => <td key={b.id} className="py-2 px-4 text-right text-slate-400">—</td>)}
                  <td className="py-2 px-4" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} onPageSizeChange={(s) => { setLimit(s); setPage(1) }} />
      </div>

      <CustomizeAgingModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        currentBuckets={buckets.map((b) => ({ id: b.id, from: b.from, to: b.to }))}
        onSave={handleSaveBuckets}
        onReset={handleResetBuckets}
      />
    </div>
  )
}
