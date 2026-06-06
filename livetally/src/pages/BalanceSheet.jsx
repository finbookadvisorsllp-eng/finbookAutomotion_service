import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Filter, Download, ChevronDown, ChevronRight, Activity, LayoutGrid, Rows, Calendar, Wallet, Building2, TrendingDown, TrendingUp } from 'lucide-react';
import { balanceSheet, formatINR } from '../data/mockData';

// Data aggregations
const totalCurrentAssets = Object.values(balanceSheet.assets.currentAssets).reduce((a, b) => a + b, 0);
const totalFixedAssets = Object.values(balanceSheet.assets.fixedAssets).reduce((a, b) => a + b, 0);
const totalCurrentLiab = Object.values(balanceSheet.liabilities.currentLiabilities).reduce((a, b) => a + b, 0);
const totalOwnersFunds = Object.values(balanceSheet.liabilities.ownersFunds).reduce((a, b) => a + b, 0);
const totalAssets = totalCurrentAssets + totalFixedAssets;
const totalLiab = totalCurrentLiab + totalOwnersFunds;
const profitAndLoss = totalAssets - totalLiab; // Mocking P&L to exactly balance the sheet
const balancedTotalLiab = totalLiab + profitAndLoss;
const workingCapital = totalCurrentAssets - totalCurrentLiab;

// Chart Data Arrays...
const assetsData = [
  { name: 'Cash & Bank', value: balanceSheet.assets.currentAssets['Cash & Bank'], color: '#3b82f6' },
  { name: 'Sundry Debtors', value: balanceSheet.assets.currentAssets['Sundry Debtors'], color: '#f59e0b' },
  { name: 'Stock-in-Hand', value: balanceSheet.assets.currentAssets['Closing Stock'], color: '#10b981' },
  { name: 'Loans & Advances', value: balanceSheet.assets.currentAssets['Loans & Advances'], color: '#8b5cf6' },
  { name: 'Other Assets', value: balanceSheet.assets.currentAssets['Other Current Assets'] + totalFixedAssets, color: '#06b6d4' },
];

const liabilitiesData = [
  { name: 'Sundry Creditors', value: balanceSheet.liabilities.currentLiabilities['Sundry Creditors'], color: '#f43f5e' },
  { name: 'GST Payable', value: balanceSheet.liabilities.currentLiabilities['GST Payable'], color: '#f59e0b' },
  { name: 'TDS Payable', value: balanceSheet.liabilities.currentLiabilities['TDS Payable'], color: '#10b981' },
  { name: 'Short-term Loans', value: balanceSheet.liabilities.currentLiabilities['Short-term Loans'], color: '#8b5cf6' },
  { name: 'Other Liabilities', value: balanceSheet.liabilities.currentLiabilities['Other Current Liabilities'], color: '#06b6d4' },
];

const equityData = [
  { name: 'Capital Account', value: balanceSheet.liabilities.ownersFunds['Capital Account'], color: '#10b981' },
  { name: 'Reserves & Surplus', value: balanceSheet.liabilities.ownersFunds['Reserves & Surplus'], color: '#8b5cf6' },
];

