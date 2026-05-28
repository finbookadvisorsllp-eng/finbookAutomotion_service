import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { monthlyTrend, plData, expenseBreakdown, formatINR } from '../data/mockData'

const totalIncome = Object.values(plData.income).reduce((a,b) => a+b, 0)
const totalDirect = Object.values(plData.directExpenses).reduce((a,b) => a+b, 0)
const totalIndirect = Object.values(plData.indirectExpenses).reduce((a,b) => a+b, 0)
const grossProfit = totalIncome - totalDirect
const netProfit = grossProfit - totalIndirect
const gpMargin = ((grossProfit / totalIncome) * 100).toFixed(1)
const npMargin = ((netProfit / totalIncome) * 100).toFixed(1)

export default function ProfitLoss() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Profit & Loss</h1>
          <p className="text-sm text-slate-400 mt-0.5">FY 2024-25 · Apr 2024 — Mar 2025</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export PDF</button>
          <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">📊 Excel</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: 'Total Income',   value: totalIncome,  color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
          { label: 'Gross Profit',   value: grossProfit,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', sub: `GP Margin: ${gpMargin}%` },
          { label: 'Total Expenses', value: totalDirect+totalIndirect, color:'text-red-500', bg:'bg-red-50', border:'border-red-100' },
          { label: 'Net Profit',     value: netProfit,    color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100', sub: `NP Margin: ${npMargin}%` },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{formatINR(s.value)}</p>
            {s.sub && <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Monthly Profit Trend</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="profGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => formatINR(v)} />
              <Area type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2.5} fill="url(#profGrad2)" name="Net Profit" />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={1.5} fill="none" strokeDasharray="4 2" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Expense Breakdown</h2>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={expenseBreakdown} dataKey="value" innerRadius={35} outerRadius={62} paddingAngle={2}>
                {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={v => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {expenseBreakdown.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
                <span className="text-xs text-slate-500 flex-1">{e.name}</span>
                <span className="text-xs font-bold text-slate-700">{formatINR(e.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* P&L Statement */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Profit & Loss Statement</h2>
        </div>
        <div className="p-5 space-y-0">
          {/* Income */}
          <div className="mb-4">
            <div className="flex items-center justify-between py-2.5 border-b-2 border-slate-200">
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Income</span>
            </div>
            {Object.entries(plData.income).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 hover:bg-slate-50/60 px-2 rounded-lg transition-colors">
                <span className="text-sm text-slate-600">{k}</span>
                <span className="text-sm font-semibold text-slate-800">{formatINR(v)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5 bg-blue-50 px-3 rounded-xl mt-2">
              <span className="text-sm font-bold text-blue-700">Total Income</span>
              <span className="text-sm font-extrabold text-blue-700">{formatINR(totalIncome)}</span>
            </div>
          </div>

          {/* Direct Expenses */}
          <div className="mb-4">
            <div className="flex items-center justify-between py-2.5 border-b-2 border-slate-200">
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Direct Expenses (COGS)</span>
            </div>
            {Object.entries(plData.directExpenses).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 hover:bg-slate-50/60 px-2 rounded-lg transition-colors">
                <span className="text-sm text-slate-600">{k}</span>
                <span className="text-sm font-semibold text-red-600">{formatINR(v)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5 bg-emerald-50 px-3 rounded-xl mt-2">
              <span className="text-sm font-bold text-emerald-700">Gross Profit ({gpMargin}%)</span>
              <span className="text-sm font-extrabold text-emerald-700">{formatINR(grossProfit)}</span>
            </div>
          </div>

          {/* Indirect Expenses */}
          <div className="mb-4">
            <div className="flex items-center justify-between py-2.5 border-b-2 border-slate-200">
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Indirect Expenses</span>
            </div>
            {Object.entries(plData.indirectExpenses).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 hover:bg-slate-50/60 px-2 rounded-lg transition-colors">
                <span className="text-sm text-slate-600">{k}</span>
                <span className="text-sm font-semibold text-red-600">{formatINR(v)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3 bg-indigo-50 px-3 rounded-xl mt-2">
              <span className="text-sm font-bold text-indigo-700">Net Profit ({npMargin}%)</span>
              <span className="text-lg font-extrabold text-indigo-700">{formatINR(netProfit)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
