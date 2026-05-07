import React, { useState } from 'react';
import { Save, Send, ArrowLeft, Plus, Settings, ChevronDown, CheckCircle2, ChevronUp, Trash2, Calendar, Layout, Search, ArrowUpRight } from 'lucide-react';

const PaymentVoucher = ({ isDark, onBack }) => {
  const theme = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    panel: isDark ? '#1e293b' : '#fff',
    border: isDark ? '#334155' : '#e2e8f0',
    headerBg: isDark ? '#1e293b' : '#fcfdfe',
    text: isDark ? '#f1f5f9' : '#1e293b',
    inputBg: isDark ? '#0f172a' : '#fff',
    mutedText: isDark ? '#94a3b8' : '#64748b',
    accent: '#f43f5e', // Rose for payment
    accentSoft: isDark ? 'rgba(244, 63, 94, 0.2)' : '#fff1f2',
  };

  const InputField = ({ label, placeholder, type = "text", value }) => (
    <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
      <label className="text-[10px] font-semibold opacity-60 truncate" style={{ color: theme.text }}>{label}</label>
      <input 
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="w-full h-8 rounded-md border px-2 text-[11px] outline-none transition-all focus:border-rose-400 focus:ring-1 focus:ring-rose-100"
        style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-white/50 backdrop-blur-sm" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded-md hover:bg-slate-100 transition-colors" style={{ color: theme.text }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-rose-100 text-rose-600">
              <ArrowUpRight size={12} strokeWidth={2.5} />
            </div>
            <h1 className="text-[14px] font-black tracking-tight" style={{ color: theme.text }}>Payment Voucher</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-bold hover:bg-slate-50 transition-colors" style={{ borderColor: theme.border, color: theme.text }}>
            <Save size={12} /> Save Draft
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-[11px] font-bold hover:bg-rose-700 transition-colors bg-rose-600 shadow-sm">
            <CheckCircle2 size={12} /> Create Payment
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-4">
          
          <div className="rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
            <div className="px-3 py-2 border-b font-bold text-[11px] uppercase tracking-wider" style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.headerBg }}>Voucher Details</div>
            <div className="p-4 flex flex-wrap gap-4">
              <InputField label="Voucher No." placeholder="PAY-2026-001" />
              <InputField label="Date" type="date" />
              <InputField label="Account (Cash/Bank)" placeholder="Select Bank/Cash Ledger..." />
              <InputField label="Current Balance" placeholder="0.00 Dr/Cr" />
            </div>
          </div>

          <div className="rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
            <div className="px-3 py-2 border-b font-bold text-[11px] uppercase tracking-wider flex justify-between items-center" style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.headerBg }}>
              <span>Particulars</span>
              <button className="flex items-center gap-1 text-rose-600 hover:text-rose-700 transition-colors"><Plus size={12} /> Add Ledger</button>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="pb-2 text-[10px] font-bold opacity-60 w-8" style={{ color: theme.text }}>By/To</th>
                    <th className="pb-2 text-[10px] font-bold opacity-60" style={{ color: theme.text }}>Particulars (Ledger)</th>
                    <th className="pb-2 text-[10px] font-bold opacity-60 text-right" style={{ color: theme.text }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t" style={{ borderColor: theme.border }}>
                    <td className="py-2 text-[11px] font-semibold" style={{ color: theme.text }}>Dr</td>
                    <td className="py-2"><InputField placeholder="Select Ledger (e.g., Salary, Rent)..." /></td>
                    <td className="py-2"><InputField type="number" placeholder="0.00" /></td>
                  </tr>
                </tbody>
              </table>
              
              <div className="mt-4 pt-4 border-t flex flex-col gap-2" style={{ borderColor: theme.border }}>
                <label className="text-[10px] font-semibold opacity-60" style={{ color: theme.text }}>Narration</label>
                <textarea 
                  className="w-full rounded-md border p-2 text-[11px] outline-none transition-all focus:border-rose-400 focus:ring-1 focus:ring-rose-100 min-h-[60px]"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
                  placeholder="Being payment made for..."
                ></textarea>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PaymentVoucher;
