import { useMemo, useState } from 'react';
import { formatINR } from '../../data/mockData';
import { plDrillDownData } from '../../data/plDrillDownData';

import { useSearchParams } from 'react-router-dom';

export default function Level3StockList({ ledgerData, stockItems: propStockItems, stockInfo }) {
  const [, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);

  const allItems = useMemo(() => {
    const raw = propStockItems || plDrillDownData.stockItems?.[ledgerData.id] || [];
    return raw.map((item, idx) => ({
      id: item.id || item.name || idx,
      name: item.name,
      qty: item.closing !== undefined ? item.closing : item.qty,
      unit: item.unit || '',
      rate: item.rate,
      value: item.value,
      negativeStock: item.negativeStock,
    }));
  }, [propStockItems, ledgerData.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allItems.filter((i) => (i.name || '').toLowerCase().includes(q)) : allItems;
  }, [allItems, search]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const startIdx = (safePage - 1) * limit;
  const pageItems = filtered.slice(startIdx, startIdx + limit);
  const oversoldCount = stockInfo?.oversoldItemCount ?? allItems.filter((i) => i.negativeStock).length;

  return (
    <div className="glass-card animate-fade-in overflow-hidden mt-4">
      {/* Header / toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-[13px] font-bold text-slate-800">Closing Stock</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /></svg>
            </span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search item…"
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-[12px] w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-slate-700">Rows per page:</span>
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="text-[12px] font-medium text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-1 focus:outline-none cursor-pointer">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Data-completeness note for oversold items (missing manufacturing journals) */}
      {oversoldCount > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800 font-medium flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          <span>{stockInfo?.note || `${oversoldCount} item(s) show as oversold — manufacturing / stock-journal vouchers are not in the synced data. Reconcile with Tally's Stock Summary.`}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] font-bold text-slate-700">
              <th className="py-2 px-4 w-1/3">Item Name</th>
              <th className="py-2 px-4 w-1/5 text-right">Quantity</th>
              <th className="py-2 px-4 w-1/5 text-right">Rate</th>
              <th className="py-2 px-4 w-1/4 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageItems.length === 0 ? (
              <tr><td colSpan="4" className="py-8 text-center text-[12px] text-slate-500">No items found.</td></tr>
            ) : pageItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td
                  onClick={() => setSearchParams((prev) => {
                    const p = new URLSearchParams(prev);
                    p.set('stockItem', item.id);
                    return p;
                  })}
                  className="py-2 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {item.name}
                  {item.negativeStock && (
                    <span className="ml-2 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide">oversold</span>
                  )}
                </td>
                <td className={`py-2 px-4 text-[12px] font-medium text-right tabular-nums ${item.negativeStock ? 'text-amber-700' : 'text-slate-700'}`}>
                  {Number(item.qty).toLocaleString('en-IN')} {item.unit}
                </td>
                <td className="py-2 px-4 text-[12px] font-medium text-slate-700 text-right tabular-nums">
                  {item.rate ? formatINR(item.rate) : '—'}
                </td>
                <td className="py-2 px-4 text-[12px] font-medium text-slate-800 text-right tabular-nums">
                  {item.value ? formatINR(item.value) : '₹ 0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="py-2.5 px-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="text-[11px] font-medium text-slate-500">
          {total === 0 ? 0 : startIdx + 1}-{Math.min(startIdx + limit, total)} of {total}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}
            className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-40 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className="px-2 text-[12px] font-medium text-slate-600">Page {safePage} / {pages}</span>
          <button onClick={() => setPage(Math.min(pages, safePage + 1))} disabled={safePage >= pages}
            className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-40 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
