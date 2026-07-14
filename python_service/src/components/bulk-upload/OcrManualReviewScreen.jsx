import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, ArrowLeft, CheckCircle2, Info, Plus, Trash2, Download, Save, ArrowRight, Sparkles, X, Search, ChevronDown, FileText, Zap, Brain, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import useSalesStore from '../../stores/useSalesStore';
import usePurchaseStore from '../../stores/usePurchaseStore';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import bulkUploadApi from '../../services/bulkUploadApi';
import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from '../vouchers/CreateFundFlow';

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
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
          <circle
            cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="2.5"
            strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[14px] font-black text-indigo-600">{progress}%</span>
        </div>
      </div>

      {/* Current label */}
      <div className="text-center">
        <p className="text-[12px] font-black text-slate-800">{stageLabel}</p>
        {error && <p className="text-[10px] text-red-500 font-semibold mt-1">{error}</p>}
      </div>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-2.5">
        {PIPELINE_STEPS.map((step) => {
          const status = getStepStatus(step.stage, stage, error);
          const Icon = status === 'active' && step.stage.includes('running') ? Loader2 : step.icon;
          return (
            <div key={step.stage} className={`flex items-center gap-3 text-[11px] font-bold transition-all duration-300 ${status === 'done' ? 'text-emerald-600' :
                status === 'active' ? 'text-indigo-700' :
                  status === 'error' ? 'text-red-500' :
                    'text-slate-300'
              }`}>
              <Icon size={13} className={status === 'active' && step.stage.includes('running') ? 'animate-spin' : ''} />
              <span>{step.label}</span>
              {status === 'done' && <span className="ml-auto text-emerald-400 text-[9px] font-black">✓</span>}
            </div>
          );
        })}
      </div>

      {stage !== 'failed' && (
        <p className="text-[9.5px] text-slate-400 font-semibold text-center">
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
  const pollRef = useRef(null);

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

  const documentType = currentDoc?.docType || currentDoc?.dynamic_schema?.document_type || currentDoc?.type || doc?.type || doc?.docType || '';
  const docTypeLower = documentType.toLowerCase();
  const isSales = docTypeLower.includes('sales') || docTypeLower.includes('credit');
  const isPurchase = docTypeLower.includes('purchase') || docTypeLower.includes('debit');
  const isInvoice = isSales || isPurchase;
  
  const voucherType = isSales 
    ? (docTypeLower.includes('credit') ? 'credit_note' : 'sales_invoice')
    : isPurchase 
    ? (docTypeLower.includes('debit') ? 'debit_note' : 'purchase_invoice')
    : (docTypeLower.includes('contra') ? 'contra' : docTypeLower.includes('receipt') ? 'bank_payment' : 'cash_payment');

  const salesForm = useSalesStore(s => s.form);
  const purchaseForm = usePurchaseStore(s => s.form);
  const form = isInvoice ? (isSales ? salesForm : purchaseForm) : {};
  
  const salesMasterData = useSalesStore(s => s.masterData);
  const purchaseMasterData = usePurchaseStore(s => s.masterData);
  const masterData = isInvoice ? (isSales ? salesMasterData : purchaseMasterData) : purchaseMasterData;

  // ── Map dynamic schema → form fields ─────────────────────────────────────
  const mapSchemaToForm = useCallback((schema) => {
    const fields = {};
    const productLines = [];

    // Robust helper to parse number from string containing commas, currencies, suffixes
    const parseNumeric = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const cleaned = val.toString().replace(/,/g, '').match(/[-+]?[0-9]*\.?[0-9]+/);
      return cleaned ? parseFloat(cleaned[0]) : 0;
    };

    // Helper to get row value by case-insensitive key matching and common aliases
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

    // Helper to normalize unit name
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

    // Helper to clean date strings into exact YYYY-MM-DD format for HTML5 inputs
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

    // Collect per-section totals from Calculation Summary for GST rate inference
    const summaryTotals = { taxableValue: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, roundOff: 0, totalAmount: 0 };
    const documentType = (schema?.document_type || '').toLowerCase();
    const isPurchaseDoc = documentType.includes('purchase') || documentType.includes('debit');

    for (const section of schema?.sections || []) {
      for (const field of section.fields || []) {
        if (field.type === 'table') {
          const rows = field.rows || field.value || [];
          for (const row of rows) {
            // Check if this row is a total/subtotal/tax row based on name or description
            const itemNameLower = (getRowValue(row, 'item_name', 'stockItem', 'itemName', 'item', 'name', 'product') || '').toString().toLowerCase().trim();
            const itemDescLower = (getRowValue(row, 'description') || '').toString().toLowerCase().trim();
            
            const checkTaxOrRoundOff = (s) => {
              if (!s) return false;
              return (
                s === 'total' ||
                s === 'subtotal' ||
                s === 'sub total' ||
                s === 'si' ||
                s === 'ci' ||
                s === 'roundoff' ||
                s === 'round-off' ||
                s.includes('sgst') ||
                s.includes('cgst') ||
                s.includes('igst') ||
                s.includes('round off') ||
                s.includes('rounded off') ||
                s.includes('tax details') ||
                s.includes('amount chargeable')
              );
            };

            if (checkTaxOrRoundOff(itemNameLower) || checkTaxOrRoundOff(itemDescLower)) {
              continue;
            }

            // Extract unit if present as space-separated suffix in qty
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

            // Default Qty to 1 if it is 0/empty but amount is non-zero
            if (qty <= 0 && amount > 0) {
              qty = 1;
            }
            // Default rate to amount if rate is 0/empty but amount is non-zero
            if (rate <= 0 && amount > 0 && qty > 0) {
              rate = parseFloat((amount / qty).toFixed(2));
            }

            // Skip zero-amount lines (header/footer text like "Services" parsed as rows)
            if (amount === 0) {
              continue;
            }

            // Skip total / subtotal rows if the amount matches the sum of previous rows
            const runningSum = productLines.reduce((sum, l) => sum + l.amount, 0);
            if (productLines.length > 0 && Math.abs(amount - runningSum) < 1.0) {
              continue;
            }

            // Correct rate if there is a clear mismatch and qty is non-zero
            let correctedRate = rate;
            if (qty > 0 && amount > 0 && Math.abs(qty * rate * (1 - disc / 100) - amount) > 1.0) {
              correctedRate = parseFloat((amount / (qty * (1 - disc / 100))).toFixed(2));
            }

            // Compute standard GST rate closest to the parsed rate
            let rawGstRate = parseFloat((getRowValue(row, 'gstRate', 'gst_rate', 'gst', 'taxPercent', 'tax_percent') || '0').toString().replace(/%/g, ''));
            // If individual CGST/SGST rate is given (<= 14%) and total is not, double it.
            // Use parseNumeric() to correctly handle comma-formatted values like "5,003.46"
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
          }
        }
      }
    }

    // ── Infer GST rate from summary totals when per-row rate is 0 ──────────
    // This handles invoices (like this purchase bill) where GST % is not listed
    // per row but only in the Calculation Summary (CGST: 347.40, SGST: 347.40).
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
    const salesLines = productLines.map((l, i) => ({ id: Date.now() + 100 + i, srNo: i + 1, salesLedger: l.stockItem || '', description: l.description || '', hsnSacCode: l.hsnSacCode || '', amount: l.amount || 0, gstRate: l.gstRate || 0 }));
    const purchaseLines = productLines.map((l, i) => ({ id: Date.now() + 100 + i, srNo: i + 1, purchaseLedger: l.stockItem || '', description: l.description || '', hsnSacCode: l.hsnSacCode || '', amount: l.amount || 0, gstRate: l.gstRate || 0 }));
    return { ...fields, productLines, salesLines, purchaseLines, entryTab: productLines.some(l => l.stockItem) ? 'with_item' : 'without_item' };
  }, []);

  const initStore = useCallback((docWithSchema) => {
    const schema = docWithSchema?.dynamic_schema;
    const docType = docWithSchema?.docType || docWithSchema?.dynamic_schema?.document_type || docWithSchema?.type || '';
    const docTypeLower = docType.toLowerCase();
    
    const sales = docTypeLower.includes('sales') || docTypeLower.includes('credit');
    const purchase = docTypeLower.includes('purchase') || docTypeLower.includes('debit');
    const isInvoiceDoc = sales || purchase;

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
      const voucherType = docTypeLower.includes('contra') ? 'contra' : docTypeLower.includes('receipt') ? 'bank_payment' : 'cash_payment';
      store.resetForm(voucherType);
      
      const getFieldValue = (fieldId) => {
        for (const sec of sectionsList) {
          const f = sec.fields?.find(field => field.id === fieldId);
          if (f) return f.value;
        }
        return '';
      };

      const voucherNum = getFieldValue('voucher_number') || getFieldValue('invoice_number');
      const voucherDateStr = getFieldValue('voucher_date') || getFieldValue('invoice_date');
      const narrationStr = getFieldValue('narration');

      if (voucherNum) store.setFormValue('voucherNumber', voucherNum);
      if (voucherDateStr) store.setFormValue('voucherDate', voucherDateStr);
      if (narrationStr) store.setFormValue('narration', narrationStr);

      if (voucherType === 'contra') {
        const fromLedger = getFieldValue('from_ledger');
        const toLedger = getFieldValue('to_ledger');
        const amountVal = parseFloat(getFieldValue('transfer_amount')) || 0;
        if (fromLedger) store.setFormValue('sourceLedger', fromLedger);
        if (toLedger) store.setFormValue('destinationLedger', toLedger);
        if (amountVal) {
          store.setFormValue('transferAmount', amountVal);
          store.setFormValue('amount', amountVal);
          store.setFormValue('amountReceived', amountVal);
        }
      } else {
        const partyLedger = getFieldValue('party_ledger');
        const bankCashLedger = getFieldValue('bank_cash_ledger');
        const amountVal = parseFloat(getFieldValue('total_amount')) || 0;
        if (bankCashLedger) {
          store.setFormValue('againstLedger', bankCashLedger);
          const isBank = bankCashLedger.toLowerCase().includes('bank') || bankCashLedger.toLowerCase().includes('sbi') || bankCashLedger.toLowerCase().includes('hdfc');
          if (isBank) {
            store.setFormValue('bankLedger', bankCashLedger);
            store.setFormValue('transType', 'RTGS');
          } else {
            store.setFormValue('cashLedger', bankCashLedger);
            store.setFormValue('transType', 'Cash');
          }
        }
        if (amountVal) store.setFormValue('amount', amountVal);
        
        if (partyLedger) {
          store.setFormValue('ledgerRows', [{
            id: Date.now(),
            ledgerName: partyLedger,
            description: '',
            amount: amountVal,
            costCenter: ''
          }]);
        }
      }
      
      store.fetchMasterData();
    }
    setIsStoreInitialized(true);
  }, [mapSchemaToForm]);

  // ── Progressive polling ───────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    // If already ready (e.g. re-opened), skip straight to form
    if (doc.dynamic_schema && (doc.status === 'Ready For Review' || doc.status === 'AI Analyzed')) {
      setCurrentDoc(doc);
      setPipelineStage('ai_complete');
      setPipelineProgress(100);
      setPipelineLabel('Extraction complete!');
      initStore(doc);
      return;
    }

    // Start polling progress endpoint
    const poll = async () => {
      try {
        const res = await bulkUploadApi.getProgress(doc.id);
        if (!active) return;

        if (res.success) {
          setPipelineStage(res.stage || 'processing');
          setPipelineProgress(res.progress || 5);
          setPipelineLabel(res.stage_label || 'Processing...');

          // Update doc metadata (fileUrl etc.) if returned
          if (res.stage !== 'failed') {
            setCurrentDoc(prev => ({ ...prev, status: res.status }));
          }

          if (res.ai_done && res.dynamic_schema) {
            // Pipeline complete — fetch full doc then init form
            clearInterval(pollRef.current);
            pollRef.current = null;
            try {
              const fullRes = await bulkUploadApi.getDocument(doc.id);
              if (active && fullRes.success && fullRes.document) {
                const d = fullRes.document;
                // Prepend baseUrl if relative
                const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
                if (d.fileUrl && d.fileUrl.startsWith('/')) d.fileUrl = `${base}${d.fileUrl}`;
                setCurrentDoc(d);
                initStore(d);
              }
            } catch (e) {
              console.error('Failed to fetch full doc after pipeline', e);
              // Fallback: use inline dynamic_schema from progress
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

    poll(); // Immediate first call
    pollRef.current = setInterval(poll, 2000);

    return () => {
      active = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-match party ledger once masterData loads ─────────────────────────
  useEffect(() => {
    const findClosestLedger = (extractedName, ledgersList) => {
      if (!extractedName || extractedName === 'Missing') return extractedName;
      if (!ledgersList || ledgersList.length === 0) return extractedName;
      
      const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^the/, '').trim();
      const cleanExtracted = clean(extractedName);
      
      // 1. Exact clean match
      for (const ledger of ledgersList) {
        if (clean(ledger) === cleanExtracted) return ledger;
      }
      
      // 2. Substring match
      for (const ledger of ledgersList) {
        const cleanLed = clean(ledger);
        if (cleanLed.includes(cleanExtracted) || cleanExtracted.includes(cleanLed)) {
          return ledger;
        }
      }
      
      return extractedName;
    };

    if (isInvoice && isStoreInitialized && masterData?.partyLedgers?.length > 0 && form.partyLedger) {
      const extracted = form.partyLedger;
      const ledgers = masterData.partyLedgers;
      if (!ledgers.includes(extracted)) {
        const closest = findClosestLedger(extracted, ledgers);
        if (closest !== extracted) {
          handleFieldChange('partyLedger', closest);
          if (masterData?.partyLedgerDetails?.[closest]) {
            const d = masterData.partyLedgerDetails[closest];
            handleFieldChange('partyGstin', d.gstin || '');
            handleFieldChange('gstRegistration', d.gstState ? `${d.gstState} Registration` : '');
            handleFieldChange('gstRegistrationType', d.registrationType || '');
          }
        }
      }
    }
  }, [masterData?.partyLedgers, form.partyLedger, isStoreInitialized, isInvoice]);

  // ── Field / item change handlers ─────────────────────────────────────────
  const handleFieldChange = (field, value) => {
    if (isSales) useSalesStore.getState().setFormField(field, value);
    else usePurchaseStore.getState().updateForm({ [field]: value });
  };
  const handleItemChange = (id, field, value) => {
    const updates = typeof field === 'object' && field !== null ? field : { [field]: value };
    if (isSales) useSalesStore.getState().updateProductLine(id, updates);
    else usePurchaseStore.getState().updateProductLine(id, updates);
  };
  const handleAddItem = () => { if (isSales) useSalesStore.getState().addProductLine(); else usePurchaseStore.getState().addProductLine(); };
  const handleRemoveItem = (id) => { if (isSales) useSalesStore.getState().removeProductLine(id); else usePurchaseStore.getState().removeProductLine(id); };

  const handlePartyChange = (value) => {
    handleFieldChange('partyLedger', value);
    if (value && masterData?.partyLedgerDetails?.[value]) {
      const d = masterData.partyLedgerDetails[value];
      handleFieldChange('partyGstin', d.gstin || '');
      handleFieldChange('gstRegistration', d.gstState ? `${d.gstState} Registration` : '');
      handleFieldChange('gstRegistrationType', d.registrationType || '');
    } else {
      handleFieldChange('partyGstin', ''); handleFieldChange('gstRegistration', ''); handleFieldChange('gstRegistrationType', '');
    }
  };

  const getGstRegistrationOptions = () => {
    const base = masterData?.gstRegistrations?.length > 0 ? [...masterData.gstRegistrations] : ['Madhya Pradesh Registration', 'Maharashtra Registration'];
    const partyStates = new Set();
    if (masterData?.partyLedgerDetails) {
      Object.values(masterData.partyLedgerDetails).forEach(d => { if (d.gstState?.trim()) partyStates.add(`${d.gstState.trim()} Registration`); });
    }
    return Array.from(new Set([...base, ...partyStates])).sort();
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      if (isInvoice) {
        const res = isSales ? await useSalesStore.getState().saveTransaction(true) : await usePurchaseStore.getState().saveTransaction(true);
        if (res.success) {
          await bulkUploadApi.updateStatus(doc.id || doc.uploadId, 'Validated');
          toast.success('Voucher saved as draft!');
          onSaveSuccess?.();
        } else {
          toast.error(res.message || 'Failed to save draft');
        }
      } else {
        const res = await bulkUploadApi.saveDynamicDraft(doc.id || doc.uploadId, sections, documentType);
        if (res.success) {
          toast.success('Dynamic draft saved successfully!');
          onSaveSuccess?.();
        } else {
          toast.error('Failed to save dynamic draft');
        }
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNext = async () => {
    setIsSaving(true);
    try {
      if (isInvoice) {
        const res = isSales ? await useSalesStore.getState().saveTransaction(false) : await usePurchaseStore.getState().saveTransaction(false);
        if (res.success) {
          await bulkUploadApi.updateStatus(doc.id || doc.uploadId, 'Validated');
          toast.success('Voucher posted!');
          onSaveSuccess?.();
        } else {
          toast.error(res.message || 'Failed to post');
        }
      } else {
        const getFieldValue = (fieldId) => {
          for (const sec of sections) {
            const f = sec.fields?.find(field => field.id === fieldId);
            if (f) return f.value;
          }
          return '';
        };

        const docTypeLower = documentType.toLowerCase();
        let draftPayload = {};
        let endpoint = '';

        if (docTypeLower.includes('payment')) {
          endpoint = '/voucher/payment';
          draftPayload = {
            voucher_type: 'Payment',
            party: getFieldValue('party_ledger'),
            amount: parseFloat(getFieldValue('total_amount')) || 0,
            credit: getFieldValue('bank_cash_ledger'),
            debit: getFieldValue('party_ledger'),
            date: getFieldValue('voucher_date') || new Date().toISOString().split('T')[0],
            narration: getFieldValue('narration') || '',
            voucher_number: getFieldValue('voucher_number') || '',
            entry_mode: 'accounting'
          };
        } else if (docTypeLower.includes('receipt')) {
          endpoint = '/voucher/receipt';
          draftPayload = {
            voucher_type: 'Receipt',
            party: getFieldValue('party_ledger'),
            amount: parseFloat(getFieldValue('total_amount')) || 0,
            credit: getFieldValue('party_ledger'),
            debit: getFieldValue('bank_cash_ledger'),
            date: getFieldValue('voucher_date') || new Date().toISOString().split('T')[0],
            narration: getFieldValue('narration') || '',
            voucher_number: getFieldValue('voucher_number') || '',
            entry_mode: 'accounting'
          };
        } else if (docTypeLower.includes('contra')) {
          endpoint = '/voucher/contra';
          draftPayload = {
            voucher_type: 'Contra',
            party: getFieldValue('to_ledger'),
            amount: parseFloat(getFieldValue('transfer_amount')) || 0,
            credit: getFieldValue('from_ledger'),
            debit: getFieldValue('to_ledger'),
            date: getFieldValue('voucher_date') || new Date().toISOString().split('T')[0],
            narration: getFieldValue('narration') || '',
            voucher_number: getFieldValue('voucher_number') || '',
            entry_mode: 'accounting'
          };
        } else {
          throw new Error('Unsupported voucher type for posting');
        }

        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-company-id': localStorage.getItem('companyId') || ''
          },
          body: JSON.stringify({
            session_id: doc.id || doc.uploadId,
            draft: draftPayload
          })
        });
        const res = await response.json();
        if (res.success) {
          await bulkUploadApi.updateStatus(doc.id || doc.uploadId, 'Validated');
          toast.success(res.message || 'Voucher posted successfully!');
          onSaveSuccess?.();
        } else {
          toast.error(res.message || 'Failed to post voucher');
        }
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
      // Use taxableAmount (post additional-charge distribution) if available, else fall back to amount
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
  const grandTotal = parseFloat(form?.grandTotal) || 0;

  const hasDescription = (form?.productLines || []).some(row => row.description && row.description.trim() !== '');
  const hasHsnSac = (form?.productLines || []).some(row => row.hsnSacCode && row.hsnSacCode.trim() !== '');
  const hasDiscount = (form?.productLines || []).some(row => parseFloat(row.discountPercent) > 0);

  const getSchemaStoreKey = (fieldId) => {
    const mapping = {
      invoice_number: 'invoiceNumber',
      invoice_date: 'invoiceDate',
      voucher_number: 'invoiceNumber',
      voucher_date: 'invoiceDate',
      customer_name: 'partyLedger',
      supplier_name: 'partyLedger',
      party_ledger: 'partyLedger',
      customer_gstin: 'partyGstin',
      supplier_gstin: 'partyGstin',
      party_gstin: 'partyGstin',
      gstin: 'partyGstin',
      state: 'gstRegistration',
      narration: 'narration',
      round_off: 'roundOff',
      taxable_value: 'baseTotal',
      cgst_total: 'cgstTotal',
      sgst_total: 'sgstTotal',
      igst_total: 'igstTotal',
      total_amount: 'grandTotal',
    };
    return mapping[fieldId] || fieldId;
  };

  const handleLocalFieldChange = (sectionId, fieldId, newValue) => {
    setSections(prevSections => prevSections.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        fields: sec.fields.map(f => {
          if (f.id !== fieldId) return f;
          return { ...f, value: newValue };
        })
      };
    }));
  };

  const handleLocalTableChange = (sectionId, fieldId, rowIndex, colId, newValue) => {
    setSections(prevSections => prevSections.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        fields: sec.fields.map(f => {
          if (f.id !== fieldId) return f;
          const newRows = [...(f.rows || [])];
          newRows[rowIndex] = { ...newRows[rowIndex], [colId]: newValue };
          return { ...f, rows: newRows };
        })
      };
    }));
  };

  const renderDynamicField = (field, sectionId) => {
    if (isInvoice) {
      const storeKey = getSchemaStoreKey(field.id);
      let storeValue = form[storeKey];
      if (storeKey === 'invoiceDate' || storeKey === 'voucherDate') {
        storeValue = form.invoiceDate || form.voucherDate || '';
      } else if (storeKey === 'invoiceNumber' || storeKey === 'voucherNumber') {
        storeValue = form.invoiceNumber || form.voucherNumber || '';
      }

      if (storeKey === 'partyLedger') {
        return (
          <div key={field.id} className="col-span-2 relative pt-1">
            <SearchableDropdown
              label={field.label}
              confidence={field.confidence}
              compact
              placeholder="Select Customer / Vendor"
              options={masterData?.partyLedgers || []}
              value={form.partyLedger}
              onChange={handlePartyChange}
            />
          </div>
        );
      }

      if (storeKey === 'gstRegistration') {
        return (
          <div key={field.id} className="col-span-1 relative pt-1">
            <SearchableDropdown
              label={field.label}
              confidence={field.confidence}
              compact
              placeholder="Select Registration"
              options={getGstRegistrationOptions()}
              value={form.gstRegistration}
              onChange={(v) => handleFieldChange('gstRegistration', v)}
            />
          </div>
        );
      }

      if (field.editable === false || storeKey === 'grandTotal' || storeKey === 'baseTotal' || storeKey === 'cgstTotal' || storeKey === 'sgstTotal' || storeKey === 'igstTotal') {
        return (
          <Field key={field.id} label={field.label} confidence={field.confidence}>
            <input
              type="text"
              readOnly
              value={typeof storeValue === 'number' ? `₹ ${storeValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (storeValue || '')}
              className="w-full h-9 px-3 rounded-t border-b text-[12px] font-black outline-none bg-indigo-50 border-indigo-300 text-indigo-700"
            />
          </Field>
        );
      }

      if (field.type === 'textarea') {
        return (
          <Field key={field.id} label={field.label} confidence={field.confidence} className="col-span-4">
            <input
              type="text"
              value={storeValue || ''}
              onChange={(e) => handleFieldChange(storeKey, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className={inputCls}
            />
          </Field>
        );
      }

      if (storeKey === 'voucherType') {
        return (
          <Field key={field.id} label={field.label} confidence={field.confidence}>
            <select
              value={form.voucherType || 'sales_invoice'}
              onChange={(e) => handleFieldChange('voucherType', e.target.value)}
              className={selectCls}
            >
              <option value="sales_invoice">Sales Invoice</option>
              <option value="sales_order">Sales Order</option>
              <option value="credit_note">Credit Note</option>
              <option value="purchase_invoice">Purchase Invoice</option>
              <option value="purchase_order">Purchase Order</option>
            </select>
          </Field>
        );
      }

      return (
        <Field key={field.id} label={field.label} confidence={field.confidence}>
          <input
            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
            value={storeValue || ''}
            onChange={(e) => {
              const val = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
              handleFieldChange(storeKey, val);
              if (storeKey === 'invoiceDate' || storeKey === 'voucherDate') {
                handleFieldChange('invoiceDate', e.target.value);
                handleFieldChange('voucherDate', e.target.value);
              } else if (storeKey === 'invoiceNumber' || storeKey === 'voucherNumber') {
                handleFieldChange('invoiceNumber', e.target.value);
                handleFieldChange('voucherNumber', e.target.value);
              }
            }}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputCls}
          />
        </Field>
      );
    } else {
      const val = field.value ?? '';
      
      const isPartyField = field.id.includes('party') || field.id.includes('customer') || field.id.includes('supplier');
      const isCashBankField = field.id.includes('bank') || field.id.includes('cash') || field.id.includes('ledger') || field.id.includes('from_account') || field.id.includes('to_account') || field.id.includes('from_ledger') || field.id.includes('to_ledger');

      if (isPartyField || isCashBankField) {
        const dropdownOptions = isPartyField 
          ? (masterData?.partyLedgers || []) 
          : (masterData?.allLedgers?.length ? masterData.allLedgers : (masterData?.partyLedgers || []));

        return (
          <div key={field.id} className="w-full relative pt-1">
            <SearchableDropdown
              label={field.label}
              confidence={field.confidence}
              compact
              placeholder={`Select ${field.label}`}
              options={dropdownOptions}
              value={val}
              onChange={(v) => handleLocalFieldChange(sectionId, field.id, v)}
            />
          </div>
        );
      }

      if (field.type === 'textarea' || field.id === 'narration') {
        return (
          <Field key={field.id} label={field.label} confidence={field.confidence} className="w-full">
            <textarea
              value={val}
              onChange={(e) => handleLocalFieldChange(sectionId, field.id, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className="w-full min-h-[64px] p-3 rounded-t border-b text-[12px] font-medium outline-none bg-slate-50 border-slate-300 text-slate-800 focus:border-indigo-500"
            />
          </Field>
        );
      }

      if (field.editable === false) {
        return (
          <Field key={field.id} label={field.label} confidence={field.confidence} className="w-full">
            <input
              type="text"
              readOnly
              value={typeof val === 'number' ? `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : val}
              className="w-full h-9 px-3 rounded-t border-b text-[12px] font-black outline-none bg-indigo-50 border-indigo-300 text-indigo-700"
            />
          </Field>
        );
      }

      return (
        <Field key={field.id} label={field.label} confidence={field.confidence} className="w-full">
          <input
            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
            value={val}
            onChange={(e) => {
              const parsedVal = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
              handleLocalFieldChange(sectionId, field.id, parsedVal);
            }}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputCls}
          />
        </Field>
      );
    }
  };

  const renderDynamicTable = (field) => {
    if (!isInvoice) return null;
    const columns = field.columns || [];
    const showHsn = columns.some(c => c.id === 'hsn_code');
    const showDiscount = columns.some(c => c.id === 'discountPercent' || c.id === 'disc_percent');

    return (
      <div key={field.id} className="p-3 m3-card mb-0 col-span-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-heading)]">{field.label}</h3>
          <button
            onClick={handleAddItem}
            className="px-2 py-1 rounded-lg border border-[var(--app-border)] text-[10px] font-black text-[var(--app-heading)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] flex items-center gap-1 shadow-sm uppercase cursor-pointer"
          >
            <Plus size={10} strokeWidth={3} /> Add Line
          </button>
        </div>
        <div className="overflow-x-auto overflow-visible">
<table className="w-full text-left text-[10px] border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b text-slate-500 font-extrabold uppercase" style={{ borderColor: theme.border }}>
                <th className="px-1 py-1.5 w-8 text-center border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>#</th>
                <th className="px-1 py-1.5 border-r min-w-[150px]" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Item / Ledger *</th>
                {showHsn && <th className="px-1 py-1.5 w-18 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>HSN/SAC</th>}
                <th className="px-1 py-1.5 w-14 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>GST%</th>
                <th className="px-1 py-1.5 w-14 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Qty</th>
                <th className="px-1 py-1.5 w-16 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Unit</th>
                <th className="px-1 py-1.5 w-22 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Rate (₹)</th>
                {showDiscount && <th className="px-1 py-1.5 w-12 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Disc%</th>}
                <th className="px-1 py-1.5 w-24 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Amount (₹)</th>
                <th className="px-1 py-1.5 w-8 text-center" style={{ backgroundColor: theme.headerBg }}></th>
              </tr>
            </thead>
            <tbody className="overflow-visible">
              {(form.productLines || []).map((row, idx) => (
                <tr 
                  key={row.id || idx} 
                  className={`border-b overflow-visible transition-colors ${
                    row.uncertain 
                      ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-2 border-l-amber-500' 
                      : 'hover:bg-slate-50/50'
                  }`}
                  style={{ borderColor: theme.border }}
                >
                  <td className="px-1 py-0.5 text-center font-bold border-r" style={{ borderColor: theme.border }}>
                    <div className="flex items-center justify-center gap-1">
                      {row.uncertain && (
                        <AlertCircle size={10} className="text-amber-600 shrink-0 animate-pulse" title={`Low Confidence Row (${row.confidence}%). Please check details.`} />
                      )}
                      <span className={row.uncertain ? 'text-amber-800' : 'text-slate-400'}>{idx + 1}</span>
                    </div>
                  </td>
                  <td className="px-1 py-0.5 border-r relative overflow-visible" style={{ borderColor: theme.border }}>
                    <SearchableDropdown
                      placeholder="Search Item / Ledger"
                      compact
                      options={masterData?.stockItems || []}
                      value={row.stockItem}
                      onChange={(v) => {
                        const updates = { stockItem: v };
                        if (v && masterData?.stockItemDetails?.[v]) {
                          const sd = masterData.stockItemDetails[v];
                          if (sd.hsnCode) updates.hsnSacCode = sd.hsnCode;
                          if (sd.gstRate !== undefined) updates.gstRate = sd.gstRate;
                          if (sd.unit) updates.unit = sd.unit;
                        }
                        handleItemChange(row.id, updates);
                      }}
                    />
                    {columns.some(c => c.id === 'description' || c.id === 'desc') && (
                      <input
                        type="text"
                        value={row.description || ''}
                        onChange={(e) => handleItemChange(row.id, 'description', e.target.value)}
                        placeholder="Description"
                        className="w-full h-5 px-2 mt-0.5 border-t outline-none text-[10px] bg-transparent text-slate-400"
                        style={{ borderColor: theme.border }}
                      />
                    )}
                  </td>
                  {showHsn && (
                    <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                      <input
                        type="text"
                        value={row.hsnSacCode || ''}
                        onChange={(e) => handleItemChange(row.id, 'hsnSacCode', e.target.value)}
                        placeholder="HSN"
                        className="w-full h-7 px-2 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] focus:border-[var(--app-accent)] transition-all"
                        style={{ borderColor: theme.border, color: theme.text }}
                      />
                    </td>
                  )}
                  <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                    <select
                      value={row.gstRate || 0}
                      onChange={(e) => handleItemChange(row.id, 'gstRate', parseFloat(e.target.value) || 0)}
                      className="w-full h-7 px-1 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] cursor-pointer focus:border-[var(--app-accent)] transition-all"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </td>
                  <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                    <input
                      type="number"
                      value={row.billQuantity || ''}
                      onChange={(e) => handleItemChange(row.id, 'billQuantity', parseFloat(e.target.value) || 0)}
                      placeholder="1"
                      className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] focus:border-[var(--app-accent)] transition-all"
                      style={{ borderColor: theme.border, color: theme.text }}
                    />
                  </td>
                  <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                    <select
                      value={row.unit || 'Nos'}
                      onChange={(e) => handleItemChange(row.id, 'unit', e.target.value)}
                      className="w-full h-7 px-1 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] cursor-pointer focus:border-[var(--app-accent)] transition-all"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <option>Nos</option>
                      <option>Pcs</option>
                      <option>Kg</option>
                      <option>Ltr</option>
                      <option>Box</option>
                      <option>Mtr</option>
                    </select>
                  </td>
                  <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                    <input
                      type="number"
                      value={row.billRate || ''}
                      onChange={(e) => handleItemChange(row.id, 'billRate', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] focus:border-[var(--app-accent)] transition-all"
                      style={{ borderColor: theme.border, color: theme.text }}
                    />
                  </td>
                  {showDiscount && (
                    <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                      <input
                        type="number"
                        value={row.discountPercent || ''}
                        onChange={(e) => handleItemChange(row.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] focus:border-[var(--app-accent)] transition-all"
                        style={{ borderColor: theme.border, color: theme.text }}
                      />
                    </td>
                  )}
                  <td className="px-1.5 py-1 text-right font-bold text-slate-800 border-r" style={{ borderColor: theme.border }}>₹{parseFloat(row.amount || 0).toFixed(2)}</td>
                  <td className="px-0 py-0 text-center">
                    <button
                      onClick={() => handleRemoveItem(row.id)}
                      disabled={(form.productLines || []).length <= 1}
                      className="p-0.5 rounded text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Summary bar */}
        <div className="mt-3 h-10 px-3 flex items-center justify-between border rounded-2xl text-[9.5px] font-black uppercase tracking-widest overflow-x-auto bg-slate-50 border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-400">Items</span>
            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px] border border-indigo-200">{(form.productLines || []).length}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {[
              { label: 'Base', val: `₹${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
              { label: 'CGST', val: `₹${totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
              { label: 'SGST', val: `₹${totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
              { label: 'IGST', val: `₹${totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
              { label: 'Net', val: `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, highlight: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <span className="text-slate-400">{item.label}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] border ${item.highlight ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Shared style helpers ──────────────────────────────────────────────────
  const Field = ({ label, confidence, className = "col-span-1", children }) => {
    const isLowConfidence = typeof confidence === 'number' && confidence < 85;
    return (
      <div className={`${className} relative pt-1`}>
        <div className="flex items-center justify-between absolute -top-2 left-2 z-10 px-1 select-none" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
          <label className="text-[10px] font-black uppercase tracking-tighter mr-1.5" style={{ color: 'var(--m3-on-surface-variant)' }}>{label}</label>
          {typeof confidence === 'number' && (
            <span className={`text-[8.5px] font-extrabold px-1 rounded-sm ${
              isLowConfidence 
                ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' 
                : confidence < 95
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {confidence}%
            </span>
          )}
        </div>
        <div className={isLowConfidence ? "rounded-lg ring-1 ring-red-400 focus-within:ring-red-500" : ""}>
          {children}
        </div>
      </div>
    );
  };

  const inputCls = "w-full h-9 px-3 rounded-t border-b text-[12px] font-medium outline-none bg-slate-50 border-slate-300 text-slate-800 focus:border-indigo-500";
  const selectCls = "w-full h-9 px-3 rounded-t border-b text-[12px] font-medium outline-none bg-slate-50 border-slate-300 text-slate-800 focus:border-indigo-500 cursor-pointer";

  const isPipelineDone = isStoreInitialized && pipelineStage === 'ai_complete';

  // ── Badge for the left panel ──────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────


  const getDynamicValidation = () => {
    if (!isInvoice) {
      const errors = [];
      const warnings = [];
      const getFieldValue = (fieldId) => {
        for (const sec of sections) {
          const f = sec.fields?.find(field => field.id === fieldId);
          if (f) return f.value;
        }
        return '';
      };
      
      const docTypeLower = documentType.toLowerCase();
      if (docTypeLower.includes('contra')) {
        if (!getFieldValue('voucher_number')) errors.push({ message: 'Voucher Number is missing' });
        if (!getFieldValue('voucher_date')) errors.push({ message: 'Voucher Date is missing' });
        if (!getFieldValue('from_ledger')) errors.push({ message: 'Source Account (From) is missing' });
        if (!getFieldValue('to_ledger')) errors.push({ message: 'Destination Account (To) is missing' });
        if (!parseFloat(getFieldValue('transfer_amount'))) errors.push({ message: 'Transfer Amount must be greater than 0' });
      } else if (docTypeLower.includes('payment') || docTypeLower.includes('receipt')) {
        if (!getFieldValue('voucher_number')) errors.push({ message: 'Voucher Number is missing' });
        if (!getFieldValue('voucher_date')) errors.push({ message: 'Voucher Date is missing' });
        if (!getFieldValue('party_ledger')) errors.push({ message: 'Party Ledger is missing' });
        if (!getFieldValue('bank_cash_ledger')) errors.push({ message: 'Bank/Cash Account is missing' });
        if (!parseFloat(getFieldValue('total_amount'))) errors.push({ message: 'Total Amount must be greater than 0' });
      }
      return {
        error_count: errors.length,
        warning_count: warnings.length,
        errors,
        warnings
      };
    }

    const errors = [];
    const warnings = [];

    const isSalesDoc = isSales;

    // 1. Missing fields check
    if (!form.invoiceNumber || form.invoiceNumber === 'Missing') {
      errors.push({ message: 'Invoice Number is missing' });
    }
    if (!form.invoiceDate || form.invoiceDate === 'Missing') {
      errors.push({ message: 'Invoice Date is missing' });
    }
    if (!form.partyLedger || form.partyLedger === 'Missing') {
      errors.push({ message: isSalesDoc ? 'Customer Name is missing' : 'Supplier Name is missing' });
    }

    // 2. Line items math check
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

    // 3. Taxable value vs sum of items
    const taxableValue = parseFloat(form.baseTotal) || 0;
    if (itemsSum > 0 && taxableValue > 0 && Math.abs(itemsSum - taxableValue) > 2.0) {
      warnings.push({ message: `Sum of line items (${itemsSum.toFixed(2)}) ≠ taxable value (${taxableValue.toFixed(2)})` });
    }

    // 4. GST symmetry
    const cgstTotal = parseFloat(form.cgstTotal) || 0;
    const sgstTotal = parseFloat(form.sgstTotal) || 0;
    const igstTotal = parseFloat(form.igstTotal) || 0;
    if (cgstTotal > 0 || sgstTotal > 0) {
      if (Math.abs(cgstTotal - sgstTotal) > 1.0) {
        errors.push({ message: `CGST (${cgstTotal.toFixed(2)}) ≠ SGST (${sgstTotal.toFixed(2)}) for intra-state transaction` });
      }
    }

    // 5. Grand total match
    const roundOff = parseFloat(form.roundOff) || 0;
    const grandTotal = parseFloat(form.grandTotal) || 0;
    const expectedTotal = Math.round((taxableValue + cgstTotal + sgstTotal + igstTotal + roundOff) * 100) / 100;
    if (grandTotal > 0 && Math.abs(expectedTotal - grandTotal) > 2.0) {
      errors.push({ message: `Calculated total (${expectedTotal.toFixed(2)}) ≠ invoice total (${grandTotal.toFixed(2)})` });
    }

    return {
      error_count: errors.length,
      warning_count: warnings.length,
      errors,
      warnings
    };
  };

  const renderVoucherTypeField = () => {
    return (
      <Field key="voucher_type_injected" label="Voucher Type" confidence={100}>
        <select
          value={form.voucherType || voucherType}
          onChange={(e) => {
            const val = e.target.value;
            handleFieldChange('voucherType', val);
          }}
          className={selectCls}
        >
          {isInvoice ? (
            <>
              <option value="sales_invoice">Sales Invoice</option>
              <option value="sales_order">Sales Order</option>
              <option value="credit_note">Credit Note</option>
              <option value="purchase_invoice">Purchase Invoice</option>
              <option value="purchase_order">Purchase Order</option>
              <option value="debit_note">Debit Note</option>
            </>
          ) : (
            <>
              <option value="cash_payment">Payment Voucher</option>
              <option value="bank_payment">Receipt Voucher</option>
              <option value="contra">Contra Voucher</option>
            </>
          )}
        </select>
      </Field>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="m3-scope absolute inset-0 z-[50] flex flex-col overflow-hidden text-slate-800 font-sans text-xs select-none" style={{ backgroundColor: 'var(--m3-surface)' }}>

      {/* ── Top Header Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="m3-icon-btn hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
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
            <span className="text-[9.5px] font-semibold text-slate-400 block -mt-0.5">Review and edit AI-extracted fields</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={handleSaveDraft} disabled={isSaving || !isPipelineDone} className="m3-btn m3-btn--outlined disabled:opacity-40 cursor-pointer">
            {isSaving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />} Draft
          </button>
          <button onClick={handleSaveNext} disabled={isSaving || !isPipelineDone} className="m3-btn m3-btn--filled disabled:opacity-40 cursor-pointer">
            {isSaving ? <Loader2 size={13} className="animate-spin mr-1" /> : <ArrowRight size={13} className="mr-1" />} Save &amp; Next
          </button>
        </div>
      </div>

      {/* ── 3-Panel Layout ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* PANEL 1: Document Preview — always visible immediately */}
        <div className="w-[30%] bg-white border-r border-slate-200/60 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
            <span className="font-bold text-slate-600 uppercase tracking-wide text-[9.5px]">Source Document</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 font-bold truncate max-w-[120px]">{fileName}</span>
              <StatusBadge />
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-white flex flex-col">
            {fileUrl ? (
              isPdf ? (
                <iframe src={fileUrl} className="w-full h-full border-none m-0 p-0" title="Invoice Preview" />
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-2 bg-slate-50">
                  <img src={fileUrl} alt="Invoice Preview" className="max-w-full max-h-full object-contain" />
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <FileText size={32} className="opacity-30" />
                <span className="font-bold text-[10px] uppercase tracking-widest">Loading preview...</span>
              </div>
            )}
          </div>
          {/* Meta info bar at bottom */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="flex gap-4 text-[9.5px] font-bold text-slate-500">
              <span>Size: <span className="text-slate-700">{fileSize}</span></span>
              <span>Pages: <span className="text-slate-700">{pageCount}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/30 px-2 py-0.5 rounded-md">
              <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
              <span>{confidence}% Confidence</span>
            </div>
          </div>
        </div>

        {/* PANEL 2: Form or Progress */}
        <div className={`${showAiPanel ? 'w-[45%]' : 'w-[70%]'} bg-[#f0f2f5] overflow-y-auto themed-scrollbar p-4 flex flex-col gap-3 transition-all duration-300 m3-scope`}>

          {!isPipelineDone ? (
            /* ── Processing State: show live progress steps ── */
            <div className="flex-1 bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-[13px] font-black text-slate-900">AI Extraction in Progress</h2>
                  <p className="text-[9.5px] text-slate-400 font-semibold">Your document is being read and analyzed</p>
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
            /* ── Done: show the full editable form ── */
            <>
              {/* Header */}
              <div className="p-3 m3-card mb-0 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--app-heading)] mb-0.5">Extracted Data</h3>
                    <p className="text-[9.5px] text-slate-400 font-semibold">Review and update extracted fields below</p>
                  </div>
                  <span className="m3-chip m3-chip--primary text-[9.5px] font-extrabold px-3 py-1">AI Extracted</span>
                </div>
              </div>

              {/* ── Validation Banner ── */}
              {(() => {
                const v = getDynamicValidation();
                if (!v) return null;
                const errCount  = v.error_count   || 0;
                const warnCount = v.warning_count  || 0;
                if (errCount === 0 && warnCount === 0) return (
                  <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/40 rounded-xl text-[10.5px] font-bold text-emerald-700 flex items-center gap-2 shadow-sm">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>Validation Passed — calculations verified.</span>
                  </div>
                );
                return (
                  <div className={`p-3 border rounded-xl text-[10.5px] font-bold shadow-sm ${
                    errCount > 0 ? 'bg-red-50/80 border-red-200/40 text-red-700' : 'bg-amber-50/80 border-amber-200/40 text-amber-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={13} className={errCount > 0 ? 'text-red-500' : 'text-amber-500'} />
                      <span>{errCount > 0 ? `Validation: ${errCount} error${errCount !== 1 ? 's' : ''}` : 'Validation'}{warnCount > 0 ? `, ${warnCount} warning${warnCount !== 1 ? 's' : ''}` : ''}</span>
                    </div>
                    <ul className="pl-5 list-disc space-y-0.5">
                      {(v.errors || []).map((e, i) => (
                        <li key={`ve-${i}`} className="text-red-600 font-semibold">{e.message}</li>
                      ))}
                      {(v.warnings || []).map((w, i) => (
                        <li key={`vw-${i}`} className="text-amber-700 font-semibold">{w.message}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* DYNAMIC SECTIONS & FIELDS RENDERER */}
              {((isInvoice ? (currentDoc?.dynamic_schema?.sections || []) : sections) || []).map((section) => {
                if (section.visible === false) return null;

                const tableField = section.fields?.find(f => f.type === 'table');
                const standardFields = section.fields?.filter(f => f.type !== 'table') || [];

                if (tableField) {
                  return renderDynamicTable(tableField);
                }

                if (!isInvoice) {
                  return (
                    <div key={section.id} className="p-3 m3-card mb-0 max-w-2xl mx-auto w-full space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-heading)] mb-1.5 flex items-center gap-1.5 border-b pb-1.5 border-slate-100">
                        <span className="w-1.5 h-3 bg-[var(--app-accent)] rounded" />
                        {section.title}
                      </h3>
                      <div className="space-y-4">
                        {section.id === 'voucher_details' ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              {renderVoucherTypeField()}
                              {section.fields?.filter(f => f.id === 'voucher_number' || f.id === 'voucher_date').map((field) => {
                                if (field.visible === false) return null;
                                return renderDynamicField(field, section.id);
                              })}
                            </div>
                            <div className="flex flex-col gap-4 pt-1">
                              {section.fields?.filter(f => f.id !== 'voucher_number' && f.id !== 'voucher_date').map((field) => {
                                if (field.visible === false) return null;
                                return renderDynamicField(field, section.id);
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {section.fields?.map((field) => {
                              if (field.visible === false) return null;
                              return renderDynamicField(field, section.id);
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                const isVoucherDetailsSec = section.title.toUpperCase().includes('VOUCHER DETAILS') || section.title.toUpperCase().includes('INVOICE DETAILS') || section.id === 'voucher_details';
                return (
                  <div key={section.id} className="p-3 m3-card mb-0">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-heading)] mb-2.5">{section.title}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-4">
                      {isVoucherDetailsSec && renderVoucherTypeField()}
                      {standardFields.map((field) => {
                        if (field.visible === false) return null;
                        return renderDynamicField(field, section.id);
                      })}
                    </div>
                  </div>
                );
              })}

              {/* C. HSN Tax Summary */}
              {isInvoice && (
                <div className="p-3 m3-card mb-0">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-heading)] mb-2">Tax Details (HSN Summary)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead>
                        <tr className="border-b font-extrabold uppercase" style={{ borderColor: theme.border, color: theme.mutedText }}>
                          <th className="px-2 py-1.5 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>HSN/SAC</th>
                          <th className="px-2 py-1.5 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Taxable</th>
                          <th className="px-2 py-1.5 text-center border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }} colSpan={2}>CGST</th>
                          <th className="px-2 py-1.5 text-center border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }} colSpan={2}>SGST/UTGST</th>
                          <th className="px-2 py-1.5 text-right" style={{ backgroundColor: theme.headerBg }}>Total Tax</th>
                        </tr>
                        <tr className="font-bold text-[8.5px] uppercase border-b bg-slate-50/50" style={{ borderColor: theme.border, color: theme.mutedText }}>
                          <th className="border-r px-2 py-1" style={{ borderColor: theme.border }}></th>
                          <th className="border-r px-2 py-1" style={{ borderColor: theme.border }}></th>
                          <th className="px-2 py-1 text-center w-12 border-r" style={{ borderColor: theme.border }}>Rate</th>
                          <th className="px-2 py-1 text-right w-20 border-r" style={{ borderColor: theme.border }}>Amt</th>
                          <th className="px-2 py-1 text-center w-12 border-r" style={{ borderColor: theme.border }}>Rate</th>
                          <th className="px-2 py-1 text-right w-20 border-r" style={{ borderColor: theme.border }}>Amt</th>
                          <th className="px-2 py-1 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {hsnSummary.map((sum, i) => (
                          <tr key={i} className="border-b hover:bg-slate-50/50" style={{ borderColor: theme.border }}>
                            <td className="px-2 py-1 text-slate-700 border-r" style={{ borderColor: theme.border }}>{sum.hsn}</td>
                            <td className="px-2 py-1 text-right text-slate-600 border-r" style={{ borderColor: theme.border }}>₹{sum.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-2 py-1 text-center text-slate-500 border-r" style={{ borderColor: theme.border }}>{sum.cgstRate}%</td>
                            <td className="px-2 py-1 text-right text-slate-600 border-r" style={{ borderColor: theme.border }}>₹{sum.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-2 py-1 text-center text-slate-500 border-r" style={{ borderColor: theme.border }}>{sum.sgstRate}%</td>
                            <td className="px-2 py-1 text-right text-slate-600 border-r" style={{ borderColor: theme.border }}>₹{sum.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-2 py-1 text-right font-bold text-slate-800">₹{sum.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        <tr className="font-black text-slate-900 text-[10.5px]" style={{ backgroundColor: theme.headerBg }}>
                          <td className="px-2 py-1.5 border-r" style={{ borderColor: theme.border }}>Total</td>
                          <td className="px-2 py-1.5 text-right border-r" style={{ borderColor: theme.border }}>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="border-r" style={{ borderColor: theme.border }}></td>
                          <td className="px-2 py-1.5 text-right border-r" style={{ borderColor: theme.border }}>₹{totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="border-r" style={{ borderColor: theme.border }}></td>
                          <td className="px-2 py-1.5 text-right border-r" style={{ borderColor: theme.border }}>₹{totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-2 py-1.5 text-right text-indigo-600">₹{(totalCGST + totalSGST + totalIGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* PANEL 3: AI Review (25%, toggleable) */}
        {showAiPanel && (
          <div className="w-[25%] bg-white border-l border-slate-200/80 flex flex-col overflow-y-auto themed-scrollbar p-4 space-y-4 shrink-0 transition-all duration-300">

            {!isPipelineDone ? (
              /* Processing placeholder cards */
              <div className="space-y-3">
                <div className="border border-slate-200/60 rounded-xl p-4 shadow-sm bg-white">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3">AI Review</h3>
                  <div className="flex flex-col gap-2">
                    {['Basic Details', 'Tax Information', 'Line Items', 'Total Verification'].map((label) => (
                      <div key={label} className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                        <Loader2 size={11} className="animate-spin text-indigo-400 shrink-0" />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-indigo-50/50 border border-indigo-200/30 rounded-xl text-[9.5px] font-bold text-indigo-600 leading-relaxed">
                  <Info size={12} className="inline mr-1.5 mb-0.5" />
                  AI is reading your document. Suggestions will appear here once extraction is complete.
                </div>
              </div>
            ) : (
              /* Done: show actual review */
              <>
                <div className="border border-slate-200/60 rounded-xl p-4 shadow-sm bg-white space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-indigo-500 rounded" />AI Review &amp; Suggestions
                  </h3>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/30 text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-[11px] block">All good!</span>
                      <span className="text-[9.5px] text-emerald-700 leading-tight">No critical errors found. Please review the extracted data.</span>
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
                      { label: 'Voucher number is valid', checked: !!(sections.find(s => s.id === 'voucher_details')?.fields.find(f => f.id === 'voucher_number')?.value) },
                      { label: 'Voucher date is valid', checked: !!(sections.find(s => s.id === 'voucher_details')?.fields.find(f => f.id === 'voucher_date')?.value) },
                      { label: 'Ledgers are mapped', checked: true },
                      { label: 'Voucher total is valid', checked: grandTotal > 0 },
                    ]).map((chk, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10.5px] font-bold text-slate-700">
                        <CheckCircle2 size={12} className={chk.checked ? 'text-emerald-500' : 'text-slate-300'} />
                        <span>{chk.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200/60 rounded-xl p-4 shadow-sm bg-slate-50/50 space-y-3 select-text">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Extracted Summary</h4>
                  {isInvoice ? (
                    <div className="space-y-2 text-[11px] font-bold text-slate-600">
                      <div className="flex justify-between"><span>Taxable Amount</span><span>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>CGST</span><span>₹{totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>SGST</span><span>₹{totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>IGST</span><span>₹{totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span>Round Off</span><span>₹{totalRound.toFixed(2)}</span></div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-[11px] font-bold text-slate-600">
                      <div className="flex justify-between"><span>Type</span><span className="capitalize">{documentType}</span></div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                    <span className="text-[11px] font-black uppercase text-slate-900 tracking-wide">Total Amount</span>
                    <span className="text-xl font-black text-indigo-600">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="border border-slate-200/60 rounded-xl p-4 shadow-sm bg-white space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-3 bg-indigo-400 rounded" />AI Suggestions
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-[10px] font-bold text-slate-600 leading-normal">
                    <li>Consider adding item description in narration for better clarity.</li>
                    <li>Verify dispatch details if goods are already dispatched.</li>
                  </ul>
                </div>

                <div className="p-3 bg-indigo-50/30 border border-indigo-200/20 text-indigo-700/80 rounded-xl flex items-start gap-2 select-text">
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

// ── Searchable Dropdown ───────────────────────────────────────────────────────
function SearchableDropdown({ label, confidence, placeholder, options = [], value, onChange, hasSearch = true, compact, rounded, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const isLowConfidence = typeof confidence === 'number' && confidence < 85;

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => (opt || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`relative flex flex-col gap-1 w-full group ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={dropdownRef} style={{ zIndex: isOpen ? 50 : 1 }}>
      {label && (
        <div className="flex items-center justify-between absolute -top-2 left-2 z-10 px-1 bg-white select-none">
          <label className="text-[10px] font-black uppercase tracking-tighter group-focus-within:text-indigo-600 text-slate-500 mr-1.5">{label}</label>
          {typeof confidence === 'number' && (
            <span className={`text-[8.5px] font-extrabold px-1 rounded-sm ${
              isLowConfidence 
                ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' 
                : confidence < 95
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {confidence}%
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full ${compact ? 'h-9' : 'h-10'} rounded-t border-b px-3 flex items-center justify-between cursor-pointer transition-all duration-300 bg-slate-50 border-slate-300 text-slate-800 ${isOpen ? 'border-indigo-500' : 'hover:border-indigo-400'} ${isLowConfidence ? 'ring-1 ring-red-400' : ''}`}>
            <span className={`text-[12px] font-medium truncate ${value ? 'text-slate-800' : 'text-slate-400'}`}>{value || placeholder}</span>
            <div className="flex items-center gap-1 text-slate-400 hover:text-indigo-500 transition-colors">
              {value && !disabled && (<X size={11} className="hover:text-red-500 transition-colors mr-1" onClick={(e) => { e.stopPropagation(); onChange(''); }} />)}
              <ChevronDown size={12} className={`transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>
          </div>
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[220px] z-50 bg-white border-slate-200" style={{ boxShadow: '0 10px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1)' }}>
              {hasSearch && (
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                    <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full h-8 pl-8 pr-3 text-[11px] font-semibold outline-none transition-all rounded-md border border-slate-200 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25" />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto themed-scrollbar p-1">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt, idx) => (
                    <div key={idx} className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer rounded-md transition-colors ${value === opt ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 hover:text-indigo-600 text-slate-700'}`} onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}>
                      {opt}
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-400 font-medium text-[10px]">No results found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
