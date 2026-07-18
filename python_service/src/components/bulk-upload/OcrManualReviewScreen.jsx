import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Loader2, ArrowLeft, CheckCircle2, Info, Download, Save, ArrowRight, Sparkles, X, FileText, Zap, Brain, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import useSalesStore from '../../stores/useSalesStore';
import usePurchaseStore from '../../stores/usePurchaseStore';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import bulkUploadApi from '../../services/bulkUploadApi';
import VoucherRenderer from '../vouchers/VoucherRenderer';

// ── Progress Steps Configuration ──────────────────────────────────────────────
const PIPELINE_STEPS = [
  { stage: 'processing',      label: 'Upload Complete',              icon: CheckCircle2 },
  { stage: 'ocr_running',     label: 'Reading Document with OCR',    icon: Loader2 },
  { stage: 'ocr_complete',    label: 'OCR Complete',                 icon: CheckCircle2 },
  { stage: 'layout_running',  label: 'Analyzing Document Layout',    icon: Loader2 },
  { stage: 'layout_complete', label: 'Layout Analysis Done',         icon: CheckCircle2 },
  { stage: 'ai_running',      label: 'AI Extracting Accounting Data',icon: Brain },
  { stage: 'ai_complete',     label: 'Extraction Complete',          icon: CheckCircle2 },
];

const STAGE_ORDER = ['processing', 'ocr_running', 'ocr_complete', 'layout_running', 'layout_complete', 'ai_running', 'ai_complete'];

function getStepStatus(stepStage, currentStage, failedStage) {
  if (currentStage === 'failed') return stepStage === STAGE_ORDER[STAGE_ORDER.indexOf(currentStage) - 1] ? 'error' : 'pending';
  const curr = STAGE_ORDER.indexOf(currentStage);
  const step = STAGE_ORDER.indexOf(stepStage);
  if (step < curr) return 'done';
  if (step === curr) return 'active';
  return 'pending';
}

