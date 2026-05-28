import DataTable from '../components/DataTable'
import { formatINR } from '../data/mockData'

// Basic Trial Balance mock data
const tbData = [
  { group: 'Capital Account', ledger: 'Capital A/c', debit: 0, credit: 2800000 },
  { group: 'Current Assets', ledger: 'Sundry Debtors', debit: 1280000, credit: 0 },
  { group: 'Current Assets', ledger: 'Cash in Hand', debit: 450000, credit: 0 },
  { group: 'Current Assets', ledger: 'Bank Accounts', debit: 1110000, credit: 0 },
  { group: 'Current Assets', ledger: 'Closing Stock', debit: 1820000, credit: 0 },
  { group: 'Fixed Assets', ledger: 'Plant & Machinery', debit: 850000, credit: 0 },
  { group: 'Fixed Assets', ledger: 'Furniture', debit: 320000, credit: 0 },
  { group: 'Current Liabilities', ledger: 'Sundry Creditors', debit: 0, credit: 840000 },
  { group: 'Current Liabilities', ledger: 'GST Payable', debit: 0, credit: 182000 },
  { group: 'Sales Accounts', ledger: 'Sales', debit: 0, credit: 4820000 },
  { group: 'Purchase Accounts', ledger: 'Purchases', debit: 3150000, credit: 0 },
  { group: 'Indirect Expenses', ledger: 'Salaries & Wages', debit: 380000, credit: 0 },
  { group: 'Indirect Expenses', ledger: 'Rent', debit: 120000, credit: 0 },
]

export default function TrialBalance() {
  const totalDebit = tbData.reduce((acc, row) => acc + row.debit, 0)
  const totalCredit = tbData.reduce((acc, row) => acc + row.credit, 0)
  const isMatch = totalDebit === totalCredit

  const columns = [
    { key: 'ledger', label: 'Particulars', sortable: true },
    { key: 'group', label: 'Group', sortable: true, render: (v) => <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{v}</span> },
    { key: 'debit', label: 'Debit Balance', align: 'right', sortable: true, render: v => v > 0 ? formatINR(v) : '-' },
    { key: 'credit', label: 'Credit Balance', align: 'right', sortable: true, render: v => v > 0 ? formatINR(v) : '-' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Trial Balance</h1>
          <p className="text-sm text-slate-400 mt-0.5">As of 31-May-2025</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Debit</p>
          <p className="text-2xl font-extrabold text-slate-900">{formatINR(totalDebit)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Credit</p>
          <p className="text-2xl font-extrabold text-slate-900">{formatINR(totalCredit)}</p>
        </div>
        <div className={`rounded-2xl border p-5 ${isMatch ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isMatch ? 'text-emerald-600' : 'text-red-600'}`}>Difference</p>
          <p className={`text-2xl font-extrabold ${isMatch ? 'text-emerald-700' : 'text-red-700'}`}>{formatINR(Math.abs(totalDebit - totalCredit))}</p>
          <p className={`text-xs font-semibold mt-1 ${isMatch ? 'text-emerald-600' : 'text-red-600'}`}>
            {isMatch ? '✓ Balances match perfectly' : '⚠ Mismatch detected!'}
          </p>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={tbData}
        title="Ledger Balances"
        pageSize={15}
      />
    </div>
  )
}
