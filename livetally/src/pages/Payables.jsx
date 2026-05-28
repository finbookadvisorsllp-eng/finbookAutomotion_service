import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { topVendors, payablesAging, formatINR } from '../data/mockData'

const columns = [
  { key: 'name',        label: 'Vendor',       sortable: true, render: v => <span className="font-semibold text-slate-800">{v}</span> },
  { key: 'city',        label: 'City',         sortable: true },
  { key: 'purchase',    label: 'Total Purchase',sortable: true, align: 'right', render: v => <span className="font-semibold">{formatINR(v)}</span> },
  { key: 'outstanding', label: 'To Pay',       sortable: true, align: 'right', render: (v, row) => (
    <span className={v > 0 ? (row.status === 'overdue' ? 'text-red-600 font-bold' : 'text-amber-600 font-semibold') : 'text-emerald-600 font-semibold'}>
      {v > 0 ? formatINR(v) : '✓ Paid'}
    </span>
  )},
  { key: 'dueDate',     label: 'Due Date',     sortable: true, render: (v, row) => (
    v ? <span className={row.status === 'overdue' ? 'text-red-500 font-semibold' : 'text-slate-500'}>{v}</span> : '—'
  )},
  { key: 'status',      label: 'Status',       sortable: true, render: v => {
    const s = { active:'bg-blue-100 text-blue-700', overdue:'bg-red-100 text-red-700', paid:'bg-emerald-100 text-emerald-700' }
    return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s[v]??s.active}`}>{v}</span>
  }},
]

export default function Payables() {
  const [modal, setModal] = useState(null)
  const totalPayable = topVendors.reduce((a, v) => a + v.outstanding, 0)
  const overdueAmt = topVendors.filter(v=>v.status==='overdue').reduce((a,v)=>a+v.outstanding,0)

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Bills to Pay</h1>
          <p className="text-sm text-slate-400 mt-0.5">Payables & Vendor Aging</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: 'Total Payable',    value: formatINR(totalPayable), bg:'bg-red-50',    border:'border-red-100',    color:'text-red-600' },
          { label: 'Overdue Amount',   value: formatINR(overdueAmt),   bg:'bg-orange-50', border:'border-orange-100', color:'text-orange-700' },
          { label: 'Due This Week',    value: formatINR(210000),       bg:'bg-amber-50',  border:'border-amber-100',  color:'text-amber-700' },
          { label: 'Vendors Pending',  value: `${topVendors.filter(v=>v.outstanding>0).length}`, bg:'bg-blue-50', border:'border-blue-100', color:'text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-5">Vendor Aging Analysis</h2>
          <div className="space-y-4">
            {payablesAging.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 text-xs font-medium text-slate-500 shrink-0">{a.bucket}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700" style={{ width:`${a.pct}%`, background: a.color }}>
                    <span className="text-[11px] font-bold text-white/90">{a.pct}%</span>
                  </div>
                </div>
                <div className="w-24 text-right shrink-0">
                  <span className="text-xs font-bold text-slate-800">{formatINR(a.amount)}</span>
                  <span className="text-[10px] text-slate-400 ml-1">({a.count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Vendor-wise Payables</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topVendors.filter(v=>v.outstanding>0)} layout="vertical" margin={{left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#64748b'}} axisLine={false} tickLine={false} width={140} tickFormatter={v=>v.length>18?v.slice(0,18)+'…':v}/>
              <Tooltip formatter={v=>formatINR(v)} />
              <Bar dataKey="outstanding" fill="#ef4444" radius={[0,4,4,0]} name="Outstanding" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DataTable
        title="Vendor-wise Payables"
        columns={columns}
        data={topVendors}
        onRowClick={setModal}
        rowClassName={row => row.status === 'overdue' ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/80'}
      />

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.name}>
        {modal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[['City',modal.city],['Total Purchase',formatINR(modal.purchase)],['Outstanding',formatINR(modal.outstanding)],['Due Date',modal.dueDate??'Paid']].map(([k,v])=>(
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="text-sm font-semibold text-slate-800">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">Mark as Paid</button>
              <button className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">View Ledger</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
