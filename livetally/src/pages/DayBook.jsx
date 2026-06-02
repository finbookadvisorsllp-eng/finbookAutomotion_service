import { useState } from 'react'
import DataTable from '../components/DataTable'
import { recentVouchers, formatINR } from '../data/mockData'

import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

export default function DayBook() {
  const [date, setDate] = useState('02/06/2026 - 02/06/2026')

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
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 rounded-lg mb-5 flex-wrap gap-3 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight">Day Book</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
             <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-l-lg transition-colors border-r border-slate-200 dark:border-slate-700">
                <ChevronLeft size={14} />
             </button>
             <button className="px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <Calendar size={14} className="text-slate-500" />
                {date}
             </button>
             <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-r-lg transition-colors border-l border-slate-200 dark:border-slate-700">
                <ChevronRight size={14} />
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Payments</p>
          <p className="text-lg font-black text-red-600 dark:text-red-400">{formatINR(totalPayments)}</p>
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
