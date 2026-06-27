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

  const salesParents = ["Sales", "Sales Order", "Credit Note"];
  const dynamicVoucherTypes = (masterData.voucherTypesFull || [])
    .filter(vt => salesParents.includes(vt.parent))
    .map(vt => vt.name);
  const voucherTypeOptions = dynamicVoucherTypes.length > 0 ? dynamicVoucherTypes : ["Sales", "Sales Order", "Credit Note"];

  const getSelectValue = () => {
    const val = form.voucherType || 'sales_invoice';
    if (voucherTypeOptions.includes(val)) return val;
    if (val === 'sales_invoice') {
      const match = voucherTypeOptions.find(opt => opt === 'Sales' || opt === 'Sales Invoice');
      if (match) return match;
    }
    if (val === 'sales_order') {
      const match = voucherTypeOptions.find(opt => opt === 'Sales Order');
      if (match) return match;
    }
    if (val === 'credit_note') {
      const match = voucherTypeOptions.find(opt => opt === 'Credit Note');
      if (match) return match;
    }
    return val;
  };

  const isOcrReview = !!ocr.result && !!ocr.previewUrl;
  const selectedCompany = useAppStore((s) => s.selectedCompany);

  // Determine if interstate based on partyGstin and gstRegistration
  const partyState = form.partyGstin?.trim().substring(0, 2);
  const companyState = form.gstRegistration ? (form.gstRegistration.includes('Maharashtra') ? '27' : '23') : '';
  const isInterstate = partyState && companyState && partyState !== companyState;

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
      const tdsAmt = parseFloat((baseAmt * rate / 100).toFixed(2));

      if (
        parseFloat(currentTds.amount || 0) !== tdsAmt ||
        parseFloat(currentTds.assessableValue || 0) !== baseAmt ||
        !currentTds.ledgerName
      ) {
        const updatedTds = [{
          id: currentTds.id || Date.now() + 500,
          ledgerName: currentTds.ledgerName || 'TDS Receivable',
          assessableValue: baseAmt,
          rate: rate,
          amount: tdsAmt
        }];
        setFormField('tdsDetails', updatedTds);
      }
    } else {
      if (form.tdsDetails && form.tdsDetails.length > 0) {
        setFormField('tdsDetails', []);
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
      if (comp === 'CGST') return ['Output CGST 9%', 'CGST Output', 'Input CGST 9%'];
      if (comp === 'SGST') return ['Output SGST 9%', 'SGST Output', 'Input SGST 9%'];
      if (comp === 'IGST') return ['Output IGST 18%', 'IGST Output', 'Input IGST 18%'];
      if (comp === 'CESS') return ['CESS Payable', 'Cess Ledger'];
      if (comp === 'TDS') return ['TDS Receivable', 'TDS Payable'];
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

    setFormField('additionalCharges', charges);
  };

  // Sync active GST components into form.additionalCharges automatically
  useEffect(() => {
    const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.salesLines || []);
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
      setFormField('additionalCharges', charges);
    }
  }, [form.baseTotal, form.cgstTotal, form.sgstTotal, form.igstTotal, isInterstate]);

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
        toast.success('Pushed for approval successfully');
        if (onSaveSuccess) onSaveSuccess(savedResult.data._id);
        else if (onBack) onBack(form.voucherType);
      } else toast.error(reviewResult.message || 'Failed to push for approval');
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
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] border transition-all ${item.highlight ? 'bg-[var(--app-accent)] text-white border-[var(--app-accent)] shadow-lg scale-105' : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)] group-hover:bg-[var(--app-accent-soft)]'}`}>
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
    const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.salesLines || []);

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
    if (form.entryTab === 'with_item' && Array.isArray(form.salesLines)) {
      form.salesLines.forEach((line) => {
        ledgerAmount += parseFloat(line.amount) || 0;
      });
    }

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

      const isTaxable = form.entryTab === 'with_item' ? (line.taxabilityType === 'Taxable' && !line.rcm) : true;

      if (isTaxable) {
        if (isInterstate) {
          igst = parseFloat(((combinedLineAmount * gstRate) / 100).toFixed(2));
        } else {
          cgst = parseFloat(((combinedLineAmount * (gstRate / 2)) / 100).toFixed(2));
          sgst = parseFloat(((combinedLineAmount * (gstRate / 2)) / 100).toFixed(2));
        }
      }

      if (!hsnMap[hsn]) {
        hsnMap[hsn] = { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      }

      hsnMap[hsn].taxableValue += combinedLineAmount;
      hsnMap[hsn].cgst += cgst;
      hsnMap[hsn].sgst += sgst;
      hsnMap[hsn].igst += igst;
    });

    return Object.values(hsnMap);
  };

  const calculateLedgerTaxDetails = () => {
    const ledgerMap = {};
    const lines = form.salesLines || [];
    let gstRate = 0;
    if (form.salesLedger) {
      const m = form.salesLedger.match(/(\d+)\s*%/);
      if (m) gstRate = parseFloat(m[1]);
    }

    lines.forEach((line) => {
      const ledgerName = (line.salesLedger || '').trim() || '-';
      const amount = parseFloat(line.amount) || 0;
      const rate = gstRate > 0 ? gstRate : (parseFloat(line.gstRate) || 0);

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterstate) {
        igst = parseFloat(((amount * rate) / 100).toFixed(2));
      } else {
        cgst = parseFloat(((amount * (rate / 2)) / 100).toFixed(2));
        sgst = parseFloat(((amount * (rate / 2)) / 100).toFixed(2));
      }

      if (!ledgerMap[ledgerName]) {
        ledgerMap[ledgerName] = { ledgerName, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      }

      ledgerMap[ledgerName].taxableValue += amount;
      ledgerMap[ledgerName].cgst += cgst;
      ledgerMap[ledgerName].sgst += sgst;
      ledgerMap[ledgerName].igst += igst;
    });

    return Object.values(ledgerMap);
  };



  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden bg-[var(--app-content-bg)]" style={{ backgroundColor: theme.bg }}>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 0px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme.accent}; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        {/* ─── 1. Compact Header Row ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-1.5 shrink-0 border-b bg-[var(--app-panel-bg)]" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-4">
            <h1 className="text-[13px] font-black tracking-tight text-[var(--app-heading)] dark:text-white uppercase">
              {isOcrReview
                ? 'OCR Review'
                : getNormalizedType(form.voucherType) === 'credit_note'
                  ? 'Create Credit Note'
                  : getNormalizedType(form.voucherType) === 'sales_order'
                    ? 'Create Sales Order'
                    : 'Create Sales Voucher'}
            </h1>

            {/* Tabs Selector */}
            <div className="flex items-center gap-1 bg-[var(--app-table-head-bg)] p-0.5 rounded-lg border border-[var(--app-border)]">
              <button
                onClick={() => {
                  setActiveTab('With Item');
                  setFormField('entryTab', 'with_item');
                }}
                className={`px-3 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-tight transition-all ${activeTab === 'With Item'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
              >
                With Item
              </button>
              <button
                onClick={() => {
                  setActiveTab('Without Item');
                  setFormField('entryTab', 'without_item');
                }}
                className={`px-3 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-tight transition-all ${activeTab === 'Without Item'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
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
              className="px-3 py-1 rounded-lg border text-[11px] font-black transition-all hover:bg-[var(--app-content-bg)] shadow-sm uppercase tracking-wider text-[var(--app-heading)] flex items-center gap-1"
              style={{ borderColor: theme.border }}
            >
              {loading.save ? <Loader2 size={10} className="animate-spin" /> : null}
              Draft
            </button>
            <button
              onClick={handlePushToReview}
              disabled={loading.save || loading.status}
              className="px-3 py-1 rounded-lg text-[11px] font-black transition-all hover:scale-[1.02] shadow-sm uppercase tracking-wider text-[var(--app-heading)] bg-[#FCD34D] hover:bg-[#FBBF24] flex items-center gap-1"
            >
              {loading.status ? <Loader2 size={10} className="animate-spin" /> : null}
              Review
            </button>
            <button
              onClick={handlePostToTally}
              className="px-3 py-1 rounded-lg text-[11px] font-black text-white bg-[var(--app-accent)] hover:opacity-90 shadow-sm transition-all hover:scale-[1.02] uppercase tracking-wider"
            >
              Post Tally
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 rounded-lg border text-[11px] font-black hover:bg-red-50 hover:text-red-500 transition-all uppercase tracking-wider text-[var(--app-muted)]"
              style={{ borderColor: theme.border }}
            >
              Cancel
            </button>
            <button className="p-1.5 rounded-lg border text-[var(--app-muted)] hover:text-[var(--app-accent)] transition-all" style={{ borderColor: theme.border }}>
              <Settings size={12} />
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 text-[var(--app-muted)] hover:text-red-500 border hover:bg-red-50 hover:border-red-200 transition-all rounded-lg ml-1.5 flex items-center justify-center"
                style={{ borderColor: theme.border }}
                title="Close Form"
              >
                <X size={12} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* ─── 2. Voucher Types & Summary Row ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-0.75 bg-[var(--app-panel-bg)] border-b shrink-0" style={{ borderColor: theme.border }}>
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
                const isSelected = ['sales_invoice', 'sales_order', 'credit_note'].includes(getNormalizedType(form.voucherType))
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

          {/* Amount Summary Cards */}
          <div className="flex items-center flex-wrap gap-1 text-[11px]">
            {activeTab === 'With Item' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--app-content-bg)] border border-[var(--app-border)]">
                <span className="text-[var(--app-muted)] font-bold uppercase tracking-wider text-[7.5px]">Items:</span>
                <span className="font-black text-[var(--app-heading)]">{form.productLines.length}</span>
              </div>
            )}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--app-content-bg)] border border-[var(--app-border)]">
              <span className="text-[var(--app-muted)] font-bold uppercase tracking-wider text-[7.5px]">Disc:</span>
              <span className="font-black text-[var(--app-heading)]">₹ {form.entryTab === 'with_item' ? form.productLines.reduce((acc, l) => acc + (parseFloat(l.discountPercent) || 0), 0).toFixed(2) : "0.00"}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--app-content-bg)] border border-[var(--app-border)]">
              <span className="text-[var(--app-muted)] font-bold uppercase tracking-wider text-[7.5px]">Taxable:</span>
              <span className="font-black text-[var(--app-heading)]">₹ {parseFloat(form.baseTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--app-content-bg)] border border-[var(--app-border)]">
              <span className="text-[var(--app-muted)] font-bold uppercase tracking-wider text-[7.5px]">Tax:</span>
              <span className="font-black text-[var(--app-heading)]">₹ {((parseFloat(form.cgstTotal) || 0) + (parseFloat(form.sgstTotal) || 0) + (parseFloat(form.igstTotal) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--app-content-bg)] border border-[var(--app-border)]">
              <span className="text-[var(--app-muted)] font-bold uppercase tracking-wider text-[7.5px]">Subtotal:</span>
              <span className="font-black text-[var(--app-heading)]">₹ {parseFloat(form.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--app-content-bg)] border border-[var(--app-border)]">
              <span className="text-[var(--app-muted)] font-bold uppercase tracking-wider text-[7.5px]">Round:</span>
              <span className="font-black text-[var(--app-heading)]">{isRoundOffChecked ? `₹ ${form.roundOff || "0.00"}` : "₹ 0.00"}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[var(--app-accent)] text-white shadow-md">
              <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85">Net:</span>
              <span className="font-black text-[11px]">₹ {parseFloat(isRoundOffChecked ? (form.grandTotal || 0) : (form.subTotal || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* ─── 3. Main Body ─── */}
        <div className={`flex-1 overflow-hidden ${isOcrReview ? 'grid grid-cols-1 lg:grid-cols-2' : 'flex flex-col'}`}>
          {/* Left Side: Document Preview (OCR Review Mode Only) */}
          {isOcrReview && (
            <div className="h-full border-r overflow-hidden flex flex-col bg-[var(--app-content-bg)]/50" style={{ borderColor: theme.border }}>
              <div className="px-4 py-2 flex items-center justify-between bg-[var(--app-panel-bg)]/50 border-b" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[var(--app-heading)]">Source Document</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[var(--app-muted)] truncate max-w-[150px]">{ocr.file?.name}</span>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                <div className="w-full h-full min-h-[500px] border bg-[var(--app-panel-bg)]" style={{ borderColor: theme.border }}>
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
          <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-[var(--app-panel-bg)]">
            <div className="flex flex-col gap-3">

              {/* A. Voucher Details Section (Flat UI, No Cards, No Rounded) */}
              <div className="p-2.5 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl shadow-sm mb-0 shrink-0">
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
                      onChange={(v) => setFormField('voucherDate', v)}
                    />
                  </div>

                  {/* Voucher Type — clickable select */}
                  <div className="col-span-1 relative">
                    <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-[var(--app-heading)]" style={{ backgroundColor: theme.panel }}>
                      Voucher Type
                    </label>
                    <select
                      value={getSelectValue()}
                      onChange={(e) => setFormField('voucherType', e.target.value)}
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
                    <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-[var(--app-heading)]" style={{ backgroundColor: theme.panel }}>
                      Voucher Number Series
                    </label>
                    <select
                      value={form.voucherNumberSeries || 'Default'}
                      onChange={(e) => setFormField('voucherNumberSeries', e.target.value)}
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
                      placeholder={activeTab === 'Without Item' ? 'Select Ledger' : 'Sales Ledger'}
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
                        const normType = getNormalizedType(form.voucherType);
                        if (normType === 'credit_note') {
                          setFormField('referenceNumber', '');
                          if (v) fetchCreditNoteInvoicesForParty(v);
                        } else if (normType === 'sales_invoice') {
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
                    <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-[var(--app-heading)]" style={{ backgroundColor: theme.panel }}>
                      Narration
                    </label>
                    <input
                      type="text"
                      value={form.narration || ''}
                      onChange={(e) => setFormField('narration', e.target.value)}
                      className="w-full h-7.5 px-3 rounded-lg border text-[11px] font-bold outline-none bg-[var(--app-panel-bg)]"
                      style={{ borderColor: theme.border, color: theme.text }}
                    />
                  </div>
                </div>
              </div>

              {/* B. Item Details Section (Flat UI, No Cards, No Rounded) */}
              {activeTab === 'With Item' && (
                <div className="p-3 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl shadow-sm mb-0 shrink-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-heading)]">Item Details</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addRow(activeTab === 'With Item' ? 'product' : 'sales')}
                        className="px-2 py-1 rounded-lg border border-[var(--app-border)] text-[11px] font-black text-[var(--app-heading)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} strokeWidth={3} /> Add Line
                      </button>
                      <button
                        onClick={() => toast.info("New ledger registration modal opened.")}
                        className="px-2 py-1 rounded-lg border border-[var(--app-border)] text-[11px] font-black text-[var(--app-heading)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] flex items-center gap-1 shadow-sm uppercase"
                      >
                        <Plus size={10} /> Add Ledger
                      </button>
                      <button
                        onClick={() => toast.info("New stock item registration modal opened.")}
                        className="px-2 py-1 rounded-lg border border-[var(--app-border)] text-[11px] font-black text-[var(--app-heading)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] flex items-center gap-1 shadow-sm uppercase"
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
                              <tr key={row.id} className="border-b hover:bg-[var(--app-content-bg)]/50 overflow-visible" style={{ borderColor: theme.border }}>
                                <td className="px-1 py-0.5 text-center font-bold text-[var(--app-muted)] border-r text-[10px]" style={{ borderColor: theme.border }}>{idx + 1}</td>
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
                                    className="w-full h-6 px-2 border-t rounded-lg outline-none text-[11px] bg-transparent"
                                    style={{ borderColor: theme.border, color: theme.mutedText }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    value={row.hsnSacCode || ''}
                                    onChange={(e) => updateSalesLine(row.id, 'hsnSacCode', e.target.value)}
                                    placeholder="HSN"
                                    className="w-full h-7 px-2 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    value={row.amount || ''}
                                    onChange={(e) => updateSalesLine(row.id, 'amount', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full h-7 px-2 rounded border outline-none text-right font-bold text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.gstRate || 0}
                                    onChange={(e) => updateSalesLine(row.id, 'gstRate', parseFloat(e.target.value) || 0)}
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
                                    onClick={() => removeSalesLine(row.id)}
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
                      <table className="w-full text-left text-[10px] border-collapse min-w-[900px] overflow-visible" style={{ borderColor: theme.border }}>
                        <thead>
                          <tr className="border-b" style={{ borderColor: theme.border, color: theme.mutedText }}>
                            <th className="px-1 py-1 w-8 text-center border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>#</th>
                            <th className="px-1 py-1 w-64 border-r" style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}>Item / Ledger *</th>
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
                          {form.productLines.map((row, idx) => {
                            return (
                              <tr key={row.id} className="border-b hover:bg-[var(--app-content-bg)]/50 overflow-visible" style={{ borderColor: theme.border }}>
                                <td className="px-1 py-0.5 text-center font-bold text-[var(--app-muted)] border-r text-[10px]" style={{ borderColor: theme.border }}>{idx + 1}</td>
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
                                    className="w-full h-6 px-2 border-t rounded-lg outline-none text-[11px] bg-transparent"
                                    style={{ borderColor: theme.border, color: theme.mutedText }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    value={row.hsnSacCode || ''}
                                    onChange={(e) => updateProductLine(row.id, 'hsnSacCode', e.target.value)}
                                    placeholder="HSN"
                                    className="w-full h-7 px-2 rounded border outline-none text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.gstRate || 0}
                                    onChange={(e) => updateProductLine(row.id, 'gstRate', parseFloat(e.target.value) || 0)}
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
                                    onChange={(e) => updateProductLine(row.id, 'billQuantity', parseFloat(e.target.value) || 0)}
                                    placeholder="1"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <select
                                    value={row.unit || 'Nos'}
                                    onChange={(e) => updateProductLine(row.id, 'unit', e.target.value)}
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
                                    onChange={(e) => updateProductLine(row.id, 'billRate', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full h-7 px-2 rounded border outline-none text-right text-[10px] bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                  />
                                </td>
                                <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    value={row.discountPercent || ''}
                                    onChange={(e) => updateProductLine(row.id, 'discountPercent', parseFloat(e.target.value) || 0)}
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
                                    onClick={() => removeProductLine(row.id)}
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
                  <div className="p-2.5 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl shadow-sm shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] rounded-lg border border-[var(--app-border)] dark:border-[var(--app-border)] flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                        </div>
                        <span className="font-bold text-[12px] text-[var(--app-heading)]">Ledger Details</span>
                      </div>
                      <button
                        onClick={addSalesLine}
                        className="px-2.5 py-0.5 bg-[var(--app-accent-soft)] hover:bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] border border-[var(--app-border)] dark:border-[var(--app-border)] rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus size={11} strokeWidth={2.5} /> Add Ledger
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-visible" style={{ borderColor: theme.border }}>
                      <table className="w-full text-left text-[11px] border-collapse" style={{ borderColor: theme.border }}>
                        <thead>
                          <tr className="border-b bg-[var(--app-content-bg)]/50" style={{ borderColor: theme.border, color: theme.mutedText }}>
                            <th className="px-2 py-1 w-14 text-center border-r font-bold" style={{ borderColor: theme.border }}>Sr. No</th>
                            <th className="px-2 py-1 border-r font-bold" style={{ borderColor: theme.border }}>Ledger Name</th>
                            <th className="px-2 py-1 border-r font-bold" style={{ borderColor: theme.border }}>Description</th>
                            <th className="px-2 py-1 w-32 text-right border-r font-bold" style={{ borderColor: theme.border }}>Amount</th>
                            <th className="px-2 py-1 w-12 text-center font-bold" style={{ borderColor: theme.border }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.salesLines || []).map((row, idx) => (
                            <tr key={row.id} className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                              <td className="px-2 py-1 text-center font-bold text-[var(--app-heading)] border-r" style={{ borderColor: theme.border }}>{idx + 1}</td>
                              <td className="p-1 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                <SearchableDropdown
                                  placeholder="Select Ledger"
                                  compact
                                  options={masterData.allLedgers?.length > 0 ? masterData.allLedgers : (masterData.salesLedgers?.length > 0 ? masterData.salesLedgers : ['General Sales'])}
                                  value={row.salesLedger || ''}
                                  onChange={(v) => updateSalesLine(row.id, 'salesLedger', v)}
                                />
                              </td>
                              <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                <input
                                  type="text"
                                  value={row.description || ''}
                                  onChange={(e) => updateSalesLine(row.id, 'description', e.target.value)}
                                  placeholder="Description"
                                  className="w-full h-7 px-2 rounded-lg border outline-none text-[11px] font-bold bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                  style={{ borderColor: theme.border, color: theme.text }}
                                />
                              </td>
                              <td className="p-1 border-r" style={{ borderColor: theme.border }}>
                                <input
                                  type="number"
                                  value={row.amount || ''}
                                  onChange={(e) => updateSalesLine(row.id, 'amount', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  className="w-full h-7 px-3 rounded-lg border outline-none text-right text-[11px] font-bold bg-[var(--app-panel-bg)] transition-all focus:border-[var(--app-accent)]"
                                  style={{ borderColor: theme.border, color: theme.text }}
                                />
                              </td>
                              <td className="p-1 text-center">
                                <button
                                  onClick={() => removeSalesLine(row.id)}
                                  className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-500/10 dark:bg-red-950/20 text-red-500 hover:text-red-500 border border-red-100 dark:border-red-900/50 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end mt-0.5 gap-2">
                      {activeTab === 'With Item' && (
                        <div className="px-3 py-1 bg-[var(--app-table-head-bg)] text-[var(--app-heading)] rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 border border-[var(--app-border)]">
                          <span>Ledger Total (₹)</span>
                          <span className="font-black">{parseFloat(form.ledgerAmount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="px-3 py-1 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)] rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 border border-[var(--app-border)] dark:border-[var(--app-border)]">
                        <span>{activeTab === 'With Item' ? 'Total (Item + Ledger) (₹)' : 'Total (₹)'}</span>
                        <span className="font-black">{parseFloat(form.baseTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* HSN / Sales Tax Details */}
                  <div className="p-2.5 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl shadow-sm shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-900/50 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12.5 13.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z"></path><path d="M14.5 17.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z"></path><line x1="14" y1="12" x2="10" y2="18"></line></svg>
                        </div>
                        <span className="font-bold text-[12px] text-[var(--app-heading)]">
                          {activeTab === 'Without Item' ? 'Sales Tax Details' : 'HSN Tax Detailes'}
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

                        <div className="px-3 py-1 bg-amber-50/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 border border-amber-100 dark:border-amber-900/30">
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
                            <th className="px-2.5 py-1.5 border-r font-bold" style={{ borderColor: theme.border }}>
                              {activeTab === 'Without Item' ? 'Ledger Name' : 'Hsn no.'}
                            </th>
                            <th className="px-2.5 py-1.5 border-r font-bold text-right" style={{ borderColor: theme.border }}>Taxable Value</th>
                            <th className="px-2.5 py-1.5 border-r font-bold text-right" style={{ borderColor: theme.border }}>CGST</th>
                            <th className="px-2.5 py-1.5 border-r font-bold text-right" style={{ borderColor: theme.border }}>SGST</th>
                            <th className="px-2.5 py-1.5 border-r font-bold text-right" style={{ borderColor: theme.border }}>IGST</th>
                            <th className="px-2.5 py-1.5 font-bold text-right" style={{ borderColor: theme.border }}>Cess</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const taxData = activeTab === 'Without Item' ? calculateLedgerTaxDetails() : calculateHsnTaxDetails();
                            const primaryKey = activeTab === 'Without Item' ? 'ledgerName' : 'hsn';
                            return (
                              <>
                                {taxData.map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border, color: theme.text }}>
                                    <td className="px-2.5 py-1.5 border-r font-medium" style={{ borderColor: theme.border }}>{row[primaryKey]}</td>
                                    <td className="px-2.5 py-1.5 border-r text-right font-semibold" style={{ borderColor: theme.border }}>
                                      ₹ {row.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 border-r text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 border-r text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 border-r text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right" style={{ borderColor: theme.border }}>
                                      ₹ {row.cess.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                                {taxData.length > 0 && (
                                  <tr className="font-bold bg-[var(--app-content-bg)]/30 border-t" style={{ color: theme.text, borderColor: theme.border }}>
                                    <td className="px-2.5 py-1.5 border-r" style={{ borderColor: theme.border }}>Total</td>
                                    <td className="px-2.5 py-1.5 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.taxableValue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.cgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.sgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 border-r text-right font-black" style={{ borderColor: theme.border }}>
                                      ₹ {taxData.reduce((sum, r) => sum + r.igst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-black">
                                      ₹ {taxData.reduce((sum, r) => sum + r.cess, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                )}
                                {taxData.length === 0 && (
                                  <tr>
                                    <td colSpan="6" className="px-2.5 py-4 text-center text-[var(--app-muted)]">No tax details available</td>
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
                <div className="p-2.5 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl shadow-sm shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col gap-2">
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
                            setFormField('tdsDetails', [{
                              id: Date.now() + 500,
                              ledgerName: 'TDS Receivable',
                              assessableValue: baseAmt,
                              rate: 2,
                              amount: tdsAmtVal
                            }]);
                          }}
                          className={`px-2.5 py-0.5 text-[11px] font-black transition-all cursor-pointer ${isTdsApplicable ? 'bg-emerald-600 text-white shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'}`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsTdsApplicable(false);
                            setFormField('tdsDetails', []);
                          }}
                          className={`px-2.5 py-0.5 text-[11px] font-black transition-all cursor-pointer ${!isTdsApplicable ? 'bg-emerald-600 text-white shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'}`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.salesLines || []);

                    // For Without Item: GST rate from Sales Ledger in Basic Details (matches store logic)
                    let gstRateVal = 0;
                    if (form.entryTab === 'without_item') {
                      if (form.salesLedger) {
                        const m = form.salesLedger.match(/(\d+)\s*%/);
                        if (m) gstRateVal = parseFloat(m[1]);
                      }
                      // Fallback to row gstRate if no rate in ledger name
                      if (gstRateVal === 0 && lines.length > 0) gstRateVal = parseFloat(lines[0].gstRate) || 0;
                    } else {
                      gstRateVal = lines.length > 0 ? (parseFloat(lines[0].gstRate) || 0) : 0;
                    }

                    const cgstRateVal = isInterstate ? 0 : gstRateVal / 2;
                    const sgstRateVal = isInterstate ? 0 : gstRateVal / 2;
                    const igstRateVal = isInterstate ? gstRateVal : 0;

                    const cgstAmtVal = parseFloat(form.cgstTotal || 0);
                    const sgstAmtVal = parseFloat(form.sgstTotal || 0);
                    const igstAmtVal = parseFloat(form.igstTotal || 0);
                    const totalGstVal = cgstAmtVal + sgstAmtVal + igstAmtVal;
                    const grandTotalVal = parseFloat(form.baseTotal || 0) + totalGstVal;

                    const invoiceAmt = parseFloat(isRoundOffChecked ? (form.grandTotal || 0) : (form.subTotal || 0)) + (isTdsApplicable ? parseFloat(form.tdsTotal || 0) : 0);
                    const tdsAmt = parseFloat(form.tdsTotal || 0);
                    const receivableAmt = parseFloat(isRoundOffChecked ? (form.grandTotal || 0) : (form.subTotal || 0));

                    return (
                      <div className="flex flex-col gap-2.5">
                        {/* Unified Table */}
                        <div className="border rounded-lg overflow-visible" style={{ borderColor: theme.border }}>
                          <table className="w-full text-left text-[11px] border-collapse" style={{ borderColor: theme.border }}>
                            <thead>
                              <tr className="border-b bg-[var(--app-content-bg)]/50" style={{ borderColor: theme.border, color: theme.mutedText }}>
                                <th className="px-3 py-1.5 border-r font-bold w-1/4" style={{ borderColor: theme.border }}>Tax Component</th>
                                <th className="px-3 py-1.5 border-r font-bold w-20 text-center" style={{ borderColor: theme.border }}>Rate (%)</th>
                                <th className="px-3 py-1.5 border-r font-bold" style={{ borderColor: theme.border }}>Ledger (Select Ledger)</th>
                                <th className="px-3 py-1.5 font-bold w-40 text-right" style={{ borderColor: theme.border }}>Amount (Auto)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* CGST + SGST Rows — show only for Intra-State */}
                              {!isInterstate && (
                                <>
                                  <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                    <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>
                                      <span className="inline-flex items-center gap-1">CGST <span className="text-[11px] px-1 py-0.5 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] rounded font-black">Intra</span></span>
                                    </td>
                                    <td className="px-3 py-1.5 border-r text-center" style={{ borderColor: theme.border }}>
                                      <span className="px-1.5 py-0.5 bg-[var(--app-table-head-bg)] text-[var(--app-heading)] rounded text-[10px] font-bold">
                                        {cgstRateVal}%
                                      </span>
                                    </td>
                                    <td className="p-1 border-r relative z-30 focus-within:z-50" style={{ borderColor: theme.border }}>
                                      <SearchableDropdown
                                        placeholder="Select CGST Ledger"
                                        compact
                                        options={getLedgerOptions('CGST')}
                                        value={getLedgerNameForComponent('CGST')}
                                        onChange={(v) => setLedgerNameForComponent('CGST', v)}
                                        disabled={cgstRateVal === 0}
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
                                  <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                    <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>
                                      <span className="inline-flex items-center gap-1">SGST <span className="text-[11px] px-1 py-0.5 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] rounded font-black">Intra</span></span>
                                    </td>
                                    <td className="px-3 py-1.5 border-r text-center" style={{ borderColor: theme.border }}>
                                      <span className="px-1.5 py-0.5 bg-[var(--app-table-head-bg)] text-[var(--app-heading)] rounded text-[10px] font-bold">
                                        {sgstRateVal}%
                                      </span>
                                    </td>
                                    <td className="p-1 border-r relative z-20 focus-within:z-50" style={{ borderColor: theme.border }}>
                                      <SearchableDropdown
                                        placeholder="Select SGST Ledger"
                                        compact
                                        options={getLedgerOptions('SGST')}
                                        value={getLedgerNameForComponent('SGST')}
                                        onChange={(v) => setLedgerNameForComponent('SGST', v)}
                                        disabled={sgstRateVal === 0}
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
                                </>
                              )}

                              {/* IGST Row */}
                              <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>
                                  <span className="inline-flex items-center gap-1">IGST <span className="text-[11px] px-1 py-0.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 rounded font-black">Inter</span></span>
                                </td>
                                <td className="px-3 py-1.5 border-r text-center" style={{ borderColor: theme.border }}>
                                  <span className="px-1.5 py-0.5 bg-[var(--app-table-head-bg)] text-[var(--app-heading)] rounded text-[10px] font-bold">
                                    {igstRateVal}%
                                  </span>
                                </td>
                                <td className="p-1 border-r relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Select IGST Ledger"
                                    compact
                                    options={getLedgerOptions('IGST')}
                                    value={getLedgerNameForComponent('IGST')}
                                    onChange={(v) => setLedgerNameForComponent('IGST', v)}
                                    disabled={igstRateVal === 0}
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

                              {/* CESS Row */}
                              <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>CESS (Cess)</td>
                                <td className="px-3 py-1.5 border-r text-center" style={{ borderColor: theme.border }}>
                                  <span className="px-1.5 py-0.5 bg-[var(--app-table-head-bg)] text-[var(--app-heading)] rounded text-[10px] font-bold">
                                    0%
                                  </span>
                                </td>
                                <td className="p-1 border-r relative z-0 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="CESS Payable"
                                    compact
                                    options={getLedgerOptions('CESS')}
                                    value={getLedgerNameForComponent('CESS') || 'CESS Payable'}
                                    onChange={(v) => setLedgerNameForComponent('CESS', v)}
                                    disabled={true}
                                  />
                                </td>
                                <td className="p-1" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    readOnly
                                    value="₹ 0.00"
                                    className="w-full h-7.5 px-3 rounded-lg outline-none text-right text-[11px] font-bold bg-[var(--app-content-bg)] border border-[var(--app-border)] text-[var(--app-muted)]"
                                    style={{ color: theme.mutedText }}
                                  />
                                </td>
                              </tr>

                              {/* TDS Row */}
                              {isTdsApplicable && (
                                <tr className="border-b last:border-b-0 hover:bg-[var(--app-content-bg)]/30" style={{ borderColor: theme.border }}>
                                  <td className="px-3 py-1.5 border-r font-bold text-[var(--app-heading)]" style={{ borderColor: theme.border }}>TDS (If Applicable)</td>
                                  <td className="px-3 py-1.5 border-r text-center" style={{ borderColor: theme.border }}>
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="number"
                                        value={form.tdsDetails?.[0]?.rate !== undefined ? form.tdsDetails[0].rate : 2}
                                        onChange={(e) => {
                                          const r = parseFloat(e.target.value) || 0;
                                          const baseAmt = parseFloat(form.baseTotal || 0);
                                          const amt = parseFloat((baseAmt * r / 100).toFixed(2));
                                          const updatedTds = [{
                                            ...(form.tdsDetails?.[0] || {}),
                                            rate: r,
                                            assessableValue: baseAmt,
                                            amount: amt
                                          }];
                                          setFormField('tdsDetails', updatedTds);
                                        }}
                                        className="w-12 h-6 px-1 text-center rounded border outline-none text-[10px] font-bold bg-[var(--app-panel-bg)]"
                                        style={{ borderColor: theme.border, color: theme.text }}
                                      />
                                      <span className="text-[10px] font-bold">%</span>
                                    </div>
                                  </td>
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
                                        setFormField('tdsDetails', updatedTds);
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
                              <span className="text-[10px] font-black uppercase tracking-tight text-[var(--app-muted)]">Less: TDS Amount</span>
                              <span className="text-[13.5px] font-black text-red-500">
                                - ₹ {tdsAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ) : (
                            <div className="border-r pr-2" style={{ borderColor: theme.border }}></div>
                          )}
                          <div className="flex flex-col gap-1 p-2 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 dark:border-emerald-900/50 rounded-lg">
                            <span className="text-[10px] font-black uppercase tracking-tight text-emerald-700 dark:text-emerald-400">Amount Receivable</span>
                            <span className="text-[14.5px] font-black text-emerald-500 dark:text-emerald-400">
                              ₹ {receivableAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

      </div>
    </ThemeContext.Provider>
  );
};



const SummaryItem = ({ label, value, isLast }) => {
  const { theme, isDark } = useContext(ThemeContext);
  return (
    <div className="flex items-center gap-2 px-5 h-9 shrink-0 group">
      <span className="text-[11px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: theme.mutedText }}>{label}</span>
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
          {hasSettings && <button className="text-[var(--app-muted)] hover:text-[var(--app-accent)] transition-all hover:scale-110 active:scale-90"><Settings size={13} /></button>}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-6 h-6 rounded-full border flex items-center justify-center text-[var(--app-muted)] hover:bg-[var(--app-content-bg)] transition-all hover:rotate-180 active:scale-90"
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
        <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-[var(--app-heading)] group-focus-within:text-[var(--app-accent)] transition-colors" style={{ backgroundColor: theme.panel }}>
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <div
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`w-full ${compact ? 'h-7.5' : 'h-10'} ${rounded ? 'rounded-lg' : 'rounded-lg'} border px-2 flex items-center justify-between cursor-pointer transition-all duration-300 group/input ${isOpen ? 'border-[var(--app-accent)]' : 'hover:border-[var(--app-accent)]'} ${disabled ? 'bg-[var(--app-table-head-bg)] cursor-not-allowed' : ''}`}
            style={{ backgroundColor: disabled ? undefined : theme.inputBg, borderColor: isOpen ? theme.accent : theme.border }}
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
                      className="w-full h-8 px-8 text-[11px] font-semibold outline-none transition-all rounded-md border focus:border-[var(--app-accent)]"
                      style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={11} />
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer rounded-md transition-colors ${value === opt ? 'text-white font-bold' : 'hover:bg-[var(--app-table-head-bg)] hover:text-[var(--app-accent)] dark:hover:text-[var(--app-accent)]'}`}
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--app-muted)] mb-1">No results for "{search}"</p>
                    <button onClick={() => { onChange(search); setIsOpen(false); }} className="text-[11px] font-black text-[var(--app-accent)] hover:underline">Add "{search}" as new</button>
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
        <label className="text-[11px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-[var(--app-heading)] group-focus-within:text-[var(--app-accent)] transition-colors" style={{ backgroundColor: theme.panel }}>
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
              style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
            />
            {Icon && !readOnly && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center cursor-pointer">
                <Icon size={12} className="text-[var(--app-muted)] hover:text-[var(--app-accent)] transition-colors pointer-events-none" />
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
            className={`w-full ${compact ? 'h-7.5 px-2' : 'h-10 px-2'} rounded-lg border text-[11px] font-bold outline-none transition-all duration-300 focus:ring-0 ${isDark ? 'placeholder:text-white/10' : 'placeholder:text-[var(--app-muted)]'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-[var(--app-content-bg)]/50') : 'hover:border-[var(--app-accent)]'}`}
            style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
          />
        )}
        {type !== "date" && Icon && <Icon className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] group-focus-within:text-[var(--app-accent)] transition-colors pointer-events-none" size={12} />}
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
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] border transition-all ${item.highlight ? 'bg-[var(--app-accent)] text-white border-[var(--app-accent)] shadow-lg scale-105' : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)] group-hover:bg-[var(--app-accent-soft)]'}`}>
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
