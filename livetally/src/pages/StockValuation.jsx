import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import DataTable from '../components/DataTable'
import { stockItems, formatINR } from '../data/mockData'

export default function StockValuation() {
  const totalValuation = stockItems.reduce((acc, i) => acc + i.value, 0)
  
  // Group valuation
  const groups = stockItems.reduce((acc, i) => {
    acc[i.group] = (acc[i.group] || 0) + i.value;
    return acc;
  }, {})
  
  const groupData = Object.keys(groups).map(k => ({ name: k, value: groups[k] }))
  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16']

  const columns = [
    { key: 'name', label: 'Item Name', sortable: true, render: v => <span className="font-bold">{v}</span> },
    { key: 'group', label: 'Group' },
    { key: 'closing', label: 'Quantity', align: 'right', sortable: true },
    { key: 'unit', label: 'Unit' },
    { key: 'value', label: 'Valuation Amount', align: 'right', sortable: true, render: v => <span className="font-black text-slate-800">{formatINR(v)}</span> },
  ]

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Stock Valuation</h1>
          <p className="text-sm text-slate-400 mt-0.5">Value of your current inventory holding.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center">
          <p className="text-sm font-bold text-blue-100 uppercase tracking-wider mb-2">Total Closing Stock Value</p>
          <p className="text-4xl font-black tracking-tight">{formatINR(totalValuation)}</p>
          <p className="text-sm font-medium text-blue-100 mt-4">Based on Average Cost method</p>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 flex flex-col md:flex-row gap-6 items-center">
          <div className="w-full md:w-1/2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={groupData} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {groupData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={v => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full md:w-1/2 grid grid-cols-2 gap-3">
            {groupData.sort((a,b)=>b.value-a.value).slice(0,6).map((g, i) => (
              <div key={g.name}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[i]}} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{g.name}</span>
                </div>
                <p className="text-sm font-black text-slate-800">{formatINR(g.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={stockItems}
        title="Item-wise Valuation"
        pageSize={15}
      />
    </div>
  )
}
