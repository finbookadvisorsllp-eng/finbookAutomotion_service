import { useState } from 'react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { formatINR } from '../data/mockData'
import { useDateRange } from '../context/DateContext'
import { useApi } from '../hooks/useApi'
import { getSalesRegister } from '../api'

const StatusBadge = ({ status }) => {
  const s = { paid:'bg-emerald-100 text-emerald-700 dark:bg-[#B6FF00]/10 dark:text-[#B6FF00]', pending:'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', overdue:'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' }
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s[status]??'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400'}`}>{status}</span>
}

const columns = [
  { key: 'id',      label: 'Invoice #',    sortable: true, render: v => <span className="text-blue-600 font-mono text-[12px] font-semibold">{v}</span> },
  { key: 'date',    label: 'Date',         sortable: true, render: v => <span className="text-slate-400 text-[12px]">{v}</span> },
  { key: 'party',   label: 'Customer',     sortable: true, render: v => <span className="font-semibold text-slate-800">{v}</span> },
  { key: 'items',   label: 'Items',        sortable: true, align: 'right' },
  { key: 'taxable', label: 'Taxable',      sortable: true, align: 'right', render: v => formatINR(v) },
  { key: 'gst',     label: 'GST',          sortable: true, align: 'right', render: v => formatINR(v) },
  { key: 'total',   label: 'Invoice Total',sortable: true, align: 'right', render: v => <span className="font-bold text-slate-800">{formatINR(v)}</span> },
  { key: 'status',  label: 'Status',       sortable: true, render: v => <StatusBadge status={v} /> },
]

export default function SalesRegister() {
  const [modal, setModal] = useState(null)
  const { fy, selectedDateRange } = useDateRange()
  const { data: resp, loading } = useApi(() => getSalesRegister(fy, { limit: 500 }), [fy], { skip: !fy })
  const salesData = resp?.data || []
  const totalSales = salesData.reduce((a,s)=>a+s.total,0)
  const totalGST = salesData.reduce((a,s)=>a+s.gst,0)
  const paidSales = salesData.filter(s=>s.status==='paid').reduce((a,s)=>a+s.total,0)

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Sales Register</h1>
          <p className="text-sm text-slate-400 mt-0.5">All sales invoices · {selectedDateRange || ''}{loading ? ' · loading…' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
          <button className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>+ New Invoice</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: 'Total Sales',     value: formatINR(totalSales), bg:'bg-blue-50 dark:bg-blue-500/10', border:'border-blue-100 dark:border-blue-500/20', color:'text-blue-700 dark:text-blue-400' },
          { label: 'GST Collected',   value: formatINR(totalGST),   bg:'bg-purple-50 dark:bg-purple-500/10', border:'border-purple-100 dark:border-purple-500/20', color:'text-purple-700 dark:text-purple-400' },
          { label: 'Collected',       value: formatINR(paidSales),  bg:'bg-emerald-50 dark:bg-[#B6FF00]/10', border:'border-emerald-100 dark:border-[#B6FF00]/20', color:'text-emerald-700 dark:text-[#B6FF00]' },
          { label: 'Total Invoices',  value: salesData.length,      bg:'bg-slate-50', border:'border-slate-200', color:'text-slate-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={salesData}
        pageSize={10}
        onRowClick={setModal}
        rowClassName={row => row.status === 'overdue' ? 'bg-red-50/40 hover:bg-red-50/70 dark:bg-red-500/10 dark:hover:bg-red-500/20' : 'hover:bg-slate-50/80'}
      />

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={`Invoice: ${modal?.id}`}>
        {modal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[['Invoice #',modal.id],['Date',modal.date],['Customer',modal.party],['Items',modal.items],['Taxable Amt',formatINR(modal.taxable)],['GST',formatINR(modal.gst)],['Total',formatINR(modal.total)],['Mode',modal.payMode]].map(([k,v])=>(
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="text-sm font-semibold text-slate-800">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">Download Invoice</button>
              <button className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Share PDF</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
