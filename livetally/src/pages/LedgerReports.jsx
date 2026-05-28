import { useState } from 'react'
import DataTable from '../components/DataTable'
import { formatINR } from '../data/mockData'

// Mock Ledger transactions
const ledgerTxns = [
  { id: '1', date: '2025-05-01', vchNo: 'JV-001', type: 'Journal', particulars: 'Opening Balance', debit: 0, credit: 0, balance: 145000, balType: 'Dr' },
  { id: '2', date: '2025-05-15', vchNo: 'SI-1834', type: 'Sales', particulars: 'Sales Account', debit: 250000, credit: 0, balance: 395000, balType: 'Dr' },
  { id: '3', date: '2025-05-18', vchNo: 'RC-0441', type: 'Receipt', particulars: 'HDFC Bank', debit: 0, credit: 200000, balance: 195000, balType: 'Dr' },
  { id: '4', date: '2025-05-27', vchNo: 'SI-1842', type: 'Sales', particulars: 'Sales Account', debit: 145000, credit: 0, balance: 340000, balType: 'Dr' },
]

export default function LedgerReports() {
  const [ledger, setLedger] = useState('Reliance Retail Ltd')

  const columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'particulars', label: 'Particulars' },
    { key: 'type', label: 'Vch Type', render: v => <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{v}</span> },
    { key: 'vchNo', label: 'Vch No.' },
    { key: 'debit', label: 'Debit', align: 'right', render: v => v > 0 ? formatINR(v) : '' },
    { key: 'credit', label: 'Credit', align: 'right', render: v => v > 0 ? formatINR(v) : '' },
    { key: 'balance', label: 'Balance', align: 'right', render: (v, r) => <span className="font-bold">{formatINR(v)} {r.balType}</span> },
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Ledger Report</h1>
          <p className="text-sm text-slate-400 mt-0.5">Detailed voucher-wise transactions</p>
        </div>
        <div>
          <select 
            value={ledger}
            onChange={(e) => setLedger(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          >
            <option>Reliance Retail Ltd</option>
            <option>Hindustan Unilever Ltd</option>
            <option>HDFC Bank Account</option>
            <option>Sales Account</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Opening Balance</p>
          <p className="text-lg font-black text-slate-700">{formatINR(145000)} Dr</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Debit</p>
          <p className="text-lg font-black text-blue-600">{formatINR(395000)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Credit</p>
          <p className="text-lg font-black text-purple-600">{formatINR(200000)}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Closing Balance</p>
          <p className="text-lg font-black text-emerald-700">{formatINR(340000)} Dr</p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={ledgerTxns}
        title={`Transactions for ${ledger}`}
        pageSize={20}
      />
    </div>
  )
}
