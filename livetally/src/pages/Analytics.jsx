import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import { monthlyTrend, budgetVsActual, cashFlowData, formatINR } from '../data/mockData'

const tooltipFmt = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 capitalize">{p.name}:</span>
          <span className="font-bold text-slate-800">{typeof p.value === 'number' && p.value > 1000 ? formatINR(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Analytics & Trends</h1>
          <p className="text-sm text-slate-400 mt-0.5">Business performance insights · FY 2024-25</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export Report</button>
      </div>

      {/* Revenue Trend */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Revenue, Expense & Profit Trend</h2>
            <p className="text-xs text-slate-400">Monthly · FY 2024-25</p>
          </div>
          <div className="flex gap-2">
            {[['Revenue','#2563eb'],['Expense','#ef4444'],['Profit','#10b981']].map(([k,c])=>(
              <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full" style={{background:c}}/>{k}
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {[['rev','#2563eb'],['exp','#ef4444'],['prof','#10b981']].map(([id,color])=>(
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
            <Tooltip content={tooltipFmt} />
            <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#rev)" name="Revenue" />
            <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#exp)" name="Expense" />
            <Area type="monotone" dataKey="profit"  stroke="#10b981" strokeWidth={2.5} fill="url(#prof)" name="Profit" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Budget vs Actual */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Budget vs Actual</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={budgetVsActual} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="category" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false} width={110}/>
              <Tooltip content={tooltipFmt}/>
              <Legend iconType="circle" iconSize={8} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
              <Bar dataKey="budget" fill="#e2e8f0" radius={[0,3,3,0]} name="Budget" />
              <Bar dataKey="actual" radius={[0,3,3,0]} name="Actual">
                {budgetVsActual.map((e,i)=>(
                  <Cell key={i} fill={e.actual <= e.budget ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cash Flow */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Cash Flow — Last 6 Months</h2>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <Tooltip content={tooltipFmt}/>
              <Legend iconType="circle" iconSize={8} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
              <Bar dataKey="operating" fill="#2563eb" radius={[3,3,0,0]} name="Operating" />
              <Bar dataKey="investing" fill="#e2e8f0" radius={[3,3,0,0]} name="Investing" />
              <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2.5} dot={{fill:'#10b981',r:4}} name="Net Cash" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Variance Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Budget Variance Analysis</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Category','Budget','Actual','Variance','Status'].map(h=>(
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budgetVsActual.map((row, i) => {
                const fav = row.variance <= 0
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-800">{row.category}</td>
                    <td className="px-5 py-3 text-slate-600">{formatINR(row.budget)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{formatINR(row.actual)}</td>
                    <td className={`px-5 py-3 font-bold ${fav?'text-emerald-600':'text-red-500'}`}>
                      {fav ? '' : '+'}{formatINR(Math.abs(row.variance))} {fav ? 'Saving' : 'Overshoot'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${fav?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                        {fav ? '✓ On Track' : '⚠ Over Budget'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
