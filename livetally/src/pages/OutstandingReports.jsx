import { useState } from 'react'
import DataTable from '../components/DataTable'
import { formatINR, topCustomers, topVendors } from '../data/mockData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function OutstandingReports() {
  const [tab, setTab] = useState('receivables')

  const totalReceivables = topCustomers.reduce((acc, c) => acc + c.outstanding, 0)
  const totalPayables = topVendors.reduce((acc, v) => acc + v.outstanding, 0)

  // Mock aging summary
  const agingData = [
    { bucket: '0-30 Days', amount: tab === 'receivables' ? 520000 : 380000, color: '#10b981' },
    { bucket: '31-60 Days', amount: tab === 'receivables' ? 380000 : 260000, color: '#f59e0b' },
    { bucket: '61-90 Days', amount: tab === 'receivables' ? 210000 : 120000, color: '#f97316' },
    { bucket: '> 90 Days',  amount: tab === 'receivables' ? 170000 : 80000,  color: '#ef4444' },
  ]

  const columns = tab === 'receivables' ? [
    { key: 'name', label: 'Customer Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'city', label: 'City' },
    { key: 'outstanding', label: 'Outstanding Amount', align: 'right', sortable: true, render: v => <span className={`font-bold ${v > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{v > 0 ? formatINR(v) : '-'}</span> },
    { key: 'status', label: 'Status', render: v => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
        v === 'overdue' ? 'bg-red-100 text-red-700' :
        v === 'warning' ? 'bg-amber-100 text-amber-700' :
        'bg-emerald-100 text-emerald-700'
      }`}>{v.toUpperCase()}</span>
    )},
  ] : [
    { key: 'name', label: 'Vendor Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'city', label: 'City' },
    { key: 'dueDate', label: 'Next Due Date', sortable: true },
    { key: 'outstanding', label: 'Outstanding Amount', align: 'right', sortable: true, render: v => <span className={`font-bold ${v > 0 ? 'text-red-500' : 'text-slate-400'}`}>{v > 0 ? formatINR(v) : '-'}</span> },
    { key: 'status', label: 'Status', render: v => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
        v === 'overdue' ? 'bg-red-100 text-red-700' :
        v === 'paid' ? 'bg-emerald-100 text-emerald-700' :
        'bg-amber-100 text-amber-700'
      }`}>{v.toUpperCase()}</span>
    )},
  ]

  const data = tab === 'receivables' ? topCustomers.filter(c => c.outstanding >= 0) : topVendors.filter(v => v.outstanding >= 0)

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Outstanding Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track your receivables and payables</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setTab('receivables')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'receivables' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Receivables (To Collect)
          </button>
          <button 
            onClick={() => setTab('payables')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'payables' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Payables (To Pay)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Total {tab === 'receivables' ? 'Receivables' : 'Payables'}
          </p>
          <p className={`text-4xl font-black tracking-tight ${tab === 'receivables' ? 'text-blue-600' : 'text-red-500'}`}>
            {formatINR(tab === 'receivables' ? totalReceivables : totalPayables)}
          </p>
          <p className="text-sm font-medium text-slate-500 mt-2">Across {data.filter(d => d.outstanding > 0).length} parties</p>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Aging Summary</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="h-32 flex-1 min-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="bucket" type="category" width={80} tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => formatINR(v)} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {agingData.map(d => (
                <div key={d.bucket} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500">{d.bucket}</p>
                  <p className="text-sm font-black text-slate-800">{formatINR(d.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={data}
        title={tab === 'receivables' ? "Customer Balances" : "Vendor Balances"}
        pageSize={10}
      />
    </div>
  )
}
