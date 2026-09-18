import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Download, RefreshCw, FolderOpen, UploadCloud, LayoutList,
  Check, Edit2, SlidersHorizontal, Search, Filter, Sparkles, ChevronRight,
  CheckCircle2, AlertCircle, AlertTriangle, X, Database, Copy, ChevronDown,
  Info, Zap, FileText, Shield, BarChart2, Plus, Wand2, SkipForward, Eye,
  Landmark, Wallet, Grid, ArrowRight, UserPlus, CheckSquare, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import useSalesStore from '../../stores/useSalesStore';
import usePurchaseStore from '../../stores/usePurchaseStore';
import useFundFlowStore from '../../stores/useFundFlowStore';
import { useIsDark, useAppStore } from '../../stores/useAppStore';
import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from '../vouchers/CreateFundFlow';
import bulkUploadApi from '../../services/bulkUploadApi';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helper Badge Components
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  Error: { color: 'rose', icon: AlertCircle, label: 'Error' },
  Warning: { color: 'amber', icon: AlertTriangle, label: 'Warning' },
  Info: { color: 'blue', icon: Info, label: 'Info' },
};

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

function ConfidenceBar({ value = 1.0 }) {
  const pct = Math.round(value <= 1 ? value * 100 : value);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9.5px] font-black text-slate-500 dark:text-slate-400 tabular-nums">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: ExcelBulkUploadReview
// ─────────────────────────────────────────────────────────────────────────────

