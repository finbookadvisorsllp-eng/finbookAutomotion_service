import { useState } from 'react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { topCustomers, formatINR } from '../data/mockData'

const columns = [
  { key:'id',   label:'#', render:(_,row,i)=><span className="text-slate-300 font-bold">#{row.id}</span> },
  { key:'name', label:'Customer', sortable:true, render:v=><span className="font-semibold text-slate-800">{v}</span> },
  { key:'city', label:'City', sortable:true },
  { key:'sales',label:'Total Sales', sortable:true, align:'right', render:v=><span className="font-bold text-blue-700">{formatINR(v)}</span> },
  { key:'outstanding', label:'Outstanding', sortable:true, align:'right', render:(v,row)=>(
    <span className={v>0?(row.status==='overdue'?'text-red-600 font-bold':'text-amber-600 font-semibold'):'text-emerald-600 font-semibold'}>
      {v>0?formatINR(v):'✓ Clear'}
    </span>
  )},
  { key:'lastTxn', label:'Last Txn', sortable:true, render:v=><span className="text-slate-400">{v}</span> },
  { key:'status', label:'Status', sortable:true, render:v=>{
    const s={active:'bg-emerald-100 text-emerald-700',overdue:'bg-red-100 text-red-700',warning:'bg-amber-100 text-amber-700'}
    return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s[v]??s.active}`}>{v}</span>
  }},
]

export default function Customers() {
  const [modal, setModal] = useState(null)
  const totalSales = topCustomers.reduce((a,c)=>a+c.sales,0)
  const totalOutstanding = topCustomers.reduce((a,c)=>a+c.outstanding,0)

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Top Customers</h1>
          <p className="text-sm text-slate-400 mt-0.5">Sales performance & outstanding</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          {label:'Total Customers',value:topCustomers.length,bg:'bg-slate-50',border:'border-slate-200',color:'text-slate-700'},
          {label:'Total Sales',value:formatINR(totalSales),bg:'bg-blue-50',border:'border-blue-100',color:'text-blue-700'},
          {label:'Outstanding',value:formatINR(totalOutstanding),bg:'bg-amber-50',border:'border-amber-100',color:'text-amber-700'},
          {label:'Overdue',value:topCustomers.filter(c=>c.status==='overdue').length,bg:'bg-red-50',border:'border-red-100',color:'text-red-600'},
        ].map(s=>(
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={topCustomers}
        onRowClick={setModal}
        rowClassName={row=>row.status==='overdue'?'bg-red-50/40 hover:bg-red-50/70':'hover:bg-slate-50/80'}
      />

      <Modal isOpen={!!modal} onClose={()=>setModal(null)} title={modal?.name}>
        {modal&&(
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[['City',modal.city],['Total Sales',formatINR(modal.sales)],['Outstanding',formatINR(modal.outstanding)],['Last Txn',modal.lastTxn]].map(([k,v])=>(
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="text-sm font-semibold text-slate-800">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">View Ledger</button>
              <button className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Send Statement</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
