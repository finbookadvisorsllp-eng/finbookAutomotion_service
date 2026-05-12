import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import VoucherEntryEngine from '../vouchers/VoucherEntryEngine';

const PurchaseInvoiceWithInventory = ({ isDark, onBack }) => {
  const theme = {
    border: 'var(--app-border)',
    text: 'var(--app-heading)',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-white/50 backdrop-blur-sm" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded-md hover:bg-slate-100 transition-colors" style={{ color: theme.text }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-100 text-emerald-600">
              <FileText size={12} strokeWidth={2.5} />
            </div>
            <h1 className="text-[14px] font-black tracking-tight" style={{ color: theme.text }}>Purchase Invoice (With Inventory)</h1>
          </div>
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

export default PurchaseInvoiceWithInventory;


