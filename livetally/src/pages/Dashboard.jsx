import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Info, Plug, Download, ArrowRight, Activity, ChevronRight, Search } from 'lucide-react'
import KPICard from '../components/KPICard'
import AlertsPanel from '../components/AlertsPanel'
import AICFOWidget from '../components/AICFOWidget'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { formatINR } from '../data/mockData'
import { useDateRange } from '../context/DateContext'
import { useApiQuery } from '../hooks/useApiQuery'
import { CACHE_TIMES } from '../queryClient'
import { getDashboard, getCurrentCompany } from '../api'

// Presentation-only metadata for each KPI (variant/icon/label/route). Every
// number itself comes from the backend, which derives it from the same engine as
// the linked report — so the card reconciles with its drill-down to the rupee.
const KPI_META = {
  sales: { variant: 'sales', icon: '📈', label: 'Total Sales', route: '/sales' },
  purchase: { variant: 'purchase', icon: '🛒', label: 'Total Purchase', route: '/purchase' },
  receivables: { variant: 'receivables', icon: '💸', label: 'Receivables', route: '/reports/outstanding' },
  payables: { variant: 'payables', icon: '🧾', label: 'Payables', route: '/reports/outstanding' },
  cashBank: { variant: 'cash', icon: '🏦', label: 'Cash & Bank Balance', route: '/cash-bank' },
  netProfit: { variant: 'profit', icon: '💰', label: 'Net Profit', route: '/reports/pl' },
}
const KPI_ORDER = ['sales', 'purchase', 'receivables', 'payables', 'cashBank', 'netProfit']
const AGING_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4']

