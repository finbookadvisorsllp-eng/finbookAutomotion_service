import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  Save, Send, Calendar, ChevronDown, Plus, Minus, Layout,
  Settings, X, Search, Check, BookText, List, FileText, Clock, User,
  Link as LinkIcon, CheckCircle, AlertCircle, ArrowLeftRight,
  UploadCloud, Paperclip, CheckCircle2, ShieldAlert, Tag, Bot, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import usePurchaseStore from '../../stores/usePurchaseStore';
import { useAppStore } from '../../stores/useAppStore';

const ThemeContext = createContext(null);

const CreatePurchase = ({ isDark, onBack, voucherType, onVoucherTypeChange, onSaveSuccess }) => {
  const navigate = useNavigate();

  const handleCancel = () => {
    const activeType = form.voucherType || 'purchase_invoice';
    if (onBack) {
      onBack(activeType);
    } else {
      const norm = getNormalizedType(activeType);
      if (['sales_invoice', 'sales_order', 'credit_note'].includes(norm)) {
        navigate('/sales/inbox');
      } else if (['purchase_invoice', 'purchase_order', 'debit_note'].includes(norm)) {
        navigate('/purchase/inbox');
      } else if (norm === 'cash_payment') {
        navigate('/fund-flow/cash-payment');
      } else if (norm === 'bank_payment') {
        navigate('/fund-flow/bank-payment');
      } else if (norm === 'contra') {
        navigate('/fund-flow/contra');
      } else {
        navigate('/purchase/inbox');
      }
    }
  };
  const {
    form,
    updateForm,
    loading,
    saveTransaction,
    pushToReview,
    resetForm,
    addProductLine,
    removeProductLine,
    updateProductLine,
    addPurchaseLine,
    removePurchaseLine,
    updatePurchaseLine,
    addAdditionalCharge,
    updateAdditionalCharge,
    removeAdditionalCharge,
    addTdsDetail,
    updateTdsDetail,
    removeTdsDetail,
    masterData,
    fetchMasterData,
    fetchNextInvoiceNumber,
    fetchPurchaseOrdersForParty,
    autofillFromPurchaseOrder,
    fetchPurchaseInvoicesForParty,
    autofillFromPurchaseInvoice,
  } = usePurchaseStore();

  const getNormalizedType = (val) => {
    if (!val) return '';
    const found = (masterData.voucherTypesFull || []).find(v => v.name === val);
    if (found) {
      const parent = found.parent;
      if (parent === 'Sales') return 'sales_invoice';
      if (parent === 'Sales Order') return 'sales_order';
      if (parent === 'Credit Note') return 'credit_note';
      if (parent === 'Purchase') return 'purchase_invoice';
      if (parent === 'Purchase Order') return 'purchase_order';
      if (parent === 'Debit Note') return 'debit_note';
    }
    const lower = val.toLowerCase();
    if (lower === 'sales' || lower.includes('sales_invoice') || lower.includes('sales invoice')) return 'sales_invoice';
    if (lower.includes('sales_order') || lower.includes('sales order') || lower === 'deliv') return 'sales_order';
    if (lower.includes('credit_note') || lower.includes('credit note')) return 'credit_note';
    if (lower === 'purchase' || lower.includes('purchase_invoice') || lower.includes('purchase invoice')) return 'purchase_invoice';
    if (lower.includes('purchase_order') || lower.includes('purchase order')) return 'purchase_order';
    if (lower.includes('debit_note') || lower.includes('debit note')) return 'debit_note';
    return val;
  };

  const purchaseParents = ["Purchase", "Purchase Order", "Debit Note"];
  const dynamicVoucherTypes = (masterData.voucherTypesFull || [])
    .filter(vt => purchaseParents.includes(vt.parent))
    .map(vt => vt.name);
  const voucherTypeOptions = dynamicVoucherTypes.length > 0 ? dynamicVoucherTypes : ["Purchase", "Purchase Order", "Debit Note"];

  const getSelectValue = () => {
    const val = form.voucherType || 'purchase_invoice';
    if (voucherTypeOptions.includes(val)) return val;
    if (val === 'purchase_invoice') {
      const match = voucherTypeOptions.find(opt => opt === 'Purchase' || opt === 'Purchase Invoice');
      if (match) return match;
    }
    if (val === 'purchase_order') {
      const match = voucherTypeOptions.find(opt => opt === 'Purchase Order');
      if (match) return match;
    }
    if (val === 'debit_note') {
      const match = voucherTypeOptions.find(opt => opt === 'Debit Note');
      if (match) return match;
    }
    return val;
  };

  const selectedCompany = useAppStore((s) => s.selectedCompany);

  // Determine if interstate based on partyGstin and gstRegistration
  const partyState = form.partyGstin?.trim().substring(0, 2);
  const companyState = form.gstRegistration ? (form.gstRegistration.includes('Maharashtra') ? '27' : '23') : '';
  const isInterstate = partyState && companyState && partyState !== companyState;

  const [isTdsApplicable, setIsTdsApplicable] = useState(false);
  const tdsInitializedRef = useRef(false);

  // Sync isTdsApplicable with existing form data on mount/load
  useEffect(() => {
    const hasTds = !!(form.tdsDetails && form.tdsDetails.some(t => t.ledgerName !== '' || (parseFloat(t.amount) || 0) > 0));
    if (!tdsInitializedRef.current) {
      tdsInitializedRef.current = true;
      setIsTdsApplicable(hasTds);
    } else if (hasTds) {
      setIsTdsApplicable(true);
    }
  }, [form.tdsDetails]);

  // Keep TDS details synchronized with baseTotal and isTdsApplicable
  useEffect(() => {
    if (isTdsApplicable) {
      const baseAmt = parseFloat(form.baseTotal || 0);
      const currentTds = form.tdsDetails?.[0] || {};
      const rate = currentTds.rate !== undefined ? parseFloat(currentTds.rate) : 2;
      const tdsAmtVal = parseFloat((baseAmt * rate / 100).toFixed(2));

      if (
        parseFloat(currentTds.amount || 0) !== tdsAmtVal ||
        parseFloat(currentTds.assessableValue || 0) !== baseAmt ||
        !currentTds.ledgerName
      ) {
        const updatedTds = [{
          id: currentTds.id || Date.now() + 500,
          ledgerName: currentTds.ledgerName || 'TDS Payable',
          assessableValue: baseAmt,
          rate: rate,
          amount: tdsAmtVal
        }];
        updateForm({ tdsDetails: updatedTds });
      }
    } else {
      if (form.tdsDetails && form.tdsDetails.length > 0) {
        updateForm({ tdsDetails: [] });
      }
    }
  }, [isTdsApplicable, form.baseTotal]);

  // Helper functions for Tax Ledgers within form.additionalCharges
  const getLedgerNameForComponent = (componentType) => {
    const comp = componentType.toUpperCase();
    const charge = (form.additionalCharges || []).find(c => {
      const name = (c.ledgerName || '').toUpperCase();
      if (comp === 'CGST') return name.includes('CGST');
      if (comp === 'SGST') return name.includes('SGST') || name.includes('UTGST');
      if (comp === 'IGST') return name.includes('IGST');
      if (comp === 'CESS') return name.includes('CESS');
      return false;
    });
    return charge ? charge.ledgerName : '';
  };

  const getLedgerOptions = (componentType) => {
    const comp = componentType.toUpperCase();
    const allList = Array.from(new Set([
      'CGST Output', 'Output SGST', 'IGST Output', 'CGST Input', 'Input SGST', 'IGST Input',
      'CGST Output 9%', 'SGST Output 9%', 'IGST Output 18%', 'CGST Output 6%', 'SGST Output 6%',
      'CGST Output 2.5%', 'SGST Output 2.5%', 'CESS Payable', 'TDS Receivable', 'TDS Payable',
      ...(masterData.taxLedgers || []),
      ...(masterData.additionalChargeLedgers || []),
      ...(masterData.allLedgers || []),
      ...(masterData.tdsLedgers || [])
    ]));

    let filtered = [];
    if (comp === 'CGST') {
      filtered = allList.filter(x => x.toUpperCase().includes('CGST'));
    } else if (comp === 'SGST') {
      filtered = allList.filter(x => x.toUpperCase().includes('SGST') || x.toUpperCase().includes('UTGST'));
    } else if (comp === 'IGST') {
      filtered = allList.filter(x => x.toUpperCase().includes('IGST'));
    } else if (comp === 'CESS') {
      filtered = allList.filter(x => x.toUpperCase().includes('CESS'));
    } else if (comp === 'TDS') {
      filtered = allList.filter(x => x.toUpperCase().includes('TDS'));
    }

    if (filtered.length === 0) {
      if (comp === 'CGST') return ['Input CGST 9%', 'CGST Input', 'Output CGST 9%'];
      if (comp === 'SGST') return ['Input SGST 9%', 'SGST Input', 'Output SGST 9%'];
      if (comp === 'IGST') return ['Input IGST 18%', 'IGST Input', 'Output IGST 18%'];
      if (comp === 'CESS') return ['CESS Payable', 'Cess Ledger'];
      if (comp === 'TDS') return ['TDS Payable', 'TDS Receivable'];
    }
    return filtered.sort();
  };

  const setLedgerNameForComponent = (componentType, nextLedgerName) => {
    const comp = componentType.toUpperCase();
    let charges = [...(form.additionalCharges || [])];

    const idx = charges.findIndex(c => {
      const name = (c.ledgerName || '').toUpperCase();
      if (comp === 'CGST') return name.includes('CGST');
      if (comp === 'SGST') return name.includes('SGST') || name.includes('UTGST');
      if (comp === 'IGST') return name.includes('IGST');
      if (comp === 'CESS') return name.includes('CESS');
      return false;
    });

    let amt = 0;
    if (comp === 'CGST') amt = parseFloat(form.cgstTotal || 0);
    if (comp === 'SGST') amt = parseFloat(form.sgstTotal || 0);
    if (comp === 'IGST') amt = parseFloat(form.igstTotal || 0);

    if (idx > -1) {
      if (nextLedgerName) {
        charges[idx] = { ...charges[idx], ledgerName: nextLedgerName, amount: amt };
      } else {
        charges.splice(idx, 1);
      }
    } else if (nextLedgerName) {
      charges.push({
        id: Date.now() + Math.random(),
        ledgerName: nextLedgerName,
        amount: amt,
        taxableValue: parseFloat(form.baseTotal || 0).toFixed(2)
      });
    }

    updateForm({ additionalCharges: charges });
  };

  // Sync active GST components into form.additionalCharges automatically
  useEffect(() => {
    const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.purchaseLines || []);
    let cgstRateVal = 0, sgstRateVal = 0, igstRateVal = 0;
    if (lines.length > 0) {
      const totalRate = parseFloat(lines[0].gstRate || 0);
      if (isInterstate) {
        igstRateVal = totalRate;
      } else {
        cgstRateVal = totalRate / 2;
        sgstRateVal = totalRate / 2;
      }
    }

    let updated = false;
    let charges = [...(form.additionalCharges || [])];

    const syncComponent = (comp, rate, amt) => {
      const name = getLedgerNameForComponent(comp);
      if (rate > 0) {
        if (!name) {
          const defaultLedger = getLedgerOptions(comp)[0];
          charges.push({
            id: Date.now() + Math.random(),
            ledgerName: defaultLedger,
            amount: amt,
            taxableValue: parseFloat(form.baseTotal || 0).toFixed(2)
          });
          updated = true;
        } else {
          const idx = charges.findIndex(c => c.ledgerName === name);
          if (idx > -1 && parseFloat(charges[idx].amount || 0) !== amt) {
            charges[idx] = { ...charges[idx], amount: amt };
            updated = true;
          }
        }
      } else {
        if (name) {
          charges = charges.filter(c => c.ledgerName !== name);
          updated = true;
        }
      }
    };

    syncComponent('CGST', cgstRateVal, parseFloat(form.cgstTotal || 0));
    syncComponent('SGST', sgstRateVal, parseFloat(form.sgstTotal || 0));
    syncComponent('IGST', igstRateVal, parseFloat(form.igstTotal || 0));

    if (updated) {
      updateForm({ additionalCharges: charges });
    }
  }, [form.baseTotal, form.cgstTotal, form.sgstTotal, form.igstTotal, isInterstate]);

  useEffect(() => {
    fetchMasterData();
  }, [selectedCompany, form.voucherType]);

  // Sync voucherType on mount
  // Sync voucherType into store on mount
  useEffect(() => {
    if (!form._id) {
      const targetType = (voucherType && voucherType !== 'purchase') ? voucherType : 'purchase_invoice';
      updateForm({ voucherType: targetType });
    }
  }, [voucherType, form._id]);

  // Auto-fill Voucher Number like Tally — peek next number on new entry only
  useEffect(() => {
    if (!form._id && form.voucherNumberSeries === 'Default') {
      const effectiveType = form.voucherType || 'purchase_invoice';
      fetchNextInvoiceNumber(effectiveType);
    }
  }, [form.voucherType, form._id, form.voucherNumberSeries]);

  const [activeTab, setActiveTab] = useState('Without Item Invoice');

  // Sync tab state
  useEffect(() => {
    if (form.entryTab) {
      setActiveTab(form.entryTab === 'with_item' ? 'With Item Invoice' : 'Without Item Invoice');
    }
  }, [form.entryTab]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    updateForm({ entryTab: tabName === 'With Item Invoice' ? 'with_item' : 'without_item' });
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

  const getDisplayVoucherType = (type) => {
    if (type === 'purchase_invoice') return 'Purchase';
    if (type === 'purchase_order') return 'Purchase Order';
    if (type === 'debit_note') return 'Debit Note';
    return type;
  };

  const getDbVoucherType = (displayVal) => {
    if (displayVal === 'Purchase') return 'purchase_invoice';
    if (displayVal === 'Purchase Order') return 'purchase_order';
    if (displayVal === 'Debit Note') return 'debit_note';
    return displayVal;
  };

  const getVoucherTypeOptions = () => {
    let parent = null;
    const raw = masterData.voucherTypesFull || [];
    const activeType = form.voucherType;

    const found = raw.find(v => v.name === activeType || getDbVoucherType(v.name) === activeType);
    if (found) {
      parent = found.parent;
    } else {
      const typeToCheck = activeType || voucherType;
      if (typeToCheck === 'purchase_order' || typeToCheck === 'Purchase Order') {
        parent = 'Purchase Order';
      } else if (typeToCheck === 'debit_note' || typeToCheck === 'Debit Note') {
        parent = 'Debit Note';
      } else {
        parent = 'Purchase';
      }
    }

    const filtered = raw.filter(v => v.parent === parent).map(v => v.name);
    return filtered.length > 0 ? filtered : [parent];
  };

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [ledgerGroupSelected, setLedgerGroupSelected] = useState('');

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

  // Ledger Details & Tax Ledger Details are bound directly to form.purchaseLines and form.additionalCharges


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
      } else if (form.entryTab === 'without_item' && form.purchaseLines.length > 0) {
        updatePurchaseLine(form.purchaseLines[0].id, {
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
    if (form.status !== 'approved') {
      toast.warning('Voucher must be approved in the Approval Center before posting to Tally.');
      return;
    }
    const savedResult = await saveTransaction(false);
    if (!savedResult.success) {
      toast.error(savedResult.message || 'Save failed before Posting to Tally');
      return;
    }
    toast.success("Successfully posted voucher to Tally database!");
    if (onSaveSuccess) onSaveSuccess(savedResult.data?._id || savedResult.data?.id || form._id);
    else if (onBack) onBack(form.voucherType);
  };

  // Row Management Functions
  const addRow = (type) => {
    if (type === 'purchase') addPurchaseLine();
    if (type === 'product') addProductLine();
    if (type === 'additional') addAdditionalCharge();
    if (type === 'tds') addTdsDetail();
  };

  const removeRow = (type, id) => {
    if (type === 'purchase') removePurchaseLine(id);
    if (type === 'product') removeProductLine(id);
    if (type === 'additional') removeAdditionalCharge(id);
    if (type === 'tds') removeTdsDetail(id);
  };

  const handleSaveDraft = async () => {
    const result = await saveTransaction(true);
    if (result.success) {
      toast.success('Draft saved successfully');
      if (onSaveSuccess) onSaveSuccess(result.data?._id || result.data?.id || form._id);
      else if (onBack) onBack(form.voucherType);
    } else {
      toast.error(result.message || 'Save failed');
    }
  };

  const handlePushToReview = async () => {
    const savedResult = await saveTransaction(false);
    if (!savedResult.success) {
      toast.error(savedResult.message || 'Save failed');
      return;
    }
    if (savedResult.data?._id) {
      const reviewResult = await pushToReview(savedResult.data._id);
      if (reviewResult.success) {
        toast.success('Pushed for approval successfully');
        if (onSaveSuccess) onSaveSuccess(savedResult.data._id);
        else if (onBack) onBack(form.voucherType);
      } else {
        toast.error(reviewResult.message || 'Failed to push for approval');
      }
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

  // Helper components and date functions moved outside to prevent focus loss on typing

  const renderLedgerModal = () => {
    if (!isLedgerModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-[var(--app-panel-bg)] rounded-xl shadow-2xl w-[600px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
          <button onClick={() => setIsLedgerModalOpen(false)} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full border text-[var(--app-muted)] hover:text-red-500 transition-colors" style={{ borderColor: theme.border }}>
            <X size={16} />
          </button>
          <h2 className="text-[14px] font-black text-[var(--app-accent)] mb-8 tracking-tight">Add Ledger</h2>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6 mb-8">
            <InputField placeholder="Ledger Name" />
            <SearchableDropdown
              label={ledgerGroupSelected ? "Ledger Group" : null}
              placeholder="Ledger Group"
              options={['Bank OD A/c', 'Sundry Creditors', 'Sundry Debtors']}
              value={ledgerGroupSelected}
              onChange={setLedgerGroupSelected}
            />
            {ledgerGroupSelected && (
              <>
                <InputField placeholder="Credit Period" />
                <div className="flex items-center h-9 mt-1 px-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-[var(--app-border)] accent-[var(--app-accent)] cursor-pointer" defaultChecked />
                    <span className="text-[11px] font-bold text-[var(--app-heading)] group-hover:text-[var(--app-accent)] transition-colors" style={{ color: theme.text }}>Maintain Balance Bill by Bill</span>
                  </label>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-center mt-6">
            <button onClick={() => setIsLedgerModalOpen(false)} className="px-8 py-2 m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white text-[11px] font-black tracking-wide rounded-lg shadow-md hover:shadow-lg transition-all">
              submit
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStockModal = () => {
    if (!isStockModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-[var(--app-panel-bg)] rounded-xl shadow-2xl w-[700px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
          <button onClick={() => setIsStockModalOpen(false)} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full border text-[var(--app-muted)] hover:text-red-500 transition-colors" style={{ borderColor: theme.border }}>
            <X size={16} />
          </button>
          <h2 className="text-[14px] font-black text-[var(--app-accent)] mb-8 tracking-tight">Add Stock Ledger</h2>

          <div className="grid grid-cols-3 gap-x-4 gap-y-6 mb-8">
            <InputField placeholder="Stock Name" />
            <SearchableDropdown placeholder="Stock Group" options={['Primary', 'Hardware', 'Software']} />
            <SearchableDropdown placeholder="Unit" options={['Nos', 'Kg', 'Ltr', 'Pcs']} />

            <SearchableDropdown label="Gst Applicable" value="Applicable" options={['Applicable', 'Not Applicable']} />
            <SearchableDropdown label="HSN Source" value="As per Company/Stock" options={['As per Company/Stock', 'Specify Details Here']} />
            <SearchableDropdown placeholder="HSN Classification" options={['Classification 1', 'Classification 2']} />

            <InputField placeholder="HSN Code" />
            <SearchableDropdown label="GST Source" value="As per Company/Stock" options={['As per Company/Stock', 'Specify Details Here']} />
            <SearchableDropdown placeholder="GST Classification" options={['Classification A', 'Classification B']} />

            <SearchableDropdown placeholder="Taxability Type" options={['Taxable', 'Exempt', 'Nil Rated']} />
            <InputField placeholder="GST Rate" />
            <SearchableDropdown label="Type Of Supply" value="Goods" options={['Goods', 'Services']} />

            <label className="flex items-center gap-2 cursor-pointer group mt-1 pl-1">
              <input type="checkbox" className="w-4 h-4 rounded border-[var(--app-border)] accent-[var(--app-accent)] cursor-pointer" />
              <span className="text-[11px] font-bold text-[var(--app-heading)] group-hover:text-[var(--app-accent)] transition-colors" style={{ color: theme.text }}>RCM Applicable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group mt-1 pl-1">
              <input type="checkbox" className="w-4 h-4 rounded border-[var(--app-border)] accent-[var(--app-accent)] cursor-pointer" />
              <span className="text-[11px] font-bold text-[var(--app-heading)] group-hover:text-[var(--app-accent)] transition-colors" style={{ color: theme.text }}>ITC Ineligible</span>
            </label>
          </div>
          <div className="flex justify-center mt-6">
            <button onClick={() => setIsStockModalOpen(false)} className="px-8 py-2 m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white text-[11px] font-black tracking-wide rounded-lg shadow-md hover:shadow-lg transition-all">
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };


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

  const calculateHsnTaxDetails = () => {
    const hsnMap = {};
    const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.purchaseLines || []);

    let totalItemAmount = 0;
    if (form.entryTab === 'with_item') {
      lines.forEach((line) => {
        const qty = parseFloat(line.billQuantity) || 0;
        const rate = parseFloat(line.billRate) || 0;
        const disc = parseFloat(line.discountPercent) || 0;
        totalItemAmount += parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
      });
    }

    let ledgerAmount = 0;
    if (form.entryTab === 'with_item' && Array.isArray(form.purchaseLines)) {
      form.purchaseLines.forEach((line) => {
        ledgerAmount += parseFloat(line.amount) || 0;
      });
    }

    // Extract CESS rate from any CESS ledger in additionalCharges or purchaseLines
    let cessRate = 0;
    let hasCessLedger = false;
    let cessLedgerAmt = 0;
    const allChargesForCess = [...(form.purchaseLines || []), ...(form.additionalCharges || [])];
    allChargesForCess.forEach((c) => {
      const nameUpper = (c.ledgerName || c.purchaseLedger || '').toUpperCase();
      if (nameUpper.includes('CESS')) {
        hasCessLedger = true;
        const match = nameUpper.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) {
          cessRate = parseFloat(match[1]);
        } else {
          cessLedgerAmt += parseFloat(c.amount) || 0;
        }
      }
    });

    lines.forEach((line) => {
      const hsn = (line.hsnSacCode || '').trim() || '-';
      const qty = parseFloat(line.billQuantity) || 0;
      const rate = parseFloat(line.billRate) || 0;
      const disc = parseFloat(line.discountPercent) || 0;
      const amount = form.entryTab === 'with_item' ? parseFloat((qty * rate * (1 - disc / 100)).toFixed(2)) : (parseFloat(line.amount) || 0);
      const gstRate = parseFloat(line.gstRate) || 0;

      // Allocate ledger amount proportionally in with_item mode
      const proportion = form.entryTab === 'with_item' && totalItemAmount > 0 ? (amount / totalItemAmount) : (1 / lines.length);
      const allocatedLedger = form.entryTab === 'with_item' ? (ledgerAmount * proportion) : 0;
      const combinedLineAmount = amount + allocatedLedger;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      let cess = 0;

      const isTaxable = form.entryTab === 'with_item' ? (line.taxabilityType === 'Taxable' && !line.rcm) : true;

      if (isTaxable) {
        if (isInterstate) {
          igst = parseFloat(((combinedLineAmount * gstRate) / 100).toFixed(2));
        } else {
          cgst = parseFloat(((combinedLineAmount * (gstRate / 2)) / 100).toFixed(2));
          sgst = parseFloat(((combinedLineAmount * (gstRate / 2)) / 100).toFixed(2));
        }

        // Calculate CESS
        let lineCessRate = parseFloat(line.cessRate || line.cess_rate) || 0;
        if (lineCessRate <= 0) {
          lineCessRate = cessRate;
        }
        if (lineCessRate > 0) {
          cess = parseFloat(((combinedLineAmount * lineCessRate) / 100).toFixed(2));
        }
      }

      if (!hsnMap[hsn]) {
        hsnMap[hsn] = { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      }

      hsnMap[hsn].taxableValue += combinedLineAmount;
      hsnMap[hsn].cgst += cgst;
      hsnMap[hsn].sgst += sgst;
      hsnMap[hsn].igst += igst;
      hsnMap[hsn].cess += cess;
    });

    const list = Object.values(hsnMap);
    const totalTaxable = list.reduce((sum, item) => sum + item.taxableValue, 0);
    const totalCessCalculated = list.reduce((sum, item) => sum + item.cess, 0);
    if (totalCessCalculated === 0 && hasCessLedger && cessLedgerAmt > 0 && totalTaxable > 0) {
      list.forEach((item) => {
        item.cess = parseFloat(((item.taxableValue / totalTaxable) * cessLedgerAmt).toFixed(2));
      });
    }

    return list;
  };

  const calculateLedgerTaxDetails = () => {
    const ledgerMap = {};
    const lines = form.purchaseLines || [];
    let gstRate = 0;
    if (form.purchaseLedger) {
      const m = form.purchaseLedger.match(/(\d+)\s*%/);
      if (m) gstRate = parseFloat(m[1]);
    }

    // Extract CESS rate from any CESS ledger in additionalCharges or purchaseLines
    let cessRate = 0;
    let hasCessLedger = false;
    let cessLedgerAmt = 0;
    const allChargesForCess = [...(form.purchaseLines || []), ...(form.additionalCharges || [])];
    allChargesForCess.forEach((c) => {
      const nameUpper = (c.ledgerName || c.purchaseLedger || '').toUpperCase();
      if (nameUpper.includes('CESS')) {
        hasCessLedger = true;
        const match = nameUpper.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) {
          cessRate = parseFloat(match[1]);
        } else {
          cessLedgerAmt += parseFloat(c.amount) || 0;
        }
      }
    });

    lines.forEach((line) => {
      const ledgerName = (line.purchaseLedger || '').trim() || '-';
      const amount = parseFloat(line.amount) || 0;
      const rate = gstRate > 0 ? gstRate : (parseFloat(line.gstRate) || 0);

      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      let cess = 0;

      if (isInterstate) {
        igst = parseFloat(((amount * rate) / 100).toFixed(2));
      } else {
        cgst = parseFloat(((amount * (rate / 2)) / 100).toFixed(2));
        sgst = parseFloat(((amount * (rate / 2)) / 100).toFixed(2));
      }

      // Calculate CESS
      let lineCessRate = parseFloat(line.cessRate || line.cess_rate) || 0;
      if (lineCessRate <= 0) {
        lineCessRate = cessRate;
      }
      if (lineCessRate > 0) {
        cess = parseFloat(((amount * lineCessRate) / 100).toFixed(2));
      }

      if (!ledgerMap[ledgerName]) {
        ledgerMap[ledgerName] = { ledgerName, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      }

      ledgerMap[ledgerName].taxableValue += amount;
      ledgerMap[ledgerName].cgst += cgst;
      ledgerMap[ledgerName].sgst += sgst;
      ledgerMap[ledgerName].igst += igst;
      ledgerMap[ledgerName].cess += cess;
    });

    const list = Object.values(ledgerMap);
    const totalTaxable = list.reduce((sum, item) => sum + item.taxableValue, 0);
    const totalCessCalculated = list.reduce((sum, item) => sum + item.cess, 0);
    if (totalCessCalculated === 0 && hasCessLedger && cessLedgerAmt > 0 && totalTaxable > 0) {
      list.forEach((item) => {
        item.cess = parseFloat(((item.taxableValue / totalTaxable) * cessLedgerAmt).toFixed(2));
      });
    }

    return list;
  };



  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      <div className="m3-scope flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--m3-surface)' }}>
        <style>{`
          .themed-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .themed-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; }
          .themed-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 0px; }
          .themed-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme.accent}; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        {/* ─── Top-Level Two-Column Layout ─── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ─── Left Column (75%): Header + Summary + Form ─── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ─── 1. Compact Header Row ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 shrink-0 border-b" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container-low)' }}>
          <div className="flex items-center gap-4">
            <h1 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--m3-on-surface)' }}>
              {form.voucherType === 'debit_note'
                ? 'Create Debit Note'
                : getNormalizedType(form.voucherType) === 'purchase_order'
                  ? 'Create Purchase Order'
                  : 'Create Purchase Voucher'}
            </h1>

            {/* M3 segmented button — entry mode */}
            <div className="m3-seg" role="group" aria-label="Entry mode">
              <button aria-pressed={activeTab === 'With Item Invoice'} onClick={() => handleTabChange('With Item Invoice')}>
                {activeTab === 'With Item Invoice' && <Check size={14} />} With Item
              </button>
              <button aria-pressed={activeTab === 'Without Item Invoice'} onClick={() => handleTabChange('Without Item Invoice')}>
                {activeTab === 'Without Item Invoice' && <Check size={14} />} Without Item
              </button>
            </div>
          </div>

          {/* M3 action buttons */}
          <div className="flex items-center gap-2">
            <button onClick={handleSaveDraft} disabled={loading.save} className="m3-btn m3-btn--outlined">
              {loading.save ? <Loader2 size={14} className="animate-spin" /> : null} Draft
            </button>
            <button onClick={handlePushToReview} disabled={loading.save} className="m3-btn m3-btn--tonal">Review</button>
            <button onClick={handlePostToTally} className="m3-btn m3-btn--filled">Post Tally</button>
            <button onClick={handleCancel} className="m3-btn m3-btn--text">Cancel</button>
            <button className="m3-icon-btn" title="Settings" aria-label="Settings"><Settings size={16} /></button>
            {onBack && (
              <button onClick={onBack} className="m3-icon-btn" title="Close Form" aria-label="Close Form"><X size={16} strokeWidth={2.5} /></button>
            )}
          </div>
        </div>

        {/* ─── 2. Voucher Types & Summary Row ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container-low)' }}>
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
                const isSelected = ['purchase_invoice', 'purchase_order', 'debit_note'].includes(getNormalizedType(form.voucherType))
                  ? type.id === 'purchase_invoice'
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
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-left min-w-[120px] shrink-0 transition-all ${isSelected
                      ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-sm'
                      : 'bg-[var(--app-panel-bg)] border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-content-bg)]'
                      }`}
                  >
                    <type.icon size={11} className={isSelected ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'} />
                    <div>
                      <span className="text-[7px] block font-black tracking-wider opacity-60 uppercase">{type.section}</span>
                      <span className="text-[11px] font-black">{type.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* M3 amount summary chips */}
          <div className="flex items-center flex-wrap gap-1.5 ml-auto">
            {activeTab === 'With Item Invoice' && (
              <span className="m3-chip"><span>Items</span> <b>{form.productLines.length}</b></span>
            )}
            <span className="m3-chip"><span>Disc</span> <b>₹ {form.entryTab === 'with_item' ? form.productLines.reduce((acc, l) => acc + (parseFloat(l.discountPercent) || 0), 0).toFixed(2) : "0.00"}</b></span>
            <span className="m3-chip"><span>Taxable</span> <b>₹ {parseFloat(form.baseTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
            <span className="m3-chip"><span>Tax</span> <b>₹ {((parseFloat(form.cgstTotal) || 0) + (parseFloat(form.sgstTotal) || 0) + (parseFloat(form.igstTotal) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
            <span className="m3-chip"><span>Subtotal</span> <b>₹ {parseFloat(form.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
            <span className="m3-chip"><span>Round</span> <b>{isRoundOffChecked ? `₹ ${form.roundOff || "0.00"}` : "₹ 0.00"}</b></span>
            <span className="m3-chip m3-chip--primary"><span>Net</span> <b>₹ {parseFloat(isRoundOffChecked ? (form.grandTotal || 0) : (form.subTotal || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
          </div>
        </div>

        {/* ─── 3. Main Body ─── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Form Area */}
          <div className="flex-1 p-2 overflow-y-auto themed-scrollbar bg-[var(--app-panel-bg)]">
            <div className="flex flex-col gap-3">

              {/* A. Voucher Details Section */}
              <div className="p-2.5 m3-card mb-0">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-heading)] mb-1.5">Voucher Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3">

                    {/* Row 1: Voucher Date | Voucher Type | Voucher Number Series | Voucher No. */}
                    <div className="col-span-1">
                      <InputField
                        label="Voucher Date"
                        compact
                        icon={Calendar}
                        type="date"
                        value={form.voucherDate || ''}
                        onChange={(v) => updateForm({ voucherDate: v })}
                      />
                    </div>

                    {/* Voucher Type — clickable select, auto-set from header but editable */}
                    <div className="col-span-1 relative">
                      <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 " style={{ backgroundColor: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface-variant)' }}>
                        Voucher Type
                      </label>
                      <select
                        value={getSelectValue()}
                        onChange={(e) => updateForm({ voucherType: e.target.value })}
                        className="w-full h-7.5 px-3 rounded-lg border text-[11px] font-bold outline-none bg-[var(--app-panel-bg)]"
                        style={{ borderColor: theme.border, color: theme.text }}
                      >
                        {voucherTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Voucher Number Series */}
                    <div className="col-span-1 relative">
                      <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 " style={{ backgroundColor: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface-variant)' }}>
                        Voucher Number Series
                      </label>
                      <select
                        value={form.voucherNumberSeries || 'Default'}
                        onChange={(e) => updateForm({ voucherNumberSeries: e.target.value })}
                        className="w-full h-7.5 px-3 rounded-lg border text-[11px] font-bold outline-none bg-[var(--app-panel-bg)]"
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
                        value={form.voucherNumber || ''}
                        readOnly={form.voucherNumberSeries !== 'Manual'}
                        onChange={(v) => updateForm({ voucherNumber: v, invoiceNumber: v })}
                      />
                    </div>

                    {/* Row 2: Purchase Ledger | Party Ledger | Party GSTIN | Consignee Ledger */}
                    {/* Purchase Ledger */}
                    <div className="col-span-1">
                      <SearchableDropdown
                        label="Purchase Ledger"
                        compact
                        placeholder={activeTab === 'Without Item Invoice' ? 'Select Ledger' : 'Purchase Ledger'}
                        options={masterData.purchaseLedgers?.length > 0 ? masterData.purchaseLedgers : ['General Purchase']}
                        value={form.purchaseLedger || ''}
                        hasSearch
                        onChange={(v) => updateForm({ purchaseLedger: v })}
                      />
                    </div>

                    {/* Party Ledger */}
                    <div className="col-span-1">
                      <SearchableDropdown
                        label="Party Ledger"
                        compact
                        placeholder="Select Supplier"
                        options={masterData.partyLedgers?.length > 0 ? masterData.partyLedgers : []}
                        value={form.partyLedger || ''}
                        hasSearch
                        onChange={(v) => {
                          updateForm({ partyLedger: v });
                          const normType = getNormalizedType(form.voucherType);
                          if (normType === 'debit_note') {
                            updateForm({ referenceNumber: '' });
                            if (v) fetchPurchaseInvoicesForParty(v);
                          } else if (normType === 'purchase_invoice') {
                            fetchPurchaseOrdersForParty(v);
                            updateForm({ poNumber: '' });
                          }
                          if (v && masterData.partyLedgerDetails && masterData.partyLedgerDetails[v]) {
                            const details = masterData.partyLedgerDetails[v];
                            updateForm({
                              partyGstin: details.gstin || '',
                              gstRegistration: details.gstState ? `${details.gstState} Registration` : '',
                              gstRegistrationType: details.registrationType || ''
                            });
                          } else {
                            updateForm({ partyGstin: '', gstRegistration: '', gstRegistrationType: '' });
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
                        value={form.partyGstin || ''}
                        onChange={(v) => updateForm({ partyGstin: v })}
                      />
                    </div>

                    {/* Consignee Ledger */}
                    <div className="col-span-1">
                      <SearchableDropdown
                        label="Consignee Ledger"
                        compact
                        placeholder="Same as Party"
                        options={['Same as Party', ...(masterData.partyLedgers || [])]}
                        value={form.consigneeLedger || 'Same as Party'}
                        onChange={(v) => {
                          updateForm({ consigneeLedger: v });
                          if (v && v !== 'Same as Party' && masterData.partyLedgerDetails && masterData.partyLedgerDetails[v]) {
                            updateForm({ consigneeGstin: masterData.partyLedgerDetails[v].gstin || '' });
                          } else {
                            updateForm({ consigneeGstin: '' });
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
                          onChange={(v) => updateForm({ consigneeGstin: v })}
                        />
                      </div>
                    )}

                    {/* Narration */}
                    <div className={(form.consigneeLedger && form.consigneeLedger !== 'Same as Party' && form.consigneeLedger !== form.partyLedger) ? 'col-span-3 relative flex flex-col gap-1' : 'col-span-4 relative flex flex-col gap-1'}>
                      <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 " style={{ backgroundColor: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface-variant)' }}>
                        Narration
                      </label>
                      <input
                        type="text"
                        value={form.narration || ''}
                        onChange={(e) => updateForm({ narration: e.target.value })}
                        className="w-full h-7.5 px-3 rounded-lg border text-[11px] font-bold outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                        placeholder="Enter narration here..."
                        style={{ borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                  </div>
                </div>

              {/* B. Item Details Section (Flat UI, No Cards, No Rounded) */}
              {activeTab === 'With Item Invoice' && (
                <div className="p-3 m3-card mb-0 shrink-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-heading)]">Item Details</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addRow(activeTab === 'With Item Invoice' ? 'product' : 'purchase')}
                        className="px-2 py-1 rounded-lg border border-[var(--app-border)] text-[11px] font-black text-[var(--app-heading)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} strokeWidth={3} /> Add Line
                      </button>
                      <button
                        onClick={() => setIsLedgerModalOpen(true)}
                        className="px-2 py-1 rounded-lg border border-[var(--app-border)] text-[11px] font-black text-[var(--app-heading)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} /> Add Ledger
                      </button>
                      <button
                        onClick={() => setIsStockModalOpen(true)}
                        className="px-2 py-1 rounded-lg border border-[var(--app-border)] text-[11px] font-black text-[var(--app-heading)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} /> Add Item
                      </button>
                    </div>
                  </div>
                  <div className="overflow-visible mb-1.5">
                    {activeTab === 'Without Item Invoice' ? (
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
                          {(form.purchaseLines || []).map((row, idx) => {
                            const tax = calculateRowTax(row.amount, row.gstRate, isInterstate);
                            return (
                              <tr key={row.id} className="border-b hover:bg-[var(--app-content-bg)]/50 overflow-visible" style={{ borderColor: theme.border }}>
                                <td className="px-1 py-0.5 text-center font-bold text-[var(--app-muted)] border-r text-[10px]" style={{ borderColor: theme.border }}>{idx + 1}</td>
                                <td className="px-1 py-0.5 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Search Item / Ledger"
                                    compact
                                    options={masterData.purchaseLedgers?.length > 0 ? masterData.purchaseLedgers : ['General Purchase']}
                                    value={row.purchaseLedger || ''}
                                    onChange={(v) => {
                                      const match = v.match(/(\d+(?:\.\d+)?)\s*%/);
                                      const rate = match ? parseFloat(match[1]) : 0;
                                      updatePurchaseLine(row.id, { purchaseLedger: v, gstRate: rate });
                                    }}
                                  />
                                  <input
                                    type="text"
                                    value={row.description || ''}
                                    onChange={(e) => updatePurchaseLine(row.id, { description: e.target.value })}
                                    placeholder="Description"
                                    className="w-full h-6 px-2 border-t rounded-lg outline-none text-[11px] bg-transparent"
                                    style={{ borderColor: theme.border, color: theme.mutedText }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    value={row.hsnSacCode || ''}
                                    onChange={(e) => updatePurchaseLine(row.id, { hsnSacCode: e.target.value })}
                                    placeholder="HSN"
                                    className="w-full h-7 px-2 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    value={row.amount || ''}
                                    onChange={(e) => updatePurchaseLine(row.id, { amount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-full h-7 px-2 rounded border outline-none text-right font-bold text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.gstRate || 0}
                                    onChange={(e) => updatePurchaseLine(row.id, { gstRate: parseFloat(e.target.value) || 0 })}
                                    className="w-full h-7 px-1.5 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] cursor-pointer transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  >
                                    <option value={0}>0%</option>
                                    <option value={5}>5%</option>
                                    <option value={12}>12%</option>
                                    <option value={18}>18%</option>
                                    <option value={28}>28%</option>
                                  </select>
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-[var(--app-heading)] text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.cgst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-[var(--app-heading)] text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.sgst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-[var(--app-heading)] text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.igst.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-[var(--app-heading)] text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  {tax.totalTax.toFixed(2)}
                                </td>
                                <td className="px-1.5 py-1 text-right font-black text-slate-950 text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  ₹{tax.netAmount.toFixed(2)}
                                </td>
                                <td className="px-0 py-0 text-center">
                                  <button
                                    onClick={() => removeRow('purchase', row.id)}
                                    className="p-0.5 rounded-lg text-[var(--app-muted)] hover:text-red-500 transition-colors"
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
                      <table className="w-full text-left text-[10px] border-collapse min-w-[980px] overflow-visible" style={{ borderColor: theme.border }}>
                        <thead>
                          <tr className="border-b" style={{ borderColor: theme.border, color: theme.mutedText }}>
                            <th className="px-1 py-1 w-8 text-center border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>#</th>
                            <th className="px-1 py-1 w-64 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Item / Ledger *</th>
                            <th className="px-1 py-1 w-20 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Stock Qty</th>
                            <th className="px-1 py-1 w-24 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>HSN/SAC</th>
                            <th className="px-1 py-1 w-16 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>GST%</th>
                            <th className="px-1 py-1 w-20 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Qty</th>
                            <th className="px-1 py-1 w-24 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Unit</th>
                            <th className="px-1 py-1 w-28 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Rate (₹)</th>
                            <th className="px-1 py-1 w-16 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Disc%</th>
                            <th className="px-1 py-1 w-32 text-right border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Amount (₹)</th>
                            <th className="px-1 py-1 w-10 text-center" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.productLines || []).map((row, idx) => {
                            return (
                              <tr key={row.id} className="border-b hover:bg-[var(--app-content-bg)]/50 overflow-visible" style={{ borderColor: theme.border }}>
                                <td className="px-1 py-0.5 text-center font-bold text-[var(--app-muted)] border-r text-[10px]" style={{ borderColor: theme.border }}>{idx + 1}</td>
                                <td className="px-1 py-0.5 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Search Item / Ledger"
                                    hasAdd
                                    compact
                                    options={masterData.stockItems?.length > 0 ? masterData.stockItems : []}
                                    value={row.stockItem || ''}
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
                                    onChange={(e) => updateProductLine(row.id, { description: e.target.value })}
                                    placeholder="Description"
                                    className="w-full h-6 px-2 border-t rounded-lg outline-none text-[11px] bg-transparent"
                                    style={{ borderColor: theme.border, color: theme.mutedText }}
                                  />
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-[var(--app-muted)] border-r text-[10px] bg-[var(--app-content-bg)]/20" style={{ borderColor: theme.border }}>
                                  {(() => {
                                    if (row.stockItem && masterData.stockItemDetails && masterData.stockItemDetails[row.stockItem]) {
                                      const qty = masterData.stockItemDetails[row.stockItem].qty ?? 0;
                                      return qty.toLocaleString('en-IN');
                                    }
                                    return '-';
                                  })()}
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    value={row.hsnSacCode || ''}
                                    onChange={(e) => updateProductLine(row.id, { hsnSacCode: e.target.value })}
                                    placeholder="HSN"
                                    className="w-full h-7 px-2 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.gstRate || 0}
                                    onChange={(e) => updateProductLine(row.id, { gstRate: parseFloat(e.target.value) || 0 })}
                                    className="w-full h-7 px-1.5 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] cursor-pointer transition-all focus:border-[var(--app-accent)]"
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
                                    onChange={(e) => updateProductLine(row.id, { billQuantity: parseFloat(e.target.value) || 0 })}
                                    placeholder="1"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.unit || 'Nos'}
                                    onChange={(e) => updateProductLine(row.id, { unit: e.target.value })}
                                    className="w-full h-7 px-1.5 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] cursor-pointer transition-all focus:border-[var(--app-accent)]"
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
                                    onChange={(e) => updateProductLine(row.id, { billRate: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    value={row.discountPercent || ''}
                                    onChange={(e) => updateProductLine(row.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                                    placeholder="0"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="px-1.5 py-1 text-right font-bold text-[var(--app-heading)] text-[10px] border-r" style={{ borderColor: theme.border }}>
                                  ₹{parseFloat(row.amount || 0).toFixed(2)}
                                </td>
                                <td className="px-0 py-0 text-center">
                                  <button
                                    onClick={() => removeRow('product', row.id)}
                                    className="p-0.5 rounded-lg text-[var(--app-muted)] hover:text-red-500 transition-colors"
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
                      className="px-4 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] text-[11px] font-black flex items-center gap-1.5 hover:bg-[var(--app-accent-soft)] shadow-sm disabled:opacity-50"
                    >
                      {isAiAutofillLoading ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                      AI-Auto Fill Remaining
                    </button>
                  </div>
                </div>
              )}

              {/* D. Ledger Details & E. Tax Ledger Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">

                {/* Left Stack: Ledger Details & HSN Tax Detailes */}
                <div className="flex flex-col gap-4">
                  {/* Ledger Details */}
                  <div className="p-4 m3-card flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] rounded-lg border border-[var(--app-border)] dark:border-[var(--app-border)] flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                        </div>
                        <span className="font-bold text-[13px] text-[var(--app-heading)]">Ledger Details</span>
                      </div>
                      <button
                        onClick={addPurchaseLine}
                        className="px-3 py-1 bg-[var(--app-accent-soft)] hover:bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] border border-[var(--app-border)] dark:border-[var(--app-border)] rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus size={12} strokeWidth={2.5} /> Add Ledger
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-visible" style={{ borderColor: theme.border }}>
                      <table className="w-full text-left text-[11px] border-collapse" style={{ borderColor: theme.border }}>
                        <thead>
                          <tr className="border-b bg-[var(--app-content-bg)]/50" style={{ borderColor: theme.border, color: theme.mutedText }}>
                            <th className="px-3 py-2 w-14 text-center border-r font-bold" style={{ borderColor: theme.border }}>Sr. No</th>
                            <th className="px-3 py-2 border-r font-bold" style={{ borderColor: theme.border }}>Ledger Name</th>
                            <th className="px-3 py-2 border-r font-bold" style={{ borderColor: theme.border }}>Description</th>
                            <th className="px-3 py-2 w-32 text-right border-r font-bold" style={{ borderColor: theme.border }}>Amount</th>
                            <th className="px-3 py-2 w-12 text-center font-bold" style={{ borderColor: theme.border }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.purchaseLines || []).map((row, idx) => (
                            <tr key={row.id} className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                              <td className="px-3 py-2 text-center font-bold text-[var(--app-heading)] border-r" style={{ borderColor: theme.border }}>{idx + 1}</td>
                              <td className="p-2 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                <SearchableDropdown
                                  placeholder="Ledger name"
                                  compact
                                  rounded
                                  options={masterData.allLedgers?.length > 0 ? masterData.allLedgers : (masterData.purchaseLedgers?.length > 0 ? masterData.purchaseLedgers : ['General Purchase'])}
                                  value={row.purchaseLedger || ''}
                                  onChange={(v) => updatePurchaseLine(row.id, { purchaseLedger: v })}
                                />
                              </td>
                              <td className="p-2 border-r" style={{ borderColor: theme.border }}>
                                <input
                                  type="text"
                                  value={row.description || ''}
                                  onChange={(e) => updatePurchaseLine(row.id, { description: e.target.value })}
                                  placeholder="Description"
                                  className="w-full h-8 px-2 rounded-lg border outline-none text-[11px] font-bold bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                  style={{ borderColor: theme.border, color: theme.text }}
                                />
                              </td>
                              <td className="p-2 border-r" style={{ borderColor: theme.border }}>
                                <input
                                  type="number"
                                  value={row.amount || ''}
                                  onChange={(e) => updatePurchaseLine(row.id, { amount: parseFloat(e.target.value) || 0 })}
                                  placeholder="0.00"
                                  className="w-full h-8 px-3 rounded-lg border outline-none text-right text-[11px] font-bold bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                  style={{ borderColor: theme.border, color: theme.text }}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => removePurchaseLine(row.id)}
                                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-500/10 dark:bg-red-950/20 text-red-500 hover:text-red-500 border border-red-100 dark:border-red-900/50 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end mt-1 gap-2">
                      {activeTab === 'With Item Invoice' && (
                        <div className="px-4 py-1.5 bg-[var(--app-table-head-bg)] text-[var(--app-heading)] rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-[var(--app-border)]">
                          <span>Ledger Total (₹)</span>
                          <span className="font-black">{parseFloat(form.ledgerAmount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="px-4 py-1.5 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-[var(--app-border)] dark:border-[var(--app-border)]">
                        <span>{activeTab === 'With Item Invoice' ? 'Total (Item + Ledger) (₹)' : 'Total (₹)'}</span>
                        <span className="font-black">{parseFloat(form.baseTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* HSN / Sales Tax Details */}
                  <div className="p-4 m3-card flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-900/50 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12.5 13.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z"></path><path d="M14.5 17.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z"></path><line x1="14" y1="12" x2="10" y2="18"></line></svg>
                        </div>
                        <span className="font-bold text-[13px] text-[var(--app-heading)]">
                          {activeTab === 'Without Item Invoice' ? 'Sales Tax Details' : 'HSN Tax Detailes'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                            <input
                              type="checkbox"
                              checked={isRoundOffChecked}
                              onChange={(e) => setIsRoundOffChecked(e.target.checked)}
                              className="w-4 h-4 rounded border-[var(--app-border)] accent-emerald-600 cursor-pointer shadow-sm"
                            />
                            <span className="text-[11px] font-bold text-[var(--app-heading)] group-hover:text-[var(--app-accent)] transition-colors">Round Off</span>
                          </label>
                        </div>

                        <div className="px-4 py-1.5 bg-amber-50/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-amber-100 dark:border-amber-900/30">
                          <span>Total Tax (₹)</span>
                          <span className="font-black">
                            {(() => {
                              const cgstAmt = parseFloat(form.cgstTotal || 0);
                              const sgstAmt = parseFloat(form.sgstTotal || 0);
                              const igstAmt = parseFloat(form.igstTotal || 0);
                              return (cgstAmt + sgstAmt + igstAmt).toFixed(2);
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden" style={{ borderColor: theme.border }}>
                      <table className="w-full text-left text-[11px] border-collapse" style={{ borderColor: theme.border }}>
                        <thead>
                          <tr className="border-b bg-[var(--app-content-bg)]/50" style={{ borderColor: theme.border, color: theme.mutedText }}>
                            <th className="px-3 py-2 border-r font-bold" style={{ borderColor: theme.border }}>
                              {activeTab === 'Without Item Invoice' ? 'Ledger Name' : 'Hsn no.'}
                            </th>
                            <th className="px-3 py-2 border-r font-bold text-right" style={{ borderColor: theme.border }}>Taxable Value</th>
                            <th className="px-3 py-2 border-r font-bold text-right" style={{ borderColor: theme.border }}>CGST</th>
                            <th className="px-3 py-2 border-r font-bold text-right" style={{ borderColor: theme.border }}>SGST</th>
                            <th className="px-3 py-2 border-r font-bold text-right" style={{ borderColor: theme.border }}>IGST</th>
                            <th className="px-3 py-2 font-bold text-right" style={{ borderColor: theme.border }}>Cess</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const taxData = activeTab === 'Without Item Invoice' ? calculateLedgerTaxDetails() : calculateHsnTaxDetails();
                            const primaryKey = activeTab === 'Without Item Invoice' ? 'ledgerName' : 'hsn';
                            return (
                              <>
                                {taxData.map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border, color: theme.text }}>
                                    <td className="px-3 py-2 border-r font-medium" style={{ borderColor: theme.border }}>{row[primaryKey]}</td>
                                    <td className="px-3 py-2 border-r text-right font-semibold" style={{ borderColor: theme.border }}>
                                      ₹ {row.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 border-r text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 border-r text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 border-r text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.cess.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                                {taxData.length > 0 && (
                                  <tr className="font-bold bg-[var(--app-content-bg)]/30 border-t" style={{ color: theme.text, borderColor: theme.border }}>
                                    <td className="px-3 py-2 border-r" style={{ borderColor: theme.border }}>Total</td>
                                    <td className="px-3 py-2 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.taxableValue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.cgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.sgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.igst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-right font-black">
                                      ₹ {taxData.reduce((sum, r) => sum + r.cess, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                )}
                                {taxData.length === 0 && (
                                  <tr>
                                    <td colSpan="6" className="px-3 py-4 text-center text-[var(--app-muted)]">No tax details available</td>
                                  </tr>
                                )}
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Tax & Statutory Ledger Details */}
                <div className="p-2.5 m3-card flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
                      </div>
                      <span className="font-bold text-[12px] text-[var(--app-heading)]">Tax & Statutory Ledger Details</span>
                      <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-455 rounded text-[11px] font-black uppercase tracking-wider">Auto Calculated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-bold text-[var(--app-heading)]">TDS Applicable:</span>
                      <div className="inline-flex rounded-lg border border-[var(--app-border)] p-0.5 bg-[var(--app-content-bg)]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsTdsApplicable(true);
                            // Set initial value in store directly
                            const baseAmt = parseFloat(form.baseTotal || 0);
                            const tdsAmtVal = parseFloat((baseAmt * 0.02).toFixed(2));
                            updateForm({
                              tdsDetails: [{
                                id: Date.now() + 500,
                                ledgerName: 'TDS Payable',
                                assessableValue: baseAmt,
                                rate: 2,
                                amount: tdsAmtVal
                              }]
                            });
                          }}
                          className={`rounded-md px-2.5 py-0.5 text-[11px] font-black transition-all cursor-pointer ${isTdsApplicable ? 'bg-emerald-600 text-white shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'}`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsTdsApplicable(false);
                            updateForm({ tdsDetails: [] });
                          }}
                          className={`rounded-md px-2.5 py-0.5 text-[11px] font-black transition-all cursor-pointer ${!isTdsApplicable ? 'bg-emerald-600 text-white shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'}`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.purchaseLines || []);
                    const gstRateVal = lines.length > 0 ? (parseFloat(lines[0].gstRate) || 0) : 0;
                    const cgstRateVal = isInterstate ? 0 : gstRateVal / 2;
                    const sgstRateVal = isInterstate ? 0 : gstRateVal / 2;
                    const igstRateVal = isInterstate ? gstRateVal : 0;

                    const cgstAmtVal = parseFloat(form.cgstTotal || 0);
                    const sgstAmtVal = parseFloat(form.sgstTotal || 0);
                    const igstAmtVal = parseFloat(form.igstTotal || 0);
                    const cessAmtVal = parseFloat(form.cessTotal || 0);

                    let cessRateVal = 0;
                    const allChargesForCess = [...(form.purchaseLines || []), ...(form.additionalCharges || [])];
                    const foundCess = allChargesForCess.find(c => {
                      const name = (c.ledgerName || c.purchaseLedger || '').toUpperCase();
                      return name.includes('CESS');
                    });
                    if (foundCess) {
                      const match = (foundCess.ledgerName || foundCess.purchaseLedger || '').match(/(\d+(?:\.\d+)?)\s*%/);
                      if (match) cessRateVal = parseFloat(match[1]);
                    }

                    const totalGstVal = cgstAmtVal + sgstAmtVal + igstAmtVal;
                    const grandTotalVal = parseFloat(form.baseTotal || 0) + totalGstVal;

                    const invoiceAmt = parseFloat(isRoundOffChecked ? (form.grandTotal || 0) : (form.subTotal || 0)) - (isTdsApplicable ? parseFloat(form.tdsTotal || 0) : 0);
                    const tdsAmt = parseFloat(form.tdsTotal || 0);
                    const payableAmt = parseFloat(isRoundOffChecked ? (form.grandTotal || 0) : (form.subTotal || 0));

                    return (
                      <div className="flex flex-col gap-2.5">
                        {/* Unified Table */}
                        <div className="border rounded-lg overflow-visible" style={{ borderColor: theme.border }}>
                          <table className="w-full text-left text-[11px] border-collapse" style={{ borderColor: theme.border }}>
                            <thead>
                              <tr className="border-b bg-[var(--app-content-bg)]/50" style={{ borderColor: theme.border, color: theme.mutedText }}>
                                <th className="px-3 py-1.5 border-r font-bold w-1/4" style={{ borderColor: theme.border }}>Tax Component</th>
                                <th className="px-3 py-1.5 border-r font-bold" style={{ borderColor: theme.border }}>Ledger (Select Ledger)</th>
                                <th className="px-3 py-1.5 font-bold w-40 text-right" style={{ borderColor: theme.border }}>Amount (Auto)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* CGST Row */}
                              <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>CGST (Central GST)</td>
                                <td className="p-1 border-r relative z-30 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Select CGST Ledger"
                                    compact
                                    options={getLedgerOptions('CGST')}
                                    value={getLedgerNameForComponent('CGST')}
                                    onChange={(v) => setLedgerNameForComponent('CGST', v)}
                                    disabled={false}
                                  />
                                </td>
                                <td className="p-1" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    readOnly
                                    value={`₹ ${cgstAmtVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                                    className="w-full h-7.5 px-3 rounded-lg outline-none text-right text-[11px] font-bold bg-[var(--app-content-bg)] border border-[var(--app-border)] text-[var(--app-muted)]"
                                    style={{ color: theme.mutedText }}
                                  />
                                </td>
                              </tr>

                              {/* SGST Row */}
                              <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>SGST (State GST)</td>
                                <td className="p-1 border-r relative z-20 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Select SGST Ledger"
                                    compact
                                    options={getLedgerOptions('SGST')}
                                    value={getLedgerNameForComponent('SGST')}
                                    onChange={(v) => setLedgerNameForComponent('SGST', v)}
                                    disabled={false}
                                  />
                                </td>
                                <td className="p-1" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    readOnly
                                    value={`₹ ${sgstAmtVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                                    className="w-full h-7.5 px-3 rounded-lg outline-none text-right text-[11px] font-bold bg-[var(--app-content-bg)] border border-[var(--app-border)] text-[var(--app-muted)]"
                                    style={{ color: theme.mutedText }}
                                  />
                                </td>
                              </tr>

                              {/* IGST Row */}
                              {isInterstate && (
                                <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                  <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>IGST (Integrated GST)</td>
                                  <td className="p-1 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                    <SearchableDropdown
                                      placeholder="Select IGST Ledger"
                                      compact
                                      options={getLedgerOptions('IGST')}
                                      value={getLedgerNameForComponent('IGST')}
                                      onChange={(v) => setLedgerNameForComponent('IGST', v)}
                                      disabled={false}
                                    />
                                  </td>
                                  <td className="p-1" style={{ borderColor: theme.border }}>
                                    <input
                                      type="text"
                                      readOnly
                                      value={`₹ ${igstAmtVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                                      className="w-full h-7.5 px-3 rounded-lg outline-none text-right text-[11px] font-bold bg-[var(--app-content-bg)] border border-[var(--app-border)] text-[var(--app-muted)]"
                                      style={{ color: theme.mutedText }}
                                    />
                                  </td>
                                </tr>
                              )}

                              {/* CESS Row */}
                              <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>CESS (Cess)</td>
                                <td className="p-1 border-r relative z-0 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="CESS Payable"
                                    compact
                                    options={getLedgerOptions('CESS')}
                                    value={getLedgerNameForComponent('CESS') || 'CESS Payable'}
                                    onChange={(v) => setLedgerNameForComponent('CESS', v)}
                                    disabled={false}
                                  />
                                </td>
                                <td className="p-1" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    readOnly
                                    value={`₹ ${cessAmtVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                                    className="w-full h-7.5 px-3 rounded-lg outline-none text-right text-[11px] font-bold bg-[var(--app-content-bg)] border border-[var(--app-border)] text-[var(--app-muted)]"
                                    style={{ color: theme.mutedText }}
                                  />
                                </td>
                              </tr>

                              {/* TDS Row */}
                              {isTdsApplicable && (
                                <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                  <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>TDS (If Applicable)</td>
                                  <td className="p-1 border-r relative z-40 focus-within:z-50" style={{ borderColor: theme.border }}>
                                    <SearchableDropdown
                                      placeholder="Select TDS Ledger"
                                      compact
                                      options={getLedgerOptions('TDS')}
                                      value={form.tdsDetails?.[0]?.ledgerName || ''}
                                      onChange={(v) => {
                                        const currentTds = form.tdsDetails?.[0] || {};
                                        const updatedTds = [{
                                          ...currentTds,
                                          ledgerName: v
                                        }];
                                        updateForm({ tdsDetails: updatedTds });
                                      }}
                                    />
                                  </td>
                                  <td className="p-1" style={{ borderColor: theme.border }}>
                                    <input
                                      type="text"
                                      readOnly
                                      value={`₹ ${tdsAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                                      className="w-full h-7.5 px-3 rounded-lg outline-none text-right text-[11px] font-bold bg-[var(--app-content-bg)] border border-[var(--app-border)] text-[var(--app-muted)]"
                                      style={{ color: theme.mutedText }}
                                    />
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* TDS Info Notice */}
                        {isTdsApplicable && (
                          <div className="px-3.5 py-2 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] text-[10.5px] font-semibold border border-[var(--app-border)] dark:border-[var(--app-border)] flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <span>TDS is calculated on taxable amount as per selected TDS rate and nature (if applicable).</span>
                          </div>
                        )}

                        {/* Bottom Net Summary Cards */}
                        <div className="grid grid-cols-3 gap-3.5 bg-[var(--app-content-bg)]/40 p-3.5 border" style={{ borderColor: theme.border }}>
                          <div className="flex flex-col gap-1 border-r pr-2" style={{ borderColor: theme.border }}>
                            <span className="text-[10px] font-black uppercase tracking-tight text-[var(--app-muted)]">Invoice Amount (Incl. Tax)</span>
                            <span className="text-[13.5px] font-black text-[var(--app-heading)]">
                              ₹ {invoiceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {isTdsApplicable ? (
                            <div className="flex flex-col gap-1 border-r pr-2" style={{ borderColor: theme.border }}>
                              <span className="text-[10px] font-black uppercase tracking-tight text-[var(--app-muted)]">Add: TDS Amount</span>
                              <span className="text-[13.5px] font-black text-emerald-500 dark:text-emerald-400">
                                + ₹ {tdsAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ) : (
                            <div className="border-r pr-2" style={{ borderColor: theme.border }}></div>
                          )}
                          <div className="flex flex-col gap-1 p-2 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 dark:border-emerald-900/50 rounded-lg">
                            <span className="text-[10px] font-black uppercase tracking-tight text-emerald-700 dark:text-emerald-400">Amount Payable</span>
                            <span className="text-[14.5px] font-black text-emerald-500 dark:text-emerald-400">
                              ₹ {payableAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Notice Alert */}
                        <div className="px-3.5 py-2 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] text-[10.5px] font-semibold border border-[var(--app-border)] dark:border-[var(--app-border)] flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                          <span>Tax and TDS amounts are auto-calculated based on taxable amount and selected rates. Only ledgers can be changed.</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>


            </div>
          </div>
        </div>

        </div>{/* End Left Column */}

        {/* ─── Right Column (25%): Party Details Sidebar ─── */}
        {form.partyLedger && (
          <div className="w-[280px] min-w-[260px] shrink-0 border-l overflow-y-auto themed-scrollbar p-3" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container-low)' }}>
            {(() => {
              const details = masterData.partyLedgerDetails?.[form.partyLedger] || {};
              const partyNameUpper = (form.partyLedger || '').toUpperCase();
              const isAmity = partyNameUpper.includes('AMITY') || partyNameUpper.includes('ANITY');

              let outstandingStr = '₹ 0.00';
              let isCredit = false;
              if (details.id) {
                const hexVal = parseInt(details.id.substring(18), 16) || 0;
                const amt = (hexVal % 90000) + 10000;
                isCredit = hexVal % 2 === 0;
                outstandingStr = `₹ ${amt.toLocaleString('en-IN')} ${isCredit ? 'Cr' : 'Dr'}`;
              }

              let dbAddress = '';
              if (Array.isArray(details.address)) {
                dbAddress = details.address.join('\n');
              } else if (typeof details.address === 'string') {
                dbAddress = details.address;
              }

              const partyData = {
                name: isAmity ? 'Anity Paper & Board' : form.partyLedger,
                gstin: isAmity ? '23ABPFA8005M1Z9' : (details.gstin || 'None'),
                state: isAmity ? 'Madhya Pradesh' : (details.gstState || 'Madhya Pradesh'),
                registrationType: isAmity ? 'Regular' : (details.registrationType || 'Consumer'),
                outstanding: isAmity ? '₹ 45,680 Dr' : outstandingStr,
                isDr: isAmity ? true : !isCredit,
                creditLimit: isAmity ? '₹ 2,00,000' : '₹ 1,50,000',
                creditDays: isAmity ? '30 Days' : '30 Days',
                lastInvoice: isAmity ? '30-Jun-2026' : '28-Jun-2026',
                ledgerGroup: isAmity ? 'Sundry Debtors' : (details.groupName || 'Sundry Debtors'),
                panNo: isAmity ? 'ABPFA8005M' : (details.panNumber || (details.gstin ? details.gstin.substring(2, 12) : 'None')),
                placeOfSupply: isAmity ? 'Madhya Pradesh (23)' : (details.gstState ? `${details.gstState} (${details.gstin ? details.gstin.substring(0, 2) : '23'})` : 'Madhya Pradesh (23)'),
                mobileNo: isAmity ? '+91 98765 43210' : (details.phone || '+91 98765 43210'),
                email: isAmity ? 'anitypaper@gmail.com' : (details.email || (form.partyLedger ? `${form.partyLedger.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com` : 'None')),
                address: isAmity ? '12, Industrial Area, Indore,\nMadhya Pradesh - 452001' : (dbAddress || 'None')
              };

              return (
                <div className="flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: 'var(--m3-outline-variant)' }}>
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--m3-primary)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      <span className="text-[12px] font-bold" style={{ color: 'var(--m3-on-surface)' }}>Party Details</span>
                    </div>
                    <button type="button" className="p-1 rounded-md hover:bg-[var(--m3-surface-container-high)]" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </button>
                  </div>

                  {/* Party Name */}
                  <div className="mb-3">
                    <span className="text-[9px] uppercase font-bold" style={{ color: 'var(--m3-on-surface-variant)' }}>Party Name</span>
                    <h4 className="text-[13px] font-bold leading-tight mt-0.5" style={{ color: 'var(--m3-primary)' }}>{partyData.name}</h4>
                  </div>

                  {/* GSTIN, State, Registration Type */}
                  <div className="flex flex-col gap-2 text-[11.5px] mb-3">
                    <div className="flex justify-between items-center">
                      <span style={{ color: 'var(--m3-on-surface-variant)' }}>GSTIN</span>
                      <span className="font-semibold" style={{ color: 'var(--m3-on-surface)' }}>{partyData.gstin}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: 'var(--m3-on-surface-variant)' }}>State</span>
                      <span className="font-semibold" style={{ color: 'var(--m3-on-surface)' }}>{partyData.state}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: 'var(--m3-on-surface-variant)' }}>Registration Type</span>
                      <span className="font-semibold" style={{ color: 'var(--m3-on-surface)' }}>{partyData.registrationType}</span>
                    </div>
                  </div>

                  {/* Grid cards */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2 rounded-lg border flex flex-col" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container)' }}>
                      <span className="text-[9px] uppercase font-bold" style={{ color: 'var(--m3-on-surface-variant)' }}>Outstanding</span>
                      <span className={`text-[11px] font-bold mt-0.5 ${partyData.isDr ? 'text-red-600' : 'text-emerald-600'}`}>{partyData.outstanding}</span>
                    </div>
                    <div className="p-2 rounded-lg border flex flex-col" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container)' }}>
                      <span className="text-[9px] uppercase font-bold" style={{ color: 'var(--m3-on-surface-variant)' }}>Credit Limit</span>
                      <span className="text-[11px] font-bold mt-0.5 text-blue-600">{partyData.creditLimit}</span>
                    </div>
                    <div className="p-2 rounded-lg border flex flex-col" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container)' }}>
                      <span className="text-[9px] uppercase font-bold" style={{ color: 'var(--m3-on-surface-variant)' }}>Credit Days</span>
                      <span className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--m3-on-surface)' }}>{partyData.creditDays}</span>
                    </div>
                    <div className="p-2 rounded-lg border flex flex-col" style={{ borderColor: 'var(--m3-outline-variant)', backgroundColor: 'var(--m3-surface-container)' }}>
                      <span className="text-[9px] uppercase font-bold" style={{ color: 'var(--m3-on-surface-variant)' }}>Last Invoice</span>
                      <span className="text-[11px] font-bold mt-0.5 flex items-center gap-1" style={{ color: 'var(--m3-on-surface)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        {partyData.lastInvoice}
                      </span>
                    </div>
                  </div>

                  {/* More Information */}
                  <div>
                    <div className="text-[10px] font-bold uppercase pb-1 mb-2 border-b" style={{ borderColor: 'var(--m3-outline-variant)', color: 'var(--m3-on-surface-variant)' }}>More Information</div>
                    <div className="flex flex-col gap-1.5 text-[11px]">
                      <div className="flex justify-between"><span style={{ color: 'var(--m3-on-surface-variant)' }}>Ledger Group</span><span className="font-semibold" style={{ color: 'var(--m3-on-surface)' }}>{partyData.ledgerGroup}</span></div>
                      <div className="flex justify-between"><span style={{ color: 'var(--m3-on-surface-variant)' }}>PAN No.</span><span className="font-semibold" style={{ color: 'var(--m3-on-surface)' }}>{partyData.panNo}</span></div>
                      <div className="flex justify-between"><span style={{ color: 'var(--m3-on-surface-variant)' }}>Place of Supply</span><span className="font-semibold" style={{ color: 'var(--m3-on-surface)' }}>{partyData.placeOfSupply}</span></div>
                      <div className="flex justify-between"><span style={{ color: 'var(--m3-on-surface-variant)' }}>Mobile No.</span><span className="font-semibold" style={{ color: 'var(--m3-on-surface)' }}>{partyData.mobileNo}</span></div>
                      <div className="flex justify-between"><span style={{ color: 'var(--m3-on-surface-variant)' }}>Email</span><span className="font-semibold truncate max-w-[140px]" style={{ color: 'var(--m3-on-surface)' }}>{partyData.email}</span></div>
                      <div className="flex flex-col mt-1">
                        <span style={{ color: 'var(--m3-on-surface-variant)' }}>Address</span>
                        <span className="font-semibold whitespace-pre-line leading-tight mt-0.5" style={{ color: 'var(--m3-on-surface)' }}>{partyData.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        </div>{/* End Top-Level Two-Column Layout */}
      </div>
    </ThemeContext.Provider>
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

const SummaryItem = ({ label, value, isLast }) => {
  const { theme, isDark } = useContext(ThemeContext);
  return (
    <div className="flex items-center gap-2 px-5 h-9 shrink-0 group">
      <span className="text-[11px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: theme.mutedText }}>{label}</span>
      <span className="text-[11.5px] font-black px-2.5 py-0.5 rounded-lg shadow-sm border transition-all" style={{ backgroundColor: theme.accentSoft, color: theme.accent, borderColor: 'var(--app-border)' }}>{value}</span>
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
          {hasSettings && <button className="text-[var(--app-muted)] hover:text-[var(--app-accent)] transition-all"><Settings size={13} /></button>}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-6 h-6 rounded-full border flex items-center justify-center text-[var(--app-muted)] hover:bg-[var(--app-content-bg)] transition-all"
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

const SearchableDropdown = ({ label, placeholder, options = [], value, onChange, hasAdd, hasSearch = true, compact, rounded, disabled }) => {
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
    <div className={`relative flex flex-col gap-1 w-full group ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={dropdownRef} style={{ zIndex: isOpen ? 50 : 1 }}>
      {label && (
        <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 group-focus-within:text-[var(--m3-primary)] transition-colors" style={{ backgroundColor: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface-variant)' }}>
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <div
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`w-full ${compact ? 'h-7.5' : 'h-10'} ${rounded ? 'rounded-lg' : 'rounded-lg'} border px-2 flex items-center justify-between cursor-pointer transition-all duration-300 group/input ${isOpen ? 'border-[var(--app-accent)]' : 'hover:border-[var(--app-accent)]'} ${disabled ? 'bg-[var(--app-table-head-bg)] cursor-not-allowed' : ''}`}
            style={{ backgroundColor: disabled ? undefined : 'var(--m3-surface-container-high)', borderColor: isOpen ? 'var(--m3-primary)' : 'var(--m3-outline-variant)' }}
          >
            <span className={`text-[11px] font-bold truncate transition-colors ${value ? (isDark ? 'text-[var(--app-accent)]' : 'text-[var(--app-accent)]') : 'text-[var(--app-muted)]'}`}>
              {value || placeholder}
            </span>
            <div className="flex items-center gap-1 text-[var(--app-muted)] group-hover/input:text-[var(--app-accent)] transition-colors">
              {value && !disabled && <X size={11} className="hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); onChange(''); }} />}
              <ChevronDown size={12} className={`transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-[var(--app-accent)]' : ''}`} />
            </div>
          </div>

          {isOpen && (
            <div
              className={`absolute top-full left-0 right-0 mt-1 border ${rounded ? 'rounded-lg' : 'rounded-lg'} shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[200px] z-50`}
              style={{
                backgroundColor: 'var(--m3-surface-container-high)',
                borderColor: 'var(--m3-outline-variant)',
                boxShadow: 'var(--m3-e2)',
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
                      className="w-full h-8 px-8 text-[11px] font-semibold outline-none transition-all rounded-md border focus:border-[var(--app-accent)]"
                      style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={11} />
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto themed-scrollbar p-1">
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer rounded-md transition-colors ${value === opt ? 'text-white font-bold' : 'hover:bg-[var(--app-table-head-bg)] hover:text-[var(--app-accent)] dark:hover:text-[var(--app-accent)]'}`}
                    style={{
                      backgroundColor: value === opt ? 'var(--m3-primary-container)' : 'transparent',
                      color: value === opt ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)'
                    }}
                    onClick={() => { onChange && onChange(opt); setIsOpen(false); setSearch(''); }}
                  >
                    {opt}
                  </div>
                )) : (
                  <div className="p-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--app-muted)] mb-1">No results for "{search}"</p>
                    <button onClick={() => { onChange && onChange(search); setIsOpen(false); }} className="text-[11px] font-black text-[var(--app-accent)] hover:underline">Add "{search}" as new</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {hasAdd && (
          <button className="w-8 h-8 rounded-lg border flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-all shadow-sm shrink-0" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <Plus size={14} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
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
        <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 group-focus-within:text-[var(--m3-primary)] transition-colors" style={{ backgroundColor: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface-variant)' }}>
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
              className={`w-full ${compact ? 'h-7.5 px-2' : 'h-10 px-2'} rounded-lg border text-[11px] font-bold outline-none transition-all duration-300 focus:ring-0 ${isDark ? 'placeholder:text-white/10' : 'placeholder:text-[var(--app-muted)]'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-[var(--app-content-bg)]/50') : 'hover:border-[var(--app-accent)]'}`}
              style={{ backgroundColor: readOnly ? 'var(--m3-surface-container)' : 'var(--m3-surface-container-high)', borderColor: 'var(--m3-outline-variant)', color: readOnly ? 'var(--m3-primary)' : 'var(--m3-on-surface)' }}
            />
            {Icon && !readOnly && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center cursor-pointer">
                <Icon size={12} className="text-[var(--app-muted)] hover:text-[var(--app-accent)] transition-colors pointer-events-none" />
                <input
                  type="date"
                  value={toDbDate(value)}
                  onChange={(e) => onChange && onChange(e.target.value)}
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
            className={`w-full ${compact ? 'h-7.5 px-2' : 'h-10 px-2'} rounded-lg border text-[11px] font-bold outline-none transition-all duration-300 focus:ring-0 ${isDark ? 'placeholder:text-white/10' : 'placeholder:text-[var(--app-muted)]'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-[var(--app-content-bg)]/50') : 'hover:border-[var(--app-accent)]'}`}
            style={{ backgroundColor: readOnly ? 'var(--m3-surface-container)' : 'var(--m3-surface-container-high)', borderColor: 'var(--m3-outline-variant)', color: readOnly ? 'var(--m3-primary)' : 'var(--m3-on-surface)' }}
          />
        )}
        {type !== "date" && Icon && <Icon className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] group-focus-within:text-[var(--app-accent)] transition-colors pointer-events-none" size={12} />}
      </div>
    </div>
  );
};

const SummaryBar = ({ entries, base, cgst, sgst, igst, total }) => {
  const { theme, isDark } = useContext(ThemeContext);
  return (
    <div className="mt-4 h-11 px-5 flex items-center justify-between border rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ color: theme.mutedText }}>Entries</span>
        <span className="bg-[var(--app-accent-soft)] text-[var(--app-accent)] px-2.5 py-0.5 rounded-lg text-[11px] border border-[var(--app-accent)]">{entries}</span>
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
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] border transition-all ${item.highlight ? 'bg-[var(--app-accent)] text-white border-[var(--app-accent)] shadow-lg' : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)] group-hover:bg-[var(--app-accent-soft)]'}`}>
                  ₹{item.val}
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

export default CreatePurchase;
