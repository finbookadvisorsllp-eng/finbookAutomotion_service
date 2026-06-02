import React from 'react';
import { ArrowLeft, Calendar, FileText, Share2, Plus } from 'lucide-react';
import { formatINR } from '../../data/mockData';
import { useNavigate } from 'react-router-dom';

export default function DrillDownHeader({ 
  level, 
  title, 
  totalAmount, 
  onBack, 
  voucherData,
  dateRange = '01/04/2025 - 31/03/2026'
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        {level > 1 && (
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        
        {level < 3 ? (
          <div>
            <h1 className="text-[13px] font-semibold text-slate-600 dark:text-slate-400 leading-tight">Total {title}:</h1>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{formatINR(totalAmount)}</p>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{voucherData?.partyName}</h1>
            <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">Voucher No: <span className="font-bold text-slate-800 dark:text-slate-200">{voucherData?.voucherNo}</span></p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {level < 3 ? (
          <>


            <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
               <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-l-lg transition-colors border-r border-slate-200 dark:border-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
               </button>
               <button className="px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <Calendar size={14} className="text-slate-500" />
                  {dateRange}
               </button>
               <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-r-lg transition-colors border-l border-slate-200 dark:border-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
               </button>
            </div>
          </>
        ) : (
          <>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <FileText size={14} className="text-slate-500" /> Add Notes
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Create eWay
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <FileText size={14} className="text-red-500" /> View PDF
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Share2 size={14} className="text-blue-500" /> Share PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
}
