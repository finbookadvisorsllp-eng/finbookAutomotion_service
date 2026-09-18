import React, { useState, useCallback } from 'react';
import {
  Keyboard, FileSpreadsheet, ScanLine, UploadCloud, Download, FileText,
  CheckCircle2, X, Send, Camera, Bot, Eye, AlertCircle, Loader2, RefreshCw
} from 'lucide-react';
import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from './CreateFundFlow';
import BulkUploadPanel from '../bulk-upload/BulkUploadPanel';
import useSalesStore from '../../stores/useSalesStore';
import { toast } from 'sonner';

const VoucherEntryEngine = ({ isDark, defaultMode = 'manual', voucherType = 'sales', onBack }) => {
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [activeVoucherType, setActiveVoucherType] = useState(voucherType);

  React.useEffect(() => {
    setActiveVoucherType(voucherType);
  }, [voucherType]);

  const handleBack = (type) => {
    if (onBack) {
      onBack(type || activeVoucherType);
    }
  };

  const theme = {
    bg: 'var(--app-content-bg)', panel: 'var(--app-panel-bg)',
    border: 'var(--app-border)', headerBg: 'var(--app-table-head-bg)',
    text: 'var(--app-heading)', mutedText: 'var(--app-muted)',
    inputBg: 'var(--app-control-bg)', accent: 'var(--app-accent)',
  };

  const NavButton = ({ mode, icon: Icon, label }) => {
    const isActive = activeMode === mode;
    return (
      <button onClick={() => setActiveMode(mode)}
        className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg font-black text-[9.5px] uppercase tracking-widest transition-all ${isActive ? 'bg-[var(--app-accent)] text-white shadow-md' : 'hover:bg-[var(--app-table-head-bg)]/50'}`}
        style={{ backgroundColor: isActive ? theme.accent : 'transparent', color: isActive ? '#fff' : theme.mutedText }}>
        <Icon size={11.5} strokeWidth={isActive ? 3 : 2.5} />{label}
      </button>
    );
  };

  const isSales = !['cash_payment', 'bank_payment', 'contra', 'purchase', 'purchase_invoice', 'purchase_order', 'debit_note'].includes(activeVoucherType);

  return (
    <div className="flex flex-col gap-1.5 w-full h-full animate-in fade-in duration-500">
      {/* Header */}
      {activeMode !== 'manual' && (
        <div className="shrink-0 rounded-2xl border shadow-sm p-2 relative overflow-hidden"
          style={{ backgroundColor: isDark ? 'rgba(30,41,59,0.9)' : '#ffffff', borderColor: theme.border }}>
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-[var(--app-accent-soft)] rounded-full blur-[30px]" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 w-full relative z-10">
            <div className="flex items-center gap-2">
              {onBack && (
                <button onClick={() => handleBack(activeVoucherType)} className="p-1 rounded-md border hover:bg-[var(--app-table-head-bg)] transition-colors"
                  style={{ color: theme.text, borderColor: theme.border, backgroundColor: theme.panel }}>
                  <X size={11.5} strokeWidth={3} />
                </button>
              )}
              <div>
                <h2 className="text-[12.5px] font-black tracking-tight" style={{ color: theme.text }}>Voucher Entry Engine</h2>
                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: theme.mutedText }}>Unified Entry System</p>
              </div>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.border}` }}>
              <NavButton mode="manual" icon={Keyboard} label="Manual Entry" />
              <NavButton mode="csv" icon={FileSpreadsheet} label="Bulk CSV" />
              <NavButton mode="ocr" icon={ScanLine} label="AI-OCR" />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {activeMode === 'manual' && (
          activeVoucherType === 'cash_payment' || activeVoucherType === 'bank_payment' || activeVoucherType === 'contra'
            ? <CreateFundFlow isDark={isDark} onBack={handleBack} voucherType={activeVoucherType} onVoucherTypeChange={setActiveVoucherType} />
            : activeVoucherType === 'purchase' || activeVoucherType === 'purchase_invoice' || activeVoucherType === 'purchase_order' || activeVoucherType === 'debit_note'
              ? <CreatePurchase isDark={isDark} onBack={handleBack} voucherType={activeVoucherType} onVoucherTypeChange={setActiveVoucherType} />
              : <CreateSales isDark={isDark} onBack={handleBack} voucherType={activeVoucherType} onVoucherTypeChange={setActiveVoucherType} />
        )}
        {activeMode === 'csv' && <BulkUploadPanel ocrOnly={false} />}
        {activeMode === 'ocr' && <BulkUploadPanel ocrOnly={true} />}
      </div>

      <style>{`@keyframes scan{0%{transform:translateY(-100%)}50%{transform:translateY(100%)}100%{transform:translateY(-100%)}}`}</style>
    </div>
  );
};

export default VoucherEntryEngine;
