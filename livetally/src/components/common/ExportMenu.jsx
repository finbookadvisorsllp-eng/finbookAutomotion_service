import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, FileType, Loader2, ChevronDown } from 'lucide-react';

/**
 * Export dropdown (PDF / Excel / CSV). Report-agnostic.
 *   onExport(format) — format ∈ 'pdf' | 'excel' | 'csv'; may return a promise.
 */
const OPTIONS = [
  { key: 'pdf', label: 'PDF Document', icon: FileText, color: 'text-red-600' },
  { key: 'excel', label: 'Excel Sheet', icon: FileSpreadsheet, color: 'text-emerald-600' },
  { key: 'csv', label: 'CSV File', icon: FileType, color: 'text-blue-600' },
];

export default function ExportMenu({ onExport, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const run = async (fmt) => {
    setBusy(fmt);
    try {
      await onExport?.(fmt);
      setOpen(false);
    } catch (e) {
      // Surface a minimal error; parent may also toast.
      alert(e?.message || 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Export
        <ChevronDown size={13} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                onClick={() => run(opt.key)}
                disabled={!!busy}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50"
              >
                {busy === opt.key ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} className={opt.color} />}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
