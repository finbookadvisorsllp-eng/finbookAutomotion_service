import DataTable from '../components/DataTable'
import { formatINR, topCustomers } from '../data/mockData'

export default function CreditLimit() {
  // Generate mock credit limit data for active customers
  const limitData = topCustomers.map(c => {
    // Mock arbitrary limit
    const limit = (Math.floor(c.sales / 50000) * 50000) + 100000
    const used = c.outstanding
    const available = limit - used
    const exceeded = used > limit ? used - limit : 0
    const risk = exceeded > 0 ? 'High Risk' : (used / limit > 0.8 ? 'Warning' : 'Good')
    
    return {
      ...c,
      limit,
      used,
      available,
      exceeded,
      risk
    }
  })

  const columns = [
    { key: 'name', label: 'Customer Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'limit', label: 'Credit Limit', align: 'right', sortable: true, render: v => formatINR(v) },
    { key: 'used', label: 'Credit Used', align: 'right', sortable: true, render: (v, r) => (
      <span className={r.exceeded > 0 ? 'text-red-500 dark:text-red-400 font-bold' : ''}>{formatINR(v)}</span>
    )},
    { key: 'available', label: 'Available', align: 'right', sortable: true, render: v => v >= 0 ? <span className="text-emerald-600 dark:text-[#B6FF00] font-semibold">{formatINR(v)}</span> : '-' },
    { key: 'exceeded', label: 'Exceeded By', align: 'right', sortable: true, render: v => v > 0 ? <span className="text-red-600 dark:text-red-400 font-black">{formatINR(v)}</span> : '-' },
    { key: 'risk', label: 'Status', render: v => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
        v === 'High Risk' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
        v === 'Warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
        'bg-emerald-100 dark:bg-[#B6FF00]/20 text-emerald-700 dark:text-[#B6FF00]'
      }`}>{v.toUpperCase()}</span>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Credit Limit Monitoring</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track customers exceeding their authorized credit limits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-5">
          <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Total Exceeded Amount</p>
          <p className="text-2xl font-black text-red-700 dark:text-red-400">{formatINR(limitData.reduce((acc, c) => acc + c.exceeded, 0))}</p>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-1">{limitData.filter(c => c.exceeded > 0).length} customers exceeded limit</p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={limitData}
        title="Credit Limit Utilization"
      />
    </div>
  )
}
