import DataTable from '../components/DataTable'
import { topVendors, formatINR } from '../data/mockData'

const columns = [
  { key:'name', label:'Vendor', sortable:true, render:v=><span className="font-semibold text-slate-800">{v}</span> },
  { key:'city', label:'City', sortable:true },
  { key:'purchase', label:'Total Purchase', sortable:true, align:'right', render:v=><span className="font-bold text-purple-700">{formatINR(v)}</span> },
  { key:'outstanding', label:'Outstanding', sortable:true, align:'right', render:(v,row)=>(
    <span className={v>0?(row.status==='overdue'?'text-red-600 font-bold':'text-amber-600 font-semibold'):'text-emerald-600 font-semibold'}>
      {v>0?formatINR(v):'✓ Paid'}
    </span>
  )},
  { key:'dueDate', label:'Due Date', sortable:true, render:(v,row)=>v?<span className={row.status==='overdue'?'text-red-500 font-semibold':'text-slate-400'}>{v}</span>:'—' },
  { key:'status', label:'Status', sortable:true, render:v=>{
    const s={active:'bg-blue-100 text-blue-700',overdue:'bg-red-100 text-red-700',paid:'bg-emerald-100 text-emerald-700'}
    return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s[v]??s.active}`}>{v}</span>
  }},
]

export default function Vendors() {
  const totalPurchase = topVendors.reduce((a,v)=>a+v.purchase,0)
  const totalOutstanding = topVendors.reduce((a,v)=>a+v.outstanding,0)
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Vendor Analysis</h1>
          <p className="text-sm text-slate-400 mt-0.5">Purchase & payable performance</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          {label:'Total Vendors',value:topVendors.length,bg:'bg-slate-50',border:'border-slate-200',color:'text-slate-700'},
          {label:'Total Purchase',value:formatINR(totalPurchase),bg:'bg-purple-50',border:'border-purple-100',color:'text-purple-700'},
          {label:'Total Payable',value:formatINR(totalOutstanding),bg:'bg-red-50',border:'border-red-100',color:'text-red-600'},
          {label:'Overdue',value:topVendors.filter(v=>v.status==='overdue').length,bg:'bg-orange-50',border:'border-orange-100',color:'text-orange-700'},
        ].map(s=>(
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <DataTable columns={columns} data={topVendors} rowClassName={row=>row.status==='overdue'?'bg-red-50/40 hover:bg-red-50/70':'hover:bg-slate-50/80'} />
    </div>
  )
}
