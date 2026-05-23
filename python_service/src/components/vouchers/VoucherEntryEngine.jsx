import React, { useState, useCallback } from 'react';
import {
  Keyboard, FileSpreadsheet, ScanLine, UploadCloud, Download, FileText,
  CheckCircle2, X, Send, Camera, Bot, Eye, AlertCircle, Loader2, RefreshCw
} from 'lucide-react';
import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from './CreateFundFlow';
import useSalesStore from '../../stores/useSalesStore';
import { toast } from 'sonner';

const VoucherEntryEngine = ({ isDark, defaultMode = 'manual', voucherType = 'sales', onBack }) => {
  const [activeMode, setActiveMode] = useState(defaultMode);
  const theme = {
    bg: 'var(--app-content-bg)', panel: 'var(--app-panel-bg)',
    border: 'var(--app-border)', headerBg: 'var(--app-table-head-bg)',
    text: 'var(--app-heading)', mutedText: 'var(--app-muted)',
    inputBg: 'var(--app-control-bg)', accent: '#4f46e5',
  };

  const NavButton = ({ mode, icon: Icon, label }) => {
    const isActive = activeMode === mode;
    return (
      <button onClick={() => setActiveMode(mode)}
        className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg font-black text-[9.5px] uppercase tracking-widest transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-100/50'}`}
        style={{ backgroundColor: isActive ? theme.accent : 'transparent', color: isActive ? '#fff' : theme.mutedText }}>
        <Icon size={11.5} strokeWidth={isActive ? 3 : 2.5} />{label}
      </button>
    );
  };

  const isSales = !['cash_payment', 'bank_payment', 'contra', 'purchase', 'purchase_invoice', 'purchase_order', 'debit_note'].includes(voucherType);

  return (
    <div className="flex flex-col gap-1.5 w-full h-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="shrink-0 rounded-2xl border shadow-sm p-2 relative overflow-hidden"
        style={{ backgroundColor: isDark ? 'rgba(30,41,59,0.9)' : '#ffffff', borderColor: theme.border }}>
        <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-[30px]" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 w-full relative z-10">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1 rounded-md border hover:bg-slate-100 transition-colors"
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

      <div className="flex-1 overflow-hidden relative">
        {activeMode === 'manual' && (
          voucherType === 'cash_payment' || voucherType === 'bank_payment' || voucherType === 'contra'
            ? <CreateFundFlow isDark={isDark} onBack={onBack} voucherType={voucherType} />
            : voucherType === 'purchase' || voucherType === 'purchase_invoice' || voucherType === 'purchase_order' || voucherType === 'debit_note'
              ? <CreatePurchase isDark={isDark} onBack={onBack} voucherType={voucherType} />
              : <CreateSales isDark={isDark} onBack={onBack} voucherType={voucherType} />
        )}
        {activeMode === 'csv' && <CsvUploadPanel isDark={isDark} theme={theme} voucherType={voucherType} isSales={isSales} />}
        {activeMode === 'ocr' && <OcrPanel isDark={isDark} theme={theme} voucherType={voucherType} isSales={isSales} onSwitchToManual={() => setActiveMode('manual')} />}
      </div>

      <style>{`@keyframes scan{0%{transform:translateY(-100%)}50%{transform:translateY(100%)}100%{transform:translateY(-100%)}}`}</style>
    </div>
  );
};

