import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Download, RefreshCw, FolderOpen, UploadCloud, LayoutList,
  Check, Edit2, SlidersHorizontal, Search, Filter, Sparkles, ChevronRight,
  CheckCircle2, AlertCircle, AlertTriangle, X, Database, Copy, ChevronDown,
  Info, Zap, FileText, Shield, BarChart2, Plus, Wand2, SkipForward, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import useSalesStore from '../../stores/useSalesStore';
import usePurchaseStore from '../../stores/usePurchaseStore';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  Error:   { color: 'rose',   icon: AlertCircle,   label: 'Error'   },
  Warning: { color: 'amber',  icon: AlertTriangle,  label: 'Warning' },
  Info:    { color: 'blue',   icon: Info,           label: 'Info'    },
};

const CATEGORY_ORDER = [
  'Date', 'Voucher', 'Party/Ledger', 'Inventory', 'Amount', 'GST',
  'Calculation', 'TDS/TCS', 'Compliance', 'Bank', 'Contact',
  'Currency', 'Cost Center', 'Duplicate', 'Voucher Rules'
];

// ─────────────────────────────────────────────────────────────────────────────
// Field → col index resolver
// ─────────────────────────────────────────────────────────────────────────────

function buildColIdxMap(columnMapping = [], headers = []) {
  const map = {};
  columnMapping.forEach(m => {
    if (m.standard_erp_field === 'Unmapped') return;
    const ci = m.col_idx !== undefined
      ? m.col_idx
      : headers.findIndex(h => String(h || '').trim().toLowerCase() === String(m.original_name || '').trim().toLowerCase());
    if (ci !== -1 && !(m.standard_erp_field in map)) {
      map[m.standard_erp_field] = ci;
    }
  });
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence bar component
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceBar({ value = 1.0 }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-black text-slate-400 tabular-nums">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity badge
// ─────────────────────────────────────────────────────────────────────────────

function SeverityBadge({ severity, small = false }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Info;
  const Icon = cfg.icon;
  const sz = small ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 ${sz} rounded-full font-black
      bg-${cfg.color}-50 dark:bg-${cfg.color}-950/20
      text-${cfg.color}-700 dark:text-${cfg.color}-400
      border border-${cfg.color}-200/40`}>
      <Icon size={small ? 7 : 8} />
      <span>{cfg.label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ExcelBulkUploadReview({
  previewDoc,
  excelGridData,
  setExcelGridData,
  setDocuments,
  onClose
}) {
  // UI state
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [sidebarMode, setSidebarMode] = useState('summary'); // 'summary' | 'report' | 'row'
  const [showSidebar, setShowSidebar] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('All Rows');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [reportSeverity, setReportSeverity] = useState('All');
  const [reportCategory, setReportCategory] = useState('All');
  const [reportSearch, setReportSearch] = useState('');

  // Resolution tracking
  const [resolvedIssues, setResolvedIssues] = useState({}); // id → 'applied'|'ignored'|'skipped'|'created'
  const [appliedFixes, setAppliedFixes] = useState({});

  // Freeze original data for resolution comparison
  const [initialGridData] = useState(() => excelGridData);

  // Load master data
  const salesMasterData = useSalesStore(s => s.masterData);
  const purchaseMasterData = usePurchaseStore(s => s.masterData);

  useEffect(() => {
    useSalesStore.getState().fetchMasterData();
    usePurchaseStore.getState().fetchMasterData();
  }, []);

  const partyLedgers = useMemo(() => [
    ...(salesMasterData?.partyLedgers || []),
    ...(purchaseMasterData?.partyLedgers || [])
  ], [salesMasterData?.partyLedgers, purchaseMasterData?.partyLedgers]);

  // ── Column index map ──────────────────────────────────────────────────────

  const colIdxMap = useMemo(() => {
    const headers = excelGridData[1] || [];
    return buildColIdxMap(previewDoc.columnMapping || [], headers);
  }, [previewDoc.columnMapping, excelGridData]);

  // ── Document type ─────────────────────────────────────────────────────────

  const docType = useMemo(() => {
    if (previewDoc.type && previewDoc.type !== 'Unknown') return previewDoc.type;
    if (previewDoc.document_type) return previewDoc.document_type;
    const name = (previewDoc.name || '').toLowerCase();
    if (name.includes('bank') || name.includes('statement')) return 'Bank Statement';
    if (name.includes('payment')) return 'Payment Voucher';
    if (name.includes('receipt')) return 'Receipt Voucher';
    if (name.includes('contra')) return 'Contra Voucher';
    if (name.includes('purchase')) return 'Purchase Voucher';
    return 'Sales Voucher';
  }, [previewDoc]);

  // ── Legacy cols map (for cell highlighting fallback) ─────────────────────

  const cols = useMemo(() => ({
    date:         colIdxMap['Date'] ?? -1,
    invoice:      colIdxMap['Voucher No'] ?? -1,
    party:        colIdxMap['Party Name'] ?? -1,
    ledger:       colIdxMap['Ledger'] ?? -1,
    item:         colIdxMap['Item Name'] ?? -1,
    amount:       colIdxMap['Amount'] ?? -1,
    taxable:      colIdxMap['Taxable Value'] ?? -1,
    gst_percent:  colIdxMap['GST Rate'] ?? -1,
    gstin:        colIdxMap['GSTIN'] ?? -1,
    pan:          colIdxMap['PAN'] ?? -1,
    hsn:          colIdxMap['HSN/SAC'] ?? -1,
    cgst:         colIdxMap['CGST Amount'] ?? -1,
    sgst:         colIdxMap['SGST Amount'] ?? -1,
    igst:         colIdxMap['IGST Amount'] ?? -1,
    qty:          colIdxMap['Quantity'] ?? -1,
    rate:         colIdxMap['Rate'] ?? -1,
  }), [colIdxMap]);

  // ── Validation data ───────────────────────────────────────────────────────

  const validationSummary = previewDoc.validationSummary || previewDoc.validation_summary || {};
  const rawIssues = previewDoc.validationResults || previewDoc.validation_results || [];

  // Field name → col index resolver for each issue
  const fieldToColIdx = useCallback((field) => {
    const direct = colIdxMap[field];
    if (direct !== undefined) return direct;
    // Legacy field name mappings
    const legacy = {
      'date': cols.date, 'Date': cols.date,
      'party': cols.party, 'Party Name': cols.party,
      'amount': cols.amount, 'Amount': cols.amount,
      'gst_percent': cols.gst_percent, 'GST Rate': cols.gst_percent,
      'gstin': cols.gstin, 'GSTIN': cols.gstin,
      'invoice': cols.invoice, 'Voucher No': cols.invoice,
      'ledger': cols.ledger, 'Ledger': cols.ledger,
      'Item Name': cols.item,
    };
    return legacy[field] ?? -1;
  }, [colIdxMap, cols]);

  // Check if an issue is resolved by user action or user edit
  const checkIsResolved = useCallback((issue) => {
    const id = issue.id;
    if (resolvedIssues[id]) return true;

    const ci = issue.col !== undefined ? issue.col : fieldToColIdx(issue.field);
    if (ci === -1) return false;
    if (!excelGridData[issue.row] || !initialGridData[issue.row]) return false;

    const currentVal = String(excelGridData[issue.row][ci] || '').trim();
    const initialVal = String(initialGridData[issue.row][ci] || '').trim();
    const suggestedVal = String(issue.suggestedValue || issue.applyValue || '').trim();

    // Applied the exact suggestion
    if (suggestedVal && currentVal.toLowerCase() === suggestedVal.toLowerCase()) return true;

    // User manually edited to something different from initial
    if (currentVal !== initialVal && currentVal) {
      const field = (issue.field || '').toLowerCase();
      if (field.includes('date')) {
        return /^\d{2}\/\d{2}\/\d{4}$/.test(currentVal) || /^\d{4}-\d{2}-\d{2}$/.test(currentVal);
      }
      if (field.includes('party') || field.includes('ledger')) {
        return partyLedgers.some(l => l.toLowerCase() === currentVal.toLowerCase()) || currentVal.length > 2;
      }
      if (field.includes('amount')) {
        const fval = parseFloat(currentVal);
        return !isNaN(fval) && fval > 0;
      }
      if (field.includes('gstin')) {
        return currentVal.length === 15 || currentVal.length === 0;
      }
      if (field.includes('pan')) {
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(currentVal) || currentVal.length === 0;
      }
      if (field.includes('ifsc')) {
        return currentVal.length === 11 || currentVal.length === 0;
      }
      if (field.includes('hsn') || field.includes('sac')) {
        return /^\d{4,8}$/.test(currentVal) || currentVal.length === 0;
      }
      return currentVal.length > 0;
    }

    return false;
  }, [resolvedIssues, fieldToColIdx, excelGridData, initialGridData, partyLedgers]);

  // Enrich issues with resolution state
  const aiIssues = useMemo(() => {
    return rawIssues.map(iss => ({
      ...iss,
      id: iss.id || `issue-${iss.row}-${iss.field}`,
      isResolved: checkIsResolved(iss),
    }));
  }, [rawIssues, checkIsResolved]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalRowsCount = Math.max(0, excelGridData.length - 2);

  const currentErrors   = aiIssues.filter(i => i.severity === 'Error'   && !i.isResolved).length
                        || aiIssues.filter(i => i.type === 'Error'   && !i.isResolved).length;
  const currentWarnings = aiIssues.filter(i => i.severity === 'Warning' && !i.isResolved).length
                        || aiIssues.filter(i => i.type === 'Warning' && !i.isResolved).length;
  const currentInfos    = aiIssues.filter(i => (i.severity || i.type) === 'Info' && !i.isResolved).length;

  const duplicateCount = useMemo(() => {
    const seen = new Set();
    let count = 0;
    excelGridData.slice(2).forEach(row => {
      const key = row.join('|');
      if (seen.has(key)) count++;
      else seen.add(key);
    });
    return count;
  }, [excelGridData]);

  const duplicateRows = useMemo(() => {
    const seen = new Set();
    const dups = new Set();
    excelGridData.slice(2).forEach((row, idx) => {
      const key = row.join('|');
      if (seen.has(key)) dups.add(idx + 2);
      else seen.add(key);
    });
    return dups;
  }, [excelGridData]);

  const errorRows = useMemo(() => {
    return new Set(aiIssues.filter(i => (i.severity || i.type) === 'Error' && !i.isResolved).map(i => i.row));
  }, [aiIssues]);

  const currentValid = Math.max(0, totalRowsCount - errorRows.size);
  const readinessPercent = totalRowsCount > 0
    ? Math.max(0, Math.min(100, Math.round((currentValid / totalRowsCount) * 100)))
    : 100;

  // ── Auto-calculation ──────────────────────────────────────────────────────

  const calculateRowValues = useCallback((row, colIdx, val) => {
    const updatedRow = [...row];
    updatedRow[colIdx] = val;

    const { taxable, amount, gst_percent, cgst, sgst, igst, qty, rate } = cols;

    // Qty × Rate → Taxable
    if (qty !== -1 && rate !== -1 && taxable !== -1) {
      if (colIdx === qty || colIdx === rate) {
        const q = parseFloat(colIdx === qty ? val : updatedRow[qty]) || 0;
        const r = parseFloat(colIdx === rate ? val : updatedRow[rate]) || 0;
        const tv = q * r;
        updatedRow[taxable] = tv.toFixed(2);
        // Cascade to GST
        if (gst_percent !== -1 && amount !== -1) {
          const g = parseFloat(updatedRow[gst_percent]) || 0;
          const total = tv * (1 + g / 100);
          updatedRow[amount] = total.toFixed(2);
          if (cgst !== -1) updatedRow[cgst] = (tv * g / 200).toFixed(2);
          if (sgst !== -1) updatedRow[sgst] = (tv * g / 200).toFixed(2);
          if (igst !== -1) updatedRow[igst] = (tv * g / 100).toFixed(2);
        }
      }
    }

    // Taxable Value → recalculate GST amounts and total
    if (colIdx === taxable && taxable !== -1) {
      const tv = parseFloat(val) || 0;
      if (gst_percent !== -1 && amount !== -1) {
        const g = parseFloat(updatedRow[gst_percent]) || 0;
        const total = tv * (1 + g / 100);
        updatedRow[amount] = total.toFixed(2);
        if (cgst !== -1) updatedRow[cgst] = (tv * g / 200).toFixed(2);
        if (sgst !== -1) updatedRow[sgst] = (tv * g / 200).toFixed(2);
        if (igst !== -1) updatedRow[igst] = (tv * g / 100).toFixed(2);
      }
    }

    // GST Rate change → recalculate
    if (colIdx === gst_percent && gst_percent !== -1) {
      const g = parseFloat(val) || 0;
      const tv = parseFloat(updatedRow[taxable]) || 0;
      if (tv > 0 && amount !== -1) {
        const total = tv * (1 + g / 100);
        updatedRow[amount] = total.toFixed(2);
        if (cgst !== -1) updatedRow[cgst] = (tv * g / 200).toFixed(2);
        if (sgst !== -1) updatedRow[sgst] = (tv * g / 200).toFixed(2);
        if (igst !== -1) updatedRow[igst] = (tv * g / 100).toFixed(2);
      }
    }

    // Amount → back-compute taxable
    if (colIdx === amount && amount !== -1 && taxable !== -1 && gst_percent !== -1) {
      const total = parseFloat(val) || 0;
      const g = parseFloat(updatedRow[gst_percent]) || 0;
      const tv = g > 0 ? total / (1 + g / 100) : total;
      updatedRow[taxable] = tv.toFixed(2);
      if (cgst !== -1) updatedRow[cgst] = (tv * g / 200).toFixed(2);
      if (sgst !== -1) updatedRow[sgst] = (tv * g / 200).toFixed(2);
      if (igst !== -1) updatedRow[igst] = (tv * g / 100).toFixed(2);
    }

    return updatedRow;
  }, [cols]);

  const handleCellChange = useCallback((rowIdx, colIdx, val) => {
    setExcelGridData(prev => {
      const updated = [...prev];
      updated[rowIdx] = calculateRowValues(updated[rowIdx], colIdx, val);
      return updated;
    });
  }, [setExcelGridData, calculateRowValues]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleApplyIssue = useCallback((issue) => {
    const ci = issue.col !== undefined ? issue.col : fieldToColIdx(issue.field);
    if (ci !== -1 && (issue.suggestedValue || issue.applyValue) != null) {
      handleCellChange(issue.row, ci, issue.suggestedValue || issue.applyValue);
      setAppliedFixes(f => ({ ...f, [issue.row]: true }));
    }
    setResolvedIssues(prev => ({ ...prev, [issue.id]: 'applied' }));
    toast.success(`Fix applied: Row ${issue.row - 1} — ${issue.title}`);
  }, [fieldToColIdx, handleCellChange]);

  const handleIgnoreIssue = useCallback((issue) => {
    setResolvedIssues(prev => ({ ...prev, [issue.id]: 'ignored' }));
    toast.info(`Ignored: ${issue.title} on Row ${issue.row - 1}`);
  }, []);

  const handleSkipIssue = useCallback((issue) => {
    setResolvedIssues(prev => ({ ...prev, [issue.id]: 'skipped' }));
    toast.info(`Skipped: Row ${issue.row - 1}`);
  }, []);

  const handleCreateNewMaster = useCallback((issue) => {
    setResolvedIssues(prev => ({ ...prev, [issue.id]: 'created' }));
    toast.success(`Flagged for new master creation: "${issue.currentValue}" — will be created on import.`);
  }, []);

  const handleAiAutoFix = useCallback(() => {
    const fixable = aiIssues.filter(i => !i.isResolved && i.canAutoFix && (i.suggestedValue || i.applyValue) != null);
    if (fixable.length === 0) {
      toast.info('No auto-fixable issues found. Manual review required for remaining errors.');
      return;
    }
    setExcelGridData(prev => {
      const updated = [...prev];
      fixable.forEach(issue => {
        const ci = issue.col !== undefined ? issue.col : fieldToColIdx(issue.field);
        if (ci !== -1 && updated[issue.row]) {
          updated[issue.row] = calculateRowValues(updated[issue.row], ci, issue.suggestedValue || issue.applyValue);
        }
      });
      return updated;
    });
    const resolved = {};
    fixable.forEach(i => { resolved[i.id] = 'applied'; });
    setResolvedIssues(prev => ({ ...prev, ...resolved }));
    setAppliedFixes(prev => {
      const f = { ...prev };
      fixable.forEach(i => { f[i.row] = true; });
      return f;
    });
    toast.success(`AI Auto Fix: Applied ${fixable.length} auto-correctable fixes!`);
  }, [aiIssues, fieldToColIdx, calculateRowValues, setExcelGridData]);

  const handleApplyAll = useCallback(() => {
    const allUnresolved = aiIssues.filter(i => !i.isResolved && (i.suggestedValue || i.applyValue) != null);
    setExcelGridData(prev => {
      const updated = [...prev];
      allUnresolved.forEach(issue => {
        const ci = issue.col !== undefined ? issue.col : fieldToColIdx(issue.field);
        if (ci !== -1 && updated[issue.row]) {
          updated[issue.row] = calculateRowValues(updated[issue.row], ci, issue.suggestedValue || issue.applyValue);
        }
      });
      return updated;
    });
    const resolved = {};
    allUnresolved.forEach(i => { resolved[i.id] = 'applied'; });
    setResolvedIssues(prev => ({ ...prev, ...resolved }));
    toast.success(`Applied all ${allUnresolved.length} suggested fixes.`);
  }, [aiIssues, fieldToColIdx, calculateRowValues, setExcelGridData]);

  // ── Filtered rows for table ───────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    return (excelGridData.slice(2) || []).filter((row, idx) => {
      const isRowBlank = row.every(cell => !cell || String(cell).trim() === '');
      if (isRowBlank) return false;

      const actualRowIndex = idx + 2;

      if (tableSearchQuery) {
        const q = tableSearchQuery.toLowerCase();
        if (!row.some(cell => String(cell || '').toLowerCase().includes(q))) return false;
      }

      if (statusFilter === 'Errors') {
        return aiIssues.some(i => i.row === actualRowIndex && (i.severity || i.type) === 'Error' && !i.isResolved);
      }
      if (statusFilter === 'Warnings') {
        return aiIssues.some(i => i.row === actualRowIndex && (i.severity || i.type) === 'Warning' && !i.isResolved);
      }
      if (statusFilter === 'Valid') {
        return !aiIssues.some(i => i.row === actualRowIndex && !i.isResolved);
      }
      if (statusFilter === 'Duplicates') {
        return duplicateRows.has(actualRowIndex);
      }
      return true;
    });
  }, [excelGridData, aiIssues, statusFilter, tableSearchQuery, duplicateRows]);

  const selectedRowIssues = useMemo(() => {
    if (selectedRowIndex === null) return [];
    return aiIssues.filter(iss => iss.row === selectedRowIndex);
  }, [selectedRowIndex, aiIssues]);

  // ── Grouped issues for report panel ──────────────────────────────────────

  const groupedIssues = useMemo(() => {
    let filtered = aiIssues.filter(i => !i.isResolved);
    if (reportSeverity !== 'All') {
      filtered = filtered.filter(i => (i.severity || i.type) === reportSeverity);
    }
    if (reportCategory !== 'All') {
      filtered = filtered.filter(i => i.category === reportCategory);
    }
    if (reportSearch) {
      const q = reportSearch.toLowerCase();
      filtered = filtered.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.whatIsWrong || '').toLowerCase().includes(q) ||
        (i.currentValue || '').toLowerCase().includes(q)
      );
    }

    const groups = {};
    filtered.forEach(issue => {
      const cat = issue.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(issue);
    });

    return CATEGORY_ORDER
      .filter(c => groups[c])
      .map(c => ({ category: c, issues: groups[c] }))
      .concat(
        Object.entries(groups)
          .filter(([c]) => !CATEGORY_ORDER.includes(c))
          .map(([c, issues]) => ({ category: c, issues }))
      );
  }, [aiIssues, reportSeverity, reportCategory, reportSearch]);

  const allCategories = useMemo(() => {
    const cats = new Set(aiIssues.map(i => i.category).filter(Boolean));
    return ['All', ...CATEGORY_ORDER.filter(c => cats.has(c))];
  }, [aiIssues]);

  // ── Sidebar mode control ──────────────────────────────────────────────────

  useEffect(() => {
    if (selectedRowIndex !== null) {
      setSidebarMode('row');
    }
  }, [selectedRowIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const renderIssueCard = (issue, compact = false) => {
    const Icon = SEVERITY_CONFIG[issue.severity || issue.type]?.icon || AlertCircle;
    const color = SEVERITY_CONFIG[issue.severity || issue.type]?.color || 'rose';
    const hasAutoFix = issue.canAutoFix && (issue.suggestedValue || issue.applyValue) != null;

    return (
      <div key={issue.id} className={`bg-slate-50 dark:bg-[#1c1c28]/70 rounded-xl border border-slate-200 dark:border-slate-800/80 p-3.5 flex flex-col gap-2.5 shadow-2xs`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className={`w-5 h-5 rounded-full bg-${color}-50 dark:bg-${color}-950/20 flex items-center justify-center border border-${color}-200/30 shrink-0`}>
              <Icon size={10} className={`text-${color}-500`} />
            </div>
            <span className="font-black text-slate-800 dark:text-slate-100 text-[11px] truncate">{issue.title}</span>
          </div>
          <SeverityBadge severity={issue.severity || issue.type} small />
        </div>

        {!compact && (
          <div className="flex flex-col gap-1.5 bg-white dark:bg-[#121216]/60 p-2 rounded-lg border border-slate-150 dark:border-slate-850 text-[10px]">
            <div>
              <span className="font-extrabold text-slate-400 dark:text-slate-500 block uppercase text-[8px] tracking-wider">What is wrong</span>
              <span className="text-slate-700 dark:text-slate-350 font-semibold">{issue.whatIsWrong}</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-850 pt-1">
              <span className="font-extrabold text-slate-400 dark:text-slate-500 block uppercase text-[8px] tracking-wider">Why it is wrong</span>
              <span className="text-slate-700 dark:text-slate-350 font-semibold">{issue.whyItIsWrong}</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-850 pt-1">
              <span className="font-extrabold text-slate-400 dark:text-slate-500 block uppercase text-[8px] tracking-wider">How to fix</span>
              <span className="text-slate-700 dark:text-slate-350 font-semibold">{issue.howToFix}</span>
            </div>
          </div>
        )}

        {(issue.suggestedValue || issue.applyValue) && (
          <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/40 rounded-lg px-2.5 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">AI Suggestion</span>
              {issue.confidence !== undefined && (
                <span className="text-[8px] font-black text-indigo-500 tabular-nums">
                  {Math.round(issue.confidence * 100)}% confidence
                </span>
              )}
            </div>
            <div className="text-[10.5px] font-black text-indigo-800 dark:text-indigo-200 mt-0.5 truncate">
              "{issue.suggestedValue || issue.applyValue}"
            </div>
            {issue.confidence !== undefined && <ConfidenceBar value={issue.confidence} />}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
          {(issue.suggestedValue || issue.applyValue) && (
            <button
              onClick={() => handleApplyIssue(issue)}
              className={`flex-1 h-6 ${hasAutoFix ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 dark:bg-slate-600 hover:bg-slate-800'} text-white rounded-md text-[9px] font-black cursor-pointer transition border-none flex items-center justify-center gap-1`}
            >
              <Wand2 size={8} />
              <span>Apply Fix</span>
            </button>
          )}
          {issue.createNewMaster && (
            <button
              onClick={() => handleCreateNewMaster(issue)}
              className="h-6 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[9px] font-black cursor-pointer transition border-none flex items-center gap-1"
            >
              <Plus size={8} />
              <span>Create New</span>
            </button>
          )}
          <button
            onClick={() => handleIgnoreIssue(issue)}
            className="h-6 px-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md text-[9px] font-bold cursor-pointer transition bg-transparent"
          >
            Ignore
          </button>
          <button
            onClick={() => handleSkipIssue(issue)}
            className="h-6 px-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md text-[9px] font-bold cursor-pointer transition bg-transparent flex items-center gap-1"
          >
            <SkipForward size={8} />
            Skip
          </button>
        </div>

        {!compact && (
          <div className="text-[9px] text-slate-400 dark:text-slate-600 font-semibold">
            Row {issue.row - 1} · Col {(issue.col ?? -1) >= 0 ? String.fromCharCode(65 + (issue.col ?? 0)) : '?'} · {issue.category}
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Sidebar: Summary Mode
  // ─────────────────────────────────────────────────────────────────────────

  const renderSummaryMode = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-150 dark:border-slate-805 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-indigo-600" />
          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">AI Import Summary</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarMode('report')}
            className="h-6 px-2 text-[9px] font-bold border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer bg-transparent transition flex items-center gap-1"
          >
            <FileText size={9} /> Full Report
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 themed-scrollbar">
        {/* Detected type */}
        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-700 dark:text-indigo-400 mb-1">
            <Database size={11} />
            <span>Detected Document Type</span>
          </div>
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-150">{docType}</h3>
          {previewDoc.aiReasoning && (
            <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold mt-1">{previewDoc.aiReasoning}</p>
          )}
        </div>

        {/* Readiness dial */}
        <div className="flex flex-col items-center py-2 border-b border-slate-100 dark:border-slate-800/50 pb-4">
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider mb-2">Import Readiness</span>
          <div className="w-20 h-20 relative flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-100 dark:text-slate-850" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                strokeDasharray={`${readinessPercent}, 100`} strokeLinecap="round"
                className={readinessPercent > 70 ? 'text-emerald-500' : readinessPercent > 40 ? 'text-amber-500' : 'text-rose-500'} />
            </svg>
            <span className="absolute text-sm font-black text-slate-800 dark:text-slate-100 font-mono">{readinessPercent}%</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Total', value: totalRowsCount, color: 'slate' },
            { label: 'Valid', value: currentValid, color: 'emerald' },
            { label: 'Errors', value: currentErrors, color: 'rose' },
            { label: 'Warnings', value: currentWarnings, color: 'amber' },
            { label: 'Info', value: currentInfos, color: 'blue' },
            { label: 'Duplicates', value: duplicateCount, color: 'purple' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`text-center p-2 rounded-lg bg-${color}-50 dark:bg-${color}-950/20 border border-${color}-100 dark:border-${color}-900/30`}>
              <div className={`text-base font-black text-${color}-700 dark:text-${color}-400 font-mono`}>{value}</div>
              <div className={`text-[8px] font-extrabold text-${color}-500 uppercase tracking-wider`}>{label}</div>
            </div>
          ))}
        </div>

        {/* Column mapping table */}
        {(previewDoc.columnMapping || []).length > 0 && (
          <div>
            <h4 className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider mb-2">Column Mapping</h4>
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-[9.5px]">
                <thead className="bg-slate-50 dark:bg-slate-900/40">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-extrabold text-slate-400 uppercase tracking-wider">Original</th>
                    <th className="px-2 py-1.5 text-left font-extrabold text-slate-400 uppercase tracking-wider">ERP Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {(previewDoc.columnMapping || []).map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                      <td className="px-2 py-1 text-slate-700 dark:text-slate-350 font-semibold truncate max-w-[90px]">{m.original_name}</td>
                      <td className="px-2 py-1">
                        {m.standard_erp_field === 'Unmapped' ? (
                          <span className="text-rose-500 font-bold">Unmapped</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">{m.standard_erp_field}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAiAutoFix}
            className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black cursor-pointer transition border-none flex items-center justify-center gap-2"
          >
            <Wand2 size={12} />
            <span>AI Auto Fix ({aiIssues.filter(i => !i.isResolved && i.canAutoFix).length} issues)</span>
          </button>
          <button
            onClick={handleApplyAll}
            className="w-full h-8 bg-slate-700 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition border-none flex items-center justify-center gap-2"
          >
            <Zap size={12} />
            <span>Apply All Suggestions</span>
          </button>
        </div>

        {/* Top issues */}
        {aiIssues.filter(i => !i.isResolved).length > 0 ? (
          <div className="flex flex-col gap-2">
            <h4 className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
              Active Issues ({aiIssues.filter(i => !i.isResolved).length})
            </h4>
            {aiIssues.filter(i => !i.isResolved).slice(0, 4).map(issue => {
              const Icon = SEVERITY_CONFIG[issue.severity || issue.type]?.icon || AlertCircle;
              const color = SEVERITY_CONFIG[issue.severity || issue.type]?.color || 'rose';
              return (
                <div
                  key={issue.id}
                  className="flex gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => { setSelectedRowIndex(issue.row); setSidebarMode('row'); }}
                >
                  <Icon size={11} className={`text-${color}-500 shrink-0 mt-0.5`} />
                  <span>Row {issue.row - 1}: {issue.title}</span>
                </div>
              );
            })}
            {aiIssues.filter(i => !i.isResolved).length > 4 && (
              <button
                onClick={() => setSidebarMode('report')}
                className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold pl-5 text-left cursor-pointer bg-transparent border-none hover:underline"
              >
                + {aiIssues.filter(i => !i.isResolved).length - 4} more — View Full Report →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
            <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
            <span className="text-[10px] font-bold">All issues resolved!</span>
            <p className="text-[9px] text-slate-500 font-semibold mt-1">Document is ready to import.</p>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Sidebar: Full Report Mode
  // ─────────────────────────────────────────────────────────────────────────

  const renderReportMode = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-150 dark:border-slate-805 bg-slate-50/50 dark:bg-slate-900/10 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText size={12} className="text-indigo-600" />
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Validation Report</span>
          </div>
          <button
            onClick={() => setSidebarMode('summary')}
            className="p-1 hover:bg-slate-150 dark:hover:bg-slate-800 rounded text-slate-400 cursor-pointer border-none bg-transparent transition"
          >
            <X size={12} />
          </button>
        </div>
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
          <input
            type="text"
            placeholder="Search issues..."
            value={reportSearch}
            onChange={e => setReportSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-3 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] bg-white dark:bg-[#20202c] text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-400"
          />
        </div>
        {/* Severity filters */}
        <div className="flex gap-1 flex-wrap">
          {['All', 'Error', 'Warning', 'Info'].map(s => (
            <button
              key={s}
              onClick={() => setReportSeverity(s)}
              className={`h-5 px-2 rounded text-[8px] font-black cursor-pointer border transition ${reportSeverity === s
                ? 'bg-indigo-600 text-white border-indigo-700'
                : 'bg-white dark:bg-[#20202c] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
              }`}
            >
              {s}
              {s !== 'All' && (
                <span className="ml-1 opacity-70">
                  {aiIssues.filter(i => !i.isResolved && (i.severity || i.type) === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Category filters */}
        <div className="flex gap-1 flex-wrap mt-1">
          {allCategories.map(c => (
            <button
              key={c}
              onClick={() => setReportCategory(c)}
              className={`h-5 px-2 rounded text-[8px] font-bold cursor-pointer border transition ${reportCategory === c
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-800 dark:border-slate-200'
                : 'bg-white dark:bg-[#20202c] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 themed-scrollbar">
        {groupedIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
            <span className="text-xs font-bold">No issues match your filters</span>
          </div>
        ) : (
          groupedIssues.map(({ category, issues }) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={10} className="text-slate-400" />
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{category}</span>
                <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 rounded-full">{issues.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {issues.map(issue => renderIssueCard(issue, true))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Sidebar: Row Detail Mode
  // ─────────────────────────────────────────────────────────────────────────

  const renderRowMode = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-150 dark:border-slate-855 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-indigo-650" />
          <span className="font-extrabold text-slate-850 dark:text-slate-200 text-xs uppercase tracking-wider">
            Row {selectedRowIndex !== null ? selectedRowIndex - 1 : ''} Analysis
          </span>
        </div>
        <button
          onClick={() => { setSelectedRowIndex(null); setSidebarMode('summary'); }}
          className="p-1 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition border-none bg-transparent cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 themed-scrollbar">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
              {selectedRowIssues.filter(i => !i.isResolved).length > 0
                ? `${selectedRowIssues.filter(i => !i.isResolved).length} issues need attention`
                : 'All checks passed for this row'}
            </p>
          </div>
          {selectedRowIssues.filter(i => !i.isResolved).length === 0 && (
            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-455 border border-emerald-200/30 text-[9px] font-extrabold select-none">
              Passed ✓
            </span>
          )}
        </div>

        {selectedRowIssues.filter(i => !i.isResolved).length > 0 ? (
          <div className="flex flex-col gap-3">
            {selectedRowIssues.filter(i => !i.isResolved).map(issue => renderIssueCard(issue, false))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
            <span className="text-xs font-black">All fields resolved!</span>
            <p className="text-[10px] text-slate-500 font-semibold mt-1 max-w-[200px]">
              No errors or warnings detected for this row.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-grow flex flex-col overflow-hidden bg-slate-50 dark:bg-[#121216] text-slate-800 dark:text-slate-200 h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#191922] border-b border-slate-200 dark:border-slate-800/80 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer border-none bg-transparent"
          >
            <ArrowLeft size={16} className="text-slate-600 dark:text-slate-400 stroke-[2.5]" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>AI Validation & Review</span>
              <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-800 dark:text-indigo-300 border border-indigo-200/30 rounded-full uppercase">
                {(previewDoc.name || '').split('.').pop() || 'Spreadsheet'}
              </span>
              <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-350 border border-emerald-200/30 rounded-full uppercase">
                {docType}
              </span>
            </h1>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-semibold -mt-0.5">
              {aiIssues.filter(i => !i.isResolved).length > 0
                ? `${currentErrors} errors · ${currentWarnings} warnings · Resolve all errors before import`
                : 'All validations passed — ready to import'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.success('Exporting validation report...')}
            className="h-8 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
          >
            <Download size={12} className="text-slate-450" />
            <span>Export Report</span>
          </button>
          <button
            onClick={() => setSidebarMode('report')}
            className="h-8 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
          >
            <BarChart2 size={11} className="text-indigo-500" />
            <span>Validation Report</span>
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="h-8 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
          >
            <Eye size={11} className="text-indigo-600 dark:text-indigo-400" />
            <span>{showSidebar ? 'Hide Panel' : 'Show Panel'}</span>
          </button>
          <button
            onClick={() => {
              if (currentErrors > 0) {
                toast.error(`Cannot save draft. Resolve ${currentErrors} error(s) first.`);
                return;
              }
              toast.success('Draft saved!');
              setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, excelData: excelGridData } : d));
              onClose();
            }}
            disabled={currentErrors > 0}
            className="h-8 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderOpen size={12} className="text-slate-450" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => {
              if (currentErrors > 0) {
                toast.error(`Cannot import. Resolve ${currentErrors} error(s) first.`);
                return;
              }
              toast.success('Import approved successfully!');
              setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'Completed', excelData: excelGridData } : d));
              onClose();
            }}
            disabled={currentErrors > 0}
            className="h-8 px-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md border-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UploadCloud size={12} />
            <span>Approve & Import</span>
          </button>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 px-6 py-2 shrink-0 bg-slate-50/50 dark:bg-[#121216] border-b border-slate-200/60 dark:border-slate-800/40">
        {[
          { label: 'Detected Type', value: docType, sub: `${previewDoc.confidence_score || 96}% conf.`, color: 'blue', wide: true },
          { label: 'Total Rows', value: totalRowsCount, color: 'slate' },
          { label: 'Valid Rows', value: currentValid, color: 'emerald', accent: true },
          { label: 'Errors', value: currentErrors, color: 'rose', accent: true },
          { label: 'Warnings', value: currentWarnings, color: 'amber', accent: true },
          { label: 'Info', value: currentInfos, color: 'blue', accent: true },
          { label: 'Duplicates', value: duplicateCount, color: 'purple', accent: true },
          { label: 'Readiness', value: `${readinessPercent}%`, color: readinessPercent > 70 ? 'emerald' : 'rose', wide: false, dial: true },
        ].map(({ label, value, sub, color, accent, wide, dial }) => (
          <div key={label}
            className={`bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex items-center gap-2 shadow-3xs overflow-hidden
              ${accent ? `border-l-2 border-l-${color}-500` : ''}`}>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider truncate">{label}</span>
              <span className={`text-[11px] font-black text-${color}-600 dark:text-${color}-400 font-mono truncate`}>{value}</span>
              {sub && <span className="text-[7.5px] font-bold text-emerald-600 dark:text-emerald-400">{sub}</span>}
            </div>
            {dial && (
              <div className="w-7 h-7 relative flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-100 dark:text-slate-850" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${readinessPercent}, 100`} strokeLinecap="round"
                    className={readinessPercent > 70 ? 'text-emerald-500' : 'text-rose-500'} />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-50 dark:bg-[#121216] pt-0 px-4 pb-4 gap-4">

        {/* Table pane */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 rounded-xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-[#191922] shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#191922] shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-8 pl-3 pr-8 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold outline-none cursor-pointer appearance-none bg-white dark:bg-[#20202c] shadow-3xs min-w-[120px]"
                >
                  <option value="All Rows">All Rows ({totalRowsCount})</option>
                  <option value="Errors">Errors ({currentErrors})</option>
                  <option value="Warnings">Warnings ({currentWarnings})</option>
                  <option value="Valid">Valid ({currentValid})</option>
                  <option value="Duplicates">Duplicates ({duplicateCount})</option>
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="Search table..."
                  value={tableSearchQuery}
                  onChange={e => setTableSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-255 bg-white dark:bg-[#20202c] placeholder:text-slate-400 text-xs outline-none focus:border-indigo-500 w-40 font-semibold transition-all shadow-3xs"
                />
              </div>
              <button
                onClick={handleAiAutoFix}
                className="h-8 px-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Wand2 size={11} className="text-indigo-650" />
                <span>AI Auto Fix</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white dark:bg-[#121216] rounded-b-xl themed-scrollbar">
            <table className="w-full border-collapse text-left text-slate-700 dark:text-slate-350 text-xs min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-[#1f1f2a] border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider h-8 sticky top-0 z-10">
                  <th className="py-1 px-2 text-center w-8">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-650 cursor-pointer h-3 w-3" />
                  </th>
                  <th className="py-1 px-2 w-14 text-center border-r border-slate-100 dark:border-slate-800/40">Row</th>
                  {(excelGridData[1] || []).map((headerText, colIdx) => {
                    const colLetter = excelGridData[0]?.[colIdx] || String.fromCharCode(65 + colIdx);
                    const mapping = (previewDoc.columnMapping || []).find((m, i) => i === colIdx);
                    const isUnmapped = mapping?.standard_erp_field === 'Unmapped';
                    return (
                      <th key={colIdx} className="py-1 px-3 border-r border-slate-100 dark:border-slate-800/40 min-w-[120px]">
                        <div className="flex flex-col">
                          <span className={`font-bold truncate max-w-[150px] ${isUnmapped ? 'text-rose-500' : 'text-slate-750 dark:text-slate-300'}`}>
                            {headerText || `Col ${colLetter}`}
                          </span>
                          {mapping && mapping.standard_erp_field !== 'Unmapped' && (
                            <span className="text-[7px] text-emerald-600 dark:text-emerald-500 font-bold truncate">{mapping.standard_erp_field}</span>
                          )}
                          {isUnmapped && (
                            <span className="text-[7px] text-rose-500 font-bold">Unmapped</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-1 px-3 w-28 border-r border-slate-100 dark:border-slate-800/40">Status</th>
                  <th className="py-1 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-sans">
                {filteredRows.map((row, idx) => {
                  const actualRowIndex = excelGridData.indexOf(row);
                  const rowNo = actualRowIndex - 1;

                  const rowIssues = aiIssues.filter(i => i.row === actualRowIndex);
                  const hasError = rowIssues.some(i => (i.severity || i.type) === 'Error' && !i.isResolved);
                  const hasWarning = rowIssues.some(i => (i.severity || i.type) === 'Warning' && !i.isResolved);
                  const hasInfo = rowIssues.some(i => (i.severity || i.type) === 'Info' && !i.isResolved);
                  const allResolved = rowIssues.length > 0 && rowIssues.every(i => i.isResolved);
                  const isDuplicate = duplicateRows.has(actualRowIndex);
                  const isAiFixed = appliedFixes[actualRowIndex];
                  const isSelected = selectedRowIndex === actualRowIndex;

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-250/25">
                      <Check size={8} className="text-emerald-600 stroke-[3]" />
                      <span>Ready</span>
                    </span>
                  );

                  if (hasError) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-250/25">
                        <AlertCircle size={8} className="text-red-500" />
                        <span>Error ({rowIssues.filter(i => (i.severity || i.type) === 'Error' && !i.isResolved).length})</span>
                      </span>
                    );
                  } else if (allResolved || isAiFixed) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-250/25">
                        <CheckCircle2 size={8} className="text-emerald-500" />
                        <span>Fixed</span>
                      </span>
                    );
                  } else if (isDuplicate) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-250/25">
                        <Copy size={8} className="text-purple-550" />
                        <span>Duplicate</span>
                      </span>
                    );
                  } else if (hasWarning || hasInfo) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-450 border border-amber-250/25">
                        <AlertTriangle size={8} className="text-amber-650" />
                        <span>Review</span>
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={idx}
                      onClick={() => { setSelectedRowIndex(actualRowIndex); setSidebarMode('row'); if (!showSidebar) setShowSidebar(true); }}
                      className={`transition-colors border-b border-slate-100 dark:border-slate-850 cursor-pointer ${isSelected
                        ? 'bg-indigo-50/45 dark:bg-indigo-950/15'
                        : 'hover:bg-slate-50/45 dark:hover:bg-slate-900/10'
                      }`}
                    >
                      <td className="py-1 px-2 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-slate-300 text-indigo-650 cursor-pointer h-3 w-3" />
                      </td>
                      <td className="py-1 px-2 text-center font-extrabold text-slate-400 border-r border-slate-100 dark:border-slate-850 select-none">{rowNo}</td>

                      {row.map((cellValue, colIdx) => {
                        // Find issue for this cell: prefer direct col match from backend
                        const cellIssue = rowIssues.find(i => {
                          const iCol = i.col !== undefined ? i.col : fieldToColIdx(i.field);
                          return iCol === colIdx;
                        });

                        const isCellErr  = cellIssue && (cellIssue.severity || cellIssue.type) === 'Error'   && !cellIssue.isResolved;
                        const isCellWarn = cellIssue && (cellIssue.severity || cellIssue.type) === 'Warning' && !cellIssue.isResolved;
                        const isCellInfo = cellIssue && (cellIssue.severity || cellIssue.type) === 'Info'    && !cellIssue.isResolved;
                        const isCellResolved = cellIssue && cellIssue.isResolved;

                        let cellClass = '';
                        let icon = null;

                        if (isCellErr) {
                          cellClass = 'bg-rose-50 dark:bg-rose-950/25 border border-rose-300/60 text-rose-800 dark:text-rose-300';
                          icon = <AlertCircle size={10} className="text-rose-500 shrink-0" />;
                        } else if (isCellWarn) {
                          cellClass = 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300/50 text-amber-800 dark:text-amber-300';
                          icon = <AlertTriangle size={10} className="text-amber-500 shrink-0" />;
                        } else if (isCellInfo) {
                          cellClass = 'bg-blue-50 dark:bg-blue-950/20 border border-blue-300/50 text-blue-800 dark:text-blue-300';
                          icon = <Info size={10} className="text-blue-500 shrink-0" />;
                        } else if (isCellResolved) {
                          cellClass = 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300/40 text-emerald-800 dark:text-emerald-300';
                          icon = <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />;
                        }

                        const isAmount = colIdx === cols.amount || colIdx === cols.taxable || colIdx === cols.cgst || colIdx === cols.sgst || colIdx === cols.igst;
                        const isRate = colIdx === cols.gst_percent;
                        const isMono = colIdx === cols.gstin || colIdx === cols.pan || colIdx === cols.hsn;

                        return (
                          <td key={colIdx} className={`py-0.5 px-2 border-r border-slate-100 dark:border-slate-850 min-w-[120px] ${cellClass}`}>
                            <div className="flex items-center justify-between gap-1 w-full">
                              <input
                                type="text"
                                value={String(cellValue || '')}
                                onChange={e => handleCellChange(actualRowIndex, colIdx, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className={`border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5 w-full text-[11px]
                                  ${isAmount ? 'text-right font-bold' : ''}
                                  ${isRate ? 'text-center font-bold' : ''}
                                  ${isMono ? 'font-mono text-[10px]' : ''}
                                `}
                              />
                              {icon}
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-1 px-2.5 border-r border-slate-100 dark:border-slate-850">{statusBadge}</td>
                      <td className="py-1 px-2 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setSelectedRowIndex(actualRowIndex); setSidebarMode('row'); if (!showSidebar) setShowSidebar(true); }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-650 transition cursor-pointer border-none bg-transparent"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar pane */}
        {showSidebar && (
          <div className="w-[340px] shrink-0 flex flex-col bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/85 overflow-hidden h-full rounded-xl shadow-xs">
            {/* Mode tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800/50 shrink-0 bg-slate-50/50 dark:bg-slate-900/10">
              {[
                { key: 'summary', label: 'Summary', Icon: Sparkles },
                { key: 'report',  label: 'Report',  Icon: FileText },
                { key: 'row',     label: 'Row',     Icon: LayoutList, disabled: selectedRowIndex === null },
              ].map(({ key, label, Icon: TabIcon, disabled }) => (
                <button
                  key={key}
                  disabled={disabled}
                  onClick={() => setSidebarMode(key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-extrabold uppercase tracking-wider cursor-pointer border-none transition
                    ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                    ${sidebarMode === key
                      ? 'text-indigo-700 dark:text-indigo-300 bg-white dark:bg-[#191922] border-b-2 border-b-indigo-600'
                      : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent'
                    }`}
                >
                  <TabIcon size={10} />
                  {label}
                </button>
              ))}
            </div>

            {sidebarMode === 'summary' && renderSummaryMode()}
            {sidebarMode === 'report'  && renderReportMode()}
            {sidebarMode === 'row'     && renderRowMode()}
          </div>
        )}
      </div>
    </div>
  );
}