const StatusBadge = ({ status }) => {
  const s = {
    paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    overdue: 'bg-red-50 text-red-700 border border-red-200/60',
    posted: 'bg-slate-100 text-slate-600 border border-slate-200/60',
  }
  return <span className={`px-1.5 py-px rounded text-[10px] font-bold capitalize ${s[status] ?? s.posted}`}>{status}</span>
}

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-2 shadow-lg text-[11px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 capitalize flex-1">{p.name}:</span>
          <span className="font-bold text-slate-800">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { fy } = useDateRange()
  const [modalRow, setModalRow] = useState(null)

  // One round-trip drives the whole command center; it is company-aware (the
  // x-company-id header) and re-fetches whenever the financial year changes.
  // Cached: re-visiting the dashboard serves instantly from cache while a fresh
  // copy revalidates in the background (stale-while-revalidate).
  const { data, loading, error } = useApiQuery(['dashboard', fy], () => getDashboard(fy), { enabled: !!fy, ...CACHE_TIMES.dashboard })
  const { data: company } = useApiQuery(['current-company'], () => getCurrentCompany(), CACHE_TIMES.master)

  // Stable references (data is stable between renders from the query cache) so the
  // useMemo blocks below don't recompute on unrelated re-renders.
  const kpis = useMemo(() => data?.kpis || {}, [data])
  const monthlyTrend = useMemo(() => data?.monthlyTrend || [], [data])
  const receivablesAging = useMemo(() => data?.receivablesAging || {}, [data])
  const recentVouchers = useMemo(() => data?.recentVouchers || [], [data])
  const cashFlow = data?.cashFlow || {}
  const topCustomers = data?.topCustomers || []
  const topItems = data?.topItems || []
  const alerts = data?.alerts || []

  // ── KPI cards (ordered, presentation merged with backend numbers) ──
  const kpiCards = useMemo(() => KPI_ORDER.filter(k => kpis[k]).map(k => {
    const v = kpis[k]
    const meta = KPI_META[k]
    return {
      key: k, ...meta,
      current: v.current, change: v.change ?? 0, trend: v.trend || 'up',
      subtitle: k === 'netProfit' ? `${v.margin ?? 0}% margin` : 'vs last FY',
    }
  }), [kpis])

  // ── Revenue vs Expense (P&L lens) + footer totals derived from the same series ──
  const { totRevenue, totExpense, totProfit, expenseRatio, profitMargin } = useMemo(() => {
    const rev = monthlyTrend.reduce((s, p) => s + (p.revenue || 0), 0)
    const exp = monthlyTrend.reduce((s, p) => s + (p.expense || 0), 0)
    const prof = rev - exp
    return {
      totRevenue: rev, totExpense: exp, totProfit: prof,
      expenseRatio: rev ? Math.round((exp / rev) * 100) : 0,
      profitMargin: rev ? Math.round((prof / rev) * 100) : 0,
    }
  }, [monthlyTrend])

  // ── Receivables aging (consumed from Outstanding Reports; honest when unsynced) ──
  const { agingBuckets, agingAvailable, agingTotal, agingPartyCount, agingBills, safeBucket, riskAmt } = useMemo(() => {
    const obj = receivablesAging.aging || { available: false, buckets: [], reason: '' }
    const buckets = (obj.buckets || []).map((b, i) => ({ ...b, color: AGING_COLORS[i % AGING_COLORS.length] }))
    return {
      agingBuckets: buckets,
      agingAvailable: !!obj.available,
      agingTotal: receivablesAging.summary?.total || 0,
      agingPartyCount: receivablesAging.summary?.partyCount || 0,
      agingBills: buckets.reduce((s, b) => s + (b.count || 0), 0),
      safeBucket: buckets[0],
      riskAmt: buckets.filter(b => (b.from ?? 0) >= 61).reduce((s, b) => s + (b.amount || 0), 0),
    }
  }, [receivablesAging])

  // ── Cash flow (consumed from the Cash Flow statement) ──
  const cfSeries = cashFlow.series || []
  const cfSummary = cashFlow.summary || {}

  // ── Recent transactions: client search + 10/25/50/100 pagination + drill-down ──
  const [rtSearch, setRtSearch] = useState('')
  const [rtPage, setRtPage] = useState(1)
  const [rtSize, setRtSize] = useState(10)
  useEffect(() => { setRtPage(1) }, [rtSearch, fy])

  const rtFiltered = useMemo(() => {
    const q = rtSearch.trim().toLowerCase()
    if (!q) return recentVouchers
    return recentVouchers.filter(v =>
      [v.number, v.type, v.party].some(x => String(x ?? '').toLowerCase().includes(q)))
  }, [recentVouchers, rtSearch])

  const rtTotal = rtFiltered.length
  const rtTotalPages = Math.max(1, Math.ceil(rtTotal / rtSize))
  const rtPageRows = rtFiltered.slice((rtPage - 1) * rtSize, rtPage * rtSize)
  const rtPagination = {
    page: rtPage, pageSize: rtSize, totalRecords: rtTotal, totalPages: rtTotalPages,
    hasPrevious: rtPage > 1, hasNext: rtPage < rtTotalPages,
  }

  const exportRecentCSV = () => {
    const head = ['Voucher', 'Date', 'Type', 'Party', 'Amount', 'GST', 'Status']
    const lines = rtFiltered.map(r => [r.number, r.date, r.type, r.party, r.amount, r.gst, r.status]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [head.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `recent-transactions_${fy || ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const companyName = company?.name || 'Business'

  return (
    <div className="animate-fade-in flex flex-col gap-2.5">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <Activity className="text-blue-600" size={15} />
            Business Command Center
          </h1>
          <p className="text-[10.5px] text-slate-400 font-medium mt-px">
            {companyName}{fy ? ` · FY ${fy}` : ''}
            {loading && <span className="ml-1.5 text-blue-500 animate-pulse">· refreshing…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/setup')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:shadow-sm transition-all"
          >
            <Plug size={11} className="text-slate-400" /> Connect Tally
          </button>
          <button
            onClick={exportRecentCSV}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-sm hover:-translate-y-px transition-all"
            style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}
          >
            <Download size={11} /> Export
          </button>
        </div>
      </div>

      {/* ── Error banner (data integrity over silent failure) ── */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 font-semibold">
          <Info size={14} /> Couldn't load dashboard data{fy ? '' : ' — select a financial year'}.
        </div>
      )}

      {/* ── Alerts Strip (dynamic, derived from live data) ── */}
      <AlertsPanel alerts={alerts} />

      {/* ── KPI Cards — 6 columns, all in one row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.length === 0 && loading
          ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg h-[46px] bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
          ))
          : kpiCards.map(kpi => (
            <KPICard key={kpi.key} data={kpi} onClick={() => navigate(kpi.route)} />
          ))}
      </div>

      {/* ── AI CFO summary (health score + top insight → full chat) ── */}
      <AICFOWidget fy={fy} />

      {/* ── Row 2: Revenue Chart + Receivables Aging ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2.5 items-stretch">

        {/* Revenue vs Expense — spans 2 */}
        <div className="xl:col-span-2 glass-card overflow-hidden flex flex-col" style={{ height: 300 }}>
          <div className="card-header shrink-0">
            <div>
              <h2 className="text-[11.5px] font-bold text-slate-800">Revenue vs Expense</h2>
              <p className="text-[10px] text-slate-400 font-medium">Monthly · P&amp;L view{fy ? ` · FY ${fy}` : ''}</p>
            </div>
            <button onClick={() => navigate('/reports/pl')} className="flex items-center gap-1 text-[10.5px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded transition-colors hover:bg-blue-100">
              Analytics <ArrowRight size={10} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2 pt-1">
            <ResponsiveContainer width="100%" height={195}>
              <AreaChart data={monthlyTrend} margin={{ top: 2, right: 4, left: -26, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-rev-stroke)" stopOpacity="var(--chart-grad-opacity-top)" />
                    <stop offset="95%" stopColor="var(--chart-rev-stroke)" stopOpacity="var(--chart-grad-opacity-bottom)" />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-exp-stroke)" stopOpacity="var(--chart-grad-opacity-top)" />
                    <stop offset="95%" stopColor="var(--chart-exp-stroke)" stopOpacity="var(--chart-grad-opacity-bottom)" />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-prof-stroke)" stopOpacity="var(--chart-grad-opacity-top)" />
                    <stop offset="95%" stopColor="var(--chart-prof-stroke)" stopOpacity="var(--chart-grad-opacity-bottom)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid-stroke)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--theme-text-muted)' }} axisLine={false} tickLine={false} dy={4} />
                <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 9, fill: 'var(--theme-text-muted)' }} axisLine={false} tickLine={false} dx={-4} />
                <Tooltip content={customTooltip} cursor={{ stroke: 'var(--chart-grid-stroke)', strokeWidth: 1 }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-text-muted)', paddingTop: 4 }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-rev-stroke)" strokeWidth={2.5} fill="url(#revGrad)" name="Revenue" activeDot={{ r: 4, fill: 'var(--theme-bg)', stroke: 'var(--chart-rev-stroke)', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="expense" stroke="var(--chart-exp-stroke)" strokeWidth={2.5} fill="url(#expGrad)" name="Expense" activeDot={{ r: 4, fill: 'var(--theme-bg)', stroke: 'var(--chart-exp-stroke)', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="profit" stroke="var(--chart-prof-stroke)" strokeWidth={2.5} fill="url(#profGrad)" name="Profit" activeDot={{ r: 4, fill: 'var(--theme-bg)', stroke: 'var(--chart-prof-stroke)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Card Footer — totals reconcile with the chart above */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-[rgba(255,255,255,0.05)] border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)] mt-auto shrink-0 bg-slate-50/30 dark:bg-[rgba(0,0,0,0.2)]">
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Total Revenue</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(totRevenue)}</span>
              </div>
            </div>
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Total Expense</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(totExpense)}</span>
                <span className="text-[8.5px] text-red-600 font-bold bg-red-50 dark:bg-[rgba(255,51,102,0.1)] dark:text-[#FF3366] px-1 py-px rounded">{expenseRatio}%</span>
              </div>
            </div>
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Net Profit</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(totProfit)}</span>
                <span className={`text-[8.5px] font-bold px-1 py-px rounded ${totProfit >= 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00]' : 'text-red-600 bg-red-50 dark:bg-[rgba(255,51,102,0.1)] dark:text-[#FF3366]'}`}>{profitMargin}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Receivables Aging */}
        <div className="glass-card overflow-hidden flex flex-col" style={{ height: 300 }}>

          {/* Card Header */}
          <div className="card-header shrink-0">
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>
                Receivables Aging
              </h2>
              <p style={{ fontSize: 10, color: 'var(--theme-text-muted)', fontWeight: 500, fontFamily: "'Nunito','Inter',sans-serif" }}>
                Outstanding · {formatINR(agingTotal)}
              </p>
            </div>
            <button
              onClick={() => navigate('/reports/outstanding')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10.5, fontWeight: 700, color: '#2563eb',
                background: 'rgba(37,99,235,0.08)', border: 'none',
                borderRadius: 8, padding: '3px 8px', cursor: 'pointer',
                fontFamily: "'Nunito','Inter',sans-serif",
              }}
            >
              View All <ChevronRight size={11} strokeWidth={2.5} />
            </button>
          </div>

          {agingAvailable ? (
            <>
              {/* Body: donut left, buckets right */}
              <div className="flex-1 flex items-center gap-2 px-3 py-2 overflow-hidden">

                {/* Donut Chart */}
                <div className="shrink-0" style={{ width: 110, height: 110, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agingBuckets} dataKey="amount" nameKey="label"
                        cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={2} strokeWidth={0}>
                        {agingBuckets.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                      </Pie>
                      <Tooltip formatter={v => formatINR(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 11, fontFamily: "'Nunito','Inter',sans-serif" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif", lineHeight: 1.2 }}>{formatINR(agingTotal, true)}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }}>{agingBills} bills</span>
                  </div>
                </div>

                {/* Bucket rows with progress bars */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {agingBuckets.map((a, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', fontFamily: "'Nunito','Inter',sans-serif" }}>{a.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>{formatINR(a.amount)}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: a.color, borderRadius: 20, padding: '1px 5px', fontFamily: "'Nunito','Inter',sans-serif" }}>{a.count}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 4, background: 'rgba(226,232,240,0.7)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${a.pct || 0}%`, borderRadius: 4, background: a.color, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-[rgba(255,255,255,0.05)] border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)] mt-auto shrink-0 bg-slate-50/30 dark:bg-[rgba(0,0,0,0.2)]">
                <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">{safeBucket?.label || '0-30 Days'} (Safe)</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(safeBucket?.amount || 0)}</span>
                    <span className="text-[8.5px] text-emerald-600 font-bold bg-emerald-50 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00] px-1 py-px rounded">{safeBucket?.pct || 0}%</span>
                  </div>
                </div>
                <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Over 60 Days (Risk)</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(riskAmt)}</span>
                    <span className="text-[8.5px] text-red-600 font-bold bg-red-50 dark:bg-[rgba(255,51,102,0.1)] dark:text-[#FF3366] px-1 py-px rounded">{agingTotal ? Math.round((riskAmt / agingTotal) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Honest "not yet computable" state — total is exact; the split needs
            // bill-wise allocations / due dates that the Tally sync hasn't exported.
            <div className="flex-1 flex flex-col px-3 py-3 gap-3">
              <div className="rounded-xl bg-slate-50/70 dark:bg-[rgba(255,255,255,0.03)] border border-slate-200/70 dark:border-[rgba(255,255,255,0.08)] p-3 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Outstanding</p>
                <p className="text-[22px] font-black tracking-tight text-slate-800 dark:text-slate-200 mt-0.5">{formatINR(agingTotal)}</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Across {agingPartyCount} customers</p>
              </div>
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p className="text-[11px] font-semibold leading-snug">
                  Age-wise split is unavailable — bill-wise allocations / due dates are not present in the
                  synced Tally data. The total above is exact and reconciles with Receivables; buckets
                  populate automatically once <span className="font-bold">billAllocations</span> are synced.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Cash Flow + Customers + Products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 items-stretch">

        {/* Cash Flow */}
        <div className="glass-card overflow-hidden flex flex-col" style={{ height: 260 }}>
          <div className="card-header shrink-0">
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>Cash Flow</h2>
              <p style={{ fontSize: 10, color: 'var(--theme-text-muted)', fontWeight: 500, fontFamily: "'Nunito','Inter',sans-serif" }}>
                Net {formatINR(cfSummary.net || 0)} · Closing {formatINR(cfSummary.closing || 0)}
              </p>
            </div>
            <button onClick={() => navigate('/reports/cf')} className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2 pt-1">
            {cfSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 font-medium">{loading ? 'Loading…' : 'No cash movement in this period'}</div>
            ) : (
              <ResponsiveContainer width="100%" height={195}>
                <BarChart data={cfSeries} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid-stroke)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }} axisLine={false} tickLine={false} dy={4} />
                  <YAxis tickFormatter={v => `${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 9, fill: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }} axisLine={false} tickLine={false} dx={-2} />
                  <Tooltip formatter={v => formatINR(v)} cursor={{ fill: 'var(--chart-grid-stroke)' }} contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 10, fontFamily: "'Nunito','Inter',sans-serif", background: 'var(--theme-card-bg)' }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 9, fontWeight: 600, color: 'var(--theme-text-muted)' }} />
                  <Bar dataKey="inflow" fill="var(--chart-cf-op)" radius={[2, 2, 0, 0]} name="Inflow" />
                  <Bar dataKey="outflow" fill="#ef4444" radius={[2, 2, 0, 0]} name="Outflow" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="glass-card overflow-hidden flex flex-col" style={{ height: 260 }}>
          <div className="card-header shrink-0">
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>Top Customers</h2>
            <button onClick={() => navigate('/sales/customers')} className="text-[10.5px] text-blue-600 font-bold hover:text-blue-700 transition-colors" style={{ fontFamily: "'Nunito','Inter',sans-serif" }}>View All</button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-slate-100/80">
            {topCustomers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 font-medium">{loading ? 'Loading…' : 'No sales in this period'}</div>
            ) : topCustomers.slice(0, 6).map((c, i) => {
              const maxSales = topCustomers[0]?.sales || 1
              return (
                <div key={`${c.name}-${i}`} onClick={() => navigate(`/sales?search=${encodeURIComponent(c.name)}`)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors group cursor-pointer">
                  <span className="w-3.5 shrink-0 text-center text-slate-300" style={{ fontSize: 10, fontWeight: 900, fontFamily: "'Nunito','Inter',sans-serif" }}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate group-hover:text-blue-600 transition-colors" style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>{c.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${(c.sales / maxSales) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>{formatINR(c.sales)}</p>
                    {c.outstanding > 0 && <p className="mt-px" style={{ fontSize: 9, color: '#d97706', fontWeight: 800, fontFamily: "'Nunito','Inter',sans-serif" }}>Due: {formatINR(c.outstanding)}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Products */}
        <div className="glass-card overflow-hidden flex flex-col" style={{ height: 260 }}>
          <div className="card-header shrink-0">
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>Top Products</h2>
            <button onClick={() => navigate('/inventory/performance')} className="text-[10.5px] text-blue-600 font-bold hover:text-blue-700 transition-colors" style={{ fontFamily: "'Nunito','Inter',sans-serif" }}>View All</button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-slate-100/80">
            {topItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 font-medium">{loading ? 'Loading…' : 'No item sales in this period'}</div>
            ) : topItems.slice(0, 6).map((item, i) => (
              <div key={`${item.name}-${i}`} onClick={() => navigate('/inventory/performance')}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors group cursor-pointer">
                <span className="w-3.5 shrink-0 text-center text-slate-300" style={{ fontSize: 10, fontWeight: 900, fontFamily: "'Nunito','Inter',sans-serif" }}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate group-hover:text-blue-600 transition-colors" style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>{item.name}</p>
                  <p className="mt-px" style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }}>{item.category} · Qty: {Number(item.qty || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>{formatINR(item.value)}</p>
                  <div
                    className={`inline-flex items-center gap-0.5 mt-px px-1 py-px rounded ${item.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : item.trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}
                    style={{ fontSize: 9, fontWeight: 800, fontFamily: "'Nunito','Inter',sans-serif" }}
                    title="Gross margin (at weighted-average cost)"
                  >
                    {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'} {item.margin}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 5: Recent Transactions (Day Book) — search + pagination + drill-down ── */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 border-b border-slate-200 dark:border-[rgba(255,255,255,0.06)] bg-slate-50/60 dark:bg-[rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Recent Transactions</h3>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={rtSearch} onChange={e => setRtSearch(e.target.value)} placeholder="Search voucher, type or party…"
                className="pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-[12px] w-64 bg-white dark:bg-[#1a1a24] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportRecentCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-slate-700 bg-white dark:bg-[#1a1a24] dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50">
              <Download size={14} /> Export CSV
            </button>
            <button onClick={() => navigate('/reports/daybook')} className="flex items-center gap-1 text-[12px] bg-blue-50 px-2.5 py-1.5 rounded-lg text-blue-600 font-bold hover:bg-blue-100 transition-colors">
              View All <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#1a1a24]/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Voucher</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Party</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">GST</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading && recentVouchers.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-[12px] text-slate-500 animate-pulse">Loading…</td></tr>
              ) : rtPageRows.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-[12px] text-slate-500">No transactions found.</td></tr>
              ) : rtPageRows.map((v, idx) => (
                <tr key={v.id ?? idx} onClick={() => setModalRow(v)} className="cursor-pointer table-row-hover hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-4 text-[11px] font-mono text-blue-600">{v.number}</td>
                  <td className="py-2 px-4 text-[12px] text-slate-600 dark:text-slate-300">{v.date}</td>
                  <td className="py-2 px-4 text-[12px] text-slate-600 dark:text-slate-300">{v.type}</td>
                  <td className="py-2 px-4 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{v.party || '—'}</td>
                  <td className="py-2 px-4 text-[12px] font-bold text-right tabular-nums text-slate-800 dark:text-slate-100">{formatINR(v.amount)}</td>
                  <td className="py-2 px-4 text-[12px] text-right tabular-nums text-slate-400">{v.gst > 0 ? formatINR(v.gst) : '—'}</td>
                  <td className="py-2 px-4"><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          pagination={rtPagination}
          onPageChange={setRtPage}
          onPageSizeChange={(s) => { setRtSize(s); setRtPage(1) }}
        />
      </div>

      {/* ── Drill-down Modal ── */}
      <Modal isOpen={!!modalRow} onClose={() => setModalRow(null)} title={`Voucher: ${modalRow?.number || ''}`}>
        {modalRow && (
          <div className="space-y-3 p-1">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Voucher #', <span className="text-blue-600 font-mono font-bold" key="v1">{modalRow.number}</span>],
                ['Type', <span className="font-semibold text-slate-800" key="v2">{modalRow.type}</span>],
                ['Date', <span className="font-semibold text-slate-800" key="v3">{modalRow.date}</span>],
                ['Party', <span className="font-semibold text-slate-800" key="v4">{modalRow.party || '—'}</span>],
                ['Taxable Amount', <span className="font-bold text-slate-800" key="v5">{formatINR((modalRow.amount || 0) - (modalRow.gst || 0))}</span>],
                ['GST Amount', <span className="font-bold text-slate-800" key="v6">{formatINR(modalRow.gst || 0)}</span>],
                ['Total Amount', <span className="font-black text-slate-900 text-sm" key="v7">{formatINR(modalRow.amount || 0)}</span>],
                ['Status', <StatusBadge key="s" status={modalRow.status} />],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                  <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">{k}</p>
                  <div className="text-[12px]">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => navigate('/reports/daybook')} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-[12px] font-bold shadow-sm hover:-translate-y-px transition-all">Open in Day Book</button>
              <button onClick={() => setModalRow(null)} className="flex-1 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-all">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
