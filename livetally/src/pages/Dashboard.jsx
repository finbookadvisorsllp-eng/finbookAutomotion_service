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

const StatusBadge = ({ status }) => {
  const s = {
    paid:    'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50',
    pending: 'bg-amber-100/80 text-amber-700 border border-amber-200/50',
    overdue: 'bg-red-100/80 text-red-700 border border-red-200/50',
    posted:  'bg-slate-100/80 text-slate-600 border border-slate-200/50',
  }
  return <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold capitalize shadow-sm ${s[status] ?? s.posted}`}>{status}</span>
}

const voucherCols = [
  { key: 'id',     label: 'Voucher #',   sortable: true, render: v => <span className="text-blue-600 font-mono text-[12px]">{v}</span> },
  { key: 'date',   label: 'Date',        sortable: true },
  { key: 'type',   label: 'Type',        sortable: true },
  { key: 'party',  label: 'Party',       sortable: true, render: v => <span className="font-semibold text-slate-700">{v}</span> },
  { key: 'amount', label: 'Amount',      sortable: true, align: 'right', render: v => <span className="font-bold text-slate-800">{formatINR(v)}</span> },
  { key: 'gst',    label: 'GST',         sortable: true, align: 'right', render: v => v > 0 ? <span className="text-slate-500 font-medium">{formatINR(v)}</span> : <span className="text-slate-300">—</span> },
  { key: 'status', label: 'Status',      sortable: true, render: v => <StatusBadge status={v} /> },
]

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-bold text-slate-700 mb-2.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1.5 last:mb-0">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: p.color }} />
          <span className="text-slate-500 font-medium capitalize flex-1 min-w-[60px]">{p.name || p.dataKey}:</span>
          <span className="font-bold text-slate-800">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [modalRow, setModalRow] = useState(null)

  const insights = [
    { type: 'danger',  icon: AlertCircle, title: 'Action Required',     desc: '5 invoices are overdue totalling ₹3.8L. BigBazaar (₹3.1L) is 17 days past due.', action: 'View Receivables', path: '/sales/receivables' },
    { type: 'warning', icon: Clock, title: 'Bills Due This Week',  desc: '4 vendor payments (₹2.1L) are due before 31 May. Britannia (₹1.95L) is already overdue.', action: 'View Payables', path: '/purchase/payables' },
    { type: 'success', icon: TrendingUp, title: 'Business Improving',  desc: 'Sales are up 16.1% and net profit improved to 18.1% margin vs 17.3% last year.', action: 'View Analytics', path: '/analytics' },
  ]

  return (
    <div className="animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 sm:mb-10 gap-6">
        <div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="text-blue-600 hidden sm:block" size={32} /> 
            Business Command Center
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">What you need to know today — Sharma Enterprises Pvt Ltd</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => navigate('/setup')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all shadow-sm">
            <Plug size={16} className="text-slate-400" /> Connect Tally
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Alerts Strip */}
      <AlertsPanel />

      {/* KPI Cards - Changed from 6 cols to 3 cols for better readability */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 mb-10">
        {Object.values(kpiData).map(kpi => (
          <KPICard key={kpi.label} data={kpi} onClick={() => navigate(
            kpi.variant === 'sales' ? '/sales' :
            kpi.variant === 'purchase' ? '/purchase' :
            kpi.variant === 'receivables' ? '/sales/receivables' :
            kpi.variant === 'payables' ? '/purchase/payables' :
            kpi.variant === 'profit' ? '/analytics' : '/'
          )} />
        ))}
      </div>

      {/* Business Health */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-10 items-start">
        {/* Revenue vs Expense — Wide */}
        <div className="xl:col-span-2 glass-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-white/50">
            <div>
              <h2 className="text-base font-black text-slate-800">Revenue vs Expense</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Monthly trend — FY 2024-25</p>
            </div>
            <button onClick={() => navigate('/analytics')} className="flex items-center gap-1 text-[13px] text-blue-600 font-bold hover:text-blue-700 bg-blue-50/50 px-3 py-1.5 rounded-lg transition-colors">
              Analytics <ArrowRight size={14} />
            </button>
          </div>
          <div className="p-4 sm:p-6 w-full">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={monthlyTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={customTooltip} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 600, color: '#475569', paddingTop: 10 }} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fill="url(#revGrad)" name="Revenue" activeDot={{ r: 6, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fill="url(#expGrad)" name="Expense" activeDot={{ r: 6, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="url(#profGrad)" name="Profit" activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Receivables Aging */}
        <div className="glass-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-white/50">
            <div>
              <h2 className="text-base font-black text-slate-800">Money Due to You</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Receivables aging breakdown</p>
            </div>
            <button onClick={() => navigate('/sales/receivables')} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>
          <div className="p-5 sm:p-6 flex-1 flex flex-col">
            <div className="flex justify-center mb-8 w-full">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={receivablesAging} dataKey="amount" nameKey="bucket" cx="50%" cy="50%" innerRadius={70} outerRadius={105} paddingAngle={4}>
                    {receivablesAging.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => formatINR(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 px-2">
              {receivablesAging.map((a, i) => (
                <div key={i} className="flex items-center gap-4 py-1">
                  <div className="w-4 h-4 rounded-md shadow-sm shrink-0" style={{ background: a.color }} />
                  <span className="text-[15px] font-semibold text-slate-600 flex-1">{a.bucket}</span>
                  <span className="text-[15px] font-black text-slate-800">{formatINR(a.amount)}</span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full w-10 text-center">({a.count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow + Top Customers + Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-10 items-start">
        {/* Cash Flow */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-white/50">
            <div>
              <h2 className="text-base font-black text-slate-800">Cash Flow</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Last 6 months</p>
            </div>
            <button onClick={() => navigate('/reports/cf')} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>
          <div className="p-4 sm:p-5 w-full">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cashFlowData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={v => `${(v/100000).toFixed(0)}L`} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dx={-5} />
                <Tooltip formatter={v => formatINR(v)} cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Bar dataKey="operating" fill="#2563eb" radius={[4,4,0,0]} name="Operating" />
                <Bar dataKey="net" fill="#10b981" radius={[4,4,0,0]} name="Net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-white/50">
            <h2 className="text-base font-black text-slate-800">Top Customers</h2>
            <button onClick={() => navigate('/sales/customers')} className="text-[13px] text-blue-600 font-bold hover:text-blue-700">View All</button>
          </div>
          <div className="divide-y divide-slate-100/80">
            {topCustomers.slice(0, 5).map((c, i) => {
              const maxSales = topCustomers[0].sales
              return (
                <div key={c.id} className="flex items-center gap-4 px-6 sm:px-8 py-5 hover:bg-slate-50/80 transition-colors group">
                  <span className="text-[14px] font-black text-slate-300 w-5 shrink-0">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{c.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(c.sales / maxSales) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-black text-slate-800">{formatINR(c.sales)}</p>
                    {c.outstanding > 0 && <p className="text-[11px] text-amber-600 font-bold mt-1">Due: {formatINR(c.outstanding)}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Items */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-white/50">
            <h2 className="text-base font-black text-slate-800">Top Products</h2>
            <button onClick={() => navigate('/inventory')} className="text-[13px] text-blue-600 font-bold hover:text-blue-700">View All</button>
          </div>
          <div className="divide-y divide-slate-100/80">
            {topItems.slice(0, 5).map((item, i) => (
              <div key={item.id} className="flex items-center gap-4 px-6 sm:px-8 py-5 hover:bg-slate-50/80 transition-colors group">
                <span className="text-[14px] font-black text-slate-300 w-5 shrink-0">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{item.name}</p>
                  <p className="text-xs font-medium text-slate-500 mt-1">{item.category} · Qty: {item.qty.toLocaleString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-black text-slate-800">{formatINR(item.value)}</p>
                  <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${item.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : item.trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                    {item.trend === 'up' ? <TrendingUp size={12} /> : item.trend === 'down' ? <TrendingUp size={12} className="rotate-180" /> : <Activity size={12} />}
                    {item.margin}% margin
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-10">
        {insights.map((ins, i) => {
          const colors = {
            danger:  { bg: 'bg-red-50',     border: 'border-red-200/60',   text: 'text-red-700',   link: 'text-red-600', icon: 'text-red-600' },
            warning: { bg: 'bg-amber-50',   border: 'border-amber-200/60', text: 'text-amber-700', link: 'text-amber-600', icon: 'text-amber-600' },
            success: { bg: 'bg-emerald-50', border: 'border-emerald-200/60',text: 'text-emerald-700',link: 'text-emerald-600', icon: 'text-emerald-600' },
          }[ins.type]
          const Icon = ins.icon
          return (
            <div key={i} className={`rounded-2xl border p-6 sm:p-8 ${colors.bg} ${colors.border} shadow-sm hover:shadow-md transition-shadow`}>
              <div className="flex items-start gap-5">
                <div className={`p-3 bg-white rounded-xl shadow-sm shrink-0 ${colors.icon}`}>
                  <Icon size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <p className={`text-base font-black mb-2 ${colors.text}`}>{ins.title}</p>
                  <p className="text-[14px] font-medium text-slate-700 leading-relaxed opacity-90">{ins.desc}</p>
                  <button onClick={() => navigate(ins.path)} className={`flex items-center gap-1.5 text-[14px] font-bold mt-4 ${colors.link} hover:underline`}>
                    {ins.action} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Transactions */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <DataTable
            title="Recent Transactions"
            columns={voucherCols}
            data={recentVouchers}
            pageSize={7}
            onRowClick={setModalRow}
            rowClassName={row => row.status === 'overdue' ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-slate-50/80'}
            actions={
              <button onClick={() => navigate('/sales')} className="flex items-center gap-1.5 text-[14px] bg-blue-50 px-4 py-2 rounded-xl text-blue-600 font-bold hover:text-blue-700 hover:bg-blue-100 transition-colors">
                View All Vouchers <ArrowRight size={16} />
              </button>
            }
          />
        </div>
      </div>

      {/* Drill-down modal */}
      <Modal isOpen={!!modalRow} onClose={() => setModalRow(null)} title={`Voucher: ${modalRow?.id}`}>
        {modalRow && (
          <div className="space-y-5 p-2">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Voucher #', <span className="text-blue-600 font-mono font-bold" key="v1">{modalRow.id}</span>],
                ['Type', <span className="font-semibold text-slate-800" key="v2">{modalRow.type}</span>],
                ['Date', <span className="font-semibold text-slate-800" key="v3">{modalRow.date}</span>],
                ['Party', <span className="font-semibold text-slate-800" key="v4">{modalRow.party}</span>],
                ['Taxable Amount', <span className="font-bold text-slate-800" key="v5">{formatINR(modalRow.amount - modalRow.gst)}</span>],
                ['GST Amount', <span className="font-bold text-slate-800" key="v6">{formatINR(modalRow.gst)}</span>],
                ['Total Amount', <span className="font-black text-slate-900 text-lg" key="v7">{formatINR(modalRow.amount)}</span>],
                ['Status', <StatusBadge key="s" status={modalRow.status} />],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-4">
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">{k}</p>
                  <div className="text-sm">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all">Download PDF</button>
              <button className="flex-1 py-3 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 hover:shadow transition-all">Share via WhatsApp</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
