import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { AlertCircle, Clock, TrendingUp, Plug, Download, ArrowRight, Activity, ChevronRight } from 'lucide-react'
import KPICard from '../components/KPICard'
import AlertsPanel from '../components/AlertsPanel'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import {
  kpiData, monthlyTrend, receivablesAging, recentVouchers,
  topCustomers, topItems, cashFlowData, formatINR
} from '../data/mockData'
import { useDateRange } from '../context/DateContext'

const StatusBadge = ({ status }) => {
  const s = {
    paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    overdue: 'bg-red-50 text-red-700 border border-red-200/60',
    posted: 'bg-slate-100 text-slate-600 border border-slate-200/60',
  }
  return <span className={`px-1.5 py-px rounded text-[10px] font-bold capitalize ${s[status] ?? s.posted}`}>{status}</span>
}

const voucherCols = [
  { key: 'id', label: 'Voucher', sortable: true, render: v => <span className="text-blue-600 font-mono text-[11px]">{v}</span> },
  { key: 'date', label: 'Date', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'party', label: 'Party', sortable: true, render: v => <span className="font-semibold text-slate-700">{v}</span> },
  { key: 'amount', label: 'Amount', sortable: true, align: 'right', render: v => <span className="font-bold text-slate-800">{formatINR(v)}</span> },
  { key: 'gst', label: 'GST', sortable: true, align: 'right', render: v => v > 0 ? <span className="text-slate-400">{formatINR(v)}</span> : <span className="text-slate-200">—</span> },
  { key: 'status', label: 'Status', sortable: true, render: v => <StatusBadge status={v} /> },
]

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
  const [modalRow, setModalRow] = useState(null)
  const { selectedDateRange } = useDateRange()

  const getRangeData = () => {
    let multiplier = 1
    let vsText = 'vs last year'
    let chartText = 'Monthly · FY 2024-25'
    let labelValues = monthlyTrend.map(t => t.month)

    if (selectedDateRange.includes('Today')) {
      multiplier = 0.0025
      vsText = 'vs yesterday'
      chartText = 'Hourly · Today'
      labelValues = ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM']
    } else if (selectedDateRange.includes('Yesterday')) {
      multiplier = 0.0032
      vsText = 'vs previous day'
      chartText = 'Hourly · Yesterday'
      labelValues = ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM']
    } else if (selectedDateRange.includes('Week')) {
      multiplier = 0.02
      vsText = 'vs last week'
      chartText = 'Daily · This Week'
      labelValues = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    } else if (selectedDateRange.includes('Month')) {
      multiplier = 0.08
      vsText = 'vs last month'
      chartText = 'Daily · ' + selectedDateRange.split(' (')[0]
      labelValues = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']
    } else if (selectedDateRange.includes('Quarter')) {
      multiplier = 0.25
      vsText = 'vs last quarter'
      chartText = 'Weekly · This Quarter'
      labelValues = ['Wk 1', 'Wk 4', 'Wk 8', 'Wk 12']
    } else if (selectedDateRange.includes('Last Year')) {
      multiplier = 0.8
      vsText = 'vs previous year'
      chartText = 'Monthly · FY 2023-24'
    }

    const dynamicKPIs = Object.fromEntries(
      Object.entries(kpiData).map(([key, kpi]) => [
        key,
        {
          ...kpi,
          current: kpi.current * multiplier,
          subtitle: vsText,
        }
      ])
    )

    const dynamicChartData = monthlyTrend.slice(0, labelValues.length).map((point, index) => ({
      ...point,
      revenue: point.revenue * multiplier,
      expense: point.expense * multiplier,
      profit: point.profit * multiplier,
      month: labelValues[index] || point.month
    }))

    return { dynamicKPIs, dynamicChartData, chartText }
  }

  const { dynamicKPIs, dynamicChartData, chartText } = getRangeData()

  return (
    <div className="animate-fade-in flex flex-col gap-2.5">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <Activity className="text-blue-600" size={15} />
            Business Command Center
          </h1>
          <p className="text-[10.5px] text-slate-400 font-medium mt-px">Sharma Enterprises Pvt Ltd · Today's Overview</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/setup')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:shadow-sm transition-all"
          >
            <Plug size={11} className="text-slate-400" /> Connect Tally
          </button>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-sm hover:-translate-y-px transition-all"
            style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}
          >
            <Download size={11} /> Export
          </button>
        </div>
      </div>

      {/* ── Alerts Strip ── */}
      <AlertsPanel />

      {/* ── KPI Cards — 6 columns, all in one row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.values(dynamicKPIs).map(kpi => (
          <KPICard key={kpi.label} data={kpi} onClick={() => navigate(
            kpi.variant === 'sales' ? '/sales' :
              kpi.variant === 'purchase' ? '/purchase' :
                kpi.variant === 'receivables' ? '/sales/receivables' :
                  kpi.variant === 'payables' ? '/purchase/payables' :
                    kpi.variant === 'profit' ? '/analytics' : '/'
          )} />
        ))}
      </div>

      {/* ── Row 2: Revenue Chart + Receivables Aging ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2.5 items-stretch">

        {/* Revenue vs Expense — spans 2 */}
        <div className="xl:col-span-2 glass-card overflow-hidden flex flex-col" style={{ height: 300 }}>
          <div className="card-header shrink-0">
            <div>
              <h2 className="text-[11.5px] font-bold text-slate-800">Revenue vs Expense</h2>
              <p className="text-[10px] text-slate-400 font-medium">{chartText}</p>
            </div>
            <button onClick={() => navigate('/reports/pl')} className="flex items-center gap-1 text-[10.5px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded transition-colors hover:bg-blue-100">
              Analytics <ArrowRight size={10} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2 pt-1">
            <ResponsiveContainer width="100%" height={195}>
              <AreaChart data={dynamicChartData} margin={{ top: 2, right: 4, left: -26, bottom: 0 }}>
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

          {/* Card Footer */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-[rgba(255,255,255,0.05)] border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)] mt-auto shrink-0 bg-slate-50/30 dark:bg-[rgba(0,0,0,0.2)]">
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Total Revenue</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(dynamicKPIs.sales?.current ?? 0)}</span>
                <span className="text-[8.5px] text-emerald-600 font-bold bg-emerald-50 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00] px-1 py-px rounded">{dynamicKPIs.sales?.trend === 'up' ? '↑' : '↓'} {Math.abs(dynamicKPIs.sales?.change ?? 0)}%</span>
              </div>
            </div>
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Total Expense</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(dynamicKPIs.purchase?.current ?? 0)}</span>
                <span className="text-[8.5px] text-red-600 font-bold bg-red-50 dark:bg-[rgba(255,51,102,0.1)] dark:text-[#FF3366] px-1 py-px rounded">{dynamicKPIs.purchase?.trend === 'up' ? '↑' : '↓'} {Math.abs(dynamicKPIs.purchase?.change ?? 0)}%</span>
              </div>
            </div>
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Net Profit</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">{formatINR(dynamicKPIs.profit?.current ?? 0)}</span>
                <span className="text-[8.5px] text-emerald-600 font-bold bg-emerald-50 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00] px-1 py-px rounded">{dynamicKPIs.profit?.trend === 'up' ? '↑' : '↓'} {Math.abs(dynamicKPIs.profit?.change ?? 0)}%</span>
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
                Outstanding · ₹12.80L total
              </p>
            </div>
            <button
              onClick={() => navigate('/sales/receivables')}
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

          {/* Body: donut left, buckets right */}
          <div className="flex-1 flex items-center gap-2 px-3 py-2 overflow-hidden">

            {/* Donut Chart */}
            <div className="shrink-0" style={{ width: 110, height: 110, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={receivablesAging}
                    dataKey="amount"
                    nameKey="bucket"
                    cx="50%" cy="50%"
                    innerRadius={32} outerRadius={50}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {receivablesAging.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={v => formatINR(v)}
                    contentStyle={{
                      borderRadius: 8, border: 'none',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      fontSize: 11, fontFamily: "'Nunito','Inter',sans-serif",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif", lineHeight: 1.2 }}>₹12.8L</span>
                <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }}>28 bills</span>
              </div>
            </div>

            {/* Bucket rows with progress bars */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {receivablesAging.map((a, i) => (
                <div key={i}>
                  {/* Label row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', fontFamily: "'Nunito','Inter',sans-serif" }}>
                        {a.bucket}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>
                        {formatINR(a.amount)}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#fff',
                        background: a.color, borderRadius: 20,
                        padding: '1px 5px', fontFamily: "'Nunito','Inter',sans-serif",
                      }}>
                        {a.count}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 4, background: 'rgba(226,232,240,0.7)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${a.pct}%`,
                      borderRadius: 4,
                      background: a.color,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Footer */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-[rgba(255,255,255,0.05)] border-t border-slate-100 dark:border-[rgba(255,255,255,0.05)] mt-auto shrink-0 bg-slate-50/30 dark:bg-[rgba(0,0,0,0.2)]">
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">0-30 Days (Safe)</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">₹5.20L</span>
                <span className="text-[8.5px] text-emerald-600 font-bold bg-emerald-50 dark:bg-[rgba(182,255,0,0.1)] dark:text-[#B6FF00] px-1 py-px rounded">40.6%</span>
              </div>
            </div>
            <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Over 60 Days (Risk)</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">₹3.80L</span>
                <span className="text-[8.5px] text-red-600 font-bold bg-red-50 dark:bg-[rgba(255,51,102,0.1)] dark:text-[#FF3366] px-1 py-px rounded">29.7%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Cash Flow + Customers + Products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 items-stretch">

        {/* Cash Flow */}
        <div className="glass-card overflow-hidden flex flex-col" style={{ height: 260 }}>
          <div className="card-header shrink-0">
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>Cash Flow</h2>
              <p style={{ fontSize: 10, color: 'var(--theme-text-muted)', fontWeight: 500, fontFamily: "'Nunito','Inter',sans-serif" }}>Last 6 months</p>
            </div>
            <button onClick={() => navigate('/reports/cf')} className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2 pt-1">
            <ResponsiveContainer width="100%" height={195}>
              <BarChart data={cashFlowData} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid-stroke)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }} axisLine={false} tickLine={false} dy={4} />
                <YAxis tickFormatter={v => `${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 9, fill: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }} axisLine={false} tickLine={false} dx={-2} />
                <Tooltip formatter={v => formatINR(v)} cursor={{ fill: 'var(--chart-grid-stroke)' }} contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 10, fontFamily: "'Nunito','Inter',sans-serif", background: 'var(--theme-card-bg)' }} />
                <Bar dataKey="operating" fill="var(--chart-cf-op)" radius={[2, 2, 0, 0]} name="Operating" />
                <Bar dataKey="net" fill="var(--chart-cf-net)" radius={[2, 2, 0, 0]} name="Net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers */}
        <div className="glass-card overflow-hidden flex flex-col" style={{ height: 260 }}>
          <div className="card-header shrink-0">
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>Top Customers</h2>
            <button onClick={() => navigate('/sales/customers')} className="text-[10.5px] text-blue-600 font-bold hover:text-blue-700 transition-colors" style={{ fontFamily: "'Nunito','Inter',sans-serif" }}>View All</button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-slate-100/80">
            {topCustomers.slice(0, 5).map((c, i) => {
              const maxSales = topCustomers[0].sales
              return (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors group">
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
            <button onClick={() => navigate('/inventory')} className="text-[10.5px] text-blue-600 font-bold hover:text-blue-700 transition-colors" style={{ fontFamily: "'Nunito','Inter',sans-serif" }}>View All</button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-slate-100/80">
            {topItems.slice(0, 5).map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors group">
                <span className="w-3.5 shrink-0 text-center text-slate-300" style={{ fontSize: 10, fontWeight: 900, fontFamily: "'Nunito','Inter',sans-serif" }}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate group-hover:text-blue-600 transition-colors" style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>{item.name}</p>
                  <p className="mt-px" style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--theme-text-muted)', fontFamily: "'Nunito','Inter',sans-serif" }}>{item.category} · Qty: {item.qty.toLocaleString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--theme-text-main)', fontFamily: "'Nunito','Inter',sans-serif" }}>{formatINR(item.value)}</p>
                  <div
                    className={`inline-flex items-center gap-0.5 mt-px px-1 py-px rounded ${item.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : item.trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}
                    style={{ fontSize: 9, fontWeight: 800, fontFamily: "'Nunito','Inter',sans-serif" }}
                  >
                    {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'} {item.margin}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ── Row 5: Recent Transactions table ── */}
      <div className="">
        <div className="overflow-x-auto">
          <DataTable
            title="Recent Transactions"
            columns={voucherCols}
            data={recentVouchers}
            pageSize={5}
            onRowClick={setModalRow}
            rowClassName={row => row.status === 'overdue' ? 'bg-red-50 dark:bg-[rgba(255,51,102,0.1)] hover:bg-red-100 dark:hover:bg-[rgba(255,51,102,0.2)]' : 'table-row-hover'}
            actions={
              <button onClick={() => navigate('/sales')} className="flex items-center gap-1 text-[11px] bg-blue-50 px-2.5 py-1 rounded-md text-blue-600 font-bold hover:bg-blue-100 transition-colors">
                View All <ArrowRight size={11} />
              </button>
            }
          />
        </div>
      </div>

      {/* ── Drill-down Modal ── */}
      <Modal isOpen={!!modalRow} onClose={() => setModalRow(null)} title={`Voucher: ${modalRow?.id}`}>
        {modalRow && (
          <div className="space-y-3 p-1">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Voucher #', <span className="text-blue-600 font-mono font-bold" key="v1">{modalRow.id}</span>],
                ['Type', <span className="font-semibold text-slate-800" key="v2">{modalRow.type}</span>],
                ['Date', <span className="font-semibold text-slate-800" key="v3">{modalRow.date}</span>],
                ['Party', <span className="font-semibold text-slate-800" key="v4">{modalRow.party}</span>],
                ['Taxable Amount', <span className="font-bold text-slate-800" key="v5">{formatINR(modalRow.amount - modalRow.gst)}</span>],
                ['GST Amount', <span className="font-bold text-slate-800" key="v6">{formatINR(modalRow.gst)}</span>],
                ['Total Amount', <span className="font-black text-slate-900 text-sm" key="v7">{formatINR(modalRow.amount)}</span>],
                ['Status', <StatusBadge key="s" status={modalRow.status} />],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                  <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">{k}</p>
                  <div className="text-[12px]">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-[12px] font-bold shadow-sm hover:-translate-y-px transition-all">Download PDF</button>
              <button className="flex-1 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-all">Share via WhatsApp</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
