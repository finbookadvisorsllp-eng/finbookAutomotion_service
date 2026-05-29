import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { balanceSheet, formatINR } from '../data/mockData'

const totalCurrentAssets = Object.values(balanceSheet.assets.currentAssets).reduce((a,b)=>a+b,0)
const totalFixedAssets = Object.values(balanceSheet.assets.fixedAssets).reduce((a,b)=>a+b,0)
const totalCurrentLiab = Object.values(balanceSheet.liabilities.currentLiabilities).reduce((a,b)=>a+b,0)
const totalOwnersFunds = Object.values(balanceSheet.liabilities.ownersFunds).reduce((a,b)=>a+b,0)
const totalAssets = totalCurrentAssets + totalFixedAssets
const totalLiab = totalCurrentLiab + totalOwnersFunds

const compChart = [
  { name: 'Current Assets', value: totalCurrentAssets, color: '#2563eb' },
  { name: 'Fixed Assets',   value: totalFixedAssets,   color: '#7c3aed' },
  { name: 'Current Liab.',  value: totalCurrentLiab,   color: '#ef4444' },
  { name: "Owner's Funds",  value: totalOwnersFunds,   color: '#10b981' },
]

const Section = ({ title, data, valueColor = 'text-slate-800', totalLabel, total }) => (
  <div className="mb-5">
    <div className="py-2.5 border-b-2 border-slate-200 mb-1">
      <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</span>
    </div>
    {Object.entries(data).map(([k, v]) => (
      <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
        <span className="text-sm text-slate-600">{k}</span>
        <span className={`text-sm font-semibold ${valueColor}`}>{formatINR(v)}</span>
      </div>
    ))}
    <div className="flex items-center justify-between py-2.5 bg-slate-100 px-3 rounded-xl mt-2">
      <span className="text-sm font-bold text-slate-700">{totalLabel}</span>
      <span className="text-sm font-extrabold text-slate-900">{formatINR(total)}</span>
    </div>
  </div>
)

export default function BalanceSheet() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Balance Sheet</h1>
          <p className="text-sm text-slate-400 mt-0.5">As on 31 March 2025</p>
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">⬇ Export PDF</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: 'Total Assets',    value: totalAssets,      bg: 'bg-blue-50 dark:bg-blue-500/10',    border: 'border-blue-100 dark:border-blue-500/20',   color: 'text-blue-700 dark:text-blue-400' },
          { label: 'Current Assets',  value: totalCurrentAssets, bg: 'bg-sky-50 dark:bg-sky-500/10',  border: 'border-sky-100 dark:border-sky-500/20',    color: 'text-sky-700 dark:text-sky-400' },
          { label: 'Total Liabilities', value: totalCurrentLiab, bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-100 dark:border-red-500/20',    color: 'text-red-600 dark:text-red-400' },
          { label: "Owner's Equity",  value: totalOwnersFunds,  bg: 'bg-emerald-50 dark:bg-[#B6FF00]/10',border: 'border-emerald-100 dark:border-[#B6FF00]/20',color: 'text-emerald-700 dark:text-[#B6FF00]' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4 transition-colors`}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{formatINR(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        {/* Chart */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Balance Overview</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compChart} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} width={110}/>
              <Tooltip formatter={v=>formatINR(v)} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {compChart.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl transition-colors">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-slate-500">Total Assets</span>
              <span className="text-xs font-bold text-slate-800">{formatINR(totalAssets)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Total Liabilities + Capital</span>
              <span className="text-xs font-bold text-slate-800">{formatINR(totalLiab)}</span>
            </div>
            <div className={`mt-2 text-center text-xs font-bold ${totalAssets === totalLiab ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalAssets === totalLiab ? '✓ Balance Sheet Balanced' : '⚠ Difference detected'}
            </div>
          </div>
        </div>

        {/* Assets */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Assets</h2>
          <Section title="Current Assets" data={balanceSheet.assets.currentAssets} valueColor="text-blue-700 dark:text-blue-400" totalLabel="Total Current Assets" total={totalCurrentAssets} />
          <Section title="Fixed Assets" data={balanceSheet.assets.fixedAssets} valueColor="text-purple-700 dark:text-purple-400" totalLabel="Total Fixed Assets" total={totalFixedAssets} />
          <div className="flex items-center justify-between py-3 bg-blue-600 text-white px-4 rounded-xl transition-colors">
            <span className="text-sm font-bold">TOTAL ASSETS</span>
            <span className="text-base font-extrabold">{formatINR(totalAssets)}</span>
          </div>
        </div>

        {/* Liabilities */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Liabilities & Capital</h2>
          <Section title="Current Liabilities" data={balanceSheet.liabilities.currentLiabilities} valueColor="text-red-600 dark:text-red-400" totalLabel="Total Current Liab." total={totalCurrentLiab} />
          <Section title="Capital & Reserves" data={balanceSheet.liabilities.ownersFunds} valueColor="text-emerald-700 dark:text-[#B6FF00]" totalLabel="Total Owner's Funds" total={totalOwnersFunds} />
          <div className="flex items-center justify-between py-3 bg-blue-600 text-white px-4 rounded-xl transition-colors">
            <span className="text-sm font-bold">TOTAL LIAB. + CAPITAL</span>
            <span className="text-base font-extrabold">{formatINR(totalLiab)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
