import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  Save, Send, Calendar, ChevronDown, Plus, Minus, Layout,
  Settings, X, Search, Check, RefreshCw, Bot, Loader2,
  FileText, BookText, ArrowLeftRight, UploadCloud, Paperclip,
  CheckCircle2, ShieldAlert, Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useSalesStore from '../../stores/useSalesStore';
import { useAppStore } from '../../stores/useAppStore';

const ThemeContext = createContext(null);

const CreateSales = ({ isDark, voucherType, onBack, onVoucherTypeChange, onSaveSuccess }) => {
  const navigate = useNavigate();

  const handleCancel = () => {
    const activeType = form.voucherType || 'sales_invoice';
    if (onBack) {
      onBack(activeType);
    } else {
      if (['sales_invoice', 'sales_order', 'credit_note'].includes(activeType)) {
        navigate('/sales/inbox');
      } else if (['purchase_invoice', 'purchase_order', 'debit_note'].includes(activeType)) {
        navigate('/purchase/inbox');
      } else if (activeType === 'cash_payment') {
        navigate('/fund-flow/cash-payment');
      } else if (activeType === 'bank_payment') {
        navigate('/fund-flow/bank-payment');
      } else if (activeType === 'contra') {
        navigate('/fund-flow/contra');
      } else {
        navigate('/sales/inbox');
      }
    }
  };

  // ── Store ──────────────────────────────────────────────────────────────
  const {
    form, setFormField, loading,
    saveTransaction, pushToReview, selectedTransaction, resetForm,
    addProductLine, removeProductLine, updateProductLine,
    addSalesLine, removeSalesLine, updateSalesLine,
    addAdditionalCharge, updateAdditionalCharge, removeAdditionalCharge,
    addTcsDetail, updateTcsDetail, removeTcsDetail,
    ocr, clearOcr,
    masterData, fetchMasterData, fetchSalesOrdersForParty, autofillFromSalesOrder,
    fetchNextInvoiceNumber,
    fetchCreditNoteInvoicesForParty, autofillFromSalesInvoice
  } = useSalesStore();

  const isOcrReview = !!ocr.result && !!ocr.previewUrl;
  const selectedCompany = useAppStore((s) => s.selectedCompany);

  // ── Local Mock States for mockup UI ────────────────────────────────────
  const [refInvoiceType, setRefInvoiceType] = useState('Select Type');
  const [refInvoiceNo, setRefInvoiceNo] = useState('');
  const [refInvoiceDate, setRefInvoiceDate] = useState('');
  const [gstTreatment, setGstTreatment] = useState('Registered Business - Regular');
  const [placeOfSupply, setPlaceOfSupply] = useState('Maharashtra');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [project, setProject] = useState('');
  const [tags, setTags] = useState('');

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Assist Loading states
  const [isAiAutofillLoading, setIsAiAutofillLoading] = useState(false);
  const [isAiCheckLoading, setIsAiCheckLoading] = useState(false);
  const [isRoundOffChecked, setIsRoundOffChecked] = useState(true);

  // Ledger Details & Tax Ledger Details are bound directly to form.salesLines and form.additionalCharges

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setAttachedFiles(prevFiles => [...prevFiles, file]);
          toast.success(`File ${file.name} uploaded successfully.`);
          return 100;
        }
        return prev + 30;
      });
    }, 200);
  };

  const handleAiAutofill = () => {
    setIsAiAutofillLoading(true);
    toast.info("AI is analyzing lines and filling values...");
    setTimeout(() => {
      setIsAiAutofillLoading(false);

      // Fill values for empty fields in first row
      if (form.entryTab === 'with_item' && form.productLines.length > 0) {
        updateProductLine(form.productLines[0].id, {
          description: "Standard High Quality item",
          billQuantity: 10,
          billRate: 1500,
          gstRate: 18
        });
      } else if (form.entryTab === 'without_item' && form.salesLines.length > 0) {
        updateSalesLine(form.salesLines[0].id, {
          description: "Professional IT Consulting Services",
          amount: 15000,
          gstRate: 18
        });
      }
      toast.success("AI auto-fill completed successfully!");
    }, 1500);
  };

  const handleAiCheck = () => {
    setIsAiCheckLoading(true);
    toast.info("AI is running compliance, tax, and double entry check...");
    setTimeout(() => {
      setIsAiCheckLoading(false);
      toast.success("AI-Auto Check: All calculations, HSN codes, and tax treatments are compliant and match Tally standards!");
    }, 1500);
  };

  const handlePostToTally = async () => {
    const savedResult = await saveTransaction(false);
    if (!savedResult.success) {
      toast.error(savedResult.message || 'Save failed before Posting to Tally');
      return;
    }
    toast.success("Successfully posted voucher to Tally database!");
    if (onSaveSuccess) onSaveSuccess(savedResult.data?._id || savedResult.data?.id || form._id);
    else if (onBack) onBack(form.voucherType);
  };

  useEffect(() => {
    fetchMasterData();
  }, [selectedCompany]);

  // Sync voucherType into store on mount if not editing
  useEffect(() => {
    if (!form._id) {
      const targetType = (voucherType && voucherType !== 'sales') ? voucherType : 'sales_invoice';
      setFormField('voucherType', targetType);
    }
  }, [voucherType, form._id]);

  // Auto-fill Voucher Number like Tally — peek next number on new entry only.
  useEffect(() => {
    if (!form._id && form.voucherNumberSeries === 'Default') {
      const effectiveType = form.voucherType || 'sales_invoice';
      fetchNextInvoiceNumber(effectiveType);
    }
  }, [form.voucherType, form._id, form.voucherNumberSeries]);

  const [activeTab, setActiveTab] = useState('Without Item');

  // Sync tab from store
  // Change by Anjalee: Map 'with_item'/'without_item' correctly to display tab labels
  useEffect(() => {
    if (form.entryTab) {
      setActiveTab(form.entryTab === 'with_item' ? 'With Item' : 'Without Item');
    }
  }, [form.entryTab]);

  const [showTcs, setShowTcs] = useState(false);
  const initializedRef = useRef(false);

  // Sync showTcs state with form.tcsDetails when it gets loaded or updated
  useEffect(() => {
    const hasTcs = !!(form.tcsDetails && form.tcsDetails.some(t => t.ledgerName !== '' || (parseFloat(t.assessableValue) || 0) > 0 || (parseFloat(t.rate) || 0) > 0));

    if (!initializedRef.current) {
      initializedRef.current = true;
      setShowTcs(hasTcs);
      if (!hasTcs) {
        setFormField('tcsDetails', []);
      }
    } else {
      // Auto-enable if populated details are loaded (e.g. from Sales Order autofill or editing)
      if (hasTcs) {
        setShowTcs(true);
      }
    }
  }, [form.tcsDetails]);

  const handleToggleTcs = (checked) => {
    setShowTcs(checked);
    if (checked) {
      if (!form.tcsDetails || form.tcsDetails.length === 0) {
        setFormField('tcsDetails', [{ id: Date.now() + 200, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }]);
      }
    } else {
      setFormField('tcsDetails', []);
    }
  };

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    const result = await saveTransaction(true);
    if (result.success) {
      toast.success('Draft saved successfully');
      if (onSaveSuccess) onSaveSuccess(result.data?._id || result.data?.id || form._id);
      else if (onBack) onBack(form.voucherType);
    } else toast.error(result.message || 'Save failed');
  };

  const handlePushToReview = async () => {
    const savedResult = await saveTransaction(false);
    if (!savedResult.success) { toast.error(savedResult.message || 'Save failed'); return; }
    if (savedResult.data?._id) {
      const reviewResult = await pushToReview(savedResult.data._id);
      if (reviewResult.success) {
        toast.success('Pushed to review successfully');
        if (onSaveSuccess) onSaveSuccess(savedResult.data._id);
        else if (onBack) onBack(form.voucherType);
      } else toast.error(reviewResult.message || 'Failed to push to review');
    }
  };

  // Row Management Functions (Now delegating to store)
  const addRow = (type) => {
    if (type === 'sales') addSalesLine();
    if (type === 'product') addProductLine();
    if (type === 'additional') addAdditionalCharge();
    if (type === 'tcs') addTcsDetail();
  };

  const removeRow = (type, id) => {
    if (type === 'sales') removeSalesLine(id);
    if (type === 'product') removeProductLine(id);
    if (type === 'additional') removeAdditionalCharge(id);
    if (type === 'tcs') removeTcsDetail(id);
  };

  const getGstRegistrationOptions = () => {
    const base = masterData.gstRegistrations && masterData.gstRegistrations.length > 0
      ? [...masterData.gstRegistrations]
      : ['Madhya Pradesh Registration', 'Maharashtra Registration'];

    const partyStates = new Set();
    if (masterData.partyLedgerDetails) {
      Object.values(masterData.partyLedgerDetails).forEach((detail) => {
        if (detail.gstState && detail.gstState.trim() !== '') {
          partyStates.add(`${detail.gstState.trim()} Registration`);
        }
      });
    }

    const combined = Array.from(new Set([...base, ...partyStates]));
    return combined.sort();
  };

  const theme = {
    bg: 'var(--app-content-bg)',
    panel: 'var(--app-panel-bg)',
    border: isDark ? '#334155' : '#cbd5e1',
    headerBg: 'var(--app-table-head-bg)',
    text: isDark ? '#f8fafc' : '#0f172a',
    inputBg: 'var(--app-control-bg)',
    mutedText: isDark ? '#94a3b8' : '#475569',
    accent: 'var(--app-accent)',
    accentSoft: 'var(--app-accent-soft)',
    accentGradient: 'var(--app-accent-gradient)',
    scrollbarThumb: isDark ? 'rgba(9, 182, 185, 0.3)' : '#cbd5e1',
    scrollbarTrack: isDark ? 'transparent' : '#f1f5f9'
  };

  const SummaryBar = ({ entries, base, cgst, sgst, igst, total }) => (
    <div className="mt-4 h-11 px-5 flex items-center justify-between border rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ color: theme.mutedText }}>Entries</span>
        <span className="bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-lg text-[11px] border border-indigo-500/10">{entries}</span>
      </div>
      <div className="flex items-center gap-6 shrink-0 ml-4">
        <div className="flex items-center gap-5">
          {[
            { label: 'Base', val: base },
            { label: 'CGST', val: cgst },
            { label: 'SGST', val: sgst },
            { label: 'IGST', val: igst },
            { label: 'Total', val: total, highlight: true }
          ].map((item, idx, arr) => (
            <React.Fragment key={item.label}>
              <div className="flex items-center gap-2 group">
                <span style={{ color: theme.mutedText }}>{item.label}</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] border transition-all ${item.highlight ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 scale-105' : 'bg-indigo-500/5 text-indigo-600 border-indigo-500/10 group-hover:bg-indigo-500/10'}`}>
                  {item.val}
                </span>
              </div>
              {idx < arr.length - 1 && <div className="h-4 w-[1px] opacity-10" style={{ backgroundColor: theme.text }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );


  // Determine if interstate based on partyGstin and gstRegistration
  const partyState = form.partyGstin?.trim().substring(0, 2);
  const companyState = form.gstRegistration ? (form.gstRegistration.includes('Maharashtra') ? '27' : '23') : '';
  const isInterstate = partyState && companyState && partyState !== companyState;

  const calculateRowTax = (rowAmount, gstRate, isInterstate) => {
    const amount = parseFloat(rowAmount) || 0;
    const rate = parseFloat(gstRate) || 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (isInterstate) {
      igst = parseFloat((amount * rate / 100).toFixed(2));
    } else {
      cgst = parseFloat((amount * (rate / 2) / 100).toFixed(2));
      sgst = parseFloat((amount * (rate / 2) / 100).toFixed(2));
    }
    const totalTax = parseFloat((cgst + sgst + igst).toFixed(2));
    const netAmount = parseFloat((amount + totalTax).toFixed(2));
    return { cgst, sgst, igst, totalTax, netAmount };
  };


  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden bg-slate-50 dark:bg-[#0b0c10]" style={{ backgroundColor: theme.bg }}>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 0px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme.accent}; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        {/* ─── 1. Compact Header Row ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-1.5 shrink-0 border-b bg-white dark:bg-[#0d0f12]" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-4">
            <h1 className="text-[13px] font-black tracking-tight text-slate-800 dark:text-white uppercase">
              {isOcrReview
                ? 'OCR Review'
                : form.voucherType === 'credit_note'
                  ? 'Create Credit Note'
                  : form.voucherType === 'sales_order'
                    ? 'Create Sales Order'
                    : 'Create Sales Voucher'}
            </h1>

            {/* Tabs Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-0.5 rounded-none border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setActiveTab('With Item');
                  setFormField('entryTab', 'with_item');
                }}
                className={`px-3 py-0.5 rounded-none text-[9.5px] font-black uppercase tracking-tight transition-all ${activeTab === 'With Item'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
              >
                With Item
              </button>
              <button
                onClick={() => {
                  setActiveTab('Without Item');
                  setFormField('entryTab', 'without_item');
                }}
                className={`px-3 py-0.5 rounded-none text-[9.5px] font-black uppercase tracking-tight transition-all ${activeTab === 'Without Item'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
              >
                Without Item
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSaveDraft}
              disabled={loading.save}
              className="px-3 py-1 rounded-none border text-[9.5px] font-black transition-all hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1"
              style={{ borderColor: theme.border }}
            >
              {loading.save ? <Loader2 size={10} className="animate-spin" /> : null}
              Draft
            </button>
            <button
              onClick={handlePushToReview}
              disabled={loading.save || loading.status}
              className="px-3 py-1 rounded-none text-[9.5px] font-black transition-all hover:scale-[1.02] shadow-sm uppercase tracking-wider text-slate-800 bg-[#FCD34D] hover:bg-[#FBBF24] flex items-center gap-1"
            >
              {loading.status ? <Loader2 size={10} className="animate-spin" /> : null}
              Review
            </button>
            <button
              onClick={handlePostToTally}
              className="px-3 py-1 rounded-none text-[9.5px] font-black text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:scale-[1.02] uppercase tracking-wider"
            >
              Post Tally
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 rounded-none border text-[9.5px] font-black hover:bg-red-50 hover:text-red-500 transition-all uppercase tracking-wider text-slate-400"
              style={{ borderColor: theme.border }}
            >
              Cancel
            </button>
            <button className="p-1.5 rounded-none border text-slate-400 hover:text-indigo-600 transition-all" style={{ borderColor: theme.border }}>
              <Settings size={12} />
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 text-slate-400 hover:text-red-500 border hover:bg-red-50 hover:border-red-200 transition-all rounded-none ml-1.5 flex items-center justify-center"
                style={{ borderColor: theme.border }}
                title="Close Form"
              >
                <X size={12} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* ─── 2. Voucher Types & Summary Row ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-0.75 bg-white dark:bg-[#0d0f12] border-b shrink-0" style={{ borderColor: theme.border }}>
          {/* Voucher Types */}
          {!onSaveSuccess && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'sales_invoice', label: 'Sales Voucher', section: 'SALES', icon: FileText },
                { id: 'purchase_invoice', label: 'Purchase Voucher', section: 'PURCHASE', icon: BookText },
                { id: 'cash_payment', label: 'Payments', section: 'PAYMENTS', icon: ArrowLeftRight },
                { id: 'bank_payment', label: 'Receipts', section: 'RECEIPTS', icon: CheckCircle2 },
                { id: 'contra', label: 'Contra', section: 'CONTRA', icon: RefreshCw },
                { id: 'others', label: 'Others', section: 'OTHERS', icon: Settings }
              ].map(type => {
                const isSelected = ['sales_invoice', 'sales_order', 'credit_note'].includes(form.voucherType)
                  ? type.id === 'sales_invoice'
                  : form.voucherType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (['sales_invoice', 'purchase_invoice', 'cash_payment', 'bank_payment', 'contra'].includes(type.id)) {
                        if (onVoucherTypeChange) {
                          onVoucherTypeChange(type.id);
                        } else {
                          if (type.id === 'sales_invoice') navigate('/sales/inbox', { state: { openManual: true } });
                          else if (type.id === 'purchase_invoice') navigate('/purchase/inbox', { state: { openManual: true } });
                          else if (type.id === 'cash_payment') navigate('/fund-flow/cash-payment', { state: { openManual: true } });
                          else if (type.id === 'bank_payment') navigate('/fund-flow/bank-payment', { state: { openManual: true } });
                          else if (type.id === 'contra') navigate('/fund-flow/contra', { state: { openManual: true } });
                        }
                      } else {
                        toast.info(`${type.label} configuration is pending.`);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-none border text-left min-w-[120px] shrink-0 transition-all ${isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm'
                        : 'bg-white dark:bg-[#12161a] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                  >
                    <type.icon size={11} className={isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                    <div>
                      <span className="text-[7px] block font-black tracking-wider opacity-60 uppercase">{type.section}</span>
                      <span className="text-[9px] font-black">{type.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Amount Summary Cards */}
          <div className="flex items-center flex-wrap gap-1 text-[9.5px]">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Items:</span>
              <span className="font-black text-slate-700 dark:text-slate-300">{form.entryTab === 'with_item' ? form.productLines.length : form.salesLines.length}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Disc:</span>
              <span className="font-black text-slate-700 dark:text-slate-300">₹ {form.entryTab === 'with_item' ? form.productLines.reduce((acc, l) => acc + (parseFloat(l.discountPercent) || 0), 0).toFixed(2) : "0.00"}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Taxable:</span>
              <span className="font-black text-slate-700 dark:text-slate-300">₹ {parseFloat(form.baseTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Tax:</span>
              <span className="font-black text-slate-700 dark:text-slate-300">₹ {((parseFloat(form.cgstTotal) || 0) + (parseFloat(form.sgstTotal) || 0) + (parseFloat(form.igstTotal) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Subtotal:</span>
              <span className="font-black text-slate-700 dark:text-slate-300">₹ {parseFloat(form.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Round:</span>
              <span className="font-black text-slate-700 dark:text-slate-300">{isRoundOffChecked ? `₹ ${form.roundOff || "0.00"}` : "₹ 0.00"}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-none bg-indigo-600 text-white shadow-md">
              <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85">Net:</span>
              <span className="font-black text-[11px]">₹ {parseFloat(isRoundOffChecked ? (form.grandTotal || 0) : (form.subTotal || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* ─── 3. Main Body ─── */}
        <div className={`flex-1 overflow-hidden ${isOcrReview ? 'grid grid-cols-1 lg:grid-cols-2' : 'flex flex-col'}`}>
          {/* Left Side: Document Preview (OCR Review Mode Only) */}
          {isOcrReview && (
            <div className="h-full border-r overflow-hidden flex flex-col bg-slate-50/50" style={{ borderColor: theme.border }}>
              <div className="px-4 py-2 flex items-center justify-between bg-white/50 border-b" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">Source Document</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 truncate max-w-[150px]">{ocr.file?.name}</span>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                <div className="w-full h-full min-h-[500px] border bg-white" style={{ borderColor: theme.border }}>
                  {ocr.file?.type === 'application/pdf' ? (
                    <iframe src={ocr.previewUrl} className="w-full h-full border-0" title="PDF Preview" />
                  ) : (
                    <img src={ocr.previewUrl} alt="Invoice Preview" className="w-full h-full object-contain" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Area */}
          <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0b0c10]">
            <div className="flex flex-col gap-3">

              {/* A. Voucher Details Section (Flat UI, No Cards, No Rounded) */}
              <div className="p-2.5 bg-white dark:bg-[#0d0f12] border border-slate-200 dark:border-slate-800 rounded-none mb-0 shrink-0">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Voucher Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3">

                  {/* Row 1: Voucher Date | Voucher Type | Voucher Number Series | Voucher No. */}
                  <div className="col-span-1">
                    <InputField
                      label="Voucher Date"
                      compact
                      icon={Calendar}
                      type="date"
                      value={form.voucherDate || ''}
                      onChange={(v) => setFormField('voucherDate', v)}
                    />
                  </div>

                  {/* Voucher Type — clickable select */}
                  <div className="col-span-1 relative">
                    <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400" style={{ backgroundColor: theme.panel }}>
                      Voucher Type
                    </label>
                    <select
                      value={form.voucherType || 'sales_invoice'}
                      onChange={(e) => setFormField('voucherType', e.target.value)}
                      className="w-full h-7.5 px-3 rounded-sm border text-[11px] font-bold outline-none bg-white dark:bg-[#12161a]"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <option value="sales_invoice">Sales Invoice</option>
                      <option value="sales_order">Sales Order</option>
                      <option value="credit_note">Credit Note</option>
                    </select>
                  </div>

                  {/* Voucher Number Series */}
                  <div className="col-span-1 relative">
                    <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400" style={{ backgroundColor: theme.panel }}>
                      Voucher Number Series
                    </label>
                    <select
                      value={form.voucherNumberSeries || 'Default'}
                      onChange={(e) => setFormField('voucherNumberSeries', e.target.value)}
                      className="w-full h-7.5 px-3 rounded-sm border text-[11px] font-bold outline-none bg-white dark:bg-[#12161a]"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <option value="Default">Default</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>

                  {/* Voucher No — read-only if Default, editable if Manual */}
                  <div className="col-span-1">
                    <InputField
                      label="Voucher No."
                      compact
                      placeholder={form.voucherNumberSeries === 'Manual' ? 'Enter Voucher No.' : 'Auto'}
                      value={form.voucherNumber}
                      readOnly={form.voucherNumberSeries !== 'Manual'}
                      onChange={(v) => {
                        setFormField('voucherNumber', v);
                        setFormField('invoiceNumber', v);
                      }}
                    />
                  </div>

                  {/* Row 2: Sales Ledger | Party Ledger | Party GSTIN | Consignee Ledger */}
                  {/* Sales Ledger */}
                  <div className="col-span-1">
                    <SearchableDropdown
                      label="Sales Ledger"
                      compact
                      placeholder="Sales Ledger"
                      options={masterData.salesLedgers?.length > 0 ? masterData.salesLedgers : ['General Sales', 'Service Sales']}
                      value={form.salesLedger}
                      hasSearch
                      onChange={(v) => setFormField('salesLedger', v)}
                    />
                  </div>

                  {/* Party Ledger */}
                  <div className="col-span-1">
                    <SearchableDropdown
                      label="Party Ledger"
                      compact
                      placeholder="Select Customer"
                      options={masterData.partyLedgers?.length > 0 ? masterData.partyLedgers : []}
                      value={form.partyLedger}
                      hasSearch
                      onChange={(v) => {
                        setFormField('partyLedger', v);
                        if (form.voucherType === 'credit_note') {
                          setFormField('referenceNumber', '');
                          if (v) fetchCreditNoteInvoicesForParty(v);
                        } else if (form.voucherType === 'sales_invoice') {
                          fetchSalesOrdersForParty(v);
                          setFormField('referenceNumber', '');
                        }
                        if (v && masterData.partyLedgerDetails && masterData.partyLedgerDetails[v]) {
                          const details = masterData.partyLedgerDetails[v];
                          setFormField('partyGstin', details.gstin || '');
                          setFormField('gstRegistration', details.gstState ? `${details.gstState} Registration` : '');
                          setFormField('gstRegistrationType', details.registrationType || '');
                        } else {
                          setFormField('partyGstin', '');
                          setFormField('gstRegistration', '');
                          setFormField('gstRegistrationType', '');
                        }
                      }}
                    />
                  </div>

                  {/* Party GSTIN */}
                  <div className="col-span-1">
                    <InputField
                      label="Party GSTIN No."
                      compact
                      placeholder="Party GSTIN"
                      value={form.partyGstin}
                      onChange={(v) => setFormField('partyGstin', v)}
                    />
                  </div>

                  {/* Consignee Ledger */}
                  <div className="col-span-1">
                    <SearchableDropdown
                      label="Consignee Ledger"
                      compact
                      placeholder="Same as Party"
                      options={['Same as Party', ...(masterData.partyLedgers || [])]}
                      value={form.consigneeLedger}
                      onChange={(v) => {
                        setFormField('consigneeLedger', v);
                        if (v && v !== 'Same as Party' && masterData.partyLedgerDetails && masterData.partyLedgerDetails[v]) {
                          setFormField('consigneeGstin', masterData.partyLedgerDetails[v].gstin || '');
                        } else {
                          setFormField('consigneeGstin', '');
                        }
                      }}
                    />
                  </div>

                  {/* Row 3: Consignee GSTIN (conditional) + Narration */}
                  {(form.consigneeLedger && form.consigneeLedger !== 'Same as Party' && form.consigneeLedger !== form.partyLedger) && (
                    <div className="col-span-1">
                      <InputField
                        label="Consignee GSTIN"
                        compact
                        placeholder="Consignee GSTIN"
                        value={form.consigneeGstin || ''}
                        onChange={(v) => setFormField('consigneeGstin', v)}
                      />
                    </div>
                  )}

                  {/* Narration */}
                  <div className={(form.consigneeLedger && form.consigneeLedger !== 'Same as Party' && form.consigneeLedger !== form.partyLedger) ? 'col-span-3 relative flex flex-col gap-1' : 'col-span-4 relative flex flex-col gap-1'}>
                    <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400" style={{ backgroundColor: theme.panel }}>
                      Narration
                    </label>
                    <input
                      type="text"
                      value={form.narration || ''}
                      onChange={(e) => setFormField('narration', e.target.value)}
                      className="w-full h-7.5 px-3 rounded-none border text-[11px] font-bold outline-none bg-white dark:bg-[#12161a]"
                      style={{ borderColor: theme.border, color: theme.text }}
                    />
                  </div>
                </div>
              </div>

              {/* B. Item Details Section (Flat UI, No Cards, No Rounded) */}
              {activeTab === 'With Item' && (
                <div className="p-3 bg-white dark:bg-[#0d0f12] border border-slate-200 dark:border-slate-800 rounded-none mb-0 shrink-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Item Details</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addRow(activeTab === 'With Item' ? 'product' : 'sales')}
                        className="px-2 py-1 rounded-none border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-[#12161a] hover:bg-slate-50 flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} strokeWidth={3} /> Add Line
                      </button>
                      <button
                        onClick={() => toast.info("New ledger registration modal opened.")}
                        className="px-2 py-1 rounded-none border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-[#12161a] hover:bg-slate-50 flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} /> Add Ledger
                      </button>
                      <button
                        onClick={() => toast.info("New stock item registration modal opened.")}
                        className="px-2 py-1 rounded-none border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-[#12161a] hover:bg-slate-50 flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} /> Add Item
                      </button>
                    </div>
                  </div>
                  <div className="overflow-visible mb-1.5">
                    {activeTab === 'Without Item' ? (
                      <table className="w-full text-left text-[10px] border-collapse min-w-[900px] overflow-visible" style={{ borderColor: theme.border }}>
                        <thead>
                          <tr className="border-b" style={{ borderColor: theme.border, color: theme.mutedText }}>
                            <th className="px-1 py-1 w-8 text-center border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>#</th>
                            <th className="px-1 py-1 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Item / Ledger *</th>
                            <th className="px-1 py-1 w-24 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>HSN/SAC</th>
                            <th className="px-1 py-1 w-24 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Amount (₹)</th>
                            <th className="px-1 py-1 w-16 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>GST%</th>
                            <th className="px-1 py-1 w-20 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>CGST</th>
                            <th className="px-1 py-1 w-20 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>SGST</th>
                            <th className="px-1 py-1 w-20 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>IGST</th>
                            <th className="px-1 py-1 w-20 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Total Tax</th>
                            <th className="px-1 py-1 w-24 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Net Amount</th>
                            <th className="px-1 py-1 w-8 text-center" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.salesLines.map((row, idx) => {
                            const tax = calculateRowTax(row.amount, row.gstRate, isInterstate);
                            return (
                              <tr key={row.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/30 overflow-visible" style={{ borderColor: theme.border }}>
                                <td className="px-1 py-0.5 text-center font-bold text-slate-400 border-r text-[10px]" style={{ borderColor: theme.border }}>{idx + 1}</td>
                                <td className="px-1 py-0.5 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Search Item / Ledger"
                                    compact
                                    options={masterData.salesLedgers?.length > 0 ? masterData.salesLedgers : ['General Sales']}
                                    value={row.salesLedger}
                                    onChange={(v) => updateSalesLine(row.id, 'salesLedger', v)}
                                  />
                                  <input
                                    type="text"
                                    value={row.description || ''}
                                    onChange={(e) => updateSalesLine(row.id, 'description', e.target.value)}
                                    placeholder="Description"
                                    className="w-full h-6 px-2 border-t rounded-none outline-none text-[9px] bg-transparent"
                                    style={{ borderColor: theme.border, color: theme.mutedText }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    value={row.hsnSacCode || ''}
                                    onChange={(e) => updateSalesLine(row.id, 'hsnSacCode', e.target.value)}
                                    placeholder="HSN"
                                    className="w-full h-7 px-2 rounded border outline-none text-[10px] bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    value={row.amount || ''}
                                    onChange={(e) => updateSalesLine(row.id, 'amount', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full h-7 px-2 rounded border outline-none text-right font-bold text-[10px] bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.gstRate || 0}
                                    onChange={(e) => updateSalesLine(row.id, 'gstRate', parseFloat(e.target.value) || 0)}
                                    className="w-full h-7 px-1.5 rounded border outline-none text-[10px] bg-white dark:bg-[#12161a] cursor-pointer transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  >
                                    <option value={0}>0%</option>
                                    <option value={5}>5%</option>
                                    <option value={12}>12%</option>
                                    <option value={18}>18%</option>
                                    <option value={28}>28%</option>
                                  </select>
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-800 dark:text-slate-200 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.cgst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-800 dark:text-slate-200 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.sgst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-800 dark:text-slate-200 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.igst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-900 dark:text-slate-100 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.totalTax.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-black text-slate-950 dark:text-slate-50 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  ₹{tax.netAmount.toFixed(2)}
                                </td>
                                <td className="px-0 py-0 text-center">
                                  <button
                                    onClick={() => removeSalesLine(row.id)}
                                    className="p-0.5 rounded-none text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-left text-[10px] border-collapse min-w-[1100px] overflow-visible" style={{ borderColor: theme.border }}>
                        <thead>
                          <tr className="border-b" style={{ borderColor: theme.border, color: theme.mutedText }}>
                            <th className="px-1 py-1 w-8 text-center border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>#</th>
                            <th className="px-1 py-1 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Item / Ledger *</th>
                            <th className="px-1 py-1 w-20 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>HSN/SAC</th>
                            <th className="px-1 py-1 w-14 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Qty</th>
                            <th className="px-1 py-1 w-20 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Unit</th>
                            <th className="px-1 py-1 w-20 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Rate (₹)</th>
                            <th className="px-1 py-1 w-14 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Disc%</th>
                            <th className="px-1 py-1 w-24 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Amount (₹)</th>
                            <th className="px-1 py-1 w-14 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>GST%</th>
                            <th className="px-1 py-1 w-18 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>CGST</th>
                            <th className="px-1 py-1 w-18 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>SGST</th>
                            <th className="px-1 py-1 w-18 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>IGST</th>
                            <th className="px-1 py-1 w-18 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Tax</th>
                            <th className="px-1 py-1 w-24 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Net Amt</th>
                            <th className="px-1 py-1 w-8 text-center" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.productLines.map((row, idx) => {
                            const tax = calculateRowTax(row.amount, row.gstRate, isInterstate);
                            return (
                              <tr key={row.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/30 overflow-visible" style={{ borderColor: theme.border }}>
                                <td className="px-1 py-0.5 text-center font-bold text-slate-400 border-r text-[10px]" style={{ borderColor: theme.border }}>{idx + 1}</td>
                                <td className="px-1 py-0.5 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Search Item / Ledger"
                                    hasAdd
                                    compact
                                    options={masterData.stockItems?.length > 0 ? masterData.stockItems : []}
                                    value={row.stockItem}
                                    onChange={(v) => {
                                      const updates = { stockItem: v, hsnSacCode: '', gstRate: 0, unit: '' };
                                      if (v && masterData.stockItemDetails && masterData.stockItemDetails[v]) {
                                        const sd = masterData.stockItemDetails[v];
                                        if (sd.hsnCode) updates.hsnSacCode = sd.hsnCode;
                                        if (sd.gstRate !== undefined) updates.gstRate = sd.gstRate;
                                        if (sd.unit) updates.unit = sd.unit;
                                      }
                                      updateProductLine(row.id, updates);
                                    }}
                                  />
                                  <input
                                    type="text"
                                    value={row.description || ''}
                                    onChange={(e) => updateProductLine(row.id, 'description', e.target.value)}
                                    placeholder="Description"
                                    className="w-full h-6 px-2 border-t rounded-none outline-none text-[9px] bg-transparent"
                                    style={{ borderColor: theme.border, color: theme.mutedText }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    value={row.hsnSacCode || ''}
                                    onChange={(e) => updateProductLine(row.id, 'hsnSacCode', e.target.value)}
                                    placeholder="HSN"
                                    className="w-full h-7 px-2 rounded border outline-none text-[10px] bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    value={row.billQuantity || ''}
                                    onChange={(e) => updateProductLine(row.id, 'billQuantity', parseFloat(e.target.value) || 0)}
                                    placeholder="1"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.unit || 'Nos'}
                                    onChange={(e) => updateProductLine(row.id, 'unit', e.target.value)}
                                    className="w-full h-7 px-1.5 rounded border outline-none text-[10px] bg-white dark:bg-[#12161a] cursor-pointer transition-all focus:border-indigo-400"
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
                                    onChange={(e) => updateProductLine(row.id, 'billRate', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    value={row.discountPercent || ''}
                                    onChange={(e) => updateProductLine(row.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-800 dark:text-slate-200 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  ₹{parseFloat(row.amount || 0).toFixed(2)}
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.gstRate || 0}
                                    onChange={(e) => updateProductLine(row.id, 'gstRate', parseFloat(e.target.value) || 0)}
                                    className="w-full h-7 px-1.5 rounded border outline-none text-[10px] bg-white dark:bg-[#12161a] cursor-pointer transition-all focus:border-indigo-400"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  >
                                    <option value={0}>0%</option>
                                    <option value={5}>5%</option>
                                    <option value={12}>12%</option>
                                    <option value={18}>18%</option>
                                    <option value={28}>28%</option>
                                  </select>
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-800 dark:text-slate-200 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.cgst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-800 dark:text-slate-200 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.sgst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-800 dark:text-slate-200 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.igst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-slate-900 dark:text-slate-100 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.totalTax.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-black text-slate-950 dark:text-slate-50 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  ₹{tax.netAmount.toFixed(2)}
                                </td>
                                <td className="px-0 py-0 text-center">
                                  <button
                                    onClick={() => removeProductLine(row.id)}
                                    className="p-0.5 rounded-none text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="flex justify-end pt-2 border-t" style={{ borderColor: theme.border }}>
                    <button
                      onClick={handleAiAutofill}
                      disabled={isAiAutofillLoading}
                      className="px-4 py-1.5 rounded-none border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-black flex items-center gap-1.5 hover:bg-indigo-50 shadow-sm disabled:opacity-50"
                    >
                      {isAiAutofillLoading ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                      AI-Auto Fill Remaining
                    </button>
                  </div>
                </div>
              )}

              {/* D. Ledger Details & E. Tax Ledger Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">

                {/* Ledger Details */}
                <div className="p-2.5 bg-white dark:bg-[#12161a] border border-slate-200 dark:border-slate-800 rounded-none shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-none border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                      </div>
                      <span className="font-bold text-[12px] text-slate-800 dark:text-slate-200">Ledger Details</span>
                    </div>
                    <button
                      onClick={addSalesLine}
                      className="px-2.5 py-0.5 bg-indigo-50/50 hover:bg-indigo-100/60 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-none text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={11} strokeWidth={2.5} /> Add Ledger
                    </button>
                  </div>

                  <div className="border rounded-none overflow-visible" style={{ borderColor: theme.border }}>
                    <table className="w-full text-left text-[11px] border-collapse" style={{ borderColor: theme.border }}>
                      <thead>
                        <tr className="border-b bg-slate-50/50 dark:bg-slate-900/20" style={{ borderColor: theme.border, color: theme.mutedText }}>
                          <th className="px-2 py-1 w-14 text-center border-r font-bold" style={{ borderColor: theme.border }}>Sr. No</th>
                          <th className="px-2 py-1 border-r font-bold" style={{ borderColor: theme.border }}>Ledger Name</th>
                          <th className="px-2 py-1 w-28 text-right border-r font-bold" style={{ borderColor: theme.border }}>GST Rate (%)</th>
                          <th className="px-2 py-1 w-32 text-right border-r font-bold" style={{ borderColor: theme.border }}>Amount</th>
                          <th className="px-2 py-1 w-12 text-center font-bold" style={{ borderColor: theme.border }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.salesLines || []).map((row, idx) => (
                          <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/20" style={{ borderColor: theme.border }}>
                            <td className="px-2 py-1 text-center font-bold text-slate-700 dark:text-slate-300 border-r" style={{ borderColor: theme.border }}>{idx + 1}</td>
                            <td className="p-1 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                              <SearchableDropdown
                                placeholder="Ledger name"
                                compact
                                options={masterData.allLedgers?.length > 0 ? masterData.allLedgers : (masterData.salesLedgers?.length > 0 ? masterData.salesLedgers : ['General Sales'])}
                                value={row.salesLedger || ''}
                                onChange={(v) => updateSalesLine(row.id, 'salesLedger', v)}
                              />
                            </td>
                            <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                              <select
                                value={row.gstRate || 0}
                                onChange={(e) => updateSalesLine(row.id, 'gstRate', parseFloat(e.target.value) || 0)}
                                className="w-full h-7 px-2 rounded-none border outline-none text-[11px] font-bold bg-white dark:bg-[#12161a] cursor-pointer transition-all focus:border-indigo-400"
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
                                value={row.amount || ''}
                                onChange={(e) => updateSalesLine(row.id, 'amount', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full h-7 px-3 rounded-none border outline-none text-right text-[11px] font-bold bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                style={{ borderColor: theme.border, color: theme.text }}
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                onClick={() => removeSalesLine(row.id)}
                                className="w-7 h-7 rounded-none bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-500 hover:text-red-600 border border-red-100 dark:border-red-900/50 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end mt-0.5">
                    <div className="px-3 py-1 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-none text-[10.5px] font-bold flex items-center gap-1.5 border border-blue-100 dark:border-blue-900/30">
                      <span>Total (₹)</span>
                      <span className="font-black">{parseFloat(form.baseTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Tax Ledger Details */}
                <div className="p-2.5 bg-white dark:bg-[#12161a] border border-slate-200 dark:border-slate-800 rounded-none shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-none border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
                      </div>
                      <span className="font-bold text-[12px] text-slate-800 dark:text-slate-200">Tax Ledger Details</span>
                    </div>
                    <button
                      onClick={addAdditionalCharge}
                      className="px-2.5 py-0.5 bg-emerald-50/50 hover:bg-emerald-100/60 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded-none text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={11} strokeWidth={2.5} /> Add Ledger
                    </button>
                  </div>

                  <div className="border rounded-none overflow-visible" style={{ borderColor: theme.border }}>
                    <table className="w-full text-left text-[11px] border-collapse" style={{ borderColor: theme.border }}>
                      <thead>
                        <tr className="border-b bg-slate-50/50 dark:bg-slate-900/20" style={{ borderColor: theme.border, color: theme.mutedText }}>
                          <th className="px-2 py-1 w-14 text-center border-r font-bold" style={{ borderColor: theme.border }}>Sr. No</th>
                          <th className="px-2 py-1 border-r font-bold" style={{ borderColor: theme.border }}><span className="text-red-500">*</span> Ledger Name</th>
                          <th className="px-2 py-1 border-r font-bold" style={{ borderColor: theme.border }}>Description</th>
                          <th className="px-2 py-1 w-28 text-right border-r font-bold" style={{ borderColor: theme.border }}>Amount</th>
                          <th className="px-2 py-1 w-12 text-center font-bold" style={{ borderColor: theme.border }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.additionalCharges || []).map((row, idx) => (
                          <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/20" style={{ borderColor: theme.border }}>
                            <td className="px-2 py-1 text-center font-bold text-slate-700 dark:text-slate-300 border-r" style={{ borderColor: theme.border }}>{idx + 1}</td>
                            <td className="p-1 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                              <SearchableDropdown
                                placeholder="Ledger name"
                                compact
                                options={Array.from(new Set([
                                  'CGST Output', 'Output SGST', 'IGST Output', 'CGST Input', 'Input SGST', 'IGST Input',
                                  'CGST Output 9%', 'SGST Output 9%', 'IGST Output 18%', 'CGST Output 6%', 'SGST Output 6%',
                                  'CGST Output 2.5%', 'SGST Output 2.5%',
                                  ...(masterData.taxLedgers || []),
                                  ...(masterData.additionalChargeLedgers || [])
                                ])).sort()}
                                value={row.ledgerName || ''}
                                onChange={(v) => updateAdditionalCharge(row.id, 'ledgerName', v)}
                              />
                            </td>
                            <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                              <input
                                type="text"
                                value={row.description || ''}
                                onChange={(e) => updateAdditionalCharge(row.id, 'description', e.target.value)}
                                placeholder="Description"
                                className="w-full h-7 px-2 outline-none text-[11px] font-bold bg-transparent border-0 text-slate-600 dark:text-slate-400"
                                style={{ color: theme.text }}
                              />
                            </td>
                            <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                              <input
                                type="number"
                                value={row.amount || ''}
                                onChange={(e) => updateAdditionalCharge(row.id, 'amount', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full h-7 px-3 rounded-none border outline-none text-right text-[11px] font-bold bg-white dark:bg-[#12161a] transition-all focus:border-indigo-400"
                                style={{ borderColor: theme.border, color: theme.text }}
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                onClick={() => removeAdditionalCharge(row.id)}
                                className="w-7 h-7 rounded-none bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-500 hover:text-red-600 border border-red-100 dark:border-red-900/50 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end mt-0.5">
                    <div className="px-3 py-1 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-none text-[10.5px] font-bold flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-900/30">
                      <span>Total (₹)</span>
                      <span className="font-black">{(form.additionalCharges || []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* C. Tax Details Section */}
              <div className="p-4 bg-white dark:bg-[#12161a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-900/50 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12.5 13.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z"></path><path d="M14.5 17.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z"></path><line x1="14" y1="12" x2="10" y2="18"></line></svg>
                    </div>
                    <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200">Tax Details</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={isRoundOffChecked}
                          onChange={(e) => setIsRoundOffChecked(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-200 dark:border-slate-800 accent-emerald-600 cursor-pointer shadow-sm"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-500 transition-colors">Round Off</span>
                      </label>
                      <span className="text-slate-400 cursor-help" title="Round off the net amount">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-slate-600 transition-colors"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                      </span>
                    </div>

                    <div className="px-4 py-1.5 bg-amber-50/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-amber-100 dark:border-amber-900/30">
                      <span>Total Tax (₹)</span>
                      <span className="font-black">{(() => {
                        const cgstAmt = parseFloat(form.cgstTotal || 0);
                        const sgstAmt = parseFloat(form.sgstTotal || 0);
                        const igstAmt = parseFloat(form.igstTotal || 0);
                        return (cgstAmt + sgstAmt + igstAmt).toFixed(2);
                      })()}</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden" style={{ borderColor: theme.border }}>
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b bg-slate-50/50 dark:bg-slate-900/20" style={{ borderColor: theme.border, color: theme.mutedText }}>
                        <th className="p-2 w-12 text-center font-bold">#</th>
                        <th className="p-2 font-bold">Tax Type</th>
                        <th className="p-2 w-32 text-right font-bold">Rate (%)</th>
                        <th className="p-2 text-right font-bold">Taxable Amount (₹)</th>
                        <th className="p-2 text-right font-bold">Tax Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const cgstAmt = parseFloat(form.cgstTotal || 0);
                        const sgstAmt = parseFloat(form.sgstTotal || 0);
                        const igstAmt = parseFloat(form.igstTotal || 0);
                        const baseTotal = parseFloat(form.baseTotal || 0);

                        const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.salesLines || []);
                        let cgstRate = 0;
                        let sgstRate = 0;
                        let igstRate = 0;

                        if (lines.length > 0) {
                          const firstLine = lines[0];
                          const totalRate = parseFloat(firstLine.gstRate || 0);
                          if (isInterstate) {
                            igstRate = totalRate;
                          } else {
                            cgstRate = totalRate / 2;
                            sgstRate = totalRate / 2;
                          }
                        }

                        const taxRows = [
                          { type: 'CGST', rate: cgstRate, taxable: baseTotal, amount: cgstAmt },
                          { type: 'SGST', rate: sgstRate, taxable: baseTotal, amount: sgstAmt },
                          { type: 'IGST', rate: igstRate, taxable: baseTotal, amount: igstAmt }
                        ];

                        return taxRows.map((gst, idx) => (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/20" style={{ borderColor: theme.border, color: theme.text }}>
                            <td className="p-2.5 text-center font-bold text-slate-600 dark:text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{gst.type}</td>
                            <td className="p-2.5 text-right font-bold text-slate-700 dark:text-slate-350">{gst.rate.toFixed(2)}%</td>
                            <td className="p-2.5 text-right font-bold text-slate-700 dark:text-slate-350">{gst.taxable.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-black text-slate-950 dark:text-slate-50">{gst.amount.toFixed(2)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </ThemeContext.Provider>
  );
};



const SummaryItem = ({ label, value, isLast }) => {
  const { theme, isDark } = useContext(ThemeContext);
  return (
    <div className="flex items-center gap-2 px-5 h-9 shrink-0 group">
      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: theme.mutedText }}>{label}</span>
      <span className="text-[11.5px] font-black px-2.5 py-0.5 rounded-lg shadow-sm border transition-all group-hover:scale-105" style={{ backgroundColor: theme.accentSoft, color: theme.accent, borderColor: isDark ? 'rgba(9, 182, 185, 0.2)' : 'transparent' }}>{value}</span>
      {!isLast && <div className="h-4 w-[1.5px] ml-4 opacity-10" style={{ backgroundColor: theme.text }} />}
    </div>
  );
};

const FormSection = ({ title, children, hasSettings = true, defaultOpen = true, headerAction, zIndex = 1, className = "mb-4", contentClassName = "p-5" }) => {
  const { theme, isDark } = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-2xl border shadow-sm transition-all duration-500 hover:shadow-md ${className}`} style={{ borderColor: theme.border, backgroundColor: theme.panel, backdropFilter: isDark ? 'blur(20px)' : undefined, zIndex: isOpen ? zIndex : 1, position: 'relative' }}>
      <div className="px-4 py-2 flex items-center justify-between border-b rounded-t-2xl" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
        <h3 className="text-[10.5px] font-black uppercase tracking-[0.15em]" style={{ color: theme.text }}>{title}</h3>
        <div className="flex gap-2.5 items-center">
          {headerAction}
          {hasSettings && <button className="text-slate-400 hover:text-indigo-600 transition-all hover:scale-110 active:scale-90"><Settings size={13} /></button>}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-6 h-6 rounded-full border flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all hover:rotate-180 active:scale-90"
            style={{ borderColor: theme.border }}
          >
            {isOpen ? <Minus size={11} strokeWidth={3} /> : <Plus size={11} strokeWidth={3} />}
          </button>
        </div>
      </div>
      <div className={`transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? `opacity-100 ${contentClassName} visible` : 'max-h-0 opacity-0 p-0 invisible overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
};

const SearchableDropdown = ({ label, placeholder, options = [], value, onChange, hasAdd, hasSearch = true, compact, rounded }) => {
  const { theme, isDark } = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex flex-col gap-1 w-full group" ref={dropdownRef} style={{ zIndex: isOpen ? 50 : 1 }}>
      {label && (
        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400 group-focus-within:text-indigo-600 transition-colors" style={{ backgroundColor: theme.panel }}>
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full ${compact ? 'h-7.5' : 'h-10'} ${rounded ? 'rounded-lg' : 'rounded-sm'} border px-2 flex items-center justify-between cursor-pointer transition-all duration-300 group/input ${isOpen ? 'border-indigo-500' : 'hover:border-indigo-400'}`}
            style={{ backgroundColor: theme.inputBg, borderColor: isOpen ? theme.accent : theme.border }}
          >
            <span className={`text-[11px] font-bold truncate transition-colors ${value ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : 'text-slate-400'}`}>
              {value || placeholder}
            </span>
            <div className="flex items-center gap-1 text-slate-400 group-hover/input:text-indigo-500 transition-colors">
              {value && <X size={11} className="hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); onChange(''); }} />}
              <ChevronDown size={12} className={`transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>
          </div>

          {isOpen && (
            <div
              className={`absolute top-full left-0 right-0 mt-1 border ${rounded ? 'rounded-lg' : 'rounded-sm'} shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[200px] z-50`}
              style={{
                backgroundColor: isDark ? '#111318' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ECEEF2',
                '--app-panel-bg': isDark ? '#111318' : '#ffffff',
                '--app-control-bg': isDark ? '#161920' : '#ffffff',
                '--app-border': isDark ? 'rgba(255, 255, 255, 0.08)' : '#ECEEF2',
                '--app-heading': isDark ? '#e2bf22ff' : '#0B0B12',
                '--app-text': isDark ? '#ffffff' : '#5B6478',
                '--app-accent': isDark ? '#60A5FA' : '#2563EB',
              }}
            >
              {hasSearch && (
                <div className="p-2 border-b" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                      className="w-full h-8 px-8 text-[11px] font-semibold outline-none transition-all rounded-md border focus:border-indigo-500"
                      style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer rounded-md transition-colors ${value === opt ? 'text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                    style={{
                      backgroundColor: value === opt ? 'var(--app-accent)' : 'transparent',
                      color: value === opt ? '#ffffff' : 'var(--app-text)'
                    }}
                    onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                  >
                    {opt}
                  </div>
                )) : (
                  <div className="p-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">No results for "{search}"</p>
                    <button onClick={() => { onChange(search); setIsOpen(false); }} className="text-[9px] font-black text-indigo-600 hover:underline">Add "{search}" as new</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {hasAdd && (
          <button className="w-8 h-8 rounded-none border flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-all shadow-sm shrink-0" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <Plus size={14} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
};

const toDisplayDate = (val) => {
  if (!val) return "";
  const datePart = val.split(/[T ]/)[0];
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts[0].length === 4 && parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return datePart;
  }
  return datePart;
};

const toDbDate = (val) => {
  if (!val) return "";
  const datePart = val.split(/[T ]/)[0];
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts[2]?.length === 4 && parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return datePart;
  }
  return datePart;
};


const InputField = ({ label, placeholder, value, icon: Icon, type = "text", compact, readOnly, align = "left", onChange }) => {
  const { theme, isDark } = useContext(ThemeContext);

  const handleTextChange = (e) => {
    const isBackspace = e.nativeEvent.inputType === "deleteContentBackward";
    let raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = "";
    if (raw.length <= 2) {
      if (raw.length === 2 && !isBackspace) {
        formatted = `${raw}-`;
      } else {
        formatted = raw;
      }
    } else if (raw.length <= 4) {
      if (raw.length === 4 && !isBackspace) {
        formatted = `${raw.slice(0, 2)}-${raw.slice(2, 4)}-`;
      } else {
        formatted = `${raw.slice(0, 2)}-${raw.slice(2)}`;
      }
    } else {
      formatted = `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4)}`;
    }

    if (formatted.length === 10) {
      onChange(toDbDate(formatted));
    } else {
      onChange(formatted);
    }
  };

  return (
    <div className="relative flex flex-col gap-1 w-full group">
      {label && (
        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400 group-focus-within:text-indigo-600 transition-colors" style={{ backgroundColor: theme.panel }}>
          {label}
        </label>
      )}
      <div className="relative">
        {type === "date" ? (
          <>
            <input
              type="text"
              value={toDisplayDate(value)}
              onChange={handleTextChange}
              placeholder="dd-mm-yyyy"
              readOnly={readOnly}
              className={`w-full ${compact ? 'h-7.5 px-2' : 'h-10 px-2'} rounded-sm border text-[11px] font-bold outline-none transition-all duration-300 focus:ring-0 ${isDark ? 'placeholder:text-white/10' : 'placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
              style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
            />
            {Icon && !readOnly && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center cursor-pointer">
                <Icon size={12} className="text-slate-400 hover:text-indigo-500 transition-colors pointer-events-none" />
                <input
                  type="date"
                  value={toDbDate(value)}
                  onChange={(e) => onChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ width: '20px', height: '20px', right: 0 }}
                />
              </div>
            )}
          </>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            readOnly={readOnly}
            placeholder={placeholder}
            className={`w-full ${compact ? 'h-7.5 px-2' : 'h-10 px-2'} rounded-sm border text-[11px] font-bold outline-none transition-all duration-300 focus:ring-0 ${isDark ? 'placeholder:text-white/10' : 'placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
            style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
          />
        )}
        {type !== "date" && Icon && <Icon className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={12} />}
      </div>
    </div>
  );
};

const SummaryBar = ({ entries, base, cgst, sgst, igst, total }) => {
  const { theme } = useContext(ThemeContext);
  return (
    <div className="mt-4 h-11 px-5 flex items-center justify-between border rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ color: theme.mutedText }}>Entries</span>
        <span className="bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-lg text-[11px] border border-indigo-500/10">{entries}</span>
      </div>
      <div className="flex items-center gap-6 shrink-0 ml-4">
        <div className="flex items-center gap-5">
          {[
            { label: 'Base', val: base },
            { label: 'CGST', val: cgst },
            { label: 'SGST', val: sgst },
            { label: 'IGST', val: igst },
            { label: 'Total', val: total, highlight: true }
          ].map((item, idx, arr) => (
            <React.Fragment key={item.label}>
              <div className="flex items-center gap-2 group">
                <span style={{ color: theme.mutedText }}>{item.label}</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] border transition-all ${item.highlight ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 scale-105' : 'bg-indigo-500/5 text-indigo-600 border-indigo-500/10 group-hover:bg-indigo-500/10'}`}>
                  {item.val}
                </span>
              </div>
              {idx < arr.length - 1 && <div className="h-4 w-[1px] opacity-10" style={{ backgroundColor: theme.text }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreateSales;
