import DataTable from '../components/DataTable'
import { stockItems } from '../data/mockData'
import { AlertOctagon, AlertTriangle } from 'lucide-react'

export default function StockAlerts() {
  const alerts = stockItems.filter(i => i.status !== 'ok').sort((a,b) => {
    if (a.status === 'critical' && b.status !== 'critical') return -1;
    if (a.status !== 'critical' && b.status === 'critical') return 1;
    return 0;
  })

  const criticalCount = alerts.filter(i => i.status === 'critical').length
  const warningCount = alerts.filter(i => i.status === 'warning').length

  const columns = [
    { key: 'name', label: 'Item Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'group', label: 'Group' },
    { key: 'closing', label: 'Current Stock', align: 'right', sortable: true, render: (v, r) => (
      <span className={`font-black ${r.status === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{v} {r.unit}</span>
    )},
    { key: 'reorder', label: 'Reorder Level', align: 'right', sortable: true, render: (v, r) => `${v} ${r.unit}` },
    { key: 'status', label: 'Alert Type', render: v => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
        v === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}>
        {v === 'critical' ? 'Out of Stock' : 'Low Stock'}
      </span>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Stock Alerts</h1>
          <p className="text-sm text-slate-400 mt-0.5">Inventory requiring immediate reordering.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertOctagon size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-0.5">Critical / Out of Stock</p>
            <p className="text-2xl font-black text-red-800">{criticalCount} Items</p>
          </div>
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-0.5">Low Stock Warning</p>
            <p className="text-2xl font-black text-amber-800">{warningCount} Items</p>
          </div>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={alerts}
        title="Items Below Reorder Level"
      />
    </div>
  )
}
