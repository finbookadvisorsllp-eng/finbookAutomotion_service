import DataTable from '../components/DataTable'
import { stockItems, formatINR } from '../data/mockData'

const StockStatus = ({ status }) => {
  const s = { ok:'bg-emerald-100 text-emerald-700', warning:'bg-amber-100 text-amber-700', critical:'bg-red-100 text-red-700' }
  const labels = { ok:'In Stock', warning:'Low Stock', critical:'Critical' }
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s[status]??s.ok}`}>{labels[status]??status}</span>
}

const columns = [
  { key:'name',    label:'Item Name',    sortable:true, render:v=><span className="font-semibold text-slate-800">{v}</span> },
  { key:'group',   label:'Category',     sortable:true, render:v=><span className="text-slate-400">{v}</span> },
  { key:'unit',    label:'Unit',         sortable:true },
  { key:'opening', label:'Opening',      sortable:true, align:'right' },
  { key:'in',      label:'In',           sortable:true, align:'right', render:v=><span className="text-emerald-600 font-medium">{v}</span> },
  { key:'out',     label:'Out',          sortable:true, align:'right', render:v=><span className="text-red-500 font-medium">{v}</span> },
  { key:'closing', label:'Closing Stock',sortable:true, align:'right', render:(v,row)=>(
    <span className={row.status==='critical'?'text-red-600 font-bold':row.status==='warning'?'text-amber-600 font-semibold':'font-semibold text-slate-800'}>{v}</span>
  )},
  { key:'value',   label:'Stock Value',  sortable:true, align:'right', render:v=><span className="font-bold">{formatINR(v)}</span> },
  { key:'status',  label:'Status',       sortable:true, render:v=><StockStatus status={v} /> },
]

export default function Inventory() {
  const totalValue = stockItems.reduce((a,s)=>a+s.value,0)
  const criticalCount = stockItems.filter(s=>s.status==='critical').length
  const lowCount = stockItems.filter(s=>s.status==='warning').length

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Stock Summary</h1>
          <p className="text-sm text-slate-400 mt-0.5">Inventory as on 27 May 2025</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label:'Total Stock Value', value:formatINR(totalValue), bg:'bg-blue-50',   border:'border-blue-100',   color:'text-blue-700' },
          { label:'Total Items',       value:stockItems.length,     bg:'bg-slate-50',  border:'border-slate-200',  color:'text-slate-700' },
          { label:'Low Stock Items',   value:lowCount,              bg:'bg-amber-50',  border:'border-amber-100',  color:'text-amber-700' },
          { label:'Critical Stock',    value:criticalCount,         bg:'bg-red-50',    border:'border-red-100',    color:'text-red-600' },
        ].map(s=>(
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {criticalCount > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <span className="text-xl">🚨</span>
          <div>
            <p className="text-sm font-bold text-red-700">Stock Alert — {criticalCount} items critically low</p>
            <p className="text-xs text-red-600 mt-0.5">
              {stockItems.filter(s=>s.status==='critical').map(s=>s.name).join(', ')} are below reorder level. Place purchase orders immediately.
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={stockItems}
        pageSize={10}
        rowClassName={row=>row.status==='critical'?'bg-red-50/40 hover:bg-red-50/70':row.status==='warning'?'bg-amber-50/30 hover:bg-amber-50/50':'hover:bg-slate-50/80'}
      />
    </div>
  )
}
