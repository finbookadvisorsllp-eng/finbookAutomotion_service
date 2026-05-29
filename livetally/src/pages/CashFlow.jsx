import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { cashFlowData, formatINR } from '../data/mockData'

const monthly = [
  { month:'Apr', inflow:3800000, outflow:3250000, net:550000, balance:2800000 },
  { month:'May', inflow:4100000, outflow:3450000, net:650000, balance:3450000 },
  { month:'Jun', inflow:3600000, outflow:3120000, net:480000, balance:3930000 },
  { month:'Jul', inflow:4400000, outflow:3650000, net:750000, balance:4680000 },
  { month:'Aug', inflow:4800000, outflow:3980000, net:820000, balance:5500000 },
  { month:'Sep', inflow:5100000, outflow:4220000, net:880000, balance:6380000 },
  { month:'Oct', inflow:4750000, outflow:3930000, net:820000, balance:7200000 },
  { month:'Nov', inflow:5300000, outflow:4380000, net:920000, balance:8120000 },
  { month:'Dec', inflow:5900000, outflow:4880000, net:1020000, balance:9140000 },
  { month:'Jan', inflow:5500000, outflow:4550000, net:950000, balance:10090000 },
  { month:'Feb', inflow:6000000, outflow:4960000, net:1040000, balance:11130000 },
  { month:'Mar', inflow:6300000, outflow:5200000, net:1100000, balance:12230000 },
]

const fmt = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-3 shadow-lg dark:shadow-[0_0_15px_rgba(182,255,0,0.15)] text-xs">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map(p => (
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
  const totalInflow  = monthly.reduce((a,m)=>a+m.inflow, 0)
  const totalOutflow = monthly.reduce((a,m)=>a+m.outflow, 0)
  const netCashFlow  = totalInflow - totalOutflow
  const closingBalance = monthly[monthly.length-1].balance

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Cash Flow Statement</h1>
          <p className="text-sm text-slate-400 mt-0.5">FY 2024-25 · Inflows, Outflows & Net Position</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">⬇ Export PDF</button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label:'Total Inflows',     value:formatINR(totalInflow),    bg:'bg-emerald-50 dark:bg-[#B6FF00]/10', border:'border-emerald-100 dark:border-[#B6FF00]/20', color:'text-emerald-700 dark:text-[#B6FF00]' },
          { label:'Total Outflows',    value:formatINR(totalOutflow),   bg:'bg-red-50 dark:bg-red-500/10',     border:'border-red-100 dark:border-red-500/20',     color:'text-red-600 dark:text-red-400' },
          { label:'Net Cash Flow',     value:formatINR(netCashFlow),    bg:'bg-blue-50 dark:bg-blue-500/10',    border:'border-blue-100 dark:border-blue-500/20',    color:'text-blue-700 dark:text-blue-400' },
          { label:'Closing Balance',   value:formatINR(closingBalance), bg:'bg-indigo-50 dark:bg-indigo-500/10',  border:'border-indigo-100 dark:border-indigo-500/20',  color:'text-indigo-700 dark:text-indigo-400' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4 transition-colors`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="glass-card p-5 mb-4">
        <h2 className="text-sm font-bold text-slate-800 mb-4">Monthly Cash Flow — Inflow vs Outflow</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={fmt} />
            <Legend iconType="circle" iconSize={8} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
            <Bar dataKey="inflow"  fill="#10b981" radius={[3,3,0,0]} name="Cash In" />
            <Bar dataKey="outflow" fill="#ef4444" radius={[3,3,0,0]} name="Cash Out" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Net Cash + Running Balance */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Net Cash Flow & Cumulative Balance</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <Tooltip content={fmt}/>
              <Legend iconType="circle" iconSize={8} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
              <Bar dataKey="net" fill="#6366f1" radius={[3,3,0,0]} name="Net Cash" />
              <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Running Balance" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Operating CF Breakdown */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Cash Position Overview</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cashFlowData} layout="vertical" margin={{left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="month" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false} width={30}/>
              <Tooltip content={fmt}/>
              <Legend iconType="circle" iconSize={8} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
              <Bar dataKey="operating" fill="#10b981" radius={[0,3,3,0]} name="Operating" />
              <Bar dataKey="net"       fill="#2563eb" radius={[0,3,3,0]} name="Net" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Monthly Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Month','Cash Inflow','Cash Outflow','Net Cash Flow','Closing Balance'].map(h=>(
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthly.map((row,i)=>(
                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-800">{row.month} '25</td>
                  <td className="px-5 py-3 text-emerald-600 font-semibold">{formatINR(row.inflow)}</td>
                  <td className="px-5 py-3 text-red-500 font-semibold">{formatINR(row.outflow)}</td>
                  <td className={`px-5 py-3 font-bold ${row.net>=0?'text-blue-700':'text-red-600'}`}>{formatINR(row.net)}</td>
                  <td className="px-5 py-3 font-bold text-indigo-700">{formatINR(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
