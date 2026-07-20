import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Download, ChevronRight, ChevronDown, AlertTriangle, ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, Banknote } from 'lucide-react'
import { formatINR } from '../data/mockData'
import { useDateRange } from '../context/DateContext'
import { useApi } from '../hooks/useApi'
import DateRangePicker from '../components/common/DateRangePicker'
import { getCashFlow } from '../api'

const ACTIVITY_COLOR = { Operating: '#10b981', Investing: '#f59e0b', Financing: '#6366f1' }

const fyBounds = (fy) => {
  const y = parseInt(fy, 10)
  return Number.isFinite(y) ? { fromDate: `${y}-04-01`, toDate: `${y + 1}-03-31`, preset: 'custom' } : null
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function CashFlow() {
  const navigate = useNavigate()
  const { fy } = useDateRange()
  const [range, setRange] = useState(null)        // null => full FY
  const [expanded, setExpanded] = useState(new Set())

  const params = range ? { dateFilter: 'custom', fromDate: range.fromDate, toDate: range.toDate } : {}
  const { data: cf, loading, error } = useApi(() => getCashFlow(fy, params), [fy, range], { skip: !fy })

  const summary = cf?.summary || { opening: 0, inflow: 0, outflow: 0, net: 0, closing: 0 }
  const activities = cf?.activities || []
  const series = cf?.series || []
  const pickerValue = range || fyBounds(fy) || { fromDate: '', toDate: '', preset: 'custom' }

  const toggle = (id) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const drillLedger = (name) => navigate(`/reports/pl?ledger=${encodeURIComponent(name)}&from=cash-flow`)

  const activityChart = activities.map((a) => ({ name: a.name, inflow: a.inflow, outflow: a.outflow, color: ACTIVITY_COLOR[a.name] || '#64748b' }))

  const exportCSV = () => {
    const lines = [['Activity', 'Group', 'Ledger', 'Inflow', 'Outflow', 'Net'].join(',')]
    activities.forEach((a) => a.groups.forEach((g) => g.ledgers.forEach((l) =>
      lines.push([a.name, g.name, l.name, l.inflow, l.outflow, l.net].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')))))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = `cash-flow_${fy}.csv`; el.click(); URL.revokeObjectURL(el.href)
  }

  const cards = [
    { label: 'Opening Balance', value: summary.opening, icon: <Wallet size={16} className="text-slate-500" />, color: 'text-slate-800', ring: 'bg-slate-100' },
    { label: 'Total Inflow', value: summary.inflow, icon: <ArrowDownLeft size={16} className="text-emerald-600" />, color: 'text-emerald-700', ring: 'bg-emerald-50' },
    { label: 'Total Outflow', value: summary.outflow, icon: <ArrowUpRight size={16} className="text-red-600" />, color: 'text-red-600', ring: 'bg-red-50' },
    { label: 'Net Cash Flow', value: summary.net, icon: <TrendingUp size={16} className="text-blue-600" />, color: summary.net >= 0 ? 'text-blue-700' : 'text-red-600', ring: 'bg-blue-50' },
    { label: 'Closing Balance', value: summary.closing, icon: <Banknote size={16} className="text-indigo-600" />, color: 'text-indigo-700', ring: 'bg-indigo-50' },
  ]

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white px-4 py-3 shadow-sm rounded-2xl">
        <div>
          <h1 className="text-xl font-black text-slate-900">Cash Flow Statement</h1>
          <p className="text-sm text-slate-400 mt-0.5">{cf?.method || 'Direct Method'} · every figure traces to a voucher</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={pickerValue} onChange={(v) => setRange(v)} />
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 shadow-sm"><Download size={15} /> Export</button>
        </div>
      </div>

      {cf && cf.reconciled === false && (
        <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium flex items-center gap-2">
          <AlertTriangle size={14} /> Cash flow does not tie out to the cash/bank closing balance — investigate.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{c.label}</p>
              <p className={`text-lg font-black truncate ${c.color}`}>{formatINR(c.value)}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${c.ring} flex items-center justify-center shrink-0`}>{c.icon}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="glass-card py-20 text-center text-slate-500 font-medium animate-pulse">Loading cash flow…</div>
      ) : error ? (
        <div className="glass-card py-20 text-center text-red-500 font-medium">{error.message}</div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Monthly Inflow vs Outflow</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={false} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
                  <Bar dataKey="inflow" fill="#10b981" radius={[3, 3, 0, 0]} name="Inflow" />
                  <Bar dataKey="outflow" fill="#ef4444" radius={[3, 3, 0, 0]} name="Outflow" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Net Cash Flow &amp; Running Balance</h2>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  {/* left axis: monthly Net (small) · right axis: cumulative Closing (large) */}
                  <YAxis yAxisId="left" tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={false} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
                  <Bar yAxisId="left" dataKey="net" name="Net (monthly)" radius={[3, 3, 0, 0]} maxBarSize={26}>
                    {series.map((s, i) => <Cell key={i} fill={s.net >= 0 ? '#6366f1' : '#ef4444'} />)}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="closing" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 2 }} name="Closing Balance" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity breakdown tree (drill-down) */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-bold text-slate-800">Cash Flow by Activity</h2>
              <div className="w-40 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChart} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide /><YAxis type="category" dataKey="name" hide />
                    <Bar dataKey="net" radius={[0, 3, 3, 0]} barSize={8}>{activityChart.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                    <th className="py-2.5 px-4">Particulars</th>
                    <th className="py-2.5 px-4 text-right">Inflow</th>
                    <th className="py-2.5 px-4 text-right">Outflow</th>
                    <th className="py-2.5 px-4 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-[12px] text-slate-500">No cash movements in this period.</td></tr>
                  ) : activities.map((a) => {
                    const aOpen = expanded.has(a.name)
                    return [
                      <tr key={a.name} className="cursor-pointer hover:bg-slate-50 font-bold" onClick={() => toggle(a.name)}>
                        <td className="py-2 px-4 text-[13px] text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLOR[a.name] || '#64748b' }} />
                            {aOpen ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
                            {a.name} Activities
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right text-[13px] text-emerald-600 tabular-nums">{a.inflow ? formatINR(a.inflow) : '—'}</td>
                        <td className="py-2 px-4 text-right text-[13px] text-red-500 tabular-nums">{a.outflow ? formatINR(a.outflow) : '—'}</td>
                        <td className={`py-2 px-4 text-right text-[13px] font-black tabular-nums ${a.net >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatINR(a.net)}</td>
                      </tr>,
                      ...(aOpen ? a.groups.flatMap((g) => {
                        const gKey = `${a.name}/${g.name}`
                        const gOpen = expanded.has(gKey)
                        return [
                          <tr key={gKey} className="cursor-pointer hover:bg-slate-50/70" onClick={() => toggle(gKey)}>
                            <td className="py-1.5 px-4 text-[12px] font-semibold text-slate-700" style={{ paddingLeft: 44 }}>
                              <span className="inline-flex items-center gap-1.5">{gOpen ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}{g.name}</span>
                            </td>
                            <td className="py-1.5 px-4 text-right text-[12px] text-slate-600 tabular-nums">{g.inflow ? formatINR(g.inflow) : '—'}</td>
                            <td className="py-1.5 px-4 text-right text-[12px] text-slate-600 tabular-nums">{g.outflow ? formatINR(g.outflow) : '—'}</td>
                            <td className="py-1.5 px-4 text-right text-[12px] font-bold text-slate-700 tabular-nums">{formatINR(g.net)}</td>
                          </tr>,
                          ...(gOpen ? g.ledgers.map((l) => (
                            <tr key={`${gKey}/${l.id}`} className="hover:bg-slate-50/60">
                              <td className="py-1.5 px-4 text-[12px] text-blue-600 hover:underline cursor-pointer" style={{ paddingLeft: 70 }} onClick={() => drillLedger(l.name)}>{l.name}</td>
                              <td className="py-1.5 px-4 text-right text-[12px] text-slate-500 tabular-nums">{l.inflow ? formatINR(l.inflow) : '—'}</td>
                              <td className="py-1.5 px-4 text-right text-[12px] text-slate-500 tabular-nums">{l.outflow ? formatINR(l.outflow) : '—'}</td>
                              <td className="py-1.5 px-4 text-right text-[12px] text-slate-600 tabular-nums">{formatINR(l.net)}</td>
                            </tr>
                          )) : []),
                        ]
                      }) : []),
                    ]
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-[13px]">
                    <td className="py-2.5 px-4 text-slate-900">Net Cash Flow</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatINR(summary.inflow)}</td>
                    <td className="py-2.5 px-4 text-right text-red-500 tabular-nums">{formatINR(summary.outflow)}</td>
                    <td className={`py-2.5 px-4 text-right tabular-nums ${summary.net >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatINR(summary.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Monthly summary table */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">Monthly Summary</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {['Month', 'Inflow', 'Outflow', 'Net', 'Closing Balance'].map((h) => <th key={h} className="px-5 py-3 text-left whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {series.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 font-semibold text-slate-800">{r.month}</td>
                      <td className="px-5 py-2.5 text-emerald-600 font-semibold tabular-nums">{formatINR(r.inflow)}</td>
                      <td className="px-5 py-2.5 text-red-500 font-semibold tabular-nums">{formatINR(r.outflow)}</td>
                      <td className={`px-5 py-2.5 font-bold tabular-nums ${r.net >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatINR(r.net)}</td>
                      <td className="px-5 py-2.5 font-bold text-indigo-700 tabular-nums">{formatINR(r.closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
