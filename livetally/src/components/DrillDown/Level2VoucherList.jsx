import React from 'react';
import { formatINR } from '../../data/mockData';
import { Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Level2VoucherList({ vouchers, onVoucherClick, showVehicle = false }) {
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
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Voucher Type</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Voucher Number</th>
                {showVehicle && <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Vehicle No</th>}
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center whitespace-nowrap">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {vouchers.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                  <td className="px-4 py-3 text-[12px] font-semibold text-blue-600 dark:text-blue-400">
                     {row.date}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-slate-900 dark:text-white">
                     {row.name}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-400">
                     {row.type}
                  </td>
                  <td className="px-4 py-3">
                    <span 
                       onClick={() => onVoucherClick(row.id)}
                       className="text-[12px] font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                    >
                       {row.id}
                    </span>
                  </td>
                  {showVehicle && (
                     <td className="px-4 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-400">
                        {row.vehicle || '-'}
                     </td>
                  )}
                  <td className="px-4 py-3 text-[12px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                    {formatINR(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button className="inline-flex items-center justify-center p-1.5 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded transition-colors" title="Download PDF">
                      <FileText size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">1-{vouchers.length} of {vouchers.length * 20}</span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" disabled>
               <ChevronLeft size={16} />
            </button>
            <button className="px-2.5 py-1 rounded bg-blue-600 text-white text-[11px] font-bold shadow-sm">1</button>
            <button className="px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold transition-colors">2</button>
            <button className="px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold transition-colors">3</button>
            <button className="px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold transition-colors">4</button>
            <span className="px-1 text-slate-400">...</span>
            <button className="px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold transition-colors">22</button>
            <button className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
               <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
