import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Download, ChevronDown, ChevronRight, Activity, LayoutGrid, Rows, ChevronLeft, Wallet, Building2, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatINR } from '../data/mockData';
import { useDateRange } from '../context/DateContext';
import { useApi } from '../hooks/useApi';
import { getBalanceSheet } from '../api';

// Colours are presentation only (never data). Sliced by index.
const ASSET_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
const LIAB_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#3b82f6'];
const EQUITY_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'];

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

const renderLegend = (props) => {
  const { payload } = props;
  return (
    <ul className="flex flex-col gap-2 mt-4 px-2">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600 truncate max-w-[110px] xl:max-w-[85px] 2xl:max-w-[130px]">{entry.payload.name}</span>
          </div>
          <span className="font-bold text-slate-800 shrink-0">{entry.payload.pct}%</span>
        </li>
      ))}
    </ul>
  );
};

// Recursive Balance-Sheet row (group → sub-group → ledger), data-driven.
function TreeRows({ nodes, depth, expanded, toggle, onDrill, prefix }) {
  const rows = [];
  (nodes || []).forEach((node) => {
    const key = `${prefix}/${node.id}`;
    const isOpen = expanded.has(key);
    const isGroup = node.type === 'group' && node.children?.length;
    rows.push(
      <div key={key}
        className={`grid grid-cols-[1fr_minmax(120px,max-content)] gap-2 py-1.5 transition-colors ${isGroup ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/60'} ${depth === 0 ? 'font-bold text-[13px] text-slate-800' : 'text-[12px] text-slate-600'}`}
        style={{ paddingLeft: 4 + depth * 18, paddingRight: 4 }}
        onClick={() => isGroup && toggle(key)}>
        <div className="flex items-center gap-1.5 min-w-0">
          {isGroup
            ? <span className="text-slate-400 w-3.5 shrink-0">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
            : <span className="w-3.5 shrink-0" />}
          <button
            className={`text-left truncate ${node.isDrillable ? 'text-blue-600 hover:underline' : depth === 0 ? '' : 'italic'}`}
            onClick={(e) => { e.stopPropagation(); if (node.isDrillable) onDrill(node); else if (isGroup) toggle(key); }}>
            {node.name}
          </button>
          {node.unmapped && <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded uppercase">unmapped</span>}
        </div>
        <div className="text-right tabular-nums text-slate-800">{formatINR(node.amount)}</div>
      </div>
    );
    if (isGroup && isOpen) {
      rows.push(...TreeRows({ nodes: node.children, depth: depth + 1, expanded, toggle, onDrill, prefix: key }));
    }
  });
  return rows;
}

function SideTable({ title, accent, nodes, total, expanded, toggle, onDrill }) {
  return (
    <div className="flex flex-col h-full min-w-[300px]">
      <div className={`${accent.bg} py-1.5 px-3 border-b-2 ${accent.border} mb-1 rounded-t-lg`}>
        <h2 className={`text-xs font-black ${accent.text} uppercase tracking-wider`}>{title}</h2>
      </div>
      <div className="grid grid-cols-[1fr_minmax(120px,max-content)] gap-2 py-1.5 border-b-2 border-slate-300 mb-1 items-end px-1">
        <div className="font-bold text-slate-800 text-sm">Particulars</div>
        <div className="text-right font-bold text-slate-800 text-[10px] uppercase">Closing Balance</div>
      </div>
      <div className="flex-1">
        {TreeRows({ nodes, depth: 0, expanded, toggle, onDrill, prefix: title })}
      </div>
      <div className="grid grid-cols-[1fr_minmax(120px,max-content)] gap-2 py-2 px-2 font-black text-slate-900 border-t-2 border-b-2 border-slate-300 mt-2 bg-slate-50 text-[13px]">
        <div>Total</div>
        <div className="text-right tabular-nums">{formatINR(total)}</div>
      </div>
    </div>
  );
}

export default function BalanceSheet() {
  const navigate = useNavigate();
  const { fy, years, selectFy } = useDateRange();
  const [viewType, setViewType] = useState('horizontal');
  const [expanded, setExpanded] = useState(new Set());

  const { data: bs, loading, error } = useApi(() => getBalanceSheet(fy), [fy], { skip: !fy });

  const currentIndex = years.findIndex((y) => y.id === fy);
  const currentYear = years[currentIndex] || { id: fy, label: '' };
  const handlePrevYear = () => { if (currentIndex > 0) { selectFy(years[currentIndex - 1].id); setExpanded(new Set()); } };
  const handleNextYear = () => { if (currentIndex < years.length - 1) { selectFy(years[currentIndex + 1].id); setExpanded(new Set()); } };

  const toggle = (key) => setExpanded((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const onDrill = (node) => navigate(`/reports/pl?ledger=${encodeURIComponent(node.id)}&from=balance-sheet`);

  const assets = bs?.assets || [];
  const liabilities = bs?.liabilities || [];
  const kpis = bs?.kpis || { totalAssets: 0, currentAssets: 0, totalLiabilities: 0, ownersEquity: 0, workingCapital: 0 };
  const charts = bs?.charts || { assetsComposition: [], liabilitiesComposition: [], equityComposition: [], assetsVsLiabilities: [] };
  const totals = bs?.totals || { assets: 0, liabilities: 0, difference: 0 };

  const withColor = (rows, palette) => (rows || []).map((r, i) => ({ ...r, color: palette[i % palette.length] }));
  const assetsData = withColor(charts.assetsComposition, ASSET_COLORS);
  const liabilitiesData = withColor(charts.liabilitiesComposition, LIAB_COLORS);
  const equityData = withColor(charts.equityComposition, EQUITY_COLORS);
  const compChart = (charts.assetsVsLiabilities || []).map((r, i) => ({ ...r, color: i === 0 ? '#3b82f6' : '#ef4444' }));

  const workingCapital = kpis.workingCapital;
  const gaugeBase = Math.max(kpis.currentAssets, Math.abs(workingCapital), 1);
  const gaugeData = [
    { name: 'Working Capital', value: Math.max(workingCapital, 0), color: workingCapital >= 0 ? '#10b981' : '#ef4444' },
    { name: 'Remaining', value: Math.max(gaugeBase - Math.max(workingCapital, 0), 0), color: '#e2e8f0' },
  ];
  const getHealth = (wc) => wc > 2000000 ? 'Excellent' : wc > 1000000 ? 'Good' : wc > 0 ? 'Average' : 'Critical';
  const health = getHealth(workingCapital);
  const healthColor = health === 'Excellent' ? 'text-emerald-500' : health === 'Good' ? 'text-blue-500' : health === 'Average' ? 'text-amber-500' : 'text-red-500';
  const isVert = viewType === 'vertical';

  const cards = [
    { label: 'Total Assets', value: kpis.totalAssets, bg: 'bg-blue-50', border: 'border-blue-100', icon: <Wallet size={16} className="text-blue-600" /> },
    { label: 'Current Assets', value: kpis.currentAssets, bg: 'bg-sky-50', border: 'border-sky-100', icon: <Building2 size={16} className="text-sky-600" /> },
    { label: 'Total Liabilities', value: kpis.totalLiabilities, bg: 'bg-red-50', border: 'border-red-100', icon: <TrendingDown size={16} className="text-red-600" /> },
    { label: "Owner's Equity", value: kpis.ownersEquity, bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <TrendingUp size={16} className="text-emerald-600" /> },
  ];

  const Chart = ({ title, data, total }) => (
    <div className="glass-card p-3 flex flex-col h-full">
      <h3 className="text-[11px] font-bold text-slate-800 mb-2 uppercase tracking-wider">{title}</h3>
      <div className="flex-1 min-h-[220px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-slate-400">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="38%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Balance Sheet</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">as at {bs?.asOf || currentYear.label || '—'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center glass-card h-9 overflow-hidden">
            <button onClick={handlePrevYear} disabled={currentIndex <= 0} className="px-2 h-full text-slate-700 hover:bg-slate-200 disabled:opacity-30 border-r border-slate-200 flex items-center"><ChevronLeft size={16} /></button>
            <div className="px-3 text-[13px] font-bold text-slate-800 flex items-center h-full min-w-[180px] justify-center">{currentYear.label || '—'}</div>
            <button onClick={handleNextYear} disabled={currentIndex >= years.length - 1} className="px-2 h-full text-slate-700 hover:bg-slate-200 disabled:opacity-30 border-l border-slate-200 flex items-center"><ChevronRight size={16} /></button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 shadow-sm"><Download size={16} />Export PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card py-20 text-center text-slate-500 font-medium animate-pulse">Loading Balance Sheet…</div>
      ) : error ? (
        <div className="glass-card py-20 text-center text-red-500 font-medium">{error.message}</div>
      ) : (
        <>
          {/* Reconciliation / data notes */}
          {(totals.difference !== 0 || bs?.meta?.stockNote) && (
            <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {totals.difference !== 0 && <strong>Out of balance by {formatINR(totals.difference)}. </strong>}
                {bs?.meta?.stockNote}
              </span>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {cards.map((s) => (
              <div key={s.label} className="glass-card p-3 relative overflow-hidden group">
                <div className={`absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 rounded-full ${s.bg} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-xl font-black text-slate-800">{formatINR(s.value)}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${s.bg} border ${s.border} flex items-center justify-center shadow-sm`}>{s.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-3 mb-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
            <Chart title="Assets Composition" data={assetsData} />
            <Chart title="Liabilities Comp." data={liabilitiesData} />
            <Chart title="Equity Comp." data={equityData} />
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
                      {compChart.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card p-3 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Working Capital</h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 ${healthColor}`}>{health}</span>
              </div>
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                <div className="relative w-full flex flex-col items-center justify-center pt-2 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gaugeData} cx="50%" cy="85%" startAngle={180} endAngle={0} innerRadius={55} outerRadius={75} dataKey="value" stroke="none" cornerRadius={4}>
                        {gaugeData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute bottom-6 flex flex-col items-center justify-center w-full">
                    <span className="font-black text-slate-800 text-xl">{formatINR(workingCapital, true)}</span>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider text-center px-2">Current Assets − Current Liab</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex p-1 rounded-xl border border-slate-200 bg-white shadow-sm">
              <button onClick={() => setViewType('horizontal')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${!isVert ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid size={16} /> Horizontal</button>
              <button onClick={() => setViewType('vertical')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${isVert ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Rows size={16} /> Vertical</button>
            </div>
          </div>

          {/* Tally-style table */}
          <div className="glass-card p-4 min-h-[400px] overflow-x-auto">
            <div className="min-w-[600px]">
              {isVert ? (
                <div className="flex flex-col gap-6">
                  <SideTable title="Liabilities" accent={{ bg: 'bg-amber-100/50', border: 'border-amber-200', text: 'text-amber-900' }} nodes={liabilities} total={totals.liabilities} expanded={expanded} toggle={toggle} onDrill={onDrill} />
                  <SideTable title="Assets" accent={{ bg: 'bg-emerald-100/50', border: 'border-emerald-200', text: 'text-emerald-900' }} nodes={assets} total={totals.assets} expanded={expanded} toggle={toggle} onDrill={onDrill} />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  <div className="border-r border-slate-100 pr-6 lg:pr-8">
                    <SideTable title="Liabilities" accent={{ bg: 'bg-amber-100/50', border: 'border-amber-200', text: 'text-amber-900' }} nodes={liabilities} total={totals.liabilities} expanded={expanded} toggle={toggle} onDrill={onDrill} />
                  </div>
                  <div>
                    <SideTable title="Assets" accent={{ bg: 'bg-emerald-100/50', border: 'border-emerald-200', text: 'text-emerald-900' }} nodes={assets} total={totals.assets} expanded={expanded} toggle={toggle} onDrill={onDrill} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 justify-center">
            <Activity size={14} />
            All values in INR, rounded to 2 decimals. Assets {formatINR(totals.assets)} = Liabilities {formatINR(totals.liabilities)}.
          </div>
        </>
      )}
    </div>
  );
}
