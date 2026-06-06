import { useState } from 'react';
import { formatINR } from '../../data/mockData';
import { plDrillDownData } from '../../data/plDrillDownData';

import { useSearchParams } from 'react-router-dom';

export default function Level3StockList({ ledgerData, currentYearData }) {
 const [, setSearchParams] = useSearchParams();
 const stockItems = plDrillDownData.stockItems?.[ledgerData.id] || [];

 return (
 <div className="glass-card animate-fade-in overflow-hidden mt-4">
 
 {/* Header with Date Range matching the screenshot (since it moved from ProfitLoss header) */}
 <div className="flex items-center justify-between p-3 px-4 border-b border-slate-200 bg-slate-50 ">
 <h2 className="text-[13px] font-bold text-slate-800 ">Closing Stock</h2>
 <div className="flex items-center gap-2">
 <span className="text-[12px] font-medium text-slate-700 ">Rows per page:</span>
 <select className="text-[12px] font-medium text-slate-700 bg-transparent focus:outline-none border-none cursor-pointer">
 <option>10</option>
 <option>25</option>
 <option>50</option>
 </select>
 </div>
 </div>

 {/* Vouchers Table */}
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse min-w-[800px]">
 <thead>
 <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] font-bold text-slate-700 ">
 <th className="py-2 px-4 w-1/3">ItemName</th>
 <th className="py-2 px-4 w-1/5 text-right">Quantity</th>
 <th className="py-2 px-4 w-1/5 text-right">Rate</th>
 <th className="py-2 px-4 w-1/4 text-right">Value</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
 {stockItems.length === 0 ? (
 <tr>
 <td colSpan="4" className="py-8 text-center text-[12px] text-slate-500 ">
 No items found.
 </td>
 </tr>
 ) : (
 stockItems.map(item => (
 <tr 
 key={item.id} 
 className="hover:bg-slate-50/80 transition-colors"
 >
 <td 
 onClick={() => setSearchParams(prev => {
 const newParams = new URLSearchParams(prev);
 newParams.set('stockItem', item.id);
 return newParams;
 })}
 className="py-2 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
 >
 {item.name}
 </td>
 <td className="py-2 px-4 text-[12px] font-medium text-slate-700 text-right">
 {item.qty}
 </td>
 <td className="py-2 px-4 text-[12px] font-medium text-slate-700 text-right">
 {item.rate}
 </td>
 <td className="py-2 px-4 text-[12px] font-medium text-slate-800 text-right">
 {item.value > 0 ? formatINR(item.value) : '₹ 0'}
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 {/* Pagination Footer */}
 <div className="py-2.5 px-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 ">
 <div className="text-[11px] font-medium text-slate-500 ">
 1-10 of 158
 </div>

 <div className="flex items-center gap-1">
 <button className="p-1 rounded text-slate-400 hover:bg-slate-200 transition-colors">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
 </button>
 <button className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white text-[12px] font-bold shadow-sm">
 1
 </button>
 <button className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 text-[12px] font-medium transition-colors">
 2
 </button>
 <button className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 text-[12px] font-medium transition-colors">
 3
 </button>
 <button className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 text-[12px] font-medium transition-colors">
 4
 </button>
 <span className="w-7 h-7 flex items-center justify-center text-slate-400 text-[12px]">...</span>
 <button className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 text-[12px] font-medium transition-colors">
 16
 </button>
 <button className="p-1 rounded text-slate-400 hover:bg-slate-200 transition-colors">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
 </button>
 </div>
 </div>
 
 </div>
 );
}

