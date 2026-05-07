import React, { useState } from 'react';
import { Save, Send, ArrowLeft, Plus, Settings, ChevronDown, CheckCircle2, ChevronUp, Trash2, Calendar, Layout, Search, FileMinus } from 'lucide-react';
import VoucherEntryEngine from './VoucherEntryEngine';

const DebitNote = ({ isDark, onBack }) => {
  const theme = {
    bg: 'var(--app-content-bg)',
    panel: 'var(--app-panel-bg)',
    border: 'var(--app-border)',
    headerBg: 'var(--app-table-head-bg)',
    text: 'var(--app-heading)',
    inputBg: 'var(--app-control-bg)',
    mutedText: 'var(--app-muted)',
    accent: '#10b981',
    accentSoft: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
  };

  const InputField = ({ label, placeholder, type = "text", value }) => (
    <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
      <label className="text-[10px] font-semibold opacity-60 truncate" style={{ color: theme.text }}>{label}</label>
      <input 
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="w-full h-8 rounded-md border px-2 text-[11px] outline-none transition-all focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
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
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-orange-100 text-orange-600">
              <FileMinus size={12} strokeWidth={2.5} />
            </div>
            <h1 className="text-[14px] font-black tracking-tight" style={{ color: theme.text }}>Debit Note (Purchase Return)</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-bold hover:bg-slate-50 transition-colors" style={{ borderColor: theme.border, color: theme.text }}>
            <Save size={12} /> Save Draft
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-[11px] font-bold hover:bg-orange-700 transition-colors bg-orange-600 shadow-sm">
            <CheckCircle2 size={12} /> Save Return
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
        <div className="max-w-6xl mx-auto">
          <VoucherEntryEngine isDark={isDark} defaultMode="manual" voucherType="purchase" />
        </div>
      </div>
    </div>
  );
};

export default DebitNote;
