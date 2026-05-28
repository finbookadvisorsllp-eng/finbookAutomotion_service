import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { gstSummary, formatINR } from '../data/mockData'

export default function GSTReports() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">GST Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">GSTIN: 27AABCS1429B1Z5 · Maharashtra</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ Export</button>
          <button className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>📤 File Return</button>
        </div>
      </div>

      {/* GST Filing Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {[
          { title:'GSTR-1 (Sales)', period:gstSummary.gstr1.period, status:gstSummary.gstr1.status, taxable:gstSummary.gstr1.taxable, tax:gstSummary.gstr1.totalTax },
          { title:'GSTR-3B (Summary)', period:gstSummary.gstr3b.period, status:gstSummary.gstr3b.status, taxable:gstSummary.gstr3b.liability, tax:gstSummary.gstr3b.netPayable },
        ].map(g=>(
          <div key={g.title} className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">{g.title}</h2>
                <p className="text-xs text-slate-400">{g.period}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${g.status==='filed'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>
                {g.status==='filed'?'✓ Filed':'Pending'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Taxable Turnover</p>
                <p className="text-base font-extrabold text-slate-800">{formatINR(g.taxable)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Tax Amount</p>
                <p className="text-base font-extrabold text-blue-700">{formatINR(g.tax)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ITC Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">ITC Summary</h2>
          <div className="space-y-3">
            {[
              { label:'Opening ITC', value:gstSummary.itcSummary.opening, color:'text-slate-700' },
              { label:'ITC Received', value:gstSummary.itcSummary.received, color:'text-emerald-600' },
              { label:'ITC Utilized', value:gstSummary.itcSummary.utilized, color:'text-red-500' },
              { label:'Closing ITC', value:gstSummary.itcSummary.closing, color:'text-blue-600' },
            ].map(s=>(
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">{s.label}</span>
                <span className={`text-sm font-bold ${s.color}`}>{formatINR(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Tax Rate Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={gstSummary.taxBreakdown} dataKey="tax" nameKey="rate" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={3}>
                  {gstSummary.taxBreakdown.map((_, i) => (
                    <Cell key={i} fill={['#2563eb','#7c3aed','#10b981','#f59e0b'][i]} />
                  ))}
                </Pie>
                <Tooltip formatter={v=>formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {gstSummary.taxBreakdown.map((t,i)=>(
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background:['#2563eb','#7c3aed','#10b981','#f59e0b'][i] }}>
                    {t.rate}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-700">Taxable: {formatINR(t.taxable)}</p>
                    <p className="text-xs text-slate-400">Tax: {formatINR(t.tax)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Next Due */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
        <span className="text-2xl">📅</span>
        <div>
          <p className="text-sm font-bold text-amber-800">Upcoming GST Deadlines</p>
          <div className="flex gap-6 mt-2 flex-wrap">
            {[{name:'GSTR-1 for May 2025',due:'11 June 2025'},{name:'GSTR-3B for May 2025',due:'20 June 2025'}].map(d=>(
              <div key={d.name} className="bg-white/70 rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">{d.name}</p>
                <p className="text-xs text-amber-700 font-bold mt-0.5">Due: {d.due}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
