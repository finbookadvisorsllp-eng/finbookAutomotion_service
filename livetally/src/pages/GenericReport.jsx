import { useState } from 'react'
import DataTable from '../components/DataTable'
import { formatINR, topCustomers } from '../data/mockData'
import { FileText, Download } from 'lucide-react'

export default function GenericReport({ title, description }) {
  const columns = [
    { key: 'name', label: 'Reference', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'city', label: 'Location' },
    { key: 'sales', label: 'Amount', align: 'right', sortable: true, render: v => formatINR(v) },
    { key: 'status', label: 'Status', render: v => (
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">{v}</span>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">{title}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{description || 'Detailed view and report data.'}</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Download size={14} /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Records</p>
            <p className="text-2xl font-black text-slate-800">1,248</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Period</p>
            <p className="text-2xl font-black text-slate-800">FY 2024-25</p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={topCustomers}
        title={`${title} Data`}
      />
    </div>
  )
}
