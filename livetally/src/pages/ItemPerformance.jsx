import DataTable from '../components/DataTable'
import { topItems, formatINR } from '../data/mockData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

export default function ItemPerformance() {
  const chartData = topItems.slice(0, 5).map(item => ({
    name: item.name.substring(0, 15) + '...',
    sales: item.value,
    profit: item.value * (item.margin / 100)
  }))

  const columns = [
    { key: 'name', label: 'Item Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'category', label: 'Category' },
    { key: 'qty', label: 'Qty Sold', align: 'right', sortable: true },
    { key: 'value', label: 'Sales Value', align: 'right', sortable: true, render: v => <span className="font-black text-slate-800">{formatINR(v)}</span> },
    { key: 'margin', label: 'Margin %', align: 'right', sortable: true, render: v => <span className="text-emerald-600 font-bold">{v}%</span> },
    { key: 'profit', label: 'Est. Profit', align: 'right', render: (v, r) => <span className="text-blue-600 font-bold">{formatINR(r.value * (r.margin/100))}</span> },
  ]

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Item-wise Performance</h1>
          <p className="text-sm text-slate-400 mt-0.5">Analyze profitability and sales volume per item.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4">Top 5 Items by Profitability</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => formatINR(v)} cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="sales" fill="#94a3b8" name="Sales Value" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="profit" fill="#10b981" name="Est. Profit" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={topItems}
        title="Item Performance Metrics"
      />
    </div>
  )
}
