import DataTable from '../components/DataTable'
import { topItems, formatINR } from '../data/mockData'
import { Zap, Rocket } from 'lucide-react'

export default function FastMoving() {
  const columns = [
    { key: 'name', label: 'Item Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'category', label: 'Category' },
    { key: 'qty', label: 'Quantity Sold', align: 'right', sortable: true, render: v => <span className="text-blue-600 font-bold">{v}</span> },
    { key: 'value', label: 'Revenue Generated', align: 'right', sortable: true, render: v => <span className="font-black text-slate-800">{formatINR(v)}</span> },
    { key: 'trend', label: 'Demand Trend', render: v => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
        v === 'up' ? 'bg-emerald-100 text-emerald-700' :
        v === 'stable' ? 'bg-blue-100 text-blue-700' :
        'bg-slate-100 text-slate-700'
      }`}>
        {v === 'up' ? '↗ High Demand' : '→ Stable Demand'}
      </span>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Fast Moving Items</h1>
          <p className="text-sm text-slate-400 mt-0.5">High-demand items driving your revenue.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 col-span-1 md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Top 10 Items Revenue</p>
              <p className="text-2xl font-black text-emerald-800">{formatINR(topItems.reduce((acc, i) => acc + i.value, 0))}</p>
            </div>
          </div>
          <p className="text-sm font-medium text-emerald-700 mt-2">These {topItems.length} items generate the bulk of your sales.</p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={topItems}
        title="Best Sellers Ranking"
      />
    </div>
  )
}
