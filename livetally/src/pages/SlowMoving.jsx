import DataTable from '../components/DataTable'
import { stockItems, formatINR } from '../data/mockData'
import { Clock, AlertTriangle } from 'lucide-react'

export default function SlowMoving() {
  // Mock slow moving items logic
  const slowItems = stockItems.map(item => {
    // Generate random last sale date between 60 to 180 days ago
    const daysAgo = Math.floor(Math.random() * 120) + 60;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    return {
      ...item,
      lastSaleDate: date.toISOString().split('T')[0],
      agingDays: daysAgo,
      action: daysAgo > 120 ? 'Discount & Clear' : 'Run Promotion'
    }
  }).filter(item => item.agingDays > 60).sort((a,b) => b.agingDays - a.agingDays)

  const columns = [
    { key: 'name', label: 'Item Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'group', label: 'Group' },
    { key: 'closing', label: 'Stock Qty', align: 'right', sortable: true },
    { key: 'value', label: 'Stock Value', align: 'right', sortable: true, render: v => formatINR(v) },
    { key: 'agingDays', label: 'Aging (Days)', align: 'right', sortable: true, render: v => (
      <span className={`font-bold ${v > 120 ? 'text-red-500' : 'text-amber-500'}`}>{v} Days</span>
    )},
    { key: 'lastSaleDate', label: 'Last Sale Date' },
    { key: 'action', label: 'Suggested Action', render: v => (
      <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{v}</span>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Slow Moving Items</h1>
          <p className="text-sm text-slate-400 mt-0.5">Identify inventory holding up capital.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 col-span-1 md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Dead Stock Value</p>
              <p className="text-2xl font-black text-amber-800">{formatINR(slowItems.reduce((acc, i) => acc + i.value, 0))}</p>
            </div>
          </div>
          <p className="text-sm font-medium text-amber-700 mt-2">{slowItems.length} items haven't moved in 60+ days.</p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={slowItems}
        title="Dead & Slow Inventory"
      />
    </div>
  )
}