const compChart = [
  { name: 'Assets', value: totalAssets, color: '#3b82f6' },
  { name: 'Liabilities', value: balancedTotalLiab, color: '#ef4444' },
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg">
        <p className="text-sm font-bold text-slate-800 mb-1">{payload[0].name}</p>
        <p className="text-sm font-bold" style={{ color: payload[0].payload.color || payload[0].color }}>
          {formatINR(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const renderLegend = (props, totalValue) => {
  const { payload } = props;
  return (
    <ul className="flex flex-col gap-2 mt-4 px-2">
      {payload.map((entry, index) => {
        const percentage = ((entry.payload.value / totalValue) * 100).toFixed(0);
        return (
          <li key={`item-${index}`} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-600 truncate max-w-[110px] xl:max-w-[85px] 2xl:max-w-[130px]" title={entry.value}>{entry.value}</span>
            </div>
            <span className="font-bold text-slate-800 shrink-0">{percentage}%</span>
          </li>
        );
      })}
    </ul>
  );
};

const TableHeader = ({ date1, date2, isComparing }) => (
  <div className={`grid ${isComparing ? 'grid-cols-[1fr_minmax(110px,max-content)_minmax(110px,max-content)]' : 'grid-cols-[1fr_minmax(110px,max-content)]'} gap-2 py-1.5 border-b-2 border-slate-300 mb-1 items-end`}>
    <div className="font-bold text-slate-800 text-sm">Particulars</div>
    <div className="text-right flex flex-col leading-tight">
      <span className="font-bold text-slate-800 text-[10px] uppercase">Livetally</span>
      <span className="font-semibold italic text-slate-500 text-[10px]">as at {date1}</span>
    </div>
    {isComparing && (
      <div className="text-right flex flex-col leading-tight">
        <span className="font-bold text-slate-800 text-[10px] uppercase">Livetally</span>
        <span className="font-semibold italic text-slate-500 text-[10px]">as at {date2}</span>
      </div>
    )}
  </div>
);

const DrillDownGroup = ({ title, data, total, isBold = false, isComparing }) => {
  const [expanded, setExpanded] = useState(false);
  const total2 = total * 0.85; // Mocking Period 2 comparison data dynamically
  const gridLayout = isComparing ? 'grid-cols-[1fr_minmax(110px,max-content)_minmax(110px,max-content)]' : 'grid-cols-[1fr_minmax(110px,max-content)]';

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div 
        className={`grid ${gridLayout} gap-2 py-1.5 px-1 cursor-pointer hover:bg-slate-50 transition-colors ${isBold ? 'font-bold text-slate-800 text-[13px]' : 'font-semibold text-slate-700 text-[13px]'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5">
           {Object.keys(data).length > 0 ? (
              <span className="text-slate-400 w-3 flex justify-center">{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>
           ) : <span className="w-3"></span>}
           {title}
        </div>
        <div className="text-right text-slate-800">{formatINR(total)}</div>
        {isComparing && <div className="text-right text-slate-500 font-medium">{formatINR(total2)}</div>}
      </div>
      {expanded && Object.keys(data).length > 0 && (
        <div className="bg-slate-50/50 pb-0.5 mb-0.5 shadow-inner rounded-b-md">
          <div className={`grid ${gridLayout} gap-2 py-1 px-1 pl-6 text-[10px] font-bold text-slate-500 uppercase bg-slate-100/80 border-y border-slate-200 mb-0.5`}>
            <div>Particulars</div>
            <div className="text-right">{isComparing ? 'Debit' : 'Closing Balance'}</div>
            {isComparing && <div className="text-right">Credit</div>}
          </div>
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className={`grid ${gridLayout} gap-2 py-1 px-1 pl-6 text-[12px] text-slate-600 hover:bg-slate-100 transition-colors`}>
              <div className="italic">{k}</div>
              <div className="text-right">{formatINR(v)}</div>
              {isComparing && <div className="text-right text-slate-400">{formatINR(v * 0.85)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BalanceSheet() {
  const [viewType, setViewType] = useState('horizontal');
  const [exportOpen, setExportOpen] = useState(false);
  
  const [date1, setDate1] = useState('2025-03-31');
  const [date2, setDate2] = useState('');
  const isComparing = date2 !== '';

  const gaugeData = [
    { name: 'Working Capital', value: workingCapital, color: '#10b981' },
    { name: 'Remaining', value: totalCurrentAssets - workingCapital, color: '#e2e8f0' }
  ];

  const renderGauge = () => (
    <div className={`relative w-full flex flex-col items-center justify-center pt-8 h-48`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={gaugeData}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={70}
            outerRadius={90}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
            cornerRadius={4}
          >
            {gaugeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute bottom-6 flex flex-col items-center justify-center w-full">
        <span className={`font-black text-slate-800 text-2xl`}>{formatINR(workingCapital, true)}</span>
        <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider text-center px-4">Current Assets - Current Liab</span>
      </div>
    </div>
  );

  const getHealth = (wc) => {
    if (wc > 2000000) return 'Excellent';
    if (wc > 1000000) return 'Good';
    if (wc > 0) return 'Average';
    return 'Critical';
  };

  const health = getHealth(workingCapital);
  const healthColor = health === 'Excellent' ? 'text-emerald-500' : health === 'Good' ? 'text-blue-500' : health === 'Average' ? 'text-amber-500' : 'text-red-500';

  const isVert = viewType === 'vertical';

  const renderLiabilities = () => (
    <div className="flex flex-col h-full min-w-[300px]">
      <div className="bg-amber-100/50 py-1.5 px-3 border-b-2 border-amber-200 mb-1 rounded-t-lg">
        <h2 className="text-xs font-black text-amber-900 uppercase tracking-wider">Liabilities</h2>
      </div>
      <TableHeader date1={date1} date2={date2} isComparing={isComparing} />
      <div className="flex-1">
        <DrillDownGroup title="Capital Account" data={balanceSheet.liabilities.ownersFunds} total={totalOwnersFunds} isBold={true} isComparing={isComparing} />
        <DrillDownGroup title="Loans (Liability)" data={{ 'Term Loan': 0, 'Other Long Term Liabilities': 0 }} total={0} isBold={true} isComparing={isComparing} />
        <DrillDownGroup title="Current Liabilities" data={balanceSheet.liabilities.currentLiabilities} total={totalCurrentLiab} isBold={true} isComparing={isComparing} />
        <DrillDownGroup title="Suspense A/c" data={{}} total={0} isBold={true} isComparing={isComparing} />
        <DrillDownGroup title="Profit & Loss A/c" data={{ 'Opening Balance': profitAndLoss * 0.4, 'Current Period': profitAndLoss * 0.6 }} total={profitAndLoss} isBold={true} isComparing={isComparing} />
      </div>
      <div className={`grid ${isComparing ? 'grid-cols-[1fr_minmax(110px,max-content)_minmax(110px,max-content)]' : 'grid-cols-[1fr_minmax(110px,max-content)]'} gap-2 py-2 px-2 font-black text-slate-900 border-t-2 border-b-2 border-slate-300 mt-2 bg-slate-50 text-[13px]`}>
        <div>Total</div>
        <div className="text-right">{formatINR(balancedTotalLiab)}</div>
        {isComparing && <div className="text-right text-slate-500">{formatINR(balancedTotalLiab * 0.85)}</div>}
      </div>
    </div>
  );

  const renderAssets = () => (
    <div className="flex flex-col h-full min-w-[300px]">
      <div className="bg-emerald-100/50 py-1.5 px-3 border-b-2 border-emerald-200 mb-1 rounded-t-lg">
        <h2 className="text-xs font-black text-emerald-900 uppercase tracking-wider">Assets</h2>
      </div>
      <TableHeader date1={date1} date2={date2} isComparing={isComparing} />
      <div className="flex-1">
        <DrillDownGroup title="Fixed Assets" data={balanceSheet.assets.fixedAssets} total={totalFixedAssets} isBold={true} isComparing={isComparing} />
        <DrillDownGroup title="Investments" data={{}} total={0} isBold={true} isComparing={isComparing} />
        <DrillDownGroup title="Current Assets" data={balanceSheet.assets.currentAssets} total={totalCurrentAssets} isBold={true} isComparing={isComparing} />
      </div>
      <div className={`grid ${isComparing ? 'grid-cols-[1fr_minmax(110px,max-content)_minmax(110px,max-content)]' : 'grid-cols-[1fr_minmax(110px,max-content)]'} gap-2 py-2 px-2 font-black text-slate-900 border-t-2 border-b-2 border-slate-300 mt-2 bg-slate-50 text-[13px]`}>
        <div>Total</div>
        <div className="text-right">{formatINR(totalAssets)}</div>
        {isComparing && <div className="text-right text-slate-500">{formatINR(totalAssets * 0.85)}</div>}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-12">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Balance Sheet</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Compare financial periods</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 shadow-sm transition-all">
            <Filter size={16} />
            Filters
          </button>

          <div className="relative">
            <button 
              onClick={() => setExportOpen(!exportOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 shadow-sm transition-all"
            >
              <Download size={16} />
              Export PDF
            </button>
            
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-slide-up">
                <button className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100">
                  Export Current View
                </button>
                <button className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100">
                  Export Charts
                </button>
                <button className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  Export Complete Balance Sheet
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Assets', value: totalAssets, bg: 'bg-blue-50', border: 'border-blue-100', color: 'text-blue-700', icon: <Wallet size={16} className="text-blue-600" /> },
          { label: 'Current Assets', value: totalCurrentAssets, bg: 'bg-sky-50', border: 'border-sky-100', color: 'text-sky-700', icon: <Building2 size={16} className="text-sky-600" /> },
          { label: 'Total Liabilities', value: balancedTotalLiab, bg: 'bg-red-50', border: 'border-red-100', color: 'text-red-600', icon: <TrendingDown size={16} className="text-red-600" /> },
          { label: "Owner's Equity", value: totalOwnersFunds, bg: 'bg-emerald-50', border: 'border-emerald-100', color: 'text-emerald-700', icon: <TrendingUp size={16} className="text-emerald-600" /> },
        ].map(s => (
          <div key={s.label} className={`glass-card p-3 relative overflow-hidden group`}>
            <div className={`absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 rounded-full ${s.bg} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                <p className={`text-xl font-black text-slate-800`}>{formatINR(s.value)}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                  vs Last Year <span className="text-emerald-500">▲ 12.4%</span>
                </p>
              </div>
              <div className={`w-8 h-8 rounded-lg ${s.bg} border ${s.border} flex items-center justify-center shadow-sm`}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section - Now ALWAYS a horizontal grid */}
      <div className="grid gap-3 mb-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
        <div className="glass-card p-3 flex flex-col h-full">
          <h3 className="text-[11px] font-bold text-slate-800 mb-2 uppercase tracking-wider">Assets Composition</h3>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={assetsData} cx="50%" cy="38%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                  {assetsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend content={(props) => renderLegend(props, totalAssets)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-3 flex flex-col h-full">
          <h3 className="text-[11px] font-bold text-slate-800 mb-2 uppercase tracking-wider">Liabilities Comp.</h3>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={liabilitiesData} cx="50%" cy="38%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                  {liabilitiesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend content={(props) => renderLegend(props, totalCurrentLiab)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-3 flex flex-col h-full">
          <h3 className="text-[11px] font-bold text-slate-800 mb-2 uppercase tracking-wider">Equity Comp.</h3>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={equityData} cx="50%" cy="38%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                  {equityData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend content={(props) => renderLegend(props, totalOwnersFunds)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-3 flex flex-col h-full">
          <h3 className="text-[11px] font-bold text-slate-800 mb-2 uppercase tracking-wider">Assets vs Liab</h3>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={35}>
                  {compChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-3 flex flex-col h-full">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Working Capital</h3>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 ${healthColor}`}>
              {health}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <div className={`relative w-full flex flex-col items-center justify-center pt-2 h-[180px]`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="85%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                  >
                    {gaugeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute bottom-6 flex flex-col items-center justify-center w-full">
                <span className={`font-black text-slate-800 text-xl`}>{formatINR(workingCapital, true)}</span>
                <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider text-center px-2">Current Assets - Current Liab</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Date Pickers */}
        <div className="flex items-center gap-2 p-1 rounded-xl border border-slate-200 bg-white shadow-sm px-3">
          <Calendar size={16} className="text-slate-400" />
          <input 
            type="date" 
            value={date1}
            onChange={(e) => setDate1(e.target.value)}
            className="text-[13px] font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 w-28 cursor-pointer"
          />
          {isComparing ? (
            <>
              <Calendar size={16} className="text-slate-400 ml-1" />
              <input 
                type="date" 
                value={date2}
                onChange={(e) => setDate2(e.target.value)}
                className="text-[13px] font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 w-28 cursor-pointer"
              />
              <button 
                onClick={() => setDate2('')}
                className="ml-2 text-xs text-slate-400 hover:text-red-500 font-bold"
                title="Remove comparison"
              >×</button>
            </>
          ) : (
            <button 
              onClick={() => setDate2('2024-03-31')}
              className="ml-3 text-[11px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-md font-bold transition-colors border border-blue-200"
            >
              + Compare
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex p-1 rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setViewType('horizontal')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
              !isVert ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid size={16} /> <span>Horizontal</span>
          </button>
          <button
            onClick={() => setViewType('vertical')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
              isVert ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Rows size={16} /> <span>Vertical</span>
          </button>
        </div>
      </div>

      {/* Balance Sheet Tally-Style Table */}
      <div className="glass-card p-4 min-h-[400px] overflow-x-auto">
        <div className="min-w-[600px]">
          {isVert ? (
            <div className="flex flex-col gap-6">
              {renderLiabilities()}
              {renderAssets()}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              <div className="border-r border-slate-100 pr-6 lg:pr-8">
                 {renderLiabilities()}
              </div>
              <div>
                 {renderAssets()}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 justify-center">
        <Activity size={14} />
        All values are in INR. Figures are rounded off to 2 decimal places.
      </div>
    </div>
  );
}
