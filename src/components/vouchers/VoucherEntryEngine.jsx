import React, { useState } from 'react';
import { 
  Keyboard, 
  FileSpreadsheet, 
  ScanLine, 
  UploadCloud, 
  Download, 
  FileText, 
  CheckCircle2,
  RefreshCw,
  X,
  Save,
  Send,
  Camera,
  Bot
} from 'lucide-react';
import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from './CreateFundFlow';

const VoucherEntryEngine = ({ isDark, defaultMode = 'manual', voucherType = 'sales', onBack }) => {
  const [activeMode, setActiveMode] = useState(defaultMode);
  
  const theme = {
    bg: 'var(--app-content-bg)',
    panel: 'var(--app-panel-bg)',
    border: 'var(--app-border)',
    headerBg: 'var(--app-table-head-bg)',
    text: 'var(--app-heading)',
    mutedText: 'var(--app-muted)',
    inputBg: 'var(--app-control-bg)',
    accent: '#4f46e5',
    accentHover: '#4338ca',
    accentSoft: isDark ? 'rgba(79, 70, 229, 0.15)' : '#eef2ff',
  };

  const NavButton = ({ mode, icon: Icon, label }) => {
    const isActive = activeMode === mode;
    return (
      <button
        onClick={() => setActiveMode(mode)}
        className={`flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${
          isActive 
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30' 
            : 'hover:bg-slate-100/50 hover:text-indigo-600'
        }`}
        style={{ 
          backgroundColor: isActive ? theme.accent : 'transparent',
          color: isActive ? '#fff' : theme.mutedText,
        }}
      >
        <Icon size={14} strokeWidth={isActive ? 3 : 2.5} />
        {label}
      </button>
    );
  };

  const InputField = ({ label, placeholder, type = "text" }) => (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
      <label className="text-xs font-bold opacity-80" style={{ color: theme.text }}>{label}</label>
      <input 
        type={type}
        placeholder={placeholder}
        className="w-full h-10 rounded-lg border px-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-2 w-full h-full animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div 
        className="shrink-0 rounded-2xl border shadow-sm p-3 backdrop-blur-md relative overflow-hidden"
        style={{ 
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
          borderColor: theme.border 
        }}
      >
        <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-[30px]"></div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full relative z-10">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-1.5 rounded-lg border hover:bg-slate-100 transition-colors" style={{ color: theme.text, borderColor: theme.border, backgroundColor: theme.panel }}>
                <X size={14} strokeWidth={3} />
              </button>
            )}
            <div>
              <h2 className="text-[16px] font-black tracking-tight" style={{ color: theme.text }}>
                Voucher Entry Engine
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.mutedText }}>
                Unified Entry System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 rounded-xl" style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.border}` }}>
            <NavButton mode="manual" icon={Keyboard} label="Manual Entry" />
            <NavButton mode="csv" icon={FileSpreadsheet} label="Bulk CSV" />
            <NavButton mode="ocr" icon={ScanLine} label="AI-OCR" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* MANUAL ENTRY SECTION */}
        {activeMode === 'manual' && (
          (voucherType === 'cash_payment' || voucherType === 'bank_payment' || voucherType === 'contra')
            ? <CreateFundFlow isDark={isDark} onBack={onBack} voucherType={voucherType} />
            : (voucherType === 'purchase' || voucherType === 'purchase_invoice' || voucherType === 'purchase_order' || voucherType === 'debit_note') 
              ? <CreatePurchase isDark={isDark} onBack={onBack} voucherType={voucherType} />
              : <CreateSales isDark={isDark} onBack={onBack} voucherType={voucherType} />
        )}

      {/* CSV UPLOAD SECTION */}
      {activeMode === 'csv' && (
        <div className="rounded-2xl border shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
          <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet size={16} />
            </div>
            <h3 className="font-bold text-lg" style={{ color: theme.text }}>Bulk CSV Upload</h3>
            <button className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-bold hover:bg-emerald-50 text-emerald-600 transition-colors" style={{ borderColor: theme.border }}>
              <Download size={14} /> Sample CSV
            </button>
          </div>
          
          <div className="p-6">
            <div 
              className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10"
              style={{ borderColor: theme.border }}
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600">
                <UploadCloud size={32} />
              </div>
              <h4 className="text-base font-bold mb-1" style={{ color: theme.text }}>Drag & Drop your CSV file here</h4>
              <p className="text-sm mb-6" style={{ color: theme.mutedText }}>Supports .csv, .xlsx formats up to 10MB</p>
              <button className="px-6 py-2.5 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors">
                Browse Files
              </button>
            </div>

            <div className="mt-8 border rounded-xl overflow-hidden" style={{ borderColor: theme.border }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-emerald-600" />
                  <span className="text-sm font-bold" style={{ color: theme.text }}>Q2_Sales_Import.csv</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">Ready to Import</span>
              </div>
              
              <div className="px-4 py-2 bg-slate-50/50">
                <div className="h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full"></div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: theme.headerBg }}>
                      <th className="p-3 text-xs font-bold border-b" style={{ borderColor: theme.border, color: theme.mutedText }}>Voucher No</th>
                      <th className="p-3 text-xs font-bold border-b" style={{ borderColor: theme.border, color: theme.mutedText }}>{voucherType === 'purchase' ? 'Vendor' : 'Customer'}</th>
                      <th className="p-3 text-xs font-bold border-b text-right" style={{ borderColor: theme.border, color: theme.mutedText }}>Amount</th>
                      <th className="p-3 text-xs font-bold border-b text-center" style={{ borderColor: theme.border, color: theme.mutedText }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 text-sm font-semibold border-b" style={{ borderColor: theme.border, color: theme.text }}>VOU-901</td>
                      <td className="p-3 text-sm border-b" style={{ borderColor: theme.border, color: theme.text }}>Apex Holdings</td>
                      <td className="p-3 text-sm font-bold border-b text-right" style={{ borderColor: theme.border, color: theme.text }}>₹45,000</td>
                      <td className="p-3 text-sm border-b text-center" style={{ borderColor: theme.border }}><CheckCircle2 size={16} className="text-emerald-500 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-sm font-semibold border-b" style={{ borderColor: theme.border, color: theme.text }}>VOU-902</td>
                      <td className="p-3 text-sm border-b" style={{ borderColor: theme.border, color: theme.text }}>Finolax Advisors</td>
                      <td className="p-3 text-sm font-bold border-b text-right" style={{ borderColor: theme.border, color: theme.text }}>₹12,500</td>
                      <td className="p-3 text-sm border-b text-center" style={{ borderColor: theme.border }}><CheckCircle2 size={16} className="text-emerald-500 mx-auto" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
            <button className="px-5 py-2 rounded-lg font-bold text-sm border hover:bg-slate-50 transition-colors" style={{ borderColor: theme.border, color: theme.text }}>
              Cancel
            </button>
            <button className="px-6 py-2 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2 transition-colors">
              <Send size={14} /> Import to Tally
            </button>
          </div>
        </div>
      )}

      {/* AI-OCR POSTING SECTION */}
      {activeMode === 'ocr' && (
        <div className="rounded-2xl border shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
          <div className="px-6 py-4 border-b flex items-center gap-3 relative overflow-hidden" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6, transparent)', animation: 'shimmer 2s infinite' }}></div>
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center relative z-10">
              <Bot size={16} />
            </div>
            <h3 className="font-bold text-lg relative z-10" style={{ color: theme.text }}>AI Smart Scanning</h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Area */}
            <div className="flex flex-col">
              <div 
                className="flex-1 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer hover:border-purple-500 hover:bg-purple-50/10 min-h-[300px]"
                style={{ borderColor: theme.border }}
              >
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4 text-purple-600 relative overflow-hidden">
                  <Camera size={32} />
                  <div className="absolute inset-0 bg-purple-400/20 translate-y-full animate-[scan_2s_ease-in-out_infinite]"></div>
                </div>
                <h4 className="text-base font-bold mb-1" style={{ color: theme.text }}>Upload Invoice Image/PDF</h4>
                <p className="text-sm mb-6" style={{ color: theme.mutedText }}>Our AI will extract all details automatically</p>
                <button className="px-6 py-2.5 rounded-lg font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-colors flex items-center gap-2">
                  <ScanLine size={16} /> Scan Invoice
                </button>
              </div>
            </div>

            {/* Parsed Result Preview */}
            <div className="border rounded-xl flex flex-col overflow-hidden shadow-sm" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
              <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                <span className="text-sm font-bold" style={{ color: theme.text }}>Parsed Preview</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-100 px-2 py-0.5 rounded">98% Confidence</span>
              </div>
              <div className="p-5 flex-1 flex flex-col gap-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: theme.mutedText }}>Invoice Number</div>
                    <div className="text-sm font-bold bg-white/5 px-2 py-1.5 rounded border border-purple-200/50" style={{ color: theme.text }}>INV-2024-8892</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: theme.mutedText }}>Invoice Date</div>
                    <div className="text-sm font-bold bg-white/5 px-2 py-1.5 rounded border border-purple-200/50" style={{ color: theme.text }}>05-May-2026</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold mb-1" style={{ color: theme.mutedText }}>Party Name</div>
                  <div className="text-sm font-bold bg-white/5 px-2 py-1.5 rounded border border-purple-200/50" style={{ color: theme.text }}>Greenline Ventures Pvt Ltd</div>
                </div>

                <div>
                  <div className="text-xs font-semibold mb-1" style={{ color: theme.mutedText }}>GST Number</div>
                  <div className="text-sm font-bold bg-white/5 px-2 py-1.5 rounded border border-purple-200/50" style={{ color: theme.text }}>27AABCU9603R1ZN</div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t" style={{ borderColor: theme.border }}>
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: theme.mutedText }}>Tax Amount</div>
                    <div className="text-lg font-bold" style={{ color: theme.text }}>₹2,250.00</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold mb-1" style={{ color: theme.mutedText }}>Total Amount</div>
                    <div className="text-2xl font-black text-purple-600">₹14,750.00</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
            <button className="px-5 py-2 rounded-lg font-bold text-sm border hover:bg-slate-50 transition-colors" style={{ borderColor: theme.border, color: theme.text }}>
              Cancel
            </button>
            <button className="px-5 py-2 rounded-lg font-bold text-sm border hover:bg-slate-50 transition-colors text-purple-600" style={{ borderColor: theme.border }}>
              Edit Data
            </button>
            <button className="px-6 py-2 rounded-lg font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-md flex items-center gap-2 transition-colors">
              <Send size={14} /> Push To Tally
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
          100% { transform: translateY(-100%); }
        }
      `}</style>
      </div>
    </div>
  );
};

export default VoucherEntryEngine;
