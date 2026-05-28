import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { topCustomers, receivablesAging, formatINR } from '../data/mockData'

const columns = [
  { key: 'name',        label: 'Customer',         sortable: true, render: v => <span className="font-semibold text-slate-800">{v}</span> },
  { key: 'city',        label: 'City',             sortable: true },
  { key: 'sales',       label: 'Total Sales',      sortable: true, align: 'right', render: v => <span className="font-semibold">{formatINR(v)}</span> },
  { key: 'outstanding', label: 'Outstanding',      sortable: true, align: 'right', render: (v, row) => (
    <span className={v > 0 ? (row.status === 'overdue' ? 'text-red-600 font-bold' : 'text-amber-600 font-semibold') : 'text-emerald-600 font-semibold'}>
      {v > 0 ? formatINR(v) : '✓ Clear'}
    </span>
  )},
  { key: 'lastTxn',     label: 'Last Transaction', sortable: true, render: v => <span className="text-slate-400">{v}</span> },
  { key: 'status',      label: 'Status',           sortable: true, render: v => {
    const s = { active:'bg-emerald-100 text-emerald-700', overdue:'bg-red-100 text-red-700', warning:'bg-amber-100 text-amber-700' }
    return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s[v]??s.active}`}>{v}</span>
  }},
]

export default function Receivables() {
  const [modal, setModal] = useState(null)
  const totalReceivable = topCustomers.reduce((a, c) => a + c.outstanding, 0)
  const overdueCustomers = topCustomers.filter(c => c.status === 'overdue')

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Money Due to You</h1>
          <p className="text-sm text-slate-400 mt-0.5">Receivables & Customer Aging</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: 'Total Outstanding', value: formatINR(totalReceivable), bg:'bg-amber-50', border:'border-amber-100', color:'text-amber-700' },
          { label: 'Overdue (90+ Days)', value: formatINR(170000), bg:'bg-red-50', border:'border-red-100', color:'text-red-600' },
          { label: 'Customers with Dues', value: `${topCustomers.filter(c=>c.outstanding>0).length} of ${topCustomers.length}`, bg:'bg-blue-50', border:'border-blue-100', color:'text-blue-700' },
          { label: 'Overdue Customers', value: overdueCustomers.length, bg:'bg-orange-50', border:'border-orange-100', color:'text-orange-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Aging Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-5">Aging Analysis</h2>
          <div className="space-y-4">
            {receivablesAging.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 text-xs font-medium text-slate-500 shrink-0">{a.bucket}</div>
                <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
                  <div className="h-full rounded-lg transition-all duration-700 flex items-center px-2" style={{ width: `${a.pct}%`, background: a.color }}>
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

          <div className="mt-5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm font-semibold text-red-700">⚠ Action Required</p>
            <p className="text-xs text-red-600 mt-0.5">₹1.7L is overdue beyond 90 days. Immediate follow-up required from BigBazaar Hyper Market.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Aging Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={receivablesAging} dataKey="amount" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={3}>
                {receivablesAging.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={v=>formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {receivablesAging.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="text-xs text-slate-500 flex-1">{a.bucket}</span>
                <span className="text-xs font-bold text-slate-700">{formatINR(a.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <DataTable
        title="Customer-wise Receivables"
        columns={columns}
        data={topCustomers}
        onRowClick={setModal}
        rowClassName={row => row.status === 'overdue' ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/80'}
      />

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.name}>
        {modal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[['City', modal.city],['Total Sales', formatINR(modal.sales)],['Outstanding', formatINR(modal.outstanding)],['Last Txn', modal.lastTxn]].map(([k,v])=>(
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="text-sm font-semibold text-slate-800">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">Send Reminder</button>
              <button className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">View Ledger</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
