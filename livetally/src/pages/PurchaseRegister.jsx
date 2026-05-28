import DataTable from '../components/DataTable'
import { purchaseData, formatINR } from '../data/mockData'

const StatusBadge = ({ status }) => {
  const s = { paid:'bg-emerald-100 text-emerald-700', pending:'bg-amber-100 text-amber-700', overdue:'bg-red-100 text-red-700' }
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s[status]??'bg-slate-100 text-slate-600'}`}>{status}</span>
}

const columns = [
  { key: 'id',      label: 'Bill #',        sortable: true, render: v => <span className="text-purple-600 font-mono text-[12px] font-semibold">{v}</span> },
  { key: 'date',    label: 'Date',          sortable: true, render: v => <span className="text-slate-400 text-[12px]">{v}</span> },
  { key: 'party',   label: 'Vendor',        sortable: true, render: v => <span className="font-semibold text-slate-800">{v}</span> },
  { key: 'items',   label: 'Items',         sortable: true, align: 'right' },
  { key: 'taxable', label: 'Taxable',       sortable: true, align: 'right', render: v => formatINR(v) },
  { key: 'gst',     label: 'GST',           sortable: true, align: 'right', render: v => formatINR(v) },
  { key: 'total',   label: 'Bill Total',    sortable: true, align: 'right', render: v => <span className="font-bold text-slate-800">{formatINR(v)}</span> },
  { key: 'dueDate', label: 'Due Date',      sortable: true, render: (v, row) => v ? <span className={row.status==='overdue'?'text-red-500 font-semibold':'text-slate-400'}>{v}</span> : '—' },
  { key: 'status',  label: 'Status',        sortable: true, render: v => <StatusBadge status={v} /> },
]

export default function PurchaseRegister() {
  const total = purchaseData.reduce((a,p)=>a+p.total,0)
  const gst   = purchaseData.reduce((a,p)=>a+p.gst,0)
  const paid  = purchaseData.filter(p=>p.status==='paid').reduce((a,p)=>a+p.total,0)

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Purchase Register</h1>
          <p className="text-sm text-slate-400 mt-0.5">All purchase bills · FY 2024-25</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label:'Total Purchase', value:formatINR(total), bg:'bg-purple-50', border:'border-purple-100', color:'text-purple-700' },
          { label:'ITC Available',  value:formatINR(gst),   bg:'bg-blue-50',   border:'border-blue-100',   color:'text-blue-700' },
          { label:'Paid to Date',   value:formatINR(paid),  bg:'bg-emerald-50',border:'border-emerald-100',color:'text-emerald-700' },
          { label:'Total Bills',    value:purchaseData.length, bg:'bg-slate-50',border:'border-slate-200',color:'text-slate-700' },
        ].map(s=>(
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={purchaseData}
        pageSize={10}
        rowClassName={row=>row.status==='overdue'?'bg-red-50/40 hover:bg-red-50/70':'hover:bg-slate-50/80'}
      />
    </div>
  )
}