// ─── OCR Panel ───────────────────────────────────────────────────────────────
const OcrPanel = ({ isDark, theme, voucherType, isSales, onSwitchToManual }) => {
  const { ocr, setOcrFile, runOcrExtraction, clearOcr } = useSalesStore();
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    if (!allowed.includes(file.type)) { toast.error('Invalid file type. Use PDF, JPEG, or PNG.'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('File exceeds 20MB limit.'); return; }
    setOcrFile(file);
  }, [setOcrFile]);

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };
  const handleInput = (e) => handleFile(e.target.files[0]);

  const handleExtract = async () => {
    const result = await runOcrExtraction();
    if (result.success) {
      toast.success(`OCR extracted at ${result.data?.confidence}% confidence. Form autofilled — please review.`);
      onSwitchToManual?.();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="rounded-2xl border shadow-sm overflow-auto h-full" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
      <div className="px-6 py-4 border-b flex items-center gap-3 relative overflow-hidden" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(90deg,transparent,#8b5cf6,transparent)', animation: 'shimmer 2s infinite' }} />
        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center relative z-10"><Bot size={16} /></div>
        <h3 className="font-bold text-lg relative z-10" style={{ color: theme.text }}>AI Smart Scanning</h3>
        {ocr.file && <button onClick={clearOcr} className="ml-auto text-slate-400 hover:text-red-500 transition-colors z-10"><X size={16} /></button>}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload / Preview Column */}
        <div className="flex flex-col gap-4">
          {!ocr.file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[300px] transition-all cursor-pointer ${dragOver ? 'border-purple-500 bg-purple-50/20' : 'hover:border-purple-400'}`}
              style={{ borderColor: dragOver ? '#8b5cf6' : theme.border }}
            >
              <label className="cursor-pointer flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 relative overflow-hidden">
                  <Camera size={32} />
                  <div className="absolute inset-0 bg-purple-400/20" style={{ animation: 'scan 2s ease-in-out infinite' }} />
                </div>
                <h4 className="text-base font-bold" style={{ color: theme.text }}>Upload Invoice / PDF</h4>
                <p className="text-sm" style={{ color: theme.mutedText }}>Drag & drop or click. PDF, JPEG, PNG up to 20MB</p>
                <span className="px-6 py-2.5 rounded-lg font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-md flex items-center gap-2">
                  <ScanLine size={16} /> Browse Files
                </span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff" onChange={handleInput} />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-3 h-full">
              {/* Document Preview */}
              <div className="rounded-xl border overflow-hidden flex-1 min-h-[300px] relative" style={{ borderColor: theme.border }}>
                <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                  <Eye size={14} className="text-purple-500" />
                  <span className="text-[11px] font-bold" style={{ color: theme.text }}>{ocr.file.name}</span>
                  <span className="ml-auto text-[10px] text-slate-400">{(ocr.file.size / 1024).toFixed(0)} KB</span>
                </div>
                {ocr.file.type === 'application/pdf' ? (
                  <iframe src={ocr.previewUrl} className="w-full h-[340px] border-0" title="PDF Preview" />
                ) : (
                  <img src={ocr.previewUrl} alt="Invoice Preview" className="w-full h-[340px] object-contain bg-slate-50" />
                )}
              </div>

              {/* Progress bar */}
              {ocr.isExtracting && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold" style={{ color: theme.mutedText }}>
                    <span>Extracting data…</span><span>{ocr.uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${ocr.uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {ocr.error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold">
                  <AlertCircle size={14} />{ocr.error}
                </div>
              )}

              <button
                onClick={handleExtract}
                disabled={ocr.isExtracting}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {ocr.isExtracting ? <><Loader2 size={16} className="animate-spin" /> Scanning…</> : <><ScanLine size={16} /> Extract & Autofill</>}
              </button>
            </div>
          )}
        </div>

        {/* Parsed Result Preview */}
        <div className="border rounded-xl flex flex-col overflow-hidden shadow-sm" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
          <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
            <span className="text-sm font-bold" style={{ color: theme.text }}>Extracted Preview</span>
            {ocr.result && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                {ocr.result.confidence}% Confidence
              </span>
            )}
          </div>
          <div className="p-5 flex-1 flex flex-col gap-4">
            {!ocr.result ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3" style={{ color: theme.mutedText }}>
                <Bot size={32} className="opacity-20" />
                <p className="text-sm font-medium">Upload a document to see extracted fields here</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Invoice Number', val: ocr.result.formFields?.invoiceNumber },
                    { label: 'Invoice Date', val: ocr.result.formFields?.invoiceDate },
                    { label: 'Party Ledger', val: ocr.result.formFields?.partyLedger },
                    { label: 'Party GSTIN', val: ocr.result.formFields?.partyGstin },
                    { label: 'Sales Ledger', val: ocr.result.formFields?.salesLedger },
                    { label: 'HSN/SAC', val: ocr.result.formFields?.salesLines?.[0]?.hsnSacCode },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div className="text-[10px] font-semibold mb-1" style={{ color: theme.mutedText }}>{label}</div>
                      <div className="text-sm font-bold px-2 py-1.5 rounded border border-purple-200/50 truncate" style={{ color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }}>
                        {val || '—'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t" style={{ borderColor: theme.border }}>
                  <div>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: theme.mutedText }}>Base Amount</div>
                    <div className="text-lg font-bold" style={{ color: theme.text }}>₹{ocr.result.formFields?.baseTotal?.toLocaleString('en-IN') || '0.00'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold mb-1" style={{ color: theme.mutedText }}>Grand Total</div>
                    <div className="text-2xl font-black text-purple-600">₹{ocr.result.formFields?.grandTotal?.toLocaleString('en-IN') || '0.00'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                  <CheckCircle2 size={14} />Form autofilled — switch to Manual Entry to review and submit
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
};

// ─── CSV Upload Panel ─────────────────────────────────────────────────────────
const CsvUploadPanel = ({ isDark, theme, voucherType, isSales }) => {
  const { csv, setCsvFile, previewCsv, importCsv, clearCsv, downloadSampleCsv } = useSalesStore();
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx'].includes(ext)) { toast.error('Only CSV or XLSX files allowed'); return; }
    setCsvFile(file);
  };

  const handlePreview = async () => {
    const res = await previewCsv();
    if (!res.success) toast.error(res.message);
  };

  const handleImport = async () => {
    const res = await importCsv(voucherType);
    if (res.success) toast.success(`Imported ${res.data?.inserted} records successfully`);
    else toast.error(res.message);
  };

  return (
    <div className="rounded-2xl border shadow-sm overflow-auto h-full" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
      <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><FileSpreadsheet size={16} /></div>
        <h3 className="font-bold text-lg" style={{ color: theme.text }}>Bulk CSV Upload</h3>
        <button onClick={() => downloadSampleCsv(voucherType)}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-bold hover:bg-emerald-50 text-emerald-600 transition-colors"
          style={{ borderColor: theme.border }}>
          <Download size={14} /> Sample CSV
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {/* Drop Zone */}
        {!csv.file ? (
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all ${dragOver ? 'border-emerald-500 bg-emerald-50/10' : 'hover:border-emerald-400'}`}
            style={{ borderColor: dragOver ? '#10b981' : theme.border }}>
            <label className="cursor-pointer flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><UploadCloud size={32} /></div>
              <h4 className="text-base font-bold" style={{ color: theme.text }}>Drag & Drop your CSV file</h4>
              <p className="text-sm" style={{ color: theme.mutedText }}>Supports .csv, .xlsx up to 10MB</p>
              <span className="px-6 py-2.5 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">Browse Files</span>
              <input type="file" className="hidden" accept=".csv,.xlsx" onChange={(e) => handleFile(e.target.files[0])} />
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
            <FileText size={20} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: theme.text }}>{csv.file.name}</p>
              <p className="text-[11px]" style={{ color: theme.mutedText }}>{(csv.file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={clearCsv} className="text-slate-400 hover:text-red-500 transition-colors shrink-0"><X size={16} /></button>
          </div>
        )}

        {/* Preview Results */}
        {csv.preview && (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: theme.border }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold" style={{ color: theme.text }}>Preview</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">{csv.preview.validCount} valid</span>
                {csv.preview.failedCount > 0 && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">{csv.preview.failedCount} errors</span>}
              </div>
              <span className="text-[11px]" style={{ color: theme.mutedText }}>{csv.preview.totalRows} total rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead><tr style={{ backgroundColor: theme.headerBg }}>
                  {['Invoice No', 'Party', 'Date', 'Base Amt', 'GST%', 'Total'].map((h) => (
                    <th key={h} className="p-3 text-[11px] font-bold border-b" style={{ borderColor: theme.border, color: theme.mutedText }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {csv.preview.preview?.map((row, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: theme.border }}>
                      <td className="p-3 text-[12px] font-semibold" style={{ color: theme.text }}>{row.invoiceNumber}</td>
                      <td className="p-3 text-[12px]" style={{ color: theme.text }}>{row.partyLedger}</td>
                      <td className="p-3 text-[12px]" style={{ color: theme.text }}>{row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="p-3 text-[12px] text-right font-bold" style={{ color: theme.text }}>₹{row.baseTotal?.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-[12px] text-center" style={{ color: theme.text }}>{row.salesLines?.[0]?.gstRate || 0}%</td>
                      <td className="p-3 text-[12px] text-right font-black text-indigo-600">₹{row.grandTotal?.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csv.preview.errors?.length > 0 && (
              <div className="p-4 border-t bg-red-50" style={{ borderColor: theme.border }}>
                <p className="text-[11px] font-black text-red-600 mb-2">Row Errors:</p>
                {csv.preview.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-[11px] text-red-500">Row {e.row}: {e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {csv.error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold">
            <AlertCircle size={14} />{csv.error}
          </div>
        )}

        {csv.importResult && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
            <CheckCircle2 size={14} />Imported {csv.importResult.inserted} records. {csv.importResult.failed} failed.
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t flex items-center justify-end gap-3 sticky bottom-0" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
        <button onClick={clearCsv} className="px-5 py-2 rounded-lg font-bold text-sm border hover:bg-slate-50 transition-colors" style={{ borderColor: theme.border, color: theme.text }}>
          Cancel
        </button>
        {csv.file && !csv.preview && (
          <button onClick={handlePreview} disabled={csv.isPreviewLoading}
            className="px-6 py-2 rounded-lg font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 transition-colors disabled:opacity-60">
            {csv.isPreviewLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Preview CSV
          </button>
        )}
        {csv.preview && csv.preview.validCount > 0 && (
          <button onClick={handleImport} disabled={csv.isImporting}
            className="px-6 py-2 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2 transition-colors disabled:opacity-60">
            {csv.isImporting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Import {csv.preview.validCount} Records
          </button>
        )}
      </div>
    </div>
  );
};

export default VoucherEntryEngine;
