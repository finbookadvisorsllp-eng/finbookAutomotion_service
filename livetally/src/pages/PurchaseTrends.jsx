import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { monthlyTrend, expenseBreakdown, formatINR } from '../data/mockData'

export default function PurchaseTrends() {
  const COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#94a3b8']

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Purchase Trends</h1>
          <p className="text-sm text-slate-400 mt-0.5">Analyze your procurement patterns and vendor spends.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-500/20">
          <p className="text-xs font-bold text-purple-100 uppercase tracking-wider mb-1">Total Purchases (YTD)</p>
          <p className="text-3xl font-black">{formatINR(3150000)}</p>
          <p className="text-sm font-semibold text-purple-100 mt-2">↑ 9.0% vs last year</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Highest Spend Month</p>
          <p className="text-2xl font-black text-slate-800">March 2025</p>
          <p className="text-sm font-bold text-red-500 mt-1">{formatINR(4400000)} Expense</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Top Vendor Spend</p>
          <p className="text-2xl font-black text-slate-800">HUL Ltd</p>
          <p className="text-sm font-bold text-purple-600 mt-1">{formatINR(680000)} Spend</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Monthly Purchase Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="colorPurch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => formatINR(v)} cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}} />
              <Area type="monotone" dataKey="expense" stroke="#9333ea" strokeWidth={3} fill="url(#colorPurch)" name="Purchases" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Spend by Category</h2>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expenseBreakdown} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full mt-4 space-y-2">
              {expenseBreakdown.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}} />
                    <span className="font-semibold text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{formatINR(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
