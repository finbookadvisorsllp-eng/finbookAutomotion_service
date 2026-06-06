import { useState, useEffect } from 'react'
import DataTable from '../components/DataTable'
import { formatINR, topCustomers, topVendors } from '../data/mockData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Info, Settings } from 'lucide-react'
import CustomizeAgingModal, { DEFAULT_BUCKETS } from '../components/CustomizeAgingModal'

export default function OutstandingReports() {
  const [reportType, setReportType] = useState('receivables')
  const [viewType, setViewType] = useState('outstanding')
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)

  const [agingBuckets, setAgingBuckets] = useState(() => {
    const saved = localStorage.getItem('agingBuckets')
    return saved ? JSON.parse(saved) : DEFAULT_BUCKETS
  })

  useEffect(() => {
    localStorage.setItem('agingBuckets', JSON.stringify(agingBuckets))
  }, [agingBuckets])

  const totalReceivables = topCustomers.reduce((acc, c) => acc + c.outstanding, 0)
  const totalPayables = topVendors.reduce((acc, v) => acc + v.outstanding, 0)

  const getBucketLabel = (b) => b.to === null ? `> ${b.from - 1} Days` : `${b.from}-${b.to} Days`;

  const getAgingBucketsForParty = (party, isReceivable) => {
    const result = { overdue: 0, notDue: 0 }
    agingBuckets.forEach(b => {
      result[`b_${b.id}`] = 0;
    });

    if (party.outstanding === 0) return result;

    let remaining = party.outstanding;
    
    // Exact mapping for reference vendors if using DEFAULT_BUCKETS
    const isDefault = JSON.stringify(agingBuckets) === JSON.stringify(DEFAULT_BUCKETS);
    if (isDefault && !isReceivable) {
        if (party.name === 'Hindustan Unilever Ltd') return { b_1: 80000, b_2: 20000, b_3: 10000, b_4: 10000, overdue: 0, notDue: 0 }
        if (party.name === 'Nestle India Ltd') return { b_1: 10000, b_2: 25000, b_3: 20000, b_4: 30000, overdue: 5000, notDue: 0 }
        if (party.name === 'Britannia Industries') return { b_1: 60000, b_2: 50000, b_3: 30000, b_4: 55000, overdue: 25000, notDue: 0 }
        if (party.name === 'Godrej Consumer Products') return { b_1: 15000, b_2: 25000, b_3: 15000, b_4: 10000, overdue: 0, notDue: 0 }
    }

    if (party.status === 'overdue') {
      result.overdue = Math.floor(party.outstanding * 0.15);
      remaining -= result.overdue;
    }

    const numBuckets = agingBuckets.length;
    agingBuckets.forEach((b, idx) => {
      if (idx === numBuckets - 1) {
        result[`b_${b.id}`] = remaining;
      } else {
        const fraction = 0.4 - (idx * 0.1); 
        const amount = Math.floor(party.outstanding * Math.max(fraction, 0.05));
        const actual = Math.min(amount, remaining);
        result[`b_${b.id}`] = actual;
        remaining -= actual;
      }
    });

    return result;
  }

  const outstandingColumns = reportType === 'receivables' ? [
    { key: 'name', label: 'Customer Name', sortable: true, render: v => <span className="font-bold text-slate-800 dark:text-slate-800">{v}</span> },
    { key: 'city', label: 'City' },
    { key: 'lastTxn', label: 'Next Due Date', sortable: true },
    { key: 'outstanding', label: 'Total Outstanding', align: 'right', sortable: true, render: v => <span className={`font-bold ${v > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{v > 0 ? formatINR(v) : '-'}</span> },
    {
      key: 'status', label: 'Status', render: v => (
        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${v === 'overdue' ? 'bg-red-100 text-red-700' :
          v === 'warning' ? 'bg-amber-100 text-amber-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>{v}</span>
      )
    },
  ] : [
    { key: 'name', label: 'Vendor Name', sortable: true, render: v => <span className="font-bold text-slate-800 dark:text-slate-800">{v}</span> },
    { key: 'city', label: 'City' },
    { key: 'dueDate', label: 'Next Due Date', sortable: true },
    { key: 'outstanding', label: 'Outstanding Amount', align: 'right', sortable: true, render: v => <span className={`font-bold ${v > 0 ? 'text-red-500' : 'text-slate-400'}`}>{v > 0 ? formatINR(v) : '-'}</span> },
    {
      key: 'status', label: 'Status', render: v => (
        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${v === 'overdue' ? 'bg-red-100 text-red-700' :
          v === 'paid' ? 'bg-emerald-100 text-emerald-700' :
            'bg-amber-100 text-amber-700'
          }`}>{v}</span>
      )
    },
  ]

  const customAgingCols = agingBuckets.map(b => ({
    key: `b_${b.id}`,
    label: getBucketLabel(b),
    align: 'right',
    sortable: true,
    render: v => v > 0 ? formatINR(v) : formatINR(0)
  }));

  const agingColumns = [
    { key: 'name', label: reportType === 'receivables' ? 'Customer Name' : 'Vendor Name', sortable: true, render: v => <span className="font-bold text-slate-800 dark:text-slate-800">{v}</span> },
    { key: 'city', label: 'City' },
    { key: 'outstanding', label: 'Total ' + (reportType === 'receivables' ? 'Outstanding' : 'Payable'), align: 'right', sortable: true, render: v => <span className={`font-bold ${reportType === 'receivables' ? 'text-amber-600' : 'text-red-500'}`}>{v > 0 ? formatINR(v) : formatINR(0)}</span> },
    ...customAgingCols,
    { key: 'overdue', label: 'Overdue', align: 'right', sortable: true, render: v => v > 0 ? <span className="font-bold text-red-600">{formatINR(v)}</span> : '-' },
    { key: 'notDue', label: 'Not Due Yet', align: 'right', sortable: true, render: v => v > 0 ? formatINR(v) : '-' },
    {
      key: 'status', label: 'Status', render: v => (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${v === 'overdue' ? 'bg-red-100 text-red-700' :
          v === 'warning' ? 'bg-amber-100 text-amber-700' :
          v === 'paid' ? 'bg-emerald-100 text-emerald-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>{v}</span>
      )
    },
  ]

  const rawData = reportType === 'receivables' ? topCustomers : topVendors

  const dataWithAging = rawData.map(party => ({
    ...party,
    ...getAgingBucketsForParty(party, reportType === 'receivables')
  }))

  const data = viewType === 'aging' ? dataWithAging : rawData

  const bucketTotals = {};
  agingBuckets.forEach(b => {
    bucketTotals[`b_${b.id}`] = dataWithAging.reduce((acc, c) => acc + (c[`b_${b.id}`] || 0), 0);
  });

  const tableTotals = {
    id: 'total_row',
    name: 'TOTAL',
    city: '',
    outstanding: data.reduce((acc, c) => acc + (c.outstanding || 0), 0),
    ...bucketTotals,
    overdue: data.reduce((acc, c) => acc + (c.overdue || 0), 0),
    notDue: data.reduce((acc, c) => acc + (c.notDue || 0), 0),
    status: '',
  }

  const finalData = viewType === 'aging' ? [...data, tableTotals] : data.filter(d => d.outstanding > 0);
  const rowClassName = (row) => row.id === 'total_row' ? 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 uppercase' : ''

  // Colors for chart buckets
  const colors = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  const agingData = agingBuckets.map((b, idx) => ({
    bucket: getBucketLabel(b),
    amount: bucketTotals[`b_${b.id}`] || 0,
    color: colors[idx % colors.length]
  }));

  const toggleTabs = (
    <div className="flex p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1a24] shadow-sm">
      {viewType === 'aging' && (
        <button
          onClick={() => setIsCustomizeOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-md text-[12px] font-bold text-slate-600 dark:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-100 transition-colors border border-slate-200 dark:border-slate-700"
        >
          <Settings size={14} /> Customize Aging
        </button>
      )}
      <button
        onClick={() => setViewType('outstanding')}
        className={`px-4 py-1.5 rounded-md text-[13px] font-bold transition-all ${
          viewType === 'outstanding' 
          ? 'bg-blue-600 text-white dark:text-slate-800 shadow-md' 
          : 'text-slate-600 dark:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-100'
        }`}
      >
        Outstanding
      </button>
      <button
        onClick={() => setViewType('aging')}
        className={`px-4 py-1.5 rounded-md text-[13px] font-bold transition-all ${
          viewType === 'aging' 
          ? 'bg-blue-600 text-white dark:text-slate-800 shadow-md' 
          : 'text-slate-600 dark:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-100'
        }`}
      >
        Aging
      </button>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-800">Outstanding Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track your receivables and payables</p>
        </div>
        <div className="flex bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-slate-700/50 p-1.5 rounded-2xl shadow-sm">
          <button
            onClick={() => setReportType('receivables')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${reportType === 'receivables' ? 'bg-slate-100 dark:bg-slate-100 text-slate-800 dark:text-slate-800' : 'text-slate-500 hover:text-slate-700 dark:text-slate-700 dark:hover:text-slate-800'}`}
          >
            Receivables (To Collect)
          </button>
          <button
            onClick={() => setReportType('payables')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${reportType === 'payables' ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-700 dark:hover:text-slate-800'}`}
          >
            Payables (To Pay)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-6 flex flex-col justify-center min-h-[160px]">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Total {reportType === 'receivables' ? 'Receivables' : 'Payables'}
          </p>
          <p className={`text-[42px] leading-none font-black tracking-tight ${reportType === 'receivables' ? 'text-blue-600 dark:text-blue-500' : 'text-red-500'}`}>
            {formatINR(reportType === 'receivables' ? totalReceivables : totalPayables)}
          </p>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-3">Across {data.filter(d => d.outstanding > 0).length} parties</p>
        </div>

        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-800 mb-5">Aging Summary</h2>
          <div className="flex flex-col sm:flex-row gap-6 h-full">
            <div className="h-28 flex-1 min-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="bucket" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-card-border)', borderRadius: '0.75rem', color: 'var(--theme-text-main)' }} formatter={v => formatINR(v)} cursor={{ fill: 'var(--theme-card-hover)' }} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={12}>
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0 h-28 overflow-y-auto pr-2">
              {agingData.map(d => (
                <div key={d.bucket} className="flex flex-col justify-center px-4 py-2 bg-white dark:bg-[#1a1a24] rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm min-h-[50px]">
                  <p className="text-[10px] font-bold text-slate-400 mb-0.5">{d.bucket}</p>
                  <p className="text-[14px] font-black text-slate-800 dark:text-slate-800">{formatINR(d.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        {viewType === 'aging' && (
          <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl flex items-center gap-3">
            <div className="text-blue-500">
              <Info size={16} strokeWidth={2.5} />
            </div>
            <p className="text-[13px] text-blue-700 dark:text-blue-400 font-semibold">
              Aging view shows outstanding amounts bucketed by due date ranges.
            </p>
          </div>
        )}

        <DataTable
          columns={viewType === 'aging' ? agingColumns : outstandingColumns}
          data={finalData}
          title={reportType === 'receivables' ? "Customer Balances" : "Vendor Balances"}
          pageSize={10}
          actions={toggleTabs}
          rowClassName={rowClassName}
        />
      </div>
      
      <CustomizeAgingModal 
        isOpen={isCustomizeOpen} 
        onClose={() => setIsCustomizeOpen(false)} 
        currentBuckets={agingBuckets} 
        onSave={setAgingBuckets} 
      />
    </div>
  )
}
