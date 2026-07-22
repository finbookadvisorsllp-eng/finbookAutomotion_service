import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Info, Plug, Download, ArrowRight, ChevronRight, Search, TrendingUp } from 'lucide-react'
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
    overdue: 'bg-rose-50 text-rose-700 border border-rose-200/60',
    posted: 'bg-slate-50 text-slate-600 border border-slate-200/60',
  }
  return <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold capitalize ${s[status] ?? s.posted}`}>{status}</span>
}

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="p-3 text-[12px]"
      style={{
        background: 'var(--theme-card-bg)',
        borderRadius: 12,
        border: '1px solid var(--theme-card-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <p className="font-semibold mb-2" style={{ color: 'var(--theme-text-main)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize flex-1" style={{ color: 'var(--theme-text-muted)' }}>{p.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--theme-text-main)' }}>{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Section wrapper for consistent spacing + stagger animation ──
const Section = ({ children, delay = 0 }) => (
  <div
    className="animate-slide-up"
    style={{ animationDelay: `${delay}ms` }}
  >
    {children}
  </div>
)

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

  // Time-based greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col gap-5">

      {/* ═══════════════════════════════════════════════════
          SECTION 1 — Page Header
          ═══════════════════════════════════════════════════ */}
      <Section delay={0}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: 'var(--theme-text-main)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {greeting}, {companyName}
            </h1>
            <p
              className="mt-1"
              style={{ fontSize: 13.5, color: 'var(--theme-text-muted)', fontWeight: 400 }}
            >
              {fy ? `Financial Year ${fy}` : 'Select a financial year to begin'}
              {loading && <span className="ml-2 text-blue-500 animate-pulse">· Refreshing…</span>}
            </p>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════
          ERROR BANNER
          ═══════════════════════════════════════════════════ */}
      {error && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-medium"
          style={{
            background: 'rgba(244, 63, 94, 0.06)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            color: '#e11d48',
          }}
        >
          <Info size={16} /> Couldn't load dashboard data{fy ? '' : ' — select a financial year'}.
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 2 — Alerts Strip
          ═══════════════════════════════════════════════════ */}
      <AlertsPanel alerts={alerts} />

      {/* ═══════════════════════════════════════════════════
          SECTION 3 — AI CFO Widget (Hero level)
          ═══════════════════════════════════════════════════ */}
      <Section delay={50}>
        <AICFOWidget fy={fy} />
      </Section>

      {/* ═══════════════════════════════════════════════════
          SECTION 4 — KPI Cards
          ═══════════════════════════════════════════════════ */}
      <Section delay={100}>
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3.5">
          {kpiCards.length === 0 && loading
            ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 20 }} />
            ))
            : kpiCards.map(kpi => (
              <KPICard key={kpi.key} data={kpi} onClick={() => navigate(kpi.route)} />
            ))}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════
          SECTION 5 — Revenue Chart + Receivables Aging
          ═══════════════════════════════════════════════════ */}
      <Section delay={150}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">

          {/* Revenue vs Expense — spans 2 */}
          <div className="xl:col-span-2 erp-card overflow-hidden flex flex-col" style={{ minHeight: 340 }}>
            <div className="card-header shrink-0">
              <div>
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>
                  Revenue vs Expense
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--theme-text-muted)', fontWeight: 400 }}>
                  Monthly · P&amp;L view{fy ? ` · FY ${fy}` : ''}
                </p>
              </div>
              <button
                onClick={() => navigate('/reports/pl')}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--theme-accent-light)', color: 'var(--theme-accent)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-accent-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-accent-light)'}
              >
                <TrendingUp size={13} /> Analytics <ArrowRight size={11} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-3 pt-3">
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={monthlyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
                  <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid-stroke)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--theme-text-light)', fontWeight: 500 }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: 'var(--theme-text-light)', fontWeight: 500 }} axisLine={false} tickLine={false} dx={-4} />
                  <Tooltip content={customTooltip} cursor={{ stroke: 'var(--chart-grid-stroke)', strokeWidth: 1 }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-text-muted)', paddingTop: 8 }} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--chart-rev-stroke)" strokeWidth={2} fill="url(#revGrad)" name="Revenue" activeDot={{ r: 4, fill: 'var(--theme-card-bg)', stroke: 'var(--chart-rev-stroke)', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="expense" stroke="var(--chart-exp-stroke)" strokeWidth={2} fill="url(#expGrad)" name="Expense" activeDot={{ r: 4, fill: 'var(--theme-card-bg)', stroke: 'var(--chart-exp-stroke)', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="profit" stroke="var(--chart-prof-stroke)" strokeWidth={2} fill="url(#profGrad)" name="Profit" activeDot={{ r: 4, fill: 'var(--theme-card-bg)', stroke: 'var(--chart-prof-stroke)', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Card Footer — totals */}
            <div
              className="grid grid-cols-3 mt-auto shrink-0"
              style={{
                borderTop: '1px solid var(--theme-card-border)',
                background: 'var(--theme-surface-secondary)',
                borderRadius: '0 0 20px 20px',
              }}
            >
              {[
                { label: 'Total Revenue', value: totRevenue, badge: null },
                { label: 'Total Expense', value: totExpense, badge: `${expenseRatio}%`, badgeColor: 'text-rose-600 bg-rose-50 dark:text-[#FF3366] dark:bg-[rgba(255,51,102,0.1)]' },
                { label: 'Net Profit', value: totProfit, badge: `${profitMargin}%`, badgeColor: totProfit >= 0 ? 'text-emerald-600 bg-emerald-50 dark:text-[#B6FF00] dark:bg-[rgba(182,255,0,0.1)]' : 'text-rose-600 bg-rose-50 dark:text-[#FF3366] dark:bg-[rgba(255,51,102,0.1)]' },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="px-4 py-3 text-center flex flex-col items-center justify-center"
                  style={i < 2 ? { borderRight: '1px solid var(--theme-card-border)' } : {}}
                >
                  <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--theme-text-muted)' }}>{item.label}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>{formatINR(item.value)}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${item.badgeColor}`}>{item.badge}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Receivables Aging */}
          <div className="erp-card overflow-hidden flex flex-col" style={{ minHeight: 340 }}>
            <div className="card-header shrink-0">
              <div>
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>
                  Receivables Aging
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--theme-text-muted)', fontWeight: 400 }}>
                  Outstanding · {formatINR(agingTotal)}
                </p>
              </div>
              <button
                onClick={() => navigate('/reports/outstanding')}
                className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--theme-accent-light)', color: 'var(--theme-accent)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-accent-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-accent-light)'}
              >
                View All <ChevronRight size={13} />
              </button>
            </div>

            {agingAvailable ? (
              <>
                {/* Body: donut left, buckets right */}
                <div className="flex-1 flex items-center gap-3 px-4 py-3 overflow-hidden">
                  {/* Donut Chart */}
                  <div className="shrink-0" style={{ width: 120, height: 120, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={agingBuckets} dataKey="amount" nameKey="label"
                          cx="50%" cy="50%" innerRadius={36} outerRadius={54} paddingAngle={2} strokeWidth={0}>
                          {agingBuckets.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={v => formatINR(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-lg)', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-main)', lineHeight: 1.3 }}>{formatINR(agingTotal, true)}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--theme-text-muted)' }}>{agingBills} bills</span>
                    </div>
                  </div>

                  {/* Bucket rows with progress bars */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {agingBuckets.map((a, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-text-secondary)' }}>{a.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text-main)' }}>{formatINR(a.amount)}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: a.color, borderRadius: 20, padding: '1px 6px' }}>{a.count}</span>
                          </div>
                        </div>
                        <div style={{ height: 4, borderRadius: 4, background: 'var(--theme-surface-secondary)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${a.pct || 0}%`, borderRadius: 4, background: a.color, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer */}
                <div
                  className="grid grid-cols-2 mt-auto shrink-0"
                  style={{
                    borderTop: '1px solid var(--theme-card-border)',
                    background: 'var(--theme-surface-secondary)',
                    borderRadius: '0 0 20px 20px',
                  }}
                >
                  <div className="px-4 py-3 text-center flex flex-col items-center justify-center" style={{ borderRight: '1px solid var(--theme-card-border)' }}>
                    <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--theme-text-muted)' }}>{safeBucket?.label || '0-30 Days'} (Safe)</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>{formatINR(safeBucket?.amount || 0)}</span>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00] px-1.5 py-0.5 rounded-lg">{safeBucket?.pct || 0}%</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 text-center flex flex-col items-center justify-center">
                    <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--theme-text-muted)' }}>Over 60 Days (Risk)</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>{formatINR(riskAmt)}</span>
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-[rgba(255,51,102,0.1)] dark:text-[#FF3366] px-1.5 py-0.5 rounded-lg">{agingTotal ? Math.round((riskAmt / agingTotal) * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // Honest "not yet computable" state
              <div className="flex-1 flex flex-col px-4 py-4 gap-4">
                <div className="rounded-2xl p-4 flex flex-col items-center justify-center" style={{ background: 'var(--theme-surface-secondary)', border: '1px solid var(--theme-card-border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-light)' }}>Total Outstanding</p>
                  <p className="text-[24px] font-bold tracking-tight mt-1" style={{ color: 'var(--theme-text-main)', letterSpacing: '-0.02em' }}>{formatINR(agingTotal)}</p>
                  <p className="text-[12px] font-medium mt-1" style={{ color: 'var(--theme-text-muted)' }}>Across {agingPartyCount} customers</p>
                </div>
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                  <Info size={15} className="shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                  <p className="text-[12px] font-medium leading-relaxed" style={{ color: '#92400e' }}>
                    Age-wise split is unavailable — bill-wise allocations / due dates are not present in the
                    synced Tally data. The total above is exact and reconciles with Receivables; buckets
                    populate automatically once <span className="font-semibold">billAllocations</span> are synced.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════
          SECTION 6 — Cash Flow + Customers + Products
          ═══════════════════════════════════════════════════ */}
      <Section delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

          {/* Cash Flow */}
          <div className="erp-card overflow-hidden flex flex-col" style={{ minHeight: 300 }}>
            <div className="card-header shrink-0">
              <div>
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>Cash Flow</h2>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--theme-text-muted)', fontWeight: 400 }}>
                  Net {formatINR(cfSummary.net || 0)} · Closing {formatINR(cfSummary.closing || 0)}
                </p>
              </div>
              <button
                onClick={() => navigate('/reports/cf')}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ background: 'var(--theme-surface-secondary)', color: 'var(--theme-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--theme-accent)'; e.currentTarget.style.background = 'var(--theme-accent-light)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--theme-text-muted)'; e.currentTarget.style.background = 'var(--theme-surface-secondary)' }}
              >
                <ChevronRight size={15} strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-3 pt-3">
              {cfSeries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[13px] font-medium" style={{ color: 'var(--theme-text-light)' }}>{loading ? 'Loading…' : 'No cash movement in this period'}</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={cfSeries} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid-stroke)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--theme-text-light)', fontWeight: 500 }} axisLine={false} tickLine={false} dy={6} />
                    <YAxis tickFormatter={v => `${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: 'var(--theme-text-light)', fontWeight: 500 }} axisLine={false} tickLine={false} dx={-2} />
                    <Tooltip formatter={v => formatINR(v)} cursor={{ fill: 'var(--chart-grid-stroke)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-lg)', fontSize: 12, background: 'var(--theme-card-bg)' }} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, fontWeight: 500, color: 'var(--theme-text-muted)' }} />
                    <Bar dataKey="inflow" fill="var(--chart-cf-op)" radius={[4, 4, 0, 0]} name="Inflow" />
                    <Bar dataKey="outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Outflow" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Customers */}
          <div className="erp-card overflow-hidden flex flex-col" style={{ minHeight: 300 }}>
            <div className="card-header shrink-0">
              <h2 className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>Top Customers</h2>
              <button
                onClick={() => navigate('/sales/customers')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--theme-accent)' }}
              >
                View All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {topCustomers.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[13px] font-medium" style={{ color: 'var(--theme-text-light)' }}>{loading ? 'Loading…' : 'No sales in this period'}</div>
              ) : topCustomers.slice(0, 6).map((c, i) => {
                const maxSales = topCustomers[0]?.sales || 1
                return (
                  <div key={`${c.name}-${i}`} onClick={() => navigate(`/sales?search=${encodeURIComponent(c.name)}`)}
                    className="flex items-center gap-3 px-5 py-3 transition-colors group cursor-pointer"
                    style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-surface-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="w-5 shrink-0 text-center" style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-text-light)' }}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13px] font-medium group-hover:text-blue-600 transition-colors" style={{ color: 'var(--theme-text-main)' }}>{c.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--theme-surface-secondary)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(c.sales / maxSales) * 100}%`, background: 'var(--theme-accent)' }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>{formatINR(c.sales)}</p>
                      {c.outstanding > 0 && <p className="mt-0.5 text-[10px] font-semibold" style={{ color: '#d97706' }}>Due: {formatINR(c.outstanding)}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Products */}
          <div className="erp-card overflow-hidden flex flex-col" style={{ minHeight: 300 }}>
            <div className="card-header shrink-0">
              <h2 className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>Top Products</h2>
              <button
                onClick={() => navigate('/inventory/performance')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--theme-accent)' }}
              >
                View All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {topItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[13px] font-medium" style={{ color: 'var(--theme-text-light)' }}>{loading ? 'Loading…' : 'No item sales in this period'}</div>
              ) : topItems.slice(0, 6).map((item, i) => (
                <div key={`${item.name}-${i}`} onClick={() => navigate('/inventory/performance')}
                  className="flex items-center gap-3 px-5 py-3 transition-colors group cursor-pointer"
                  style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-surface-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="w-5 shrink-0 text-center" style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-text-light)' }}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-medium group-hover:text-blue-600 transition-colors" style={{ color: 'var(--theme-text-main)' }}>{item.name}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--theme-text-muted)', fontWeight: 400 }}>{item.category} · Qty: {Number(item.qty || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>{formatINR(item.value)}</p>
                    <div
                      className={`inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded-lg ${item.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : item.trend === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}
                      style={{ fontSize: 10, fontWeight: 600 }}
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
      </Section>

      {/* ═══════════════════════════════════════════════════
          SECTION 7 — Recent Transactions
          ═══════════════════════════════════════════════════ */}
      <Section delay={250}>
        <div className="erp-card overflow-hidden">
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            style={{ borderBottom: '1px solid var(--theme-card-border)' }}
          >
            <div className="flex items-center gap-3">
              <h3 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text-main)' }}>Recent Transactions</h3>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-light)' }} />
                <input
                  value={rtSearch}
                  onChange={e => setRtSearch(e.target.value)}
                  placeholder="Search voucher, type or party…"
                  className="pl-9 pr-4 py-2 text-[13px] w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  style={{
                    border: '1px solid var(--theme-card-border)',
                    borderRadius: 12,
                    background: 'var(--theme-card-bg)',
                    color: 'var(--theme-text-main)',
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={exportRecentCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-xl transition-all"
                style={{
                  color: 'var(--theme-text-secondary)',
                  background: 'var(--theme-card-bg)',
                  border: '1px solid var(--theme-card-border)',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-xs)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={() => navigate('/reports/daybook')}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-2 rounded-xl transition-colors"
                style={{ background: 'var(--theme-accent-light)', color: 'var(--theme-accent)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-accent-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-accent-light)'}
              >
                View All <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr style={{ background: 'var(--report-head-bg)' }}>
                  {['Voucher', 'Date', 'Type', 'Party', 'Amount', 'GST', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-3 px-5 text-[11px] font-semibold uppercase tracking-wider ${i >= 4 && i <= 5 ? 'text-right' : ''}`}
                      style={{ color: 'var(--theme-text-muted)', borderBottom: '1px solid var(--theme-card-border)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && recentVouchers.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--theme-text-muted)' }}>Loading…</td></tr>
                ) : rtPageRows.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>No transactions found.</td></tr>
                ) : rtPageRows.map((v, idx) => (
                  <tr
                    key={v.id ?? idx}
                    onClick={() => setModalRow(v)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid var(--report-divider)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--report-row-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="py-3 px-5 text-[12px] font-mono" style={{ color: 'var(--theme-accent)' }}>{v.number}</td>
                    <td className="py-3 px-5 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{v.date}</td>
                    <td className="py-3 px-5 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{v.type}</td>
                    <td className="py-3 px-5 text-[13px] font-medium" style={{ color: 'var(--theme-text-main)' }}>{v.party || '—'}</td>
                    <td className="py-3 px-5 text-[13px] font-semibold text-right tabular-nums" style={{ color: 'var(--theme-text-main)' }}>{formatINR(v.amount)}</td>
                    <td className="py-3 px-5 text-[13px] text-right tabular-nums" style={{ color: 'var(--theme-text-light)' }}>{v.gst > 0 ? formatINR(v.gst) : '—'}</td>
                    <td className="py-3 px-5"><StatusBadge status={v.status} /></td>
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
      </Section>

      {/* ═══════════════════════════════════════════════════
          DRILL-DOWN MODAL
          ═══════════════════════════════════════════════════ */}
      <Modal isOpen={!!modalRow} onClose={() => setModalRow(null)} title={`Voucher: ${modalRow?.number || ''}`}>
        {modalRow && (
          <div className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Voucher #', <span className="font-mono font-semibold" style={{ color: 'var(--theme-accent)' }} key="v1">{modalRow.number}</span>],
                ['Type', <span className="font-medium" style={{ color: 'var(--theme-text-main)' }} key="v2">{modalRow.type}</span>],
                ['Date', <span className="font-medium" style={{ color: 'var(--theme-text-main)' }} key="v3">{modalRow.date}</span>],
                ['Party', <span className="font-medium" style={{ color: 'var(--theme-text-main)' }} key="v4">{modalRow.party || '—'}</span>],
                ['Taxable Amount', <span className="font-semibold" style={{ color: 'var(--theme-text-main)' }} key="v5">{formatINR((modalRow.amount || 0) - (modalRow.gst || 0))}</span>],
                ['GST Amount', <span className="font-semibold" style={{ color: 'var(--theme-text-main)' }} key="v6">{formatINR(modalRow.gst || 0)}</span>],
                ['Total Amount', <span className="text-[15px] font-bold" style={{ color: 'var(--theme-text-main)' }} key="v7">{formatINR(modalRow.amount || 0)}</span>],
                ['Status', <StatusBadge key="s" status={modalRow.status} />],
              ].map(([k, v]) => (
                <div key={k} className="p-3 rounded-xl" style={{ background: 'var(--theme-surface-secondary)', border: '1px solid var(--theme-card-border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--theme-text-light)' }}>{k}</p>
                  <div className="text-[13px]">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => navigate('/reports/daybook')} className="flex-1 py-2.5 text-white rounded-xl text-[13px] font-semibold transition-all hover:shadow-md" style={{ background: '#2563eb' }}>Open in Day Book</button>
              <button onClick={() => setModalRow(null)} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all" style={{ border: '1px solid var(--theme-card-border)', background: 'var(--theme-card-bg)', color: 'var(--theme-text-secondary)' }}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
