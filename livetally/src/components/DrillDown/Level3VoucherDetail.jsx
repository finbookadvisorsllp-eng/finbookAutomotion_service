import React from 'react';
import { formatINR } from '../../data/mockData';

export default function Level3VoucherDetail({ voucherData }) {
  if (!voucherData) return null;

  return (
    <div className="p-4 flex-1 flex flex-col gap-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
        {/* Transaction Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 dark:border-slate-700">
           <div className="text-[12px] font-bold text-slate-800 dark:text-slate-200">
              Transaction Date: <span className="font-semibold text-slate-600 dark:text-slate-400">{voucherData.date}</span>
           </div>
           <div className="text-[12px] font-bold text-slate-800 dark:text-slate-200">
              Type: <span className="font-semibold text-slate-600 dark:text-slate-400">{voucherData.type}</span>
           </div>
        </div>

        {/* Items Section */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
           <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Items</h3>
           <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">Sr.No</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">Items Name</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">HSN/SAC</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">Quantity</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right">Rate</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right">Gr.Rate</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">Dis.(%)</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right">Amount</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {voucherData.items.map((item) => (
                       <tr key={item.srNo} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-3 py-2 text-[12px] font-semibold text-slate-600 dark:text-slate-400">{item.srNo}</td>
                          <td className="px-3 py-2 text-[12px] font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                          <td className="px-3 py-2 text-[12px] font-medium text-slate-600 dark:text-slate-400">{item.hsn}</td>
                          <td className="px-3 py-2 text-[12px] font-bold text-slate-800 dark:text-slate-200">{item.qty} {item.unit}</td>
                          <td className="px-3 py-2 text-[12px] font-medium text-slate-600 dark:text-slate-400 text-right tabular-nums">
                             <span className="font-bold text-slate-800 dark:text-slate-200">{formatINR(item.rate)}</span>/{item.unit}
                          </td>
                          <td className="px-3 py-2 text-[12px] font-medium text-slate-600 dark:text-slate-400 text-right tabular-nums">
                             <span className="font-bold text-slate-800 dark:text-slate-200">{formatINR(item.grossRate)}</span>/{item.unit}
                          </td>
                          <td className="px-3 py-2 text-[12px] font-semibold text-slate-600 dark:text-slate-400">{item.discount}</td>
                          <td className="px-3 py-2 text-[12px] font-black text-slate-900 dark:text-white text-right tabular-nums">{formatINR(item.amount)}</td>
                       </tr>
                    ))}
                 </tbody>
                 <tfoot className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700">
                    <tr>
                       <td colSpan="3" className="px-3 py-2 text-[12px] font-black text-slate-900 dark:text-white">Total</td>
                       <td colSpan="4" className="px-3 py-2 text-[12px] font-black text-slate-900 dark:text-white text-center tabular-nums">
                          {voucherData.items.reduce((sum, item) => sum + item.qty, 0).toFixed(3)}
                       </td>
                       <td className="px-3 py-2 text-[12px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                          {formatINR(voucherData.items.reduce((sum, item) => sum + item.amount, 0))}
                       </td>
                    </tr>
                 </tfoot>
              </table>
           </div>
        </div>

        {/* Summary Section */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
           <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Summary</h3>
           <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2 border border-slate-200 dark:border-slate-700">
              {voucherData.summary.map((sumItem, index) => (
                 <div key={index} className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700 last:border-0 last:pb-0">
                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300">{sumItem.name}</span>
                    <span className="text-[12px] font-bold text-slate-900 dark:text-white tabular-nums">{formatINR(sumItem.amount)}</span>
                 </div>
              ))}
           </div>
        </div>

        {/* Gross Total Section */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center rounded-b-lg">
           <h2 className="text-lg font-black text-slate-900 dark:text-white">Gross Total</h2>
           <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{formatINR(voucherData.grossTotal)}</span>
        </div>
      </div>
    </div>
  );
}
