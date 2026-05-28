import { useState } from 'react'
import DataTable from '../components/DataTable'
import { recentVouchers, formatINR } from '../data/mockData'

export default function DayBook() {
  const [date, setDate] = useState('2025-05-27')

  // Filter vouchers by selected date (mock logic: just show all for the demo, or filter if exactly matches)
  // For the sake of the mock having enough data, we'll just show all recentVouchers and pretend they are for this day/week.
  const displayVouchers = recentVouchers

  const totalSales = displayVouchers.filter(v => v.type === 'Sales Invoice').reduce((acc, v) => acc + v.amount, 0)
  const totalPurchase = displayVouchers.filter(v => v.type === 'Purchase Invoice').reduce((acc, v) => acc + v.amount, 0)
  const totalReceipts = displayVouchers.filter(v => v.type === 'Receipt').reduce((acc, v) => acc + v.amount, 0)
  const totalPayments = displayVouchers.filter(v => v.type === 'Payment').reduce((acc, v) => acc + v.amount, 0)

  const columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'id', label: 'Voucher No.' },
    { key: 'type', label: 'Voucher Type', render: v => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
        v.includes('Sales') ? 'bg-blue-100 text-blue-700' :
        v.includes('Purchase') ? 'bg-purple-100 text-purple-700' :
        v.includes('Receipt') ? 'bg-emerald-100 text-emerald-700' :
        v.includes('Payment') ? 'bg-red-100 text-red-700' :
        'bg-slate-100 text-slate-700'
      }`}>{v}</span>
    )},
    { key: 'party', label: 'Particulars' },
    { key: 'amount', label: 'Inward Amount', align: 'right', render: (v, r) => ['Sales Invoice', 'Receipt'].includes(r.type) ? formatINR(v) : '-' },
    { key: 'amount', label: 'Outward Amount', align: 'right', render: (v, r) => ['Purchase Invoice', 'Payment'].includes(r.type) ? formatINR(v) : '-' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Day Book</h1>
          <p className="text-sm text-slate-400 mt-0.5">Daily transaction register</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Sales</p>
          <p className="text-lg font-black text-blue-600">{formatINR(totalSales)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Purchase</p>
          <p className="text-lg font-black text-purple-600">{formatINR(totalPurchase)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Receipts</p>
          <p className="text-lg font-black text-emerald-600">{formatINR(totalReceipts)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Payments</p>
          <p className="text-lg font-black text-red-600">{formatINR(totalPayments)}</p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={displayVouchers}
        title="Transactions"
        pageSize={15}
      />
    </div>
  )
}
