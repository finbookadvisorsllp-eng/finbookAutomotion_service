import React from 'react';
import { formatINR } from '../../data/mockData';
import { Search, FileText, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Level1Monthly({ months, onMonthClick }) {
  return (
    <div className="p-4 flex-1 flex flex-col h-full animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col flex-1">
        {/* Table Toolbar */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 w-64 shadow-inner">
              <Search size={14} className="text-slate-400" />
              <input type="text" placeholder="Search..." className="bg-transparent border-none outline-none text-[12px] font-medium w-full text-slate-700 dark:text-slate-300 placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600 dark:text-slate-400">
              <span>Rows per page:</span>
              <select className="bg-transparent border-none outline-none font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <option>10</option>
                <option>20</option>
                <option>50</option>
              </select>
            </div>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[12px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
             <FileText size={14} className="text-red-600" /> View PDF
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <div className="flex items-center gap-1">Month <ChevronDown size={12} /></div>
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {months.map((row) => (
                <tr key={row.id} onClick={() => onMonthClick(row.id)} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group">
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline">{row.label}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                    {formatINR(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">1-{months.length} of {months.length}</span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" disabled>
               <ChevronLeft size={16} />
            </button>
            <button className="px-2.5 py-1 rounded bg-blue-600 text-white text-[11px] font-bold shadow-sm">1</button>
            <button className="px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold transition-colors">2</button>
            <button className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
               <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
