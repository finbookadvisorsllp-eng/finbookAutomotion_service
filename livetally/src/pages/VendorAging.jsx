import { payablesAging, formatINR, topVendors } from '../data/mockData'
import DataTable from '../components/DataTable'

export default function VendorAging() {
  const columns = [
    { key: 'name', label: 'Vendor Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'city', label: 'City' },
    { key: 'amount0', label: '0-30 Days', align: 'right', render: v => v > 0 ? formatINR(v) : '-' },
    { key: 'amount31', label: '31-60 Days', align: 'right', render: v => v > 0 ? formatINR(v) : '-' },
    { key: 'amount61', label: '61-90 Days', align: 'right', render: v => v > 0 ? formatINR(v) : '-' },
    { key: 'amount90', label: '> 90 Days', align: 'right', render: v => v > 0 ? <span className="text-red-500 font-bold">{formatINR(v)}</span> : '-' },
    { key: 'outstanding', label: 'Total Payable', align: 'right', sortable: true, render: v => <span className="font-black text-slate-800">{formatINR(v)}</span> },
  ]

  // Mock mapping aging to top vendors
  const vendorsWithAging = topVendors.filter(v => v.outstanding > 0).map(v => {
    let remain = v.outstanding
    const a0 = Math.min(remain, Math.floor(Math.random() * remain))
    remain -= a0
    const a31 = Math.min(remain, Math.floor(Math.random() * remain))
    remain -= a31
    const a61 = Math.min(remain, Math.floor(Math.random() * remain))
    remain -= a61
    const a90 = remain
    return { ...v, amount0: a0, amount31: a31, amount61: a61, amount90: a90 }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Vendor Aging</h1>
          <p className="text-sm text-slate-400 mt-0.5">Time-based analysis of outstanding payables</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {payablesAging.map(bucket => (
          <div key={bucket.bucket} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: bucket.color }} />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{bucket.bucket}</p>
            <p className="text-2xl font-black text-slate-900">{formatINR(bucket.amount)}</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">{bucket.count} bills · {bucket.pct}% of total</p>
          </div>
        ))}
      </div>

      <DataTable 
        columns={columns}
        data={vendorsWithAging}
        title="Vendor Aging Details"
      />
    </div>
  )
}