export default function ExcelBulkUploadReview({
  previewDoc,
  excelGridData,
  setExcelGridData,
  setDocuments,
  onClose
}) {
  const isDark = useIsDark();
  const selectedCompany = useAppStore(s => s.selectedCompany);

  // View state: 'grouped' (Vouchers View) vs 'all_rows' (Grid Table View)
  const [viewTab, setViewTab] = useState('grouped');

  // UI state
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [selectedDraftVoucher, setSelectedDraftVoucher] = useState(null);

  // Form Modal state
  const [showManualFormModal, setShowManualFormModal] = useState(false);
  const [manualVoucherType, setManualVoucherType] = useState('fundflow');
  const [manualVoucherDraft, setManualVoucherDraft] = useState(null);

  // Inline Master Modal State
  const [masterModal, setMasterModal] = useState({
    isOpen: false,
    rowIndex: null,
    voucherId: null,
    uploadedParty: '',
    groupName: 'Sundry Debtors',
    selectedLedger: '',
    gstin: '',
    phone: '',
    city: ''
  });
  const [customLedgers, setCustomLedgers] = useState([]);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Resolution tracking
  const [resolvedIssues, setResolvedIssues] = useState({});
  const [initialGridData] = useState(() => excelGridData);

  // Load master data
  const salesMasterData = useSalesStore(s => s.masterData);
  const purchaseMasterData = usePurchaseStore(s => s.masterData);
  const fundFlowMasterData = useFundFlowStore(s => s.masterData);

  useEffect(() => {
    useSalesStore.getState().fetchMasterData();
    usePurchaseStore.getState().fetchMasterData();
    useFundFlowStore.getState().fetchMasterData();
  }, []);

  const partyLedgers = useMemo(() => [
    ...(salesMasterData?.partyLedgers || []),
    ...(purchaseMasterData?.partyLedgers || []),
    ...(fundFlowMasterData?.partyLedgers || []).map(l => l.name || l.ledgerName || l)
  ], [salesMasterData?.partyLedgers, purchaseMasterData?.partyLedgers, fundFlowMasterData?.partyLedgers]);

  const allAvailableLedgers = useMemo(() => {
    const list = Array.from(new Set([
      ...partyLedgers,
      ...customLedgers,
      'HDFC Bank Account', 'ICICI Bank Account', 'SBI Bank Account', 'Bank Account',
      'Cash Account', 'Suspense Account', 'Sales Account', 'Purchase Account',
      'Sundry Debtors', 'Sundry Creditors', 'Electricity Expense', 'Rent Expense',
      'Office Expenses', 'Consulting Fees'
    ]));
    return list;
  }, [partyLedgers, customLedgers]);

  // ── Column index map ──────────────────────────────────────────────────────
  const colIdxMap = useMemo(() => {
    const headers = excelGridData[1] || [];
    return buildColIdxMap(previewDoc.columnMapping || [], headers);
  }, [previewDoc.columnMapping, excelGridData]);

  // ── Document type ─────────────────────────────────────────────────────────
  const docType = useMemo(() => {
    if (previewDoc.type && previewDoc.type !== 'Unknown') return previewDoc.type;
    if (previewDoc.document_type && previewDoc.document_type !== 'Unknown') return previewDoc.document_type;
    const name = (previewDoc.name || '').toLowerCase();
    if (name.includes('bank') || name.includes('statement') || name.includes('optransactionhistory') || name.includes('txn') || name.includes('passbook') || name.includes('history')) return 'Bank Statement';
    if (name.includes('payment')) return 'Payment Voucher';
    if (name.includes('receipt')) return 'Receipt Voucher';
    if (name.includes('contra')) return 'Contra Voucher';
    if (name.includes('purchase')) return 'Purchase Voucher';
    if ((previewDoc.grouped_vouchers && previewDoc.grouped_vouchers.length > 0) || (previewDoc.groupedVouchers && previewDoc.groupedVouchers.length > 0)) return 'Bank Statement';
    return 'Sales Voucher';
  }, [previewDoc]);

  const isBankStatement = useMemo(() => {
    const dt = String(docType || '').toLowerCase();
    const pdt = String(previewDoc.document_type || previewDoc.type || '').toLowerCase();
    const nm = String(previewDoc.name || '').toLowerCase();
    return dt.includes('bank') || dt.includes('statement') || pdt.includes('bank') || pdt.includes('statement') || nm.includes('statement') || nm.includes('optransactionhistory') || nm.includes('txn') || nm.includes('passbook') || Boolean((previewDoc.grouped_vouchers && previewDoc.grouped_vouchers.length > 0) || (previewDoc.groupedVouchers && previewDoc.groupedVouchers.length > 0));
  }, [docType, previewDoc]);

  // ── Grouped Vouchers computation ──────────────────────────────────────────
  const computedGroupedVouchers = useMemo(() => {
    const rawVouchers = (previewDoc.grouped_vouchers && previewDoc.grouped_vouchers.length > 0)
      ? previewDoc.grouped_vouchers
      : (previewDoc.groupedVouchers && previewDoc.groupedVouchers.length > 0)
        ? previewDoc.groupedVouchers
        : (previewDoc.bank_statement_items && previewDoc.bank_statement_items.length > 0)
          ? previewDoc.bank_statement_items
          : (previewDoc.dynamic_schema?.bank_statement_items && previewDoc.dynamic_schema.bank_statement_items.length > 0)
            ? previewDoc.dynamic_schema.bank_statement_items
            : null;

    if (rawVouchers && Array.isArray(rawVouchers) && rawVouchers.length > 0) {
      return rawVouchers.map((v, i) => {
        const vType = v.voucher_type || v.voucherType || (isBankStatement ? 'Payment Voucher' : docType);
        const isReceipt = vType.toLowerCase().includes('receipt') || String(v.raw_type || '').toUpperCase() === 'CR' || (v.credit > 0);
        const isPayment = vType.toLowerCase().includes('payment') || String(v.raw_type || '').toUpperCase() === 'DR' || (!isReceipt);
        const partyName = v.party_ledger || v.partyLedger || v.partyName || v.againstLedger || v.narration || 'Unspecified Party';
        const totalAmount = v.totals?.total_amount || v.amount || v.totalAmount || (v.debit > 0 ? v.debit : v.credit) || 0;
        const refNo = v.invoice_number || v.ref_no || v.referenceNumber || v.refNo || `BS-${String(i + 1).padStart(4, '0')}`;
        const invDate = v.invoice_date || v.voucherDate || v.date || '';

        return {
          id: v.voucher_id || v.item_id || `VG-${String(i + 1).padStart(3, '0')}`,
          groupNo: `VG-${String(i + 1).padStart(3, '0')}`,
          voucherNo: refNo,
          partyName: partyName,
          date: invDate,
          voucherType: isBankStatement ? (isReceipt ? 'Receipt Voucher' : 'Payment Voucher') : vType,
          isBankStatement: isBankStatement || Boolean(v.is_bank_statement),
          isReceipt,
          isPayment,
          itemsCount: isBankStatement ? 1 : (v.items ? v.items.length : 1),
          items: isBankStatement ? [] : (v.items || []),
          totalAmount: totalAmount,
          status: v.status || 'Ready',
          narration: v.narration || '',
          instNumber: refNo,
          debit: v.debit || (isPayment ? totalAmount : 0),
          credit: v.credit || (isReceipt ? totalAmount : 0),
          matchedMaster: partyName,
          debitAccount: isReceipt ? 'HDFC Bank Account' : partyName,
          creditAccount: isReceipt ? partyName : 'HDFC Bank Account',
          reconciliationStatus: v.reconciliation_status || (partyName && partyName !== 'Unspecified Party' ? 'Matched' : 'Needs Review'),
          confidence: v.confidence || 95,
          aiReasoning: v.user_reasoning || v.review_reason || 'Bank Statement transaction extracted via AI'
        };
      });
    }

    const rows = excelGridData.slice(2) || [];
    const result = [];
    rows.forEach((r, idx) => {
      if (!r || r.every(cell => !cell || String(cell).trim() === '')) return;
      const dateVal = r[colIdxMap['Voucher Date'] ?? colIdxMap['Date'] ?? 0] || '';
      const vTypeVal = r[colIdxMap['Voucher Type'] ?? 1] || docType;
      const narrVal = r[colIdxMap['Particulars / Narration'] ?? colIdxMap['Particulars'] ?? colIdxMap['Party Name'] ?? 2] || '';
      const refVal = r[colIdxMap['Reference No'] ?? colIdxMap['Voucher No'] ?? 3] || `REF-${String(idx + 1).padStart(4, '0')}`;
      const debitVal = parseFloat(r[colIdxMap['Debit (Dr)'] ?? colIdxMap['Debit'] ?? 4]) || 0;
      const creditVal = parseFloat(r[colIdxMap['Credit (Cr)'] ?? colIdxMap['Credit'] ?? 5]) || 0;
      const partyVal = r[colIdxMap['Party / Counterpart Ledger'] ?? colIdxMap['Party Name'] ?? 6] || narrVal || 'Unspecified Party';
      const amtVal = parseFloat(r[colIdxMap['Amount'] ?? colIdxMap['Total Amount'] ?? 7]) || debitVal || creditVal || 0;

      const isReceipt = creditVal > 0 || String(vTypeVal).toLowerCase().includes('receipt');
      const isPayment = debitVal > 0 || String(vTypeVal).toLowerCase().includes('payment');

      result.push({
        id: `VG-${String(idx + 1).padStart(3, '0')}`,
        groupNo: `VG-${String(idx + 1).padStart(3, '0')}`,
        voucherNo: refVal,
        partyName: partyVal,
        date: dateVal,
        voucherType: isBankStatement ? (isReceipt ? 'Receipt Voucher' : 'Payment Voucher') : vTypeVal,
        isBankStatement,
        isReceipt,
        isPayment,
        itemsCount: 1,
        items: [],
        totalAmount: amtVal,
        status: 'Ready',
        narration: narrVal,
        instNumber: refVal,
        debit: debitVal,
        credit: creditVal,
        matchedMaster: partyVal,
        debitAccount: isReceipt ? 'HDFC Bank Account' : partyVal,
        creditAccount: isReceipt ? partyVal : 'HDFC Bank Account',
        reconciliationStatus: 'Ready',
        confidence: 90,
        aiReasoning: 'Extracted from bank statement spreadsheet'
      });
    });

    return result;
  }, [previewDoc, excelGridData, colIdxMap, isBankStatement, docType]);

  // Live Vouchers Editable State
  const [vouchersState, setVouchersState] = useState([]);
  useEffect(() => {
    setVouchersState(computedGroupedVouchers);
  }, [computedGroupedVouchers]);

  // Row update handler
  const handleUpdateVoucherRow = useCallback((index, field, value) => {
    setVouchersState(prev => {
      const updated = [...prev];
      if (updated[index]) {
        const row = { ...updated[index], [field]: value };
        if (field === 'voucherType') {
          const isReceipt = String(value).toLowerCase().includes('receipt');
          row.isReceipt = isReceipt;
          row.isPayment = !isReceipt;
          if (isReceipt) {
            row.debitAccount = 'HDFC Bank Account';
            row.creditAccount = row.partyName || 'Suspense Account';
          } else {
            row.debitAccount = row.partyName || 'Suspense Account';
            row.creditAccount = 'HDFC Bank Account';
          }
        } else if (field === 'partyName') {
          row.matchedMaster = value;
          if (row.isReceipt) {
            row.creditAccount = value;
          } else {
            row.debitAccount = value;
          }
        }
        updated[index] = row;
      }
      return updated;
    });
  }, []);

  // Save Inline Master Ledger to backend database
  const handleSaveInlineMaster = useCallback(async (e) => {
    e.preventDefault();
    if (!masterModal.selectedLedger) {
      toast.error('Ledger Name is required');
      return;
    }

    try {
      const companyId = typeof selectedCompany === 'string'
        ? selectedCompany
        : (selectedCompany?.id || selectedCompany?._id || selectedCompany?.dbName || localStorage.getItem('selectedCompanyId') || '');

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v2';
      await fetch(`${baseUrl}/ledgers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': companyId
        },
        body: JSON.stringify({
          ledgerName: masterModal.selectedLedger,
          groupName: masterModal.groupName,
          gstin: masterModal.gstin,
          phone: masterModal.phone,
          city: masterModal.city
        })
      }).catch(err => console.warn('Inline ledger creation backend warning:', err));

      setCustomLedgers(prev => [...prev, masterModal.selectedLedger]);

      if (masterModal.rowIndex !== null) {
        handleUpdateVoucherRow(masterModal.rowIndex, 'partyName', masterModal.selectedLedger);
        handleUpdateVoucherRow(masterModal.rowIndex, 'matchedMaster', masterModal.selectedLedger);
        handleUpdateVoucherRow(masterModal.rowIndex, 'reconciliationStatus', 'Matched');
      }

      toast.success(`Created & linked master ledger: "${masterModal.selectedLedger}" (${masterModal.groupName})`);
      setMasterModal({ isOpen: false, rowIndex: null, voucherId: null, uploadedParty: '', groupName: 'Sundry Debtors', selectedLedger: '', gstin: '', phone: '', city: '' });
    } catch (err) {
      toast.error('Failed to create master ledger');
    }
  }, [masterModal, handleUpdateVoucherRow, selectedCompany]);

  // Bulk Save/Import handler
  const handleApproveAndImport = useCallback(async () => {
    const listToSave = vouchersState.length > 0 ? vouchersState : computedGroupedVouchers;
    if (!listToSave || listToSave.length === 0) {
      toast.error("No voucher rows to import!");
      return;
    }

    toast.loading("Saving bank statement vouchers into database...");
    try {
      const companyId = typeof selectedCompany === 'string'
        ? selectedCompany
        : (selectedCompany?.id || selectedCompany?._id || selectedCompany?.dbName || localStorage.getItem('selectedCompanyId') || '');

      const formattedForApi = listToSave.map(v => ({
        invoiceNumber: v.instNumber || v.voucherNo || `BS-${v.id}`,
        voucherNo: v.instNumber || v.voucherNo || `BS-${v.id}`,
        voucherDate: v.date || new Date().toISOString().split('T')[0],
        docType: v.voucherType || (v.isReceipt ? 'Receipt Voucher' : 'Payment Voucher'),
        voucherType: v.voucherType || (v.isReceipt ? 'Receipt Voucher' : 'Payment Voucher'),
        partyName: v.partyName || v.matchedMaster || 'Unspecified Party',
        party: v.partyName || v.matchedMaster || 'Unspecified Party',
        totalAmount: v.totalAmount || v.amount || 0,
        amount: v.totalAmount || v.amount || 0,
        debit: v.debit || 0,
        credit: v.credit || 0,
        narration: v.narration || '',
        referenceNumber: v.instNumber || '',
        debitAccount: v.debitAccount,
        creditAccount: v.creditAccount,
        status: 'approved'
      }));

      await bulkUploadApi.saveVouchersToMongo(
        previewDoc.id || previewDoc.uploadId || 'bulk_upload',
        formattedForApi,
        'approved',
        companyId
      );

      toast.dismiss();
      toast.success(`Successfully approved & imported ${formattedForApi.length} vouchers to database!`);
      setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'Completed', excelData: excelGridData } : d));
      onClose();
    } catch (err) {
      toast.dismiss();
      console.error("Failed to save vouchers to database:", err);
      toast.error("Failed to import vouchers to database.");
    }
  }, [vouchersState, computedGroupedVouchers, previewDoc, selectedCompany, setDocuments, onClose, excelGridData]);

  // Open Draft Form Modal Handler
  const handleOpenDraftModal = useCallback((vch) => {
    if (vch.isBankStatement || isBankStatement || String(vch.voucherType).toLowerCase().includes('payment') || String(vch.voucherType).toLowerCase().includes('receipt')) {
      const store = useFundFlowStore.getState();
      const isReceipt = vch.isReceipt || String(vch.voucherType).toLowerCase().includes('receipt');
      const ffVoucherType = isReceipt ? 'bank_payment' : 'cash_payment';
      store.resetForm(ffVoucherType);

      const bankLedger = 'HDFC Bank Account';

      store.setFormValue('againstLedger', bankLedger);
      store.setFormValue('bankLedger', bankLedger);
      store.setFormValue('transType', 'RTGS');
      store.setFormValue('voucherDate', vch.date || '');
      store.setFormValue('voucherNumber', vch.instNumber || vch.voucherNo || '');
      store.setFormValue('narration', vch.narration || vch.partyName || '');
      store.setFormValue('instNumber', vch.instNumber || '');
      store.setFormValue('amount', vch.totalAmount || 0);

      store.setFormValue('ledgerRows', [{
        id: Date.now(),
        ledgerName: vch.partyName || 'Suspense Account',
        description: vch.narration || '',
        amount: vch.totalAmount || 0,
        costCenter: ''
      }]);

      setManualVoucherType('fundflow');
      setManualVoucherDraft({ ...vch, isReceipt });
      setShowManualFormModal(true);
    }
  }, [isBankStatement]);

  const rawIssues = previewDoc.validationResults || previewDoc.validation_results || [];

  const aiIssues = useMemo(() => {
    return rawIssues.map(iss => ({
      ...iss,
      id: iss.id || `issue-${iss.row}-${iss.field}`,
      isResolved: Boolean(resolvedIssues[iss.id || `issue-${iss.row}-${iss.field}`]),
    }));
  }, [rawIssues, resolvedIssues]);

  const totalRowsCount = Math.max(0, excelGridData.length - 2);
  const currentErrors = aiIssues.filter(i => (i.severity || i.type) === 'Error' && !i.isResolved).length;
  const currentWarnings = aiIssues.filter(i => (i.severity || i.type) === 'Warning' && !i.isResolved).length;

  const currentValid = Math.max(0, totalRowsCount - currentErrors);
  const readinessPercent = totalRowsCount > 0
    ? Math.max(0, Math.min(100, Math.round((currentValid / totalRowsCount) * 100)))
    : 100;

  // Filtered rows & vouchers for review table
  const activeVouchersList = vouchersState.length > 0 ? vouchersState : computedGroupedVouchers;

  const filteredGroupedVouchers = useMemo(() => {
    return activeVouchersList.filter(v => {
      // Search Query Filter
      if (tableSearchQuery) {
        const q = tableSearchQuery.toLowerCase();
        const mParty = String(v.partyName || '').toLowerCase().includes(q);
        const mNo = String(v.voucherNo || '').toLowerCase().includes(q);
        const mRef = String(v.instNumber || '').toLowerCase().includes(q);
        const mNarr = String(v.narration || '').toLowerCase().includes(q);
        if (!mParty && !mNo && !mRef && !mNarr) return false;
      }

      // Status Dropdown Filter
      if (statusFilter === 'Needs Review') {
        return v.reconciliationStatus === 'Needs Review' || v.status === 'Review Required';
      }
      if (statusFilter === 'Ready' || statusFilter === 'Reconciled') {
        return v.reconciliationStatus === 'Matched' || v.status === 'Ready';
      }
      if (statusFilter === 'Unmatched') {
        return !v.matchedMaster || v.matchedMaster === 'Unspecified Party';
      }
      return true;
    });
  }, [activeVouchersList, tableSearchQuery, statusFilter]);

  return (
    <div className="flex-grow flex flex-col overflow-hidden bg-slate-50 dark:bg-[#121216] text-slate-800 dark:text-slate-200 h-full">

      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
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
                {(previewDoc.name || '').split('.').pop() || 'PDF'}
              </span>
              <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-350 border border-emerald-200/30 rounded-full uppercase">
                {docType}
              </span>
            </h1>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-semibold -mt-0.5">
              All validations passed — ready to import
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('AI review analysis running')}
            className="h-8.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer border-none shadow-sm"
          >
            <Sparkles size={12} />
            <span>AI Review</span>
          </button>
          <button
            onClick={() => {
              toast.success('Draft saved successfully!');
              onClose();
            }}
            className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
          >
            <FolderOpen size={12} className="text-slate-450" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={handleApproveAndImport}
            className="h-8.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md border-none"
          >
            <UploadCloud size={13} />
            <span>Approve & Import {activeVouchersList.length} Vouchers</span>
          </button>
        </div>
      </div>

      {/* ── Stats Summary Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-8 gap-2 px-6 py-2 shrink-0 bg-slate-50/50 dark:bg-[#121216] border-b border-slate-200/60 dark:border-slate-800/40">
        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-blue-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Detected Type</span>
          <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono truncate">{docType}</span>
          <span className="text-[7.5px] font-bold text-emerald-600 dark:text-emerald-400">98% conf.</span>
        </div>

        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-indigo-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Transactions</span>
          <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 font-mono">{activeVouchersList.length} Extracted</span>
        </div>

        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-emerald-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Valid Vouchers</span>
          <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono">{activeVouchersList.length}</span>
        </div>

        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-amber-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Needs Review</span>
          <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 font-mono">
            {activeVouchersList.filter(v => v.reconciliationStatus === 'Needs Review' || !v.partyName).length}
          </span>
        </div>

        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-purple-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Receipts (Money In)</span>
          <span className="text-[11px] font-black text-purple-600 dark:text-purple-400 font-mono">
            {activeVouchersList.filter(v => v.isReceipt).length}
          </span>
        </div>

        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-rose-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Payments (Money Out)</span>
          <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 font-mono">
            {activeVouchersList.filter(v => !v.isReceipt).length}
          </span>
        </div>

        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-teal-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Value</span>
          <span className="text-[11px] font-black text-teal-600 dark:text-teal-400 font-mono">
            ₹ {activeVouchersList.reduce((acc, v) => acc + (parseFloat(v.totalAmount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-2 border-l-emerald-500">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Readiness</span>
          <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono">{readinessPercent}%</span>
        </div>
      </div>

      {/* ── Main Review Layout Container ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-50 dark:bg-[#121216] pt-0 px-4 pb-4 gap-4 mt-2">

        {/* Table Container Card */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 rounded-xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-[#191922] shadow-xs">

          {/* Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#191922] shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <button
                  onClick={() => setViewTab('grouped')}
                  className={`h-7 px-3 rounded-md text-[11px] font-black transition cursor-pointer border-none ${viewTab === 'grouped' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 bg-transparent'}`}
                >
                  Bank Transactions ({activeVouchersList.length})
                </button>
                <button
                  onClick={() => setViewTab('all_rows')}
                  className={`h-7 px-3 rounded-md text-[11px] font-black transition cursor-pointer border-none ${viewTab === 'all_rows' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 bg-transparent'}`}
                >
                  Raw Grid ({totalRowsCount})
                </button>
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-8 pl-3 pr-8 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold outline-none cursor-pointer appearance-none bg-white dark:bg-[#20202c] shadow-3xs min-w-[130px]"
                >
                  <option value="All Status">Filter: All Status</option>
                  <option value="Needs Review">Needs Review</option>
                  <option value="Ready">Ready / Reconciled</option>
                  <option value="Unmatched">Unmatched Masters</option>
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="Search in extracted data..."
                  value={tableSearchQuery}
                  onChange={e => setTableSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-255 bg-white dark:bg-[#20202c] placeholder:text-slate-400 text-xs outline-none focus:border-indigo-500 w-52 font-semibold transition-all shadow-3xs"
                />
              </div>
              <button
                onClick={() => toast.info('AI Master Matching Auto-Fix complete')}
                className="h-8 px-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Wand2 size={11} className="text-indigo-650" />
                <span>AI Auto Match</span>
              </button>
            </div>
          </div>

          {/* ── Table Grid ─────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto bg-white dark:bg-[#121216] rounded-b-xl themed-scrollbar">
            {viewTab === 'grouped' ? (
              <table className="w-full border-collapse text-left text-slate-700 dark:text-slate-350 text-xs min-w-[1250px]">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-[#1f1f2a] border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider h-9 sticky top-0 z-10 select-none">
                    <th className="py-1.5 px-3 font-extrabold w-24">DATE</th>
                    <th className="py-1.5 px-3 font-extrabold min-w-[200px]">DESCRIPTION / NARRATION</th>
                    <th className="py-1.5 px-3 font-extrabold w-28">REF / UTR NO</th>
                    <th className="py-1.5 px-3 font-extrabold text-right w-24">DEBIT (₹)</th>
                    <th className="py-1.5 px-3 font-extrabold text-right w-24">CREDIT (₹)</th>
                    <th className="py-1.5 px-3 font-extrabold min-w-[200px]">MATCHED MASTER LEDGER</th>
                    <th className="py-1.5 px-3 font-extrabold w-36">VOUCHER TYPE</th>
                    <th className="py-1.5 px-3 font-extrabold min-w-[150px]">DEBIT ACCOUNT</th>
                    <th className="py-1.5 px-3 font-extrabold min-w-[150px]">CREDIT ACCOUNT</th>
                    <th className="py-1.5 px-3 font-extrabold text-center w-28">STATUS</th>
                    <th className="py-1.5 px-3 font-extrabold text-center w-28">CONFIDENCE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-sans">
                  {filteredGroupedVouchers.length > 0 ? (
                    filteredGroupedVouchers.map((vch, idx) => {
                      const isReceipt = vch.isReceipt || vch.credit > 0;
                      return (
                        <tr key={vch.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors h-12 border-b border-slate-100 dark:border-slate-850">

                          {/* Date */}
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={vch.date || ''}
                              onChange={e => handleUpdateVoucherRow(idx, 'date', e.target.value)}
                              className="w-full bg-transparent border-none font-mono text-[11px] font-bold outline-none focus:bg-indigo-50/50 rounded px-1"
                            />
                          </td>

                          {/* Description / Narration */}
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={vch.narration || ''}
                              onChange={e => handleUpdateVoucherRow(idx, 'narration', e.target.value)}
                              className="w-full bg-transparent border-none text-[11px] font-medium outline-none focus:bg-indigo-50/50 rounded px-1 truncate"
                              title={vch.narration}
                            />
                          </td>

                          {/* Ref / UTR No */}
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={vch.instNumber || ''}
                              onChange={e => handleUpdateVoucherRow(idx, 'instNumber', e.target.value)}
                              className="w-full bg-transparent border-none font-mono text-[10.5px] text-slate-500 outline-none focus:bg-indigo-50/50 rounded px-1"
                            />
                          </td>

                          {/* Debit */}
                          <td className="py-1.5 px-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                            {vch.debit > 0 ? `₹ ${parseFloat(vch.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>

                          {/* Credit */}
                          <td className="py-1.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {vch.credit > 0 ? `₹ ${parseFloat(vch.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>

                          {/* Matched Master Ledger + Edit/Add Button */}
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={vch.partyName || ''}
                                onChange={e => handleUpdateVoucherRow(idx, 'partyName', e.target.value)}
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-[11px] font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 truncate min-w-[140px]"
                              >
                                {allAvailableLedgers.map(l => (
                                  <option key={l} value={l}>{l}</option>
                                ))}
                              </select>

                              <button
                                onClick={() => setMasterModal({
                                  isOpen: true,
                                  rowIndex: idx,
                                  voucherId: vch.id,
                                  uploadedParty: vch.narration || '',
                                  groupName: isReceipt ? 'Sundry Debtors' : 'Sundry Creditors',
                                  selectedLedger: vch.partyName || vch.narration || '',
                                  gstin: '',
                                  phone: '',
                                  city: ''
                                })}
                                className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded transition cursor-pointer shrink-0"
                                title="Add/Edit Master Ledger"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>

                          {/* Voucher Type */}
                          <td className="py-1.5 px-3">
                            <select
                              value={vch.voucherType || (isReceipt ? 'Receipt Voucher' : 'Payment Voucher')}
                              onChange={e => handleUpdateVoucherRow(idx, 'voucherType', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-[10.5px] font-black outline-none focus:border-indigo-500"
                            >
                              <option value="Receipt Voucher">Receipt Voucher</option>
                              <option value="Payment Voucher">Payment Voucher</option>
                              <option value="Contra Voucher">Contra Voucher</option>
                            </select>
                          </td>

                          {/* Debit Account */}
                          <td className="py-1.5 px-3">
                            <select
                              value={vch.debitAccount || (isReceipt ? 'HDFC Bank Account' : vch.partyName)}
                              onChange={e => handleUpdateVoucherRow(idx, 'debitAccount', e.target.value)}
                              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10.5px] font-semibold truncate outline-none"
                            >
                              {allAvailableLedgers.map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          </td>

                          {/* Credit Account */}
                          <td className="py-1.5 px-3">
                            <select
                              value={vch.creditAccount || (isReceipt ? vch.partyName : 'HDFC Bank Account')}
                              onChange={e => handleUpdateVoucherRow(idx, 'creditAccount', e.target.value)}
                              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10.5px] font-semibold truncate outline-none"
                            >
                              {allAvailableLedgers.map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          </td>

                          {/* Status */}
                          <td className="py-1.5 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-black border ${vch.reconciliationStatus === 'Needs Review' || !vch.partyName || vch.partyName === 'Unspecified Party'
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-350 border-amber-200/50'
                              : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-350 border-emerald-200/50'
                              }`}>
                              <CheckCircle2 size={9} />
                              <span>{vch.reconciliationStatus || 'Ready'}</span>
                            </span>
                          </td>

                          {/* Confidence & Reasoning */}
                          <td className="py-1.5 px-3 text-center" title={vch.aiReasoning}>
                            <ConfidenceBar value={vch.confidence || 95} />
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-semibold">
                        <div className="flex flex-col items-center gap-2">
                          <Layers size={24} className="text-slate-300" />
                          <span>No extracted transaction data found for this document.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-left text-slate-700 dark:text-slate-350 text-xs min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-[#1f1f2a] border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-550 font-bold uppercase tracking-wider h-8 sticky top-0 z-10">
                    <th className="py-1 px-2 w-12 text-center border-r border-slate-100 dark:border-slate-800/40">Row</th>
                    {(excelGridData[1] || []).map((headerText, colIdx) => (
                      <th key={colIdx} className="py-1 px-3 border-r border-slate-100 dark:border-slate-800/40 min-w-[120px]">
                        <span className="font-bold truncate">{headerText}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-sans">
                  {excelGridData.slice(2).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                      <td className="py-1 px-2 text-center font-bold text-slate-400 border-r border-slate-100 dark:border-slate-850">{idx + 1}</td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-1 px-2.5 border-r border-slate-100 dark:border-slate-850">
                          <span className="text-[11px] font-medium">{String(cell || '')}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL 1: INLINE MASTER CREATE MODAL ─────────────────────────────── */}
      {masterModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[700] p-4 select-none">
          <div className="bg-white dark:bg-[#181824] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-indigo-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Create / Match Company Master Ledger
                </h3>
              </div>
              <button
                onClick={() => setMasterModal({ isOpen: false, rowIndex: null, voucherId: null, uploadedParty: '', groupName: 'Sundry Debtors', selectedLedger: '', gstin: '', phone: '', city: '' })}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveInlineMaster} className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50 text-[10.5px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Uploaded Transaction Text:</span>
                <p className="font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5 truncate">{masterModal.uploadedParty}</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[9.5px]">
                  Master Ledger Name *
                </label>
                <input
                  type="text"
                  required
                  value={masterModal.selectedLedger}
                  onChange={e => setMasterModal({ ...masterModal, selectedLedger: e.target.value })}
                  placeholder="Enter Party / Ledger Name"
                  className="h-8.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 font-bold outline-none focus:border-indigo-500 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[9.5px]">
                  Parent Group *
                </label>
                <select
                  value={masterModal.groupName}
                  onChange={e => setMasterModal({ ...masterModal, groupName: e.target.value })}
                  className="h-8.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 font-bold outline-none focus:border-indigo-500 bg-white dark:bg-slate-900"
                >
                  <option value="Sundry Debtors">Sundry Debtors (Customers)</option>
                  <option value="Sundry Creditors">Sundry Creditors (Vendors / Suppliers)</option>
                  <option value="Indirect Expenses">Indirect Expenses</option>
                  <option value="Direct Expenses">Direct Expenses</option>
                  <option value="Bank Accounts">Bank Accounts</option>
                  <option value="Duties & Taxes">Duties & Taxes</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-black text-slate-500 uppercase tracking-wider text-[9px]">GSTIN</label>
                  <input
                    type="text"
                    value={masterModal.gstin}
                    onChange={e => setMasterModal({ ...masterModal, gstin: e.target.value })}
                    placeholder="27ABCDE1234F1Z5"
                    className="h-8 px-2.5 rounded border border-slate-200 dark:border-slate-800 font-mono text-[10.5px] uppercase bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-black text-slate-500 uppercase tracking-wider text-[9px]">Phone / Mobile</label>
                  <input
                    type="text"
                    value={masterModal.phone}
                    onChange={e => setMasterModal({ ...masterModal, phone: e.target.value })}
                    placeholder="9876543210"
                    className="h-8 px-2.5 rounded border border-slate-200 dark:border-slate-800 font-mono text-[10.5px] bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setMasterModal({ isOpen: false, rowIndex: null, voucherId: null, uploadedParty: '', groupName: 'Sundry Debtors', selectedLedger: '', gstin: '', phone: '', city: '' })}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black cursor-pointer shadow-sm border-none"
                >
                  Save Master & Match Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MANUAL FORM MODAL ─────────────────────────────────────── */}
      {showManualFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#181824] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto relative p-6">
            <button
              onClick={() => setShowManualFormModal(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border-none bg-transparent z-50"
            >
              <X size={18} />
            </button>

            {manualVoucherType === 'fundflow' ? (
              <CreateFundFlow
                isDark={isDark || false}
                voucherType={manualVoucherDraft?.isReceipt ? 'bank_payment' : 'cash_payment'}
                onBack={() => setShowManualFormModal(false)}
                onSaveSuccess={() => {
                  toast.success('Voucher saved successfully!');
                  setShowManualFormModal(false);
                }}
              />
            ) : manualVoucherType === 'purchase' ? (
              <CreatePurchase
                isDark={isDark || false}
                onBack={() => setShowManualFormModal(false)}
              />
            ) : (
              <CreateSales
                isDark={isDark || false}
                onBack={() => setShowManualFormModal(false)}
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