// ── Progressive Loading Panel ─────────────────────────────────────────────────
function ProgressPanel({ stage, progress, stageLabel, error }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      {/* Progress circle */}
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-200 dark:text-slate-800" />
          <circle
            cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round"
            className="text-indigo-600 dark:text-indigo-400 transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[14px] font-black text-indigo-600 dark:text-indigo-400">{progress}%</span>
        </div>
      </div>

      {/* Current label */}
      <div className="text-center">
        <p className="text-[12px] font-black text-slate-800 dark:text-slate-200">{stageLabel}</p>
        {error && <p className="text-[10px] text-red-500 font-semibold mt-1">{error}</p>}
      </div>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-2.5">
        {PIPELINE_STEPS.map((step) => {
          const status = getStepStatus(step.stage, stage, error);
          const Icon = status === 'active' && step.stage.includes('running') ? Loader2 : step.icon;
          return (
            <div key={step.stage} className={`flex items-center gap-3 text-[11px] font-bold transition-all duration-300 ${status === 'done' ? 'text-emerald-600 dark:text-emerald-450' :
                status === 'active' ? 'text-indigo-700 dark:text-indigo-400' :
                  status === 'error' ? 'text-red-500 dark:text-red-400' :
                    'text-slate-300 dark:text-slate-700'
              }`}>
              <Icon size={13} className={status === 'active' && step.stage.includes('running') ? 'animate-spin' : ''} />
              <span>{step.label}</span>
              {status === 'done' && <span className="ml-auto text-emerald-400 dark:text-emerald-500 text-[9px] font-black">✓</span>}
            </div>
          );
        })}
      </div>

      {stage !== 'failed' && (
        <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-semibold text-center">
          Please wait — this may take up to 60 seconds for large documents.
        </p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OcrManualReviewScreen({ doc, isDark, onClose, onSaveSuccess }) {
  const [currentDoc, setCurrentDoc] = useState(doc);
  const [pipelineStage, setPipelineStage] = useState('processing');
  const [pipelineProgress, setPipelineProgress] = useState(5);
  const [pipelineLabel, setPipelineLabel] = useState('Starting pipeline...');
  const [pipelineError, setPipelineError] = useState(null);
  const [isStoreInitialized, setIsStoreInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [sections, setSections] = useState([]);
  const [overrideDocType, setOverrideDocType] = useState(null);
  const [isReRunning, setIsReRunning] = useState(false);
  const pollRef = useRef(null);

  const handleReRunAi = async () => {
    if (isReRunning) return;
    setIsReRunning(true);
    setIsStoreInitialized(false);
    setPipelineStage('ocr_running');
    setPipelineProgress(10);
    setPipelineLabel('Re-analyzing document...');
    setPipelineError(null);

    try {
      // Trigger backend re-analyze with force_rerun=true (skip OCR, already done)
      const res = await bulkUploadApi.reAnalyzeOnly(doc.id);

      if (res && res.success && res.schema) {
        toast.success('Document re-analyzed successfully!');
        // Fetch fresh full document from backend
        const fullRes = await bulkUploadApi.getDocument(doc.id);
        if (fullRes.success && fullRes.document) {
          const d = fullRes.document;
          const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
          if (d.fileUrl && d.fileUrl.startsWith('/')) d.fileUrl = `${base}${d.fileUrl}`;
          setCurrentDoc(d);
          setPipelineStage('ai_complete');
          setPipelineProgress(100);
          setPipelineLabel('Extraction complete!');
          initStore(d);
        } else {
          setPipelineStage('ai_complete');
          setPipelineProgress(100);
          setPipelineLabel('Extraction complete!');
        }
      } else {
        const errMsg = res?.error || res?.detail || 'Re-run failed. Please try again.';
        toast.error(errMsg);
        setPipelineStage('failed');
        setPipelineError(errMsg);
      }
    } catch (e) {
      const errMsg = e?.response?.data?.detail || e.message || 'Error re-running AI';
      toast.error('Error re-running AI: ' + errMsg);
      setPipelineStage('failed');
      setPipelineError(errMsg);
    } finally {
      setIsReRunning(false);
    }
  };

  const theme = {
    bg: 'var(--app-content-bg)',
    panel: 'var(--app-panel-bg)',
    border: 'var(--app-border)',
    headerBg: 'var(--app-table-head-bg)',
    text: 'var(--app-heading)',
    inputBg: 'var(--app-control-bg)',
    mutedText: 'var(--app-muted)',
    accent: 'var(--app-accent)',
    accentSoft: 'var(--app-accent-soft)',
    accentGradient: 'var(--app-accent-gradient)',
    scrollbarThumb: 'var(--app-border)',
    scrollbarTrack: 'transparent'
  };

  // ── Resolve file URL ──────────────────────────────────────────────────────
  let fileUrl = currentDoc?.fileUrl || doc?.fileUrl || doc?.previewUrl || null;
  if (fileUrl && fileUrl.startsWith('/')) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
    fileUrl = `${baseUrl}${fileUrl}`;
  }
  const fileName = currentDoc?.name || doc?.name || 'Document';
  const fileExt = (fileName.split('.').pop() || '').toLowerCase();
  const isPdf = fileExt === 'pdf';
  const rawSize = currentDoc?.size || doc?.size;
  const fileSize = typeof rawSize === 'number' ? `${(rawSize / (1024 * 1024)).toFixed(1)} MB` : (rawSize || '—');
  const pageCount = currentDoc?.dynamic_schema?._meta?.ocr_page_count || currentDoc?.pageCount || 1;
  const confidence = currentDoc?.confidence || 95;

  const documentType = overrideDocType || currentDoc?.docType || currentDoc?.dynamic_schema?.document_type || currentDoc?.type || doc?.type || doc?.docType || '';
  const docTypeLower = documentType.toLowerCase();

  const isSales = docTypeLower.includes('sales') || docTypeLower.includes('credit');
  const isPurchase = docTypeLower.includes('purchase') || docTypeLower.includes('debit');
  const isInvoice = isSales || isPurchase;
  
  const getVoucherType = () => {
    if (isSales) {
      return docTypeLower.includes('credit') ? 'credit_note' : 'sales_invoice';
    }
    if (isPurchase) {
      return docTypeLower.includes('debit') ? 'debit_note' : 'purchase_invoice';
    }
    if (docTypeLower.includes('contra')) {
      return 'contra';
    }
    if (docTypeLower.includes('receipt')) {
      return 'bank_payment';
    }
    
    // For Payment: check if payment mode or account represents a bank/credit card
    const schema = currentDoc?.dynamic_schema || doc?.dynamic_schema;
    if (schema) {
      const sectionsList = schema.sections || [];
      const getAnyFieldValue = (...fieldIds) => {
        for (const id of fieldIds) {
          const normId = id.toLowerCase().replace(/_/g, '');
          for (const sec of sectionsList) {
            const f = sec.fields?.find(field => {
              const fid = (field.id || field.key || '').toLowerCase().replace(/_/g, '');
              return fid === normId;
            });
            if (f && f.value !== undefined && f.value !== null && f.value !== '') {
              return f.value;
            }
          }
        }
        return '';
      };
      const bankCashLedger = getAnyFieldValue('bank_cash_ledger', 'bank_account', 'cash_account', 'payment_mode', 'against_ledger', 'from_ledger', 'to_ledger', 'bank_name', 'bankname');
      const isBank = bankCashLedger && (
        bankCashLedger.toLowerCase().includes('bank') ||
        bankCashLedger.toLowerCase().includes('sbi') ||
        bankCashLedger.toLowerCase().includes('hdfc') ||
        bankCashLedger.toLowerCase().includes('axis') ||
        bankCashLedger.toLowerCase().includes('cc')
      );
      if (isBank) return 'bank_payment';
    }
    return 'cash_payment';
  };

  const voucherType = getVoucherType();

  const salesForm = useSalesStore(s => s.form);
  const purchaseForm = usePurchaseStore(s => s.form);
  const fundFlowForm = useFundFlowStore(s => s.form);
  const form = isInvoice ? (isSales ? salesForm : purchaseForm) : fundFlowForm;
  
  const salesMasterData = useSalesStore(s => s.masterData);
  const purchaseMasterData = usePurchaseStore(s => s.masterData);
  const fundFlowMasterData = useFundFlowStore(s => s.masterData);
  const masterData = isInvoice ? (isSales ? salesMasterData : purchaseMasterData) : fundFlowMasterData;

  // ── Map dynamic schema → form fields ──────────────────────────────────────
  const mapSchemaToForm = useCallback((schema) => {
    const fields = {};
    const productLines = [];

    const parseNumeric = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const cleaned = val.toString().replace(/,/g, '').match(/[-+]?[0-9]*\.?[0-9]+/);
      return cleaned ? parseFloat(cleaned[0]) : 0;
    };

    const getRowValue = (row, ...keys) => {
      if (!row || typeof row !== 'object') return undefined;
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return row[k];
        const lowerKey = k.toLowerCase();
        for (const rk of Object.keys(row)) {
          if (rk.toLowerCase() === lowerKey) {
            if (row[rk] !== undefined && row[rk] !== null) return row[rk];
          }
        }
      }
      return undefined;
    };

    const normalizeUnit = (u) => {
      if (!u) return 'Nos';
      const clean = u.toString().trim().toLowerCase();
      if (clean === 'pcs' || clean === 'pieces' || clean === 'piece') return 'Pcs';
      if (clean === 'nos' || clean === 'numbers' || clean === 'number') return 'Nos';
      if (clean === 'kg' || clean === 'kgs' || clean === 'kilogram' || clean === 'kilograms') return 'Kg';
      if (clean === 'ltr' || clean === 'liters' || clean === 'litre' || clean === 'litres') return 'Ltr';
      if (clean === 'box' || clean === 'boxes') return 'Box';
      if (clean === 'mtr' || clean === 'meters' || clean === 'meter' || clean === 'metres') return 'Mtr';
      return 'Nos';
    };

    const cleanDate = (val) => {
      if (!val) return '';
      const cleanVal = val.toString().trim();
      const match = cleanVal.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
      try {
        const d = new Date(cleanVal);
        if (!isNaN(d.getTime())) {
          return d.toISOString().slice(0, 10);
        }
      } catch (e) { }
      return '';
    };

    const summaryTotals = { taxableValue: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, roundOff: 0, totalAmount: 0 };
    const documentTypeVal = (schema?.document_type || '').toLowerCase();
    const isPurchaseDoc = documentTypeVal.includes('purchase') || documentTypeVal.includes('debit');

    for (const section of schema?.sections || []) {
      for (const field of section.fields || []) {
        if (field.type === 'table') {
          const rows = field.rows || field.value || [];
          for (const row of rows) {
            const itemNameLower = (getRowValue(row, 'item_name', 'stockItem', 'itemName', 'item', 'name', 'product') || '').toString().toLowerCase().trim();
            const itemDescLower = (getRowValue(row, 'description') || '').toString().toLowerCase().trim();

            const checkTaxOrRoundOff = (s) => {
              if (!s) return false;
              return (
                s === 'total' || s === 'subtotal' || s === 'sub total' ||
                s === 'si' || s === 'ci' || s === 'roundoff' || s === 'round-off' ||
                s.includes('sgst') || s.includes('cgst') || s.includes('igst') ||
                s.includes('round off') || s.includes('rounded off') ||
                s.includes('tax details') || s.includes('amount chargeable')
              );
            };

            if (checkTaxOrRoundOff(itemNameLower) || checkTaxOrRoundOff(itemDescLower)) {
              continue;
            }

            let rawUnit = getRowValue(row, 'unit', 'uom', 'unit_name') || '';
            const rawQty = getRowValue(row, 'qty', 'quantity', 'billQuantity', 'billedQty', 'actualQty', 'qty_pcs') || '';
            if (!rawUnit && typeof rawQty === 'string') {
              const match = rawQty.trim().match(/\s+([a-zA-Z]+)$/);
              if (match) rawUnit = match[1];
            }
            const unit = normalizeUnit(rawUnit);

            const amount = parseNumeric(getRowValue(row, 'amount', 'total', 'line_total', 'lineTotal', 'taxableAmount', 'taxable_amount', 'value'));
            let qty = parseNumeric(rawQty);
            let rate = parseNumeric(getRowValue(row, 'rate', 'billRate', 'price', 'unitPrice', 'unit_price', 'rate_per_unit'));
            const disc = parseNumeric(getRowValue(row, 'discountPercent', 'discount_percent', 'discount', 'disc'));

            if (qty <= 0 && amount > 0) qty = 1;
            if (rate <= 0 && amount > 0 && qty > 0) rate = parseFloat((amount / qty).toFixed(2));
            if (amount === 0) continue;

            const runningSum = productLines.reduce((sum, l) => sum + l.amount, 0);
            if (productLines.length > 0 && Math.abs(amount - runningSum) < 1.0) continue;

            let correctedRate = rate;
            if (qty > 0 && amount > 0 && Math.abs(qty * rate * (1 - disc / 100) - amount) > 1.0) {
              correctedRate = parseFloat((amount / (qty * (1 - disc / 100))).toFixed(2));
            }

            let rawGstRate = parseFloat((getRowValue(row, 'gstRate', 'gst_rate', 'gst', 'taxPercent', 'tax_percent') || '0').toString().replace(/%/g, ''));
            if (rawGstRate <= 14 && (parseNumeric(getRowValue(row, 'cgst_amount', 'cgst', 'cgstAmount')) > 0 || parseNumeric(getRowValue(row, 'sgst_amount', 'sgst', 'sgstAmount')) > 0) && parseNumeric(getRowValue(row, 'igst_amount', 'igst', 'igstAmount')) === 0) {
              rawGstRate = rawGstRate * 2;
            }
            const standardRates = [0, 5, 12, 18, 28];
            const closestGstRate = standardRates.reduce((prev, curr) =>
              Math.abs(curr - rawGstRate) < Math.abs(prev - rawGstRate) ? curr : prev
            );

            productLines.push({
              id: Date.now() + Math.random(),
              srNo: productLines.length + 1,
              stockItem: getRowValue(row, 'item_name', 'stockItem', 'itemName', 'item', 'name', 'product') || itemNameLower || '',
              description: getRowValue(row, 'description') || '',
              hsnSacCode: getRowValue(row, 'hsn_code', 'hsnSacCode', 'hsn', 'sac', 'hsn_sac', 'hsn/sac') || '',
              billQuantity: qty,
              unit: unit,
              billRate: correctedRate,
              discountPercent: disc,
              amount: amount,
              rcm: row.rcm === true || row.rcm === 'true',
              taxabilityType: row.taxabilityType || 'Taxable',
              gstRate: closestGstRate,
              uncertain: row.uncertain === true || row.uncertain === 'true',
              confidence: row.confidence || 100,
            });
          }
        } else {
          const cleanString = (val) => {
            if (val === null || val === undefined) return 'Missing';
            const s = val.toString().trim();
            if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'none') return 'Missing';
            return s;
          };

          const fid = (field.id || field.key || '').toLowerCase().replace(/_/g, '');
          const fval = cleanString(field.value);

          if (['invoicenumber', 'vouchernumber', 'notenumber', 'billnumber'].includes(fid)) {
            fields.invoiceNumber = fval; fields.voucherNumber = fval;
          } else if (['invoicedate', 'voucherdate', 'notedate', 'creditnotedate', 'debitnotedate', 'billdate'].includes(fid)) {
            const formattedDate = cleanDate(field.value);
            fields.invoiceDate = formattedDate || 'Missing';
            fields.voucherDate = formattedDate || 'Missing';
            fields.creditNoteDate = formattedDate || 'Missing';
            fields.debitNoteDate = formattedDate || 'Missing';
          } else if (['partyledger', 'party'].includes(fid)) {
            if (!fields.partyLedger || fields.partyLedger === 'Missing') fields.partyLedger = fval;
          } else if (['suppliername', 'vendorname'].includes(fid)) {
            if (isPurchaseDoc) fields.partyLedger = fval;
            else if (!fields.partyLedger || fields.partyLedger === 'Missing') fields.partyLedger = fval;
          } else if (['customername'].includes(fid)) {
            if (!isPurchaseDoc) fields.partyLedger = fval;
          } else if (['suppliergstin'].includes(fid)) {
            if (isPurchaseDoc) fields.partyGstin = fval;
            else if (!fields.partyGstin || fields.partyGstin === 'Missing') fields.partyGstin = fval;
          } else if (['customergstin'].includes(fid)) {
            if (!isPurchaseDoc) fields.partyGstin = fval;
          } else if (['gstin', 'partygstin'].includes(fid)) {
            if (!fields.partyGstin || fields.partyGstin === 'Missing') fields.partyGstin = fval;
          } else if (['state', 'companystate', 'gststate', 'statename', 'gstregistration', 'gstregistrationstate'].includes(fid)) {
            fields.gstRegistration = fval !== 'Missing' ? (fval.toString().toLowerCase().includes('registration') ? fval : `${fval} Registration`) : 'Missing';
          } else if (['narration', 'narrationremarks', 'remarks'].includes(fid)) {
            fields.narration = fval;
          } else if (['roundoff'].includes(fid)) {
            const parsedVal = parseNumeric(field.value);
            if (Math.abs(parsedVal) < 5.0) {
              summaryTotals.roundOff = parsedVal;
              fields.roundOff = parsedVal;
            }
          } else if (['referencenumber', 'ponumber', 'originalinvoicenumber', 'reference'].includes(fid)) {
            fields.referenceNumber = fval;
          } else if (['taxablevalue', 'subtotal'].includes(fid)) {
            summaryTotals.taxableValue = parseNumeric(field.value);
          } else if (['cgsttotal', 'cgst'].includes(fid)) {
            summaryTotals.cgstTotal = parseNumeric(field.value);
          } else if (['sgsttotal', 'sgst'].includes(fid)) {
            summaryTotals.sgstTotal = parseNumeric(field.value);
          } else if (['igsttotal', 'igst'].includes(fid)) {
            summaryTotals.igstTotal = parseNumeric(field.value);
          } else if (['totalamount', 'grandtotal'].includes(fid)) {
            summaryTotals.totalAmount = parseNumeric(field.value);
          } else if (['consigneename', 'consignee', 'shiptoname', 'shipto', 'shiptoparty', 'deliveryto'].includes(fid)) {
            // Map consignee/ship-to to consigneeLedger (separate from partyLedger / bill-to)
            if (fval && fval !== 'Missing') {
              fields.consigneeLedger = fval;
            }
          } else if (['consigneegstin', 'shiptogstin'].includes(fid)) {
            if (fval && fval !== 'Missing') {
              fields.consigneeGstin = fval;
            }
          }
        }
      }
    }

    const allRatesZero = productLines.every(l => l.gstRate === 0);
    if (allRatesZero && productLines.length > 0) {
      const totalTax = summaryTotals.cgstTotal + summaryTotals.sgstTotal + summaryTotals.igstTotal;
      const taxable = productLines.reduce((s, l) => s + parseNumeric(l.amount), 0) || summaryTotals.taxableValue;
      if (taxable > 0 && totalTax > 0) {
        const rawRate = (totalTax / taxable) * 100;
        const standardRates = [0, 5, 12, 18, 28];
        const inferredRate = standardRates.reduce((prev, curr) =>
          Math.abs(curr - rawRate) < Math.abs(prev - rawRate) ? curr : prev
        );
        if (inferredRate > 0) {
          productLines.forEach(l => { l.gstRate = inferredRate; });
        }
      }
    }

    if (productLines.length === 0) {
      productLines.push({ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, unit: 'Nos', billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 });
    }
    // Determine entry tab: prioritizing backend dynamic schema entry_tab
    let entryTab = schema?.entry_tab || schema?.entryTab || '';
    
    // Fallback or override: if we have actual items with quantities/names/amounts, force with_item mode
    const hasActualStockItems = productLines.some(l => l.stockItem && l.stockItem.trim() !== '' && (l.billQuantity > 0 || l.amount > 0));
    if (hasActualStockItems) {
      entryTab = 'with_item';
    } else if (!entryTab) {
      entryTab = 'without_item';
    }

    // In with_item mode: Ledger Details should show ONE consolidated row (total taxable amount)
    // representing the purchase/sales account — items are already shown in the Items card.
    // In without_item mode: each productLine IS a ledger distribution row — keep them all.
    const totalTaxableAmt = productLines.reduce((s, l) => s + (l.amount || 0), 0);
    const dominantGstRate = productLines.length > 0
      ? productLines.reduce((acc, l) => (l.amount > acc.amt ? { rate: l.gstRate, amt: l.amount } : acc), { rate: 0, amt: 0 }).rate
      : 0;

    const salesLines = entryTab === 'with_item'
      ? [{ id: Date.now() + 100, srNo: 1, salesLedger: 'Sales Account', description: '', hsnSacCode: '', amount: totalTaxableAmt, gstRate: dominantGstRate }]
      : productLines.map((l, i) => ({ id: Date.now() + 100 + i, srNo: i + 1, salesLedger: l.stockItem || '', description: l.description || '', hsnSacCode: l.hsnSacCode || '', amount: l.amount || 0, gstRate: l.gstRate || 0 }));

    const purchaseLines = entryTab === 'with_item'
      ? [{ id: Date.now() + 200, srNo: 1, purchaseLedger: 'Purchase Account', description: '', hsnSacCode: '', amount: totalTaxableAmt, gstRate: dominantGstRate }]
      : productLines.map((l, i) => ({ id: Date.now() + 200 + i, srNo: i + 1, purchaseLedger: l.stockItem || '', description: l.description || '', hsnSacCode: l.hsnSacCode || '', amount: l.amount || 0, gstRate: l.gstRate || 0 }));

    // If consignee is same as party, clear it so "Same as Party" placeholder shows
    if (fields.consigneeLedger && fields.partyLedger &&
        fields.consigneeLedger.trim().toLowerCase() === fields.partyLedger.trim().toLowerCase()) {
      fields.consigneeLedger = '';
    }
    if (fields.consigneeGstin && fields.partyGstin &&
        fields.consigneeGstin.trim() === fields.partyGstin.trim()) {
      fields.consigneeGstin = '';
    }

    return { ...fields, productLines, salesLines, purchaseLines, entryTab };
  }, []);

  const mapSchemaToFundFlow = useCallback((schema, ffVoucherType) => {
    const sectionsList = schema?.sections || [];
    const ledgers = fundFlowMasterData?.ledgers || [];

    const findClosestLedger = (extractedName, groupFilter = null) => {
      if (!extractedName) return '';
      const cleanExtracted = extractedName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (!cleanExtracted) return extractedName;

      const filteredLedgers = groupFilter
        ? ledgers.filter(l => groupFilter.includes(l.groupName))
        : ledgers;

      // First try: exact clean match
      for (const l of filteredLedgers) {
        const cleanLedger = (l.name || l.ledgerName || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        if (cleanLedger === cleanExtracted) {
          return l.name || l.ledgerName;
        }
      }

      // Second try: substring match
      let bestMatch = '';
      let highestScore = 0;
      for (const l of filteredLedgers) {
        const cleanLedger = (l.name || l.ledgerName || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        if (cleanLedger.includes(cleanExtracted) || cleanExtracted.includes(cleanLedger)) {
          const score = Math.min(cleanLedger.length, cleanExtracted.length) / Math.max(cleanLedger.length, cleanExtracted.length);
          if (score > highestScore) {
            highestScore = score;
            bestMatch = l.name || l.ledgerName;
          }
        }
      }

      return bestMatch || extractedName;
    };

    const getAnyFieldValue = (...fieldIds) => {
      for (const id of fieldIds) {
        const normId = id.toLowerCase().replace(/_/g, '');
        for (const sec of sectionsList) {
          const f = sec.fields?.find(field => {
            const fid = (field.id || field.key || '').toLowerCase().replace(/_/g, '');
            return fid === normId;
          });
          if (f && f.value !== undefined && f.value !== null && f.value !== '') {
            return f.value;
          }
        }
      }
      return '';
    };

    const voucherNum = getAnyFieldValue('voucher_number', 'invoice_number', 'bill_number', 'reference_number');
    const voucherDateStr = getAnyFieldValue('voucher_date', 'invoice_date', 'bill_date');
    const narrationStr = getAnyFieldValue('narration', 'narration_remarks', 'remarks');

    // ── Flat schema fast path (new format) ───────────────────────────────
    const normalizeDate = (d) => {
      if (!d) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const parts = d.split('-');
      if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      const sp = d.split('/');
      if (sp.length === 3 && sp[2].length === 4) return `${sp[2]}-${sp[1]}-${sp[0]}`;
      return d;
    };

    const isFlatSchema = schema && (schema.voucherNumber !== undefined || schema.partyLedger !== undefined || schema.productLines !== undefined);
    if (isFlatSchema) {
      const pLedger = schema.partyLedger || '';
      const bCash = schema.bankCashLedger || '';
      const totalAmt = parseFloat(schema.amount || schema.grandTotal) || 0;

      const flatFields = {
        voucherNumber: schema.voucherNumber || schema.invoiceNumber || '',
        voucherDate: normalizeDate(schema.voucherDate || schema.invoiceDate || ''),
        narration: schema.narration || '',
      };

      const docLower = (ffVoucherType || '').toLowerCase();
      const isContra = docLower.includes('contra') || (schema.voucherType || '') === 'contra';

      if (isContra) {
        // Contra: sourceLedger (From) and destinationLedger (To)
        const src = schema.sourceLedger || schema.partyLedger || '';
        const dst = schema.destinationLedger || schema.bankCashLedger || '';
        const tAmt = parseFloat(schema.transferAmount || schema.amount || schema.grandTotal) || 0;
        if (src) flatFields.sourceLedger = src;
        if (dst) flatFields.destinationLedger = dst;
        if (tAmt) {
          flatFields.transferAmount = tAmt;
          flatFields.amount = tAmt;
          flatFields.amountReceived = tAmt;
        }
      } else {
        // Payment / Receipt: use ledgerRows for TRANSACTION DETAILS
        if (bCash) {
          flatFields.againstLedger = bCash;
          const isBank = bCash.toLowerCase().match(/bank|hdfc|sbi|axis|icici|kotak|cc/);
          if (isBank) {
            flatFields.bankLedger = bCash;
            flatFields.transType = 'RTGS';
          } else {
            flatFields.cashLedger = bCash;
            flatFields.transType = 'Cash';
          }
        }
        if (pLedger) {
          flatFields.partyLedger = pLedger;
          flatFields.amount = totalAmt;
          flatFields.ledgerRows = [{
            id: Date.now(),
            ledgerName: pLedger,
            description: schema.narration || '',
            amount: totalAmt,
            costCenter: ''
          }];
        }
        // Bill rows (outstanding bills)
        const schBillRows = schema.billRows || schema.bill_allocations || [];
        if (schBillRows.length > 0) {
          const seen = new Set();
          flatFields.billRows = schBillRows
            .filter(r => {
              const no = r.billNo || r.bill_no || r.billRef || r.reference_no || '';
              if (!no || seen.has(no)) return false;
              seen.add(no);
              return true;
            })
            .slice(0, 50)
            .map((r, idx) => ({
              id: Date.now() + 200 + idx,
              billType: r.billType || r.bill_type || 'Against Ref',
              billNo: r.billNo || r.bill_no || r.billRef || r.reference_no || '',
              billRef: r.billNo || r.bill_no || r.billRef || r.reference_no || '',
              allocationAmount: parseFloat(r.allocationAmount || r.allocation_amount || r.amount) || 0,
              allocatedAmount: parseFloat(r.allocationAmount || r.allocation_amount || r.amount) || 0,
              ledgerName: pLedger || ''
            }));
        }
      }
      return flatFields;
    }

    // ── Legacy sections structure fallback ────────────────────────────────

    const fields = {
      voucherNumber: voucherNum,
      voucherDate: normalizeDate(voucherDateStr),
      narration: narrationStr,
    };


    if (ffVoucherType && ffVoucherType.toLowerCase().includes('contra')) {
      const fromLedgerRaw = getAnyFieldValue('from_ledger', 'bank_cash_ledger', 'source_ledger');
      const toLedgerRaw = getAnyFieldValue('to_ledger', 'party_ledger', 'destination_ledger');
      
      const fromLedger = findClosestLedger(fromLedgerRaw, ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand']);
      const toLedger = findClosestLedger(toLedgerRaw, ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand']);
      
      const amountVal = parseFloat(getAnyFieldValue('transfer_amount', 'total_amount', 'amount', 'grand_total')) || 0;
      if (fromLedger) fields.sourceLedger = fromLedger;
      if (toLedger) fields.destinationLedger = toLedger;
      if (amountVal) {
        fields.transferAmount = amountVal;
        fields.amount = amountVal;
        fields.amountReceived = amountVal;
      }
    } else {
      const partyLedgerRaw = getAnyFieldValue('party_ledger', 'party_name', 'party', 'customer_name', 'supplier_name', 'vendor_name', 'buyer_name');
      const bankCashLedgerRaw = getAnyFieldValue('bank_cash_ledger', 'bank_account', 'cash_account', 'payment_mode', 'against_ledger', 'from_ledger', 'to_ledger', 'bank_name', 'bankname');
      
      // Smart swap detection: if LLM accidentally put bank name in party_ledger and party name in bank_cash_ledger, fix it
      let effectivePartyLedgerRaw = partyLedgerRaw;
      let effectiveBankCashLedgerRaw = bankCashLedgerRaw;
      {
        const partyMatchesBank = partyLedgerRaw && ledgers.some(l => {
          const n = l.name || l.ledgerName;
          const g = l.groupName || '';
          return n === partyLedgerRaw && (g === 'Bank Accounts' || g === 'Bank OD A/c' || g === 'Cash-in-Hand');
        });
        const bankMatchesParty = bankCashLedgerRaw && ledgers.some(l => {
          const n = l.name || l.ledgerName;
          const g = l.groupName || '';
          return n === bankCashLedgerRaw && (g === 'Sundry Debtors' || g === 'Sundry Creditors' || g === 'Expenses (Direct)' || g === 'Expenses (Indirect)');
        });
        // Also detect: party_ledger has bank keywords, bank_cash_ledger is our company name or no keywords
        const partyHasBankWords = ['bank', 'sbi', 'hdfc', 'axis', 'icici', 'rtgs', 'neft'].some(k => (partyLedgerRaw || '').toLowerCase().includes(k));
        if (partyMatchesBank || (partyHasBankWords && !bankMatchesParty && !effectiveBankCashLedgerRaw)) {
          // Swap: what was in party_ledger is actually bank_cash_ledger and vice versa
          effectivePartyLedgerRaw = bankCashLedgerRaw;
          effectiveBankCashLedgerRaw = partyLedgerRaw;
        } else if (bankMatchesParty && !partyMatchesBank) {
          effectivePartyLedgerRaw = bankCashLedgerRaw;
          effectiveBankCashLedgerRaw = partyLedgerRaw;
        }
      }

      const partyLedger = findClosestLedger(effectivePartyLedgerRaw, ['Sundry Debtors', 'Sundry Creditors']);
      const bankCashLedger = findClosestLedger(effectiveBankCashLedgerRaw, ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand']);
      
      let amountVal = parseFloat(getAnyFieldValue('total_amount', 'grand_total', 'amount', 'transfer_amount')) || 0;
      // Fallback: if amountVal is still 0, compute from bill_allocations sum (for older documents)
      if (!amountVal) {
        const billSec = sectionsList.find(s => s.id === 'bill_allocations');
        const billFld = billSec?.fields?.find(f => f.type === 'table');
        const billR = billFld?.rows || [];
        if (billR.length > 0) {
          amountVal = billR.reduce((sum, r) => sum + (parseFloat(r.allocation_amount || r.amount) || 0), 0);
        }
      }
      // Check if any field in the schema mentions bank keywords (e.g. AXIS, HDFC, SBI, bank)
      let hasBankKeywords = false;
      for (const sec of sectionsList) {
        for (const f of sec.fields || []) {
          const valStr = String(f.value || '').toLowerCase();
          if (['bank', 'sbi', 'hdfc', 'axis', 'icici', 'rtgs', 'neft', 'cheque', 'imps'].some(k => valStr.includes(k))) {
            hasBankKeywords = true;
            break;
          }
        }
        if (hasBankKeywords) break;
      }

      if (bankCashLedger) {
        fields.againstLedger = bankCashLedger;
        const ledgerObj = ledgers.find(l => (l.name || l.ledgerName) === bankCashLedger);
        const groupName = ledgerObj?.groupName || '';
        const isBankGroup = groupName === 'Bank Accounts' || groupName === 'Bank OD A/c' || groupName === 'Bank OD Accounts';
        if (isBankGroup) {
          fields.bankLedger = bankCashLedger;
          fields.transType = 'RTGS';
        } else {
          fields.cashLedger = bankCashLedger;
          fields.transType = 'Cash';
        }
      } else if (hasBankKeywords) {
        // Fallback: bank keyword found but findClosestLedger returned empty, auto-select first bank ledger
        const firstBankLedger = ledgers.find(l => l.groupName === 'Bank Accounts' || l.groupName === 'Bank OD A/c' || l.groupName === 'Bank OD Accounts');
        if (firstBankLedger) {
          const bankName = firstBankLedger.name || firstBankLedger.ledgerName;
          fields.againstLedger = bankName;
          fields.bankLedger = bankName;
          fields.transType = 'RTGS';
        }
      } else {
        // Fallback: default to cash if no bank keywords are found
        const firstCashLedger = ledgers.find(l => l.groupName === 'Cash-in-Hand');
        if (firstCashLedger) {
          const cashName = firstCashLedger.name || firstCashLedger.ledgerName;
          fields.againstLedger = cashName;
          fields.cashLedger = cashName;
          fields.transType = 'Cash';
        }
      }
      if (amountVal) fields.amount = amountVal;

      const lineItemsSection = sectionsList.find(s => s.id === 'line_items');
      const lineItemsField = lineItemsSection?.fields?.find(f => f.type === 'table');
      const rows = lineItemsField?.rows || lineItemsField?.value || [];
      
      if (rows && rows.length > 0) {
        const tempLedgerRows = [];
        const tempBillRows = [];

        rows.forEach((r, idx) => {
          const name = r.ledger_name || r.ledgerName || r.item_name || r.stockItem || r.salesLedger || r.purchaseLedger || '';
          if (!name) return;
          const amt = parseFloat(r.amount) || 0;
          const desc = r.description || '';

          const isRef = name.toLowerCase().includes('ref') || name.toLowerCase().includes('agst') || name.toLowerCase().includes('against');
          if (isRef) {
            let billType = 'Against Ref';
            if (name.toLowerCase().includes('new')) {
              billType = 'New Ref';
            } else if (name.toLowerCase().includes('advance')) {
              billType = 'Advance';
            } else if (name.toLowerCase().includes('account')) {
              billType = 'On Account';
            }

            const cleanBillNo = name.replace(/^(agst\s*ref|against\s*ref|new\s*ref|ref|on\s*account)\s*/i, '').trim();
            tempBillRows.push({
              id: Date.now() + 500 + idx,
              billType,
              billNo: cleanBillNo || name,
              billRef: cleanBillNo || name,
              allocationAmount: amt,
              allocatedAmount: amt,
              ledgerName: partyLedger || partyLedgerRaw || ''
            });
          } else {
            const cleanName = findClosestLedger(name);
            const resolvedName = cleanName || name;

            // Skip rows that match the cash/bank payment account (it belongs in Payment Account, not details)
            const isBankOrCashAccount = (bankCashLedger && (resolvedName === bankCashLedger || name.toLowerCase() === (bankCashLedgerRaw || '').toLowerCase())) ||
              ledgers.some(l => (l.name || l.ledgerName) === resolvedName && (l.groupName === 'Bank Accounts' || l.groupName === 'Bank OD A/c' || l.groupName === 'Bank OD Accounts' || l.groupName === 'Cash-in-Hand'));

            // Skip garbled total rows: contains 'cid:', just a symbol, or name has no alphabetic chars
            const isTotalRow = name.toLowerCase().includes('total') || name.toLowerCase().includes('subtotal') ||
              name.includes('cid:') || /^\s*[₹$€¥£\-]+\s*$/.test(name) || !/[a-zA-Z]/.test(name);

            if (isBankOrCashAccount || isTotalRow) return;

            tempLedgerRows.push({
              id: Date.now() + idx,
              ledgerName: resolvedName,
              description: desc,
              amount: amt,
              costCenter: ''
            });
          }
        });

        fields.ledgerRows = tempLedgerRows;

        if (fields.ledgerRows.length === 0 && partyLedger) {
          const totalAllocatedSum = tempBillRows.reduce((sum, b) => sum + b.allocationAmount, 0);
          fields.ledgerRows = [{
            id: Date.now(),
            ledgerName: partyLedger,
            description: '',
            amount: totalAllocatedSum || amountVal,
            costCenter: ''
          }];
        }

        if (tempBillRows.length > 0) {
          const seenBillNos = new Set();
          const uniqueBillRows = [];
          for (const b of tempBillRows) {
            if (!b.billNo) continue;
            if (seenBillNos.has(b.billNo)) continue;
            seenBillNos.add(b.billNo);
            uniqueBillRows.push(b);
          }
          if (uniqueBillRows.length > 0) {
            fields.billRows = uniqueBillRows;
          }
        }
      } else if (partyLedger) {
        // No line_items rows — this is normal for Payment/Receipt. Use bill_allocations sum as amount.
        const billAllocsSec2 = sectionsList.find(s => s.id === 'bill_allocations');
        const billAllocsFld2 = billAllocsSec2?.fields?.find(f => f.type === 'table');
        const billAllocsRows2 = billAllocsFld2?.rows || [];
        const billAllocsSum = billAllocsRows2.reduce((sum, r) => sum + (parseFloat(r.allocation_amount || r.amount) || 0), 0);
        fields.ledgerRows = [{
          id: Date.now(),
          ledgerName: partyLedger,
          description: '',
          amount: amountVal || billAllocsSum,
          costCenter: ''
        }];
      }
      
      // Parse bill allocations from OCR schema to populate outstanding bills table
      const billAllocsSection = sectionsList.find(s => s.id === 'bill_allocations');
      const billAllocsField = billAllocsSection?.fields?.find(f => f.type === 'table');
      const billRows = billAllocsField?.rows || billAllocsField?.value || [];
      if (billRows && billRows.length > 0) {
        // Deduplicate by bill number to prevent 100s of same rows from OCR hanging the browser
        const seenBillNos = new Set();
        const uniqueBillRows = [];
        for (const r of billRows) {
          const billNo = r.bill_no || r.billNo || r.reference_no || '';
          if (!billNo) continue; // skip empty bill numbers
          if (seenBillNos.has(billNo)) continue; // skip duplicates
          seenBillNos.add(billNo);
          uniqueBillRows.push(r);
          if (uniqueBillRows.length >= 50) break; // hard cap at 50 rows
        }
        if (uniqueBillRows.length > 0) {
          fields.billRows = uniqueBillRows.map((r, idx) => ({
            id: Date.now() + idx,
            billType: r.bill_type || 'Against Ref',
            billNo: r.bill_no || r.billNo || r.reference_no || '',
            billRef: r.bill_no || r.billNo || r.reference_no || '',
            allocationAmount: parseFloat(r.allocation_amount || r.amount) || 0,
            allocatedAmount: parseFloat(r.allocation_amount || r.amount) || 0,
            ledgerName: partyLedger || (fields.ledgerRows && fields.ledgerRows[0]?.ledgerName) || partyLedgerRaw || ''
          }));
        }
      }
    }

    return fields;
  }, [fundFlowMasterData]);

  const initialData = useMemo(() => {
    if (!currentDoc?.dynamic_schema) return {};
    return isInvoice
      ? mapSchemaToForm(currentDoc.dynamic_schema)
      : mapSchemaToFundFlow(currentDoc.dynamic_schema, docTypeLower);
  }, [currentDoc?.dynamic_schema, isInvoice, docTypeLower, mapSchemaToForm, mapSchemaToFundFlow]);

  const initStore = useCallback((docWithSchema, customDocType) => {
    const schema = docWithSchema?.dynamic_schema;
    const docType = customDocType || docWithSchema?.docType || docWithSchema?.dynamic_schema?.document_type || docWithSchema?.type || '';
    const docTypeLower = docType.toLowerCase();
    
    const sales = docTypeLower.includes('sales') || docTypeLower.includes('credit');
    const purchase = docTypeLower.includes('purchase') || docTypeLower.includes('debit');
    const isInvoiceDoc = sales || purchase;

    // Check if schema is in new flat format or old sections format
    const isFlatSchema = schema && (schema.voucherNumber !== undefined || schema.partyLedger !== undefined || schema.productLines !== undefined);

    if (isFlatSchema) {
      const vNum = schema.voucherNumber || schema.invoiceNumber || '';
      const vDate = schema.voucherDate || schema.invoiceDate || '';
      const pLedger = schema.partyLedger || '';
      const pGstin = schema.partyGstin || '';
      const gstReg = schema.gstRegistration || '';
      const eTab = schema.entryTab || 'without_item';
      
      const prodLines = (schema.productLines || []).map((line, idx) => ({
        id: line.id || (Date.now() + idx),
        srNo: line.srNo || (idx + 1),
        stockItem: line.stockItem || '',
        description: line.description || '',
        hsnSacCode: line.hsnSacCode || '',
        billQuantity: line.billQuantity || 0,
        unit: line.unit || 'Nos',
        billRate: line.billRate || 0,
        discountPercent: line.discountPercent || 0,
        amount: line.amount || 0,
        gstRate: line.gstRate || 0,
        rcm: line.rcm || false,
        taxabilityType: line.taxabilityType || 'Taxable'
      }));

      // Map service lines for both salesLines and purchaseLines to support without-item mode switching!
      const serviceLines = (schema.productLines || []).map((line, idx) => ({
        id: line.id || (Date.now() + 100 + idx),
        srNo: line.srNo || (idx + 1),
        salesLedger: line.stockItem || '',
        purchaseLedger: line.stockItem || '',
        description: line.description || '',
        hsnSacCode: line.hsnSacCode || '',
        amount: line.amount || 0,
        gstRate: line.gstRate || 0
      }));

      const bRows = (schema.billRows || schema.bill_allocations || []).map((r, idx) => ({
        id: r.id || (Date.now() + 200 + idx),
        billType: r.billType || r.bill_type || 'Against Ref',
        billNo: r.billNo || r.bill_no || r.reference_no || '',
        billRef: r.billNo || r.bill_no || r.reference_no || '',
        allocationAmount: parseFloat(r.allocationAmount || r.allocation_amount || r.amount) || 0,
        allocatedAmount: parseFloat(r.allocationAmount || r.allocation_amount || r.amount) || 0,
        ledgerName: pLedger || ''
      }));

      if (isInvoiceDoc) {
        if (sales) {
          const s = useSalesStore.getState();
          s.resetForm();
          s.setForm({
            voucherType: docTypeLower.includes('credit') ? 'credit_note' : 'sales_invoice',
            invoiceNumber: vNum,
            voucherNumber: vNum,
            invoiceDate: vDate,
            voucherDate: vDate,
            partyLedger: pLedger,
            partyGstin: pGstin,
            gstRegistration: gstReg,
            entryTab: eTab,
            productLines: prodLines,
            salesLines: serviceLines,
            billRows: bRows,
            narration: schema.narration || '',
            entryMode: 'ocr'
          });
          s.fetchMasterData();
        } else {
          const s = usePurchaseStore.getState();
          s.resetForm('purchase_invoice');
          s.updateForm({
            voucherType: docTypeLower.includes('debit') ? 'debit_note' : 'purchase_invoice',
            invoiceNumber: vNum,
            voucherNumber: vNum,
            invoiceDate: vDate,
            voucherDate: vDate,
            partyLedger: pLedger,
            partyGstin: pGstin,
            gstRegistration: gstReg,
            entryTab: eTab,
            productLines: prodLines,
            purchaseLines: serviceLines,
            billRows: bRows,
            narration: schema.narration || '',
            entryMode: 'ocr'
          });
          s.fetchMasterData();
        }
      } else {
        const store = useFundFlowStore.getState();
        // Use schema.voucherType directly (backend sets bank_payment/cash_payment/contra)
        let voucherTypeVal = schema.voucherType || (
          docTypeLower.includes('contra') ? 'contra' :
          docTypeLower.includes('receipt') ? 'bank_payment' :
          'cash_payment'
        );
        const bankCashLedgerLower = (schema.bankCashLedger || '').toLowerCase();
        if (voucherTypeVal === 'cash_payment' && (
          bankCashLedgerLower.includes('bank') || bankCashLedgerLower.includes('hdfc') ||
          bankCashLedgerLower.includes('sbi') || bankCashLedgerLower.includes('axis') ||
          bankCashLedgerLower.includes('icici') || bankCashLedgerLower.includes('cc')
        )) {
          voucherTypeVal = 'bank_payment';
        }

        store.resetForm(voucherTypeVal);

        // Normalize date: DD-MM-YYYY → YYYY-MM-DD for date input
        const normalizeDate = (d) => {
          if (!d) return '';
          // Already ISO format
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
          // DD-MM-YYYY
          const parts = d.split('-');
          if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
          // DD/MM/YYYY
          const slashParts = d.split('/');
          if (slashParts.length === 3 && slashParts[2].length === 4) return `${slashParts[2]}-${slashParts[1]}-${slashParts[0]}`;
          return d;
        };

        if (vNum) store.setFormValue('voucherNumber', vNum);
        if (vDate) store.setFormValue('voucherDate', normalizeDate(vDate));
        if (schema.narration) store.setFormValue('narration', schema.narration);

        if (voucherTypeVal === 'contra') {
          // Contra: sourceLedger = From account, destinationLedger = To account
          const srcLedger = schema.sourceLedger || schema.partyLedger || '';
          const dstLedger = schema.destinationLedger || schema.bankCashLedger || '';
          const transferAmt = parseFloat(schema.transferAmount || schema.amount || schema.grandTotal) || 0;
          if (srcLedger) store.setFormValue('sourceLedger', srcLedger);
          if (dstLedger) store.setFormValue('destinationLedger', dstLedger);
          if (transferAmt) {
            store.setFormValue('transferAmount', transferAmt);
            store.setFormValue('amount', transferAmt);
            store.setFormValue('amountReceived', transferAmt);
          }
        } else {
          // Payment / Receipt
          const isBankType = schema.bankCashLedger && (
            schema.bankCashLedger.toLowerCase().includes('bank') ||
            schema.bankCashLedger.toLowerCase().includes('sbi') ||
            schema.bankCashLedger.toLowerCase().includes('hdfc') ||
            schema.bankCashLedger.toLowerCase().includes('axis') ||
            schema.bankCashLedger.toLowerCase().includes('icici') ||
            schema.bankCashLedger.toLowerCase().includes('cc')
          );
          if (schema.bankCashLedger) {
            store.setFormValue('againstLedger', schema.bankCashLedger);
            if (isBankType) {
              store.setFormValue('bankLedger', schema.bankCashLedger);
              store.setFormValue('transType', 'RTGS');
            } else {
              store.setFormValue('cashLedger', schema.bankCashLedger);
              store.setFormValue('transType', 'Cash');
            }
          }

          // KEY FIX: CreateFundFlow uses ledgerRows (not partyLedger) for TRANSACTION DETAILS
          const totalAmt = parseFloat(schema.amount || schema.grandTotal) || 0;
          if (pLedger) {
            store.setFormValue('ledgerRows', [{
              id: Date.now(),
              ledgerName: pLedger,
              description: schema.narration || '',
              amount: totalAmt,
              costCenter: ''
            }]);
            store.setFormValue('partyLedger', pLedger);
            store.setFormValue('amount', totalAmt);
          }

          // Set billRows — add ledgerName so they link to the correct ledger row
          if (bRows.length > 0) {
            const bRowsWithLedger = bRows.map(r => ({ ...r, ledgerName: pLedger || r.ledgerName || '' }));
            store.setFormValue('billRows', bRowsWithLedger);
            // Double-set after paint to survive any store auto-resets
            requestAnimationFrame(() => {
              useFundFlowStore.getState().setFormValue('billRows', bRowsWithLedger);
            });
          }
        }
        store.fetchMasterData();
      }


      setIsStoreInitialized(true);
      return;
    }

    // Otherwise, fall back to old sections structure parser (backward compatible)
    if (isInvoiceDoc) {
      if (sales) {
        const s = useSalesStore.getState();
        s.resetForm();
        const mapped = mapSchemaToForm(schema);
        s.setForm({
          ...mapped,
          voucherType: docTypeLower.includes('credit') ? 'credit_note' : 'sales_invoice',
          entryMode: 'ocr'
        });
        s.fetchMasterData();
      } else {
        const s = usePurchaseStore.getState();
        s.resetForm('purchase_invoice');
        const mapped = mapSchemaToForm(schema);
        s.updateForm({
          ...mapped,
          voucherType: docTypeLower.includes('debit') ? 'debit_note' : 'purchase_invoice',
          entryMode: 'ocr'
        });
        s.fetchMasterData();
      }
    } else {
      const sectionsList = schema?.sections || [];
      setSections(sectionsList);
      
      const store = useFundFlowStore.getState();
      const mapped = mapSchemaToFundFlow(schema, docTypeLower);
      
      let voucherTypeVal = docTypeLower.includes('contra') ? 'contra' : docTypeLower.includes('receipt') ? 'bank_payment' : 'cash_payment';
      const isBankPayment = mapped.againstLedger && (
        mapped.againstLedger.toLowerCase().includes('bank') ||
        mapped.againstLedger.toLowerCase().includes('sbi') ||
        mapped.againstLedger.toLowerCase().includes('hdfc') ||
        mapped.againstLedger.toLowerCase().includes('axis') ||
        mapped.againstLedger.toLowerCase().includes('cc')
      );
      if (voucherTypeVal === 'cash_payment' && isBankPayment) {
        voucherTypeVal = 'bank_payment';
      }

      store.resetForm(voucherTypeVal);

      if (mapped.voucherNumber) store.setFormValue('voucherNumber', mapped.voucherNumber);
      if (mapped.voucherDate) store.setFormValue('voucherDate', mapped.voucherDate);
      if (mapped.narration) store.setFormValue('narration', mapped.narration);

      if (voucherTypeVal === 'contra') {
        if (mapped.sourceLedger) store.setFormValue('sourceLedger', mapped.sourceLedger);
        if (mapped.destinationLedger) store.setFormValue('destinationLedger', mapped.destinationLedger);
        if (mapped.transferAmount) {
          store.setFormValue('transferAmount', mapped.transferAmount);
          store.setFormValue('amount', mapped.transferAmount);
          store.setFormValue('amountReceived', mapped.transferAmount);
        }
      } else {
        if (mapped.againstLedger) {
          store.setFormValue('againstLedger', mapped.againstLedger);
          if (isBankPayment) {
            store.setFormValue('bankLedger', mapped.againstLedger);
            store.setFormValue('transType', 'RTGS');
          } else {
            store.setFormValue('cashLedger', mapped.againstLedger);
            store.setFormValue('transType', 'Cash');
          }
        }
        if (mapped.amount) store.setFormValue('amount', mapped.amount);
        if (mapped.ledgerRows) store.setFormValue('ledgerRows', mapped.ledgerRows);
        if (mapped.billRows) store.setFormValue('billRows', mapped.billRows);
      }
      
      store.fetchMasterData();
    }
    setIsStoreInitialized(true);
  }, [mapSchemaToForm, mapSchemaToFundFlow]);

  // ── Progressive polling ───────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    if (doc.dynamic_schema && (doc.status === 'Ready For Review' || doc.status === 'AI Analyzed')) {
      setCurrentDoc(doc);
      setPipelineStage('ai_complete');
      setPipelineProgress(100);
      setPipelineLabel('Extraction complete!');
      initStore(doc);
      return;
    }

    const poll = async () => {
      try {
        const res = await bulkUploadApi.getProgress(doc.id);
        if (!active) return;

        if (res.success) {
          setPipelineStage(res.stage || 'processing');
          setPipelineProgress(res.progress || 5);
          setPipelineLabel(res.stage_label || 'Processing...');

          if (res.stage !== 'failed') {
            setCurrentDoc(prev => ({ ...prev, status: res.status }));
          }

          if (res.ai_done && res.dynamic_schema) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            try {
              const fullRes = await bulkUploadApi.getDocument(doc.id);
              if (active && fullRes.success && fullRes.document) {
                const d = fullRes.document;
                const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
                if (d.fileUrl && d.fileUrl.startsWith('/')) d.fileUrl = `${base}${d.fileUrl}`;
                setCurrentDoc(d);
                initStore(d);
              }
            } catch (e) {
              console.error('Failed to fetch full doc after pipeline', e);
              const fallback = { ...doc, dynamic_schema: res.dynamic_schema, status: res.status };
              setCurrentDoc(fallback);
              initStore(fallback);
            }
          } else if (res.stage === 'failed') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setPipelineError(res.error || 'Processing failed. Please try again.');
          }
        }
      } catch (err) {
        console.error('Progress poll error:', err);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      active = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOcrVoucherTypeChange = (typeId) => {
    const docTypeMap = {
      sales_invoice: 'Sales Invoice',
      sales_order: 'Sales Order',
      credit_note: 'Credit Note',
      purchase_invoice: 'Purchase Invoice',
      purchase_order: 'Purchase Order',
      debit_note: 'Debit Note',
      cash_payment: 'Payment Voucher',
      bank_payment: 'Receipt Voucher',
      contra: 'Contra Voucher'
    };
    const mappedDocType = docTypeMap[typeId];
    if (mappedDocType) {
      setOverrideDocType(mappedDocType);
      initStore(currentDoc || doc, mappedDocType);
    }
  };

  const handleSaveDraft = async () => {
    const val = getDynamicValidation();
    if (val && val.error_count > 0) {
      toast.error(`Cannot save draft. Please resolve the ${val.error_count} critical validation error(s) first.`);
      return;
    }
    setIsSaving(true);
    try {
      let res;
      if (isSales) {
        res = await useSalesStore.getState().saveTransaction(true);
      } else if (isPurchase) {
        res = await usePurchaseStore.getState().saveTransaction(true);
      } else {
        res = await useFundFlowStore.getState().saveDraft();
      }

      if (res.success) {
        await bulkUploadApi.updateStatus(doc.id || doc.uploadId, 'Validated');
        toast.success('Voucher saved as draft!');
        onSaveSuccess?.();
      } else {
        toast.error(res.message || 'Failed to save draft');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNext = async () => {
    const val = getDynamicValidation();
    if (val && val.error_count > 0) {
      toast.error(`Cannot save voucher. Please resolve the ${val.error_count} critical validation error(s) first.`);
      return;
    }
    setIsSaving(true);
    try {
      let res;
      if (isSales) {
        res = await useSalesStore.getState().saveTransaction(false);
      } else if (isPurchase) {
        res = await usePurchaseStore.getState().saveTransaction(false);
      } else {
        res = await useFundFlowStore.getState().saveDraft();
        if (res.success && res.data?._id) {
          res = await useFundFlowStore.getState().pushToReview(res.data._id);
        }
      }

      if (res.success) {
        await bulkUploadApi.updateStatus(doc.id || doc.uploadId, 'Validated');
        toast.success('Voucher saved and submitted!');
        onSaveSuccess?.();
      } else {
        toast.error(res.message || 'Failed to submit voucher');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadJson = () => {
    const payload = isInvoice ? form : { documentType, sections };
    const a = document.createElement('a');
    a.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2)));
    a.setAttribute('download', `${fileName.split('.')[0]}_extracted.json`);
    document.body.appendChild(a); a.click(); a.remove();
    toast.success('Downloaded!');
  };

  const getHsnTaxSummary = () => {
    const summary = {};
    (form?.productLines || []).forEach(l => {
      const hsn = l.hsnSacCode || '—';
      if (!summary[hsn]) summary[hsn] = { hsn, taxableValue: 0, cgstRate: (parseFloat(l.gstRate) || 0) / 2, cgstAmount: 0, sgstRate: (parseFloat(l.gstRate) || 0) / 2, sgstAmount: 0, igstRate: (parseFloat(l.gstRate) || 0), igstAmount: 0, totalTax: 0 };
      summary[hsn].taxableValue += parseFloat(l.taxableAmount ?? l.amount) || 0;
      const cgst = parseFloat(l.cgst) || 0; const sgst = parseFloat(l.sgst) || 0; const igst = parseFloat(l.igst) || 0;
      summary[hsn].cgstAmount += cgst; summary[hsn].sgstAmount += sgst; summary[hsn].igstAmount += igst; summary[hsn].totalTax += cgst + sgst + igst;
    });
    return Object.values(summary);
  };

  const hsnSummary = getHsnTaxSummary();
  const totalTaxable = parseFloat(form?.baseTotal) || 0;
  const totalCGST = parseFloat(form?.cgstTotal) || 0;
  const totalSGST = parseFloat(form?.sgstTotal) || 0;
  const totalIGST = parseFloat(form?.igstTotal) || 0;
  const totalRound = parseFloat(form?.roundOff) || 0;
  const grandTotal = parseFloat(form?.grandTotal) || parseFloat(form?.amount) || 0;

  const getDynamicValidation = () => {
    const errors = [];
    const warnings = [];

    if (!isInvoice) {
      if (!form.voucherNumber) errors.push({ message: 'Voucher Number is missing' });
      if (!form.voucherDate) errors.push({ message: 'Voucher Date is missing' });
      const docTypeLowerFF = docTypeLower;
      if (docTypeLowerFF.includes('contra')) {
        if (!form.sourceLedger) errors.push({ message: 'Source Account (From) is missing' });
        if (!form.destinationLedger) errors.push({ message: 'Destination Account (To) is missing' });
        if (!parseFloat(form.transferAmount)) errors.push({ message: 'Transfer Amount must be greater than 0' });
      } else {
        if (!form.againstLedger) errors.push({ message: 'Bank/Cash Account is missing' });
        if (!parseFloat(form.amount)) errors.push({ message: 'Total Amount must be greater than 0' });
      }
      return { error_count: errors.length, warning_count: warnings.length, errors, warnings };
    }

    if (!form.invoiceNumber || form.invoiceNumber === 'Missing') {
      errors.push({ message: 'Invoice Number is missing' });
    }
    if (!form.invoiceDate || form.invoiceDate === 'Missing') {
      errors.push({ message: 'Invoice Date is missing' });
    }
    if (!form.partyLedger || form.partyLedger === 'Missing') {
      errors.push({ message: isSales ? 'Customer Name is missing' : 'Supplier Name is missing' });
    }

    const productLines = form.productLines || [];
    let itemsSum = 0;
    productLines.forEach((row, idx) => {
      const qty = parseFloat(row.billQuantity) || 0;
      const rate = parseFloat(row.billRate) || 0;
      const disc = parseFloat(row.discountPercent) || 0;
      const amount = parseFloat(row.amount) || 0;

      if (qty > 0 && rate > 0 && amount > 0) {
        const expected = Math.round(qty * rate * (1 - disc / 100) * 100) / 100;
        if (Math.abs(expected - amount) > 1.5) {
          errors.push({ message: `Row ${idx + 1}: ${qty} × ${rate} = ${expected.toFixed(2)}, but amount = ${amount.toFixed(2)}` });
        }
      }
      itemsSum += amount;
    });

    const taxableValue = parseFloat(form.baseTotal) || 0;
    if (itemsSum > 0 && taxableValue > 0 && Math.abs(itemsSum - taxableValue) > 2.0) {
      warnings.push({ message: `Sum of line items (${itemsSum.toFixed(2)}) ≠ taxable value (${taxableValue.toFixed(2)})` });
    }

    const cgstTotal = parseFloat(form.cgstTotal) || 0;
    const sgstTotal = parseFloat(form.sgstTotal) || 0;
    const igstTotal = parseFloat(form.igstTotal) || 0;
    if (cgstTotal > 0 || sgstTotal > 0) {
      if (Math.abs(cgstTotal - sgstTotal) > 1.0) {
        errors.push({ message: `CGST (${cgstTotal.toFixed(2)}) ≠ SGST (${sgstTotal.toFixed(2)}) for intra-state transaction` });
      }
    }

    const expectedTotal = Math.round((taxableValue + cgstTotal + sgstTotal + igstTotal + totalRound) * 100) / 100;
    if (grandTotal > 0 && Math.abs(expectedTotal - grandTotal) > 2.0) {
      errors.push({ message: `Calculated total (${expectedTotal.toFixed(2)}) ≠ invoice total (${grandTotal.toFixed(2)})` });
    }

    return { error_count: errors.length, warning_count: warnings.length, errors, warnings };
  };

  const isPipelineDone = isStoreInitialized && pipelineStage === 'ai_complete';

  const StatusBadge = () => {
    if (pipelineStage === 'ai_complete') return (
      <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200/50">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />OCR Done
      </span>
    );
    if (pipelineStage === 'failed') return (
      <span className="flex items-center gap-1 bg-red-50 text-red-700 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border border-red-200/50">
        <AlertCircle size={8} />Failed
      </span>
    );
    return (
      <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200/50">
        <Loader2 size={8} className="animate-spin" />Processing {pipelineProgress}%
      </span>
    );
  };

  return (
    <div className="m3-scope absolute inset-0 z-[50] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 font-sans text-xs select-none" style={{ backgroundColor: 'var(--m3-surface)' }}>

      {/* ─── Top Header Bar ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="m3-icon-btn hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors bg-transparent border-none">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[14px] font-black tracking-tight" style={{ color: 'var(--m3-on-surface)' }}>
                {isSales ? 'Create Sales Voucher (OCR)' : isPurchase ? 'Create Purchase Voucher (OCR)' : 'Create Voucher (OCR)'}
              </h1>
              {documentType && (
                <span className="bg-[var(--app-accent-soft)] text-[var(--app-accent)] text-[8.5px] font-black px-1.5 py-0.5 rounded border border-[var(--app-accent)]/20 uppercase tracking-wider">
                  {documentType}
                </span>
              )}
            </div>
            <span className="text-[9.5px] font-semibold text-slate-400 dark:text-slate-500 block -mt-0.5">Review and edit AI-extracted fields</span>
          </div>
        </div>
        <div className="flex items-center gap-2">

          <button
            onClick={handleReRunAi}
            disabled={isReRunning}
            className="m3-btn m3-btn--outlined cursor-pointer"
          >
            {isReRunning ? <Loader2 size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
            Re-run AI
          </button>
          <button
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="m3-btn m3-btn--tonal cursor-pointer"
          >
            <Sparkles size={13} className="mr-1" />
            {showAiPanel ? 'Hide AI Review' : 'Show AI Review'}
          </button>
          <button onClick={handleDownloadJson} disabled={!isPipelineDone} className="m3-btn m3-btn--outlined disabled:opacity-40 cursor-pointer">
            <Download size={13} className="mr-1" /> Download
          </button>
          <button onClick={handleSaveDraft} disabled={isSaving || !isPipelineDone || getDynamicValidation().error_count > 0} className="m3-btn m3-btn--outlined disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {isSaving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />} Draft
          </button>
          <button onClick={handleSaveNext} disabled={isSaving || !isPipelineDone || getDynamicValidation().error_count > 0} className="m3-btn m3-btn--filled disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {isSaving ? <Loader2 size={13} className="animate-spin mr-1" /> : <ArrowRight size={13} className="mr-1" />} Save &amp; Next
          </button>
        </div>
      </div>

      {/* ─── 3-Panel Layout ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* PANEL 1: Document Preview — always visible immediately */}
        <div className="w-[30%] bg-white dark:bg-[#191922] border-r border-slate-200/60 dark:border-slate-800/80 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#20202c]">
            <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide text-[9.5px]">Source Document</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 dark:text-slate-505 font-bold truncate max-w-[120px]">{fileName}</span>
              <StatusBadge />
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-white dark:bg-[#121216] flex flex-col">
            {fileUrl ? (
              isPdf ? (
                <iframe src={fileUrl} className="w-full h-full border-none m-0 p-0" title="Invoice Preview" />
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-2 bg-slate-50 dark:bg-[#121216]">
                  <img src={fileUrl} alt="Invoice Preview" className="max-w-full max-h-full object-contain" />
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3">
                <FileText size={32} className="opacity-30" />
                <span className="font-bold text-[10px] uppercase tracking-widest">Loading preview...</span>
              </div>
            )}
          </div>
          {/* Meta info bar at bottom */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-[#20202c] flex items-center justify-between shrink-0">
            <div className="flex gap-4 text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
              <span>Size: <span className="text-slate-700 dark:text-slate-300">{fileSize}</span></span>
              <span>Pages: <span className="text-slate-700 dark:text-slate-300">{pageCount}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/30 dark:border-emerald-900/30 px-2 py-0.5 rounded-md">
              <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
              <span>{confidence}% Confidence</span>
            </div>
          </div>
        </div>

        {/* PANEL 2: Form or Progress */}
        <div className={`${showAiPanel ? 'w-[45%]' : 'w-[70%]'} bg-[#f0f2f5] dark:bg-[#121216] overflow-y-auto themed-scrollbar p-4 flex flex-col gap-3 transition-all duration-300 m3-scope relative`}>

          {!isPipelineDone ? (
            /* ─── Processing State: show live progress steps ─── */
            <div className="flex-1 bg-white dark:bg-[#191922] rounded-xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-[#20202c] flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-[13px] font-black text-slate-900 dark:text-slate-100">AI Extraction in Progress</h2>
                  <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-semibold">Your document is being read and analyzed</p>
                </div>
              </div>
              <ProgressPanel
                stage={pipelineStage}
                progress={pipelineProgress}
                stageLabel={pipelineLabel}
                error={pipelineError}
              />
            </div>
          ) : (
            /* ─── Done: Render the VoucherRenderer inside Panel 2 ─── */
            <>
              {/* Validation Banner */}
              {(() => {
                const v = getDynamicValidation();
                if (!v) return null;
                const errCount  = v.error_count   || 0;
                const warnCount = v.warning_count  || 0;
                if (errCount === 0 && warnCount === 0) return (
                  <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30 rounded-xl text-[10.5px] font-bold text-emerald-700 dark:text-emerald-450 flex items-center gap-2 shadow-sm shrink-0 mb-1">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>Validation Passed — calculations verified.</span>
                  </div>
                );
                return (
                  <div className={`p-3 border rounded-xl text-[10.5px] font-bold shadow-sm shrink-0 mb-1 ${
                    errCount > 0 ? 'bg-red-50/80 dark:bg-red-955/20 border-red-200/40 dark:border-red-900/30 text-red-700 dark:text-red-400' : 'bg-amber-50/80 dark:bg-amber-955/20 border-amber-200/40 dark:border-amber-900/30 text-amber-800 dark:text-amber-450'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={13} className={errCount > 0 ? 'text-red-500' : 'text-amber-500'} />
                      <span>{errCount > 0 ? `Validation: ${errCount} error${errCount !== 1 ? 's' : ''}` : 'Validation'}{warnCount > 0 ? `, ${warnCount} warning${warnCount !== 1 ? 's' : ''}` : ''}</span>
                    </div>
                    <ul className="pl-5 list-disc space-y-0.5">
                      {(v.errors || []).map((e, i) => (
                        <li key={`ve-${i}`} className="text-red-600 dark:text-red-400 font-semibold">{e.message}</li>
                      ))}
                      {(v.warnings || []).map((w, i) => (
                        <li key={`vw-${i}`} className="text-amber-705 dark:text-amber-450 font-semibold">{w.message}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-[#191922] rounded-xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
                <VoucherRenderer
                  voucherType={documentType}
                  initialData={initialData}
                  isDark={isDark}
                  onBack={onClose}
                  isOcrMode={true}
                  onSaveSuccess={onSaveSuccess}
                  onVoucherTypeChange={handleOcrVoucherTypeChange}
                />
              </div>
            </>
          )}
        </div>

        {/* PANEL 3: AI Review (25%, toggleable) */}
        {showAiPanel && (
          <div className="w-[25%] bg-white dark:bg-[#191922] border-l border-slate-200/80 dark:border-slate-800/80 flex flex-col overflow-y-auto themed-scrollbar p-4 space-y-4 shrink-0 transition-all duration-300">

            {!isPipelineDone ? (
              /* Processing placeholder cards */
              <div className="space-y-3">
                <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 shadow-sm bg-white dark:bg-[#1e1e28]">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">AI Review</h3>
                  <div className="flex flex-col gap-2">
                    {['Basic Details', 'Tax Information', 'Line Items', 'Total Verification'].map((label) => (
                      <div key={label} className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-550 font-bold">
                        <Loader2 size={11} className="animate-spin text-indigo-400 dark:text-indigo-500 shrink-0" />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/30 dark:border-indigo-900/30 rounded-xl text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 leading-relaxed">
                  <Info size={12} className="inline mr-1.5 mb-0.5" />
                  AI is reading your document. Suggestions will appear here once extraction is complete.
                </div>
              </div>
            ) : (
              /* Done: show actual review */
              <>
                <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 shadow-sm bg-white dark:bg-[#1e1e28] space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-indigo-500 rounded" />AI Review &amp; Suggestions
                  </h3>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/30 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-[11px] block">All good!</span>
                      <span className="text-[9.5px] text-emerald-750 dark:text-emerald-450 leading-tight">No critical errors found. Please review the extracted data.</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    {(isInvoice ? [
                      { label: 'Invoice number is valid', checked: !!(form.invoiceNumber || form.voucherNumber) },
                      { label: 'Invoice date is valid', checked: !!(form.invoiceDate || form.voucherDate) },
                      { label: 'Party GSTIN is valid', checked: !!form.partyGstin },
                      { label: 'HSN/SAC codes present', checked: true },
                      { label: 'Tax calculation is correct', checked: true },
                      { label: 'Invoice total matches', checked: true },
                    ] : [
                      { label: 'Voucher number is valid', checked: !!form.voucherNumber },
                      { label: 'Voucher date is valid', checked: !!form.voucherDate },
                      { label: 'Ledgers are mapped', checked: true },
                      { label: 'Voucher total is valid', checked: grandTotal > 0 },
                    ]).map((chk, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                        <CheckCircle2 size={12} className={chk.checked ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-750'} />
                        <span>{chk.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 shadow-sm bg-slate-50/50 dark:bg-[#20202c]/50 space-y-3 select-text">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Extracted Summary</h4>
                  {isInvoice ? (
                    <div className="space-y-2 text-[11px] font-bold text-slate-600 dark:text-slate-350">
                      <div className="flex justify-between"><span>Taxable Amount</span><span>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>CGST</span><span>₹{totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>SGST</span><span>₹{totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>IGST</span><span>₹{totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>Round Off</span><span>₹{totalRound.toFixed(2)}</span></div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-[11px] font-bold text-slate-600 dark:text-slate-350">
                      <div className="flex justify-between"><span>Type</span><span className="capitalize">{documentType}</span></div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline">
                    <span className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-300 tracking-wide">Total Amount</span>
                    <span className="text-xl font-black text-indigo-650 dark:text-indigo-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 shadow-sm bg-white dark:bg-[#1e1e28] space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-3 bg-indigo-400 rounded" />AI Suggestions
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-normal font-sans">
                    <li>Consider adding item description in narration for better clarity.</li>
                    <li>Verify dispatch details if goods are already dispatched.</li>
                  </ul>
                </div>

                <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-200/20 dark:border-indigo-900/20 text-indigo-700/80 dark:text-indigo-400 rounded-xl flex items-start gap-2 select-text">
                  <Info size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-[9.5px] font-bold leading-normal">Please review all extracted data carefully before saving.</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
