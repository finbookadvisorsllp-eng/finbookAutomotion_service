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
    <div className="flex items-center justify-between px-4 py-3 glass-card sticky top-0 z-10 rounded-none border-t-0 border-l-0 border-r-0 rounded-b-xl border-b-slate-200">
      <div className="flex items-center gap-4">
        {level > 1 && (
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        
        {level < 3 ? (
          <div>
            <h1 className="text-[13px] font-semibold text-slate-600 leading-tight">Total {title}:</h1>
            <p className="text-lg font-black text-slate-900 mt-0.5">{formatINR(totalAmount)}</p>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">{voucherData?.partyName}</h1>
            <p className="text-[13px] font-semibold text-slate-600 mt-0.5">Voucher No: <span className="font-bold text-slate-800">{voucherData?.voucherNo}</span></p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {level < 3 ? (
          <>


            <div className="flex items-center glass-card overflow-hidden">
               <button className="p-2 hover:bg-slate-100 text-slate-600 transition-colors border-r border-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
               </button>
               <button className="px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                  <Calendar size={14} className="text-slate-500" />
                  {dateRange}
               </button>
               <button className="p-2 hover:bg-slate-100 text-slate-600 transition-colors border-l border-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
               </button>
            </div>
          </>
        ) : (
          <>
            <button className="flex items-center gap-1.5 px-3 py-1.5 glass-card text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              <FileText size={14} className="text-slate-500" /> Add Notes
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 glass-card text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              Create eWay
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 glass-card text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              <FileText size={14} className="text-red-500" /> View PDF
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 glass-card text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              <Share2 size={14} className="text-blue-500" /> Share PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
}
