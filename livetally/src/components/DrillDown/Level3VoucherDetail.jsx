import React from 'react';
import { formatINR } from '../../data/mockData';

export default function Level3VoucherDetail({ voucherData }) {
  if (!voucherData) return null;

  return (
    <div className="p-4 flex-1 flex flex-col gap-4 animate-fade-in">
      <div className="glass-card rounded-lg shadow-sm border-0">
        {/* Transaction Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
           <div className="text-[12px] font-bold text-slate-800">
              Transaction Date: <span className="font-semibold text-slate-600">{voucherData.date}</span>
           </div>
           <div className="text-[12px] font-bold text-slate-800">
              Type: <span className="font-semibold text-slate-600">{voucherData.type}</span>
           </div>
        </div>

        {/* Items Section */}
        <div className="p-4 border-b border-slate-100">
           <h3 className="text-sm font-black text-slate-900 mb-3">Items</h3>
           <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700">Sr.No</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700">Items Name</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700">HSN/SAC</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700">Quantity</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 text-right">Rate</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 text-right">Gr.Rate</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700">Dis.(%)</th>
                       <th className="px-3 py-2 text-[11px] font-bold text-slate-700 text-right">Amount</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                     {voucherData.items.map((item) => (
                       <tr key={item.srNo} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-[12px] font-semibold text-slate-600">{item.srNo}</td>
                          <td className="px-3 py-2 text-[12px] font-bold text-slate-800">{item.name}</td>
                          <td className="px-3 py-2 text-[12px] font-medium text-slate-600">{item.hsn}</td>
                          <td className="px-3 py-2 text-[12px] font-bold text-slate-800">{item.qty} {item.unit}</td>
                          <td className="px-3 py-2 text-[12px] font-medium text-slate-600 text-right tabular-nums">
                             <span className="font-bold text-slate-800">{formatINR(item.rate)}</span>/{item.unit}
                          </td>
                          <td className="px-3 py-2 text-[12px] font-medium text-slate-600 text-right tabular-nums">
                             <span className="font-bold text-slate-800">{formatINR(item.grossRate)}</span>/{item.unit}
                          </td>
                          <td className="px-3 py-2 text-[12px] font-semibold text-slate-600">{item.discount}</td>
                          <td className="px-3 py-2 text-[12px] font-black text-slate-900 text-right tabular-nums">{formatINR(item.amount)}</td>
                       </tr>
                    ))}
                 </tbody>
                 <tfoot className="bg-slate-50 border-t border-slate-100">
                    <tr>
                       <td colSpan="3" className="px-3 py-2 text-[12px] font-black text-slate-900">Total</td>
                       <td colSpan="4" className="px-3 py-2 text-[12px] font-black text-slate-900 text-center tabular-nums">
                          {voucherData.items.reduce((sum, item) => sum + item.qty, 0).toFixed(3)}
                       </td>
                       <td className="px-3 py-2 text-[12px] font-black text-slate-900 text-right tabular-nums">
                          {formatINR(voucherData.items.reduce((sum, item) => sum + item.amount, 0))}
                       </td>
                    </tr>
                 </tfoot>
              </table>
           </div>
        </div>

        {/* Summary Section */}
        <div className="p-4 border-b border-slate-100">
           <h3 className="text-sm font-black text-slate-900 mb-3">Summary</h3>
           <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
              {voucherData.summary.map((sumItem, index) => (
                 <div key={index} className="flex justify-between items-center pb-2 border-b border-slate-200 last:border-0 last:pb-0">
                    <span className="text-[12px] font-bold text-slate-700">{sumItem.name}</span>
                    <span className="text-[12px] font-bold text-slate-900 tabular-nums">{formatINR(sumItem.amount)}</span>
                 </div>
              ))}
           </div>
        </div>

        {/* Gross Total Section */}
        <div className="p-4 bg-slate-50 flex justify-between items-center rounded-b-lg border-t border-slate-100">
           <h2 className="text-lg font-black text-slate-900">Gross Total</h2>
           <span className="text-xl font-black text-slate-900 tabular-nums">{formatINR(voucherData.grossTotal)}</span>
        </div>
      </div>
    </div>
  );
}
