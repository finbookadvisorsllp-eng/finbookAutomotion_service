import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts'
import { monthlyTrend, expenseBreakdown, formatINR, budgetVsActual } from '../data/mockData'
import DataTable from '../components/DataTable'

export default function ExpenseTrends() {
  const columns = [
    { key: 'category', label: 'Expense Head', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'budget', label: 'Budgeted Amount', align: 'right', sortable: true, render: v => formatINR(v) },
    { key: 'actual', label: 'Actual Spent', align: 'right', sortable: true, render: v => <span className="font-black text-slate-800 dark:text-slate-200">{formatINR(v)}</span> },
    { key: 'variance', label: 'Variance', align: 'right', sortable: true, render: v => (
      <span className={`font-bold ${v > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-[#B6FF00]'}`}>{v > 0 ? `+${formatINR(v)}` : formatINR(v)}</span>
    )},
  ]

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Expense Analysis</h1>
          <p className="text-sm text-slate-400 mt-0.5">Detailed breakdown of indirect expenses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Monthly Expense Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => formatINR(v)} cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fill="url(#colorExp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Top Expense Categories</h2>
          <div className="space-y-4">
            {expenseBreakdown.sort((a,b)=>b.value-a.value).slice(0, 5).map((exp, i) => (
              <div key={exp.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-600">{exp.name}</span>
                  <span className="text-sm font-black text-slate-800">{formatINR(exp.value)}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(exp.value / 3150000) * 100}%`, backgroundColor: exp.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={budgetVsActual.filter(b => b.category !== 'Sales Revenue' && b.category !== 'Gross Profit' && b.category !== 'Net Profit')}
        title="Expense Budget vs Actual"
      />
    </div>
  )
}
