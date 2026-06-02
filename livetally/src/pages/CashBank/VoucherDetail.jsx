import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cashBankDataV2 } from '../../data/cashBankDataV2';
import { formatINR } from '../../data/mockData';
import { ArrowLeft, Printer, Download, FileText, User, Receipt, PencilLine, Paperclip } from 'lucide-react';

export default function VoucherDetail({ voucherId, yearId, ledgerId }) {
  const navigate = useNavigate();
  const voucherData = cashBankDataV2.vouchers[voucherId];

  if (!voucherData) return <div className="p-8 text-center text-slate-500">Voucher details not found.</div>;

  const navigateBack = () => {
    // If we have a ledger context, go back to the ledger detail, otherwise go to dashboard
    if (ledgerId) {
      navigate(`/cash-bank?ledgerId=${ledgerId}&year=${yearId}`);
    } else {
      // In a real app we might use history.back() or just navigate to the dashboard
      navigate(`/cash-bank`);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-screen pb-10 space-y-4">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between bg-white dark:bg-slate-800 py-4 px-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-4">
        <div className="flex items-start gap-4">
          <button onClick={navigateBack} className="mt-0.5 p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 rounded transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">{voucherData.id}</h1>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded ${voucherData.type === 'Receipt' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                {voucherData.type}
              </span>
            </div>
            <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
              Transaction Date: <span className="text-slate-700 dark:text-slate-300">{voucherData.date}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase">Created By: <span className="text-slate-600 dark:text-slate-300">{voucherData.createdBy}</span></span>
             <span className="text-[10px] font-bold text-slate-400 uppercase">Modified By: <span className="text-slate-600 dark:text-slate-300">{voucherData.modifiedBy}</span></span>
          </div>
          <button className="flex items-center gap-1.5 px-3 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Download size={14} /> PDF
          </button>
          <button className="flex items-center gap-1.5 px-3 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Section 1: Party Info ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <User size={16} className="text-slate-400" />
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Party Information</h2>
          </div>
          <div className="p-4 space-y-3">
             <div className="grid grid-cols-2 gap-2">
                <div>
                   <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Party Name</p>
                   <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{voucherData.party.name}</p>
                </div>
                <div>
                   <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">GST Number</p>
                   <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{voucherData.party.gst}</p>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2">
                <div>
                   <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mobile</p>
                   <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{voucherData.party.mobile}</p>
                </div>
                <div>
                   <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Email</p>
                   <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{voucherData.party.email}</p>
                </div>
             </div>
          </div>
        </div>

        {/* ── Section 2: Transaction Details ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Receipt size={16} className="text-slate-400" />
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Transaction Details</h2>
          </div>
          <div className="p-4 space-y-3 flex flex-col justify-between">
             <div className="grid grid-cols-2 gap-2">
                <div>
                   <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Receipt Amount</p>
                   <p className="text-[16px] font-black text-emerald-600 dark:text-emerald-400">{voucherData.details.receiptAmount > 0 ? formatINR(voucherData.details.receiptAmount) : '-'}</p>
                </div>
                <div>
                   <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Payment Amount</p>
                   <p className="text-[16px] font-black text-red-600 dark:text-red-400">{voucherData.details.paymentAmount > 0 ? formatINR(voucherData.details.paymentAmount) : '-'}</p>
                </div>
             </div>
             <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Transaction Mode</p>
                <span className="inline-block mt-1 px-2.5 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                  {voucherData.details.mode}
                </span>
             </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Accounting Entries ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <FileText size={16} className="text-slate-400" />
          <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Accounting Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 h-9">
                <th className="font-semibold px-4 w-[60px]">Dr/Cr</th>
                <th className="font-semibold px-4">Account Name</th>
                <th className="font-semibold px-4 text-right w-[150px]">Debit (₹)</th>
                <th className="font-semibold px-4 text-right w-[150px]">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {voucherData.entries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-2.5 text-[12px] font-black text-slate-700 dark:text-slate-300">{entry.type}</td>
                  <td className="px-4 py-2.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400">{entry.account}</td>
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800 dark:text-slate-200 text-right tabular-nums">
                    {entry.type === 'Dr' ? formatINR(entry.amount) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800 dark:text-slate-200 text-right tabular-nums">
                    {entry.type === 'Cr' ? formatINR(entry.amount) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
               <tr className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 h-10">
                  <td colSpan="2" className="px-4 text-right text-[12px] font-black text-slate-800 dark:text-slate-200">Total</td>
                  <td className="px-4 text-[12px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                    {formatINR(voucherData.entries.filter(e => e.type === 'Dr').reduce((s, e) => s + e.amount, 0))}
                  </td>
                  <td className="px-4 text-[12px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                    {formatINR(voucherData.entries.filter(e => e.type === 'Cr').reduce((s, e) => s + e.amount, 0))}
                  </td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Bottom Sections: Narration & Attachments ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
               <PencilLine size={16} className="text-slate-400" />
               <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Narration</h2>
            </div>
            <div className="p-4">
               <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 italic">
                 "{voucherData.narration}"
               </p>
            </div>
         </div>

         <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
               <Paperclip size={16} className="text-slate-400" />
               <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Attachments</h2>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center h-[80px]">
               <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">No documents attached.</p>
               <button className="text-[11px] font-bold text-blue-600 hover:underline">Upload Document</button>
            </div>
         </div>
      </div>

    </div>
  );
}
