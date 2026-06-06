import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie } from 'recharts'
import { monthlyTrend, topItems, topCustomers, formatINR } from '../data/mockData'

export default function SalesAnalysis() {
  const topCategories = topItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.value;
    return acc;
  }, {})
  
  const categoryData = Object.keys(topCategories).map(k => ({ name: k, value: topCategories[k] })).sort((a,b) => b.value - a.value).slice(0, 5)
  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899']

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Sales Analysis</h1>
          <p className="text-sm text-slate-400 mt-0.5">In-depth insights into your sales performance</p>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
          <p className="text-xs font-bold text-blue-100 uppercase tracking-wider mb-1">Total Sales (YTD)</p>
          <p className="text-3xl font-black">{formatINR(4820000)}</p>
          <p className="text-sm font-semibold text-blue-100 mt-2">↑ 16.1% vs last year</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Best Month</p>
          <p className="text-2xl font-black text-slate-800">March 2025</p>
          <p className="text-sm font-bold text-emerald-600 mt-1">{formatINR(5500000)} Revenue</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Top Selling Category</p>
          <p className="text-2xl font-black text-slate-800">FMCG</p>
          <p className="text-sm font-bold text-blue-600 mt-1">{formatINR(categoryData[0]?.value || 0)} Revenue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Trend Chart */}
        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Sales Trend (Month-wise)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid-stroke)" />
              <XAxis dataKey="month" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-card-border)', borderRadius: '0.75rem', color: 'var(--theme-text-main)' }} formatter={v => formatINR(v)} cursor={{stroke: 'var(--chart-grid-stroke)', strokeWidth: 1, strokeDasharray: '4 4'}} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Categories Pie */}
        <div className="glass-card p-5 flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Sales by Category</h2>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-card-border)', borderRadius: '0.75rem', color: 'var(--theme-text-main)' }} formatter={v => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full mt-4 space-y-2">
              {categoryData.map((d, i) => (
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
