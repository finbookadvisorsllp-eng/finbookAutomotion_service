import DataTable from '../components/DataTable'
import { purchaseData, formatINR } from '../data/mockData'
import { Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function BillsDue() {
  const pendingBills = purchaseData.filter(p => p.status !== 'paid')
  
  // Categorize
  const overdue = pendingBills.filter(p => p.status === 'overdue')
  const dueThisWeek = pendingBills.filter(p => p.status === 'pending')

  const columns = [
    { key: 'dueDate', label: 'Due Date', sortable: true, render: v => <span className="font-bold flex items-center gap-1.5"><Calendar size={14} className="text-slate-400"/> {v}</span> },
    { key: 'party', label: 'Vendor Name', sortable: true },
    { key: 'id', label: 'Ref No.' },
    { key: 'total', label: 'Amount Due', align: 'right', sortable: true, render: v => <span className="font-black text-slate-800">{formatINR(v)}</span> },
    { key: 'status', label: 'Status', render: v => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
        v === 'overdue' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 flex items-center w-fit gap-1' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center w-fit gap-1'
      }`}>
        {v === 'overdue' ? <AlertCircle size={10}/> : <CheckCircle2 size={10}/>} {v.toUpperCase()}
      </span>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Bills Due</h1>
          <p className="text-sm text-slate-400 mt-0.5">Upcoming payments and overdue bills.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Overdue Bills</p>
              <p className="text-3xl font-black text-red-700 dark:text-red-400">{formatINR(overdue.reduce((a,b)=>a+b.total, 0))}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
          </div>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-3">{overdue.length} bills require immediate attention.</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Due Next 7 Days</p>
              <p className="text-3xl font-black text-amber-700 dark:text-amber-400">{formatINR(dueThisWeek.reduce((a,b)=>a+b.total, 0))}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar size={20} />
            </div>
          </div>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-3">{dueThisWeek.length} bills approaching due date.</p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={pendingBills}
        title="Pending Payables"
        pageSize={10}
      />
    </div>
  )
}
