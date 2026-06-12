import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  Save,
  Send,
  Calendar,
  ChevronDown,
  Plus,
  Minus,
  Layout,
  Settings,
  X,
  Search,
  BookText,
  List,
  FileText,
  Clock,
  User,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import usePurchaseStore from '../../stores/usePurchaseStore';
import { useAppStore } from '../../stores/useAppStore';

const ThemeContext = createContext(null);

const CreatePurchase = ({ isDark, onBack, voucherType }) => {
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

  const selectedCompany = useAppStore((s) => s.selectedCompany);

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
      const effectiveType = (voucherType && voucherType !== 'purchase') ? voucherType : 'purchase_invoice';
      fetchNextInvoiceNumber(effectiveType);
    }
  }, [voucherType, form._id, form.voucherNumberSeries]);

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
      if (onBack) onBack();
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
        toast.success('Pushed to review successfully');
        if (onBack) onBack();
      } else {
        toast.error(reviewResult.message || 'Failed to push to review');
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
    accent: 'var(--app-accent, #4f46e5)',
    accentSoft: isDark ? 'rgba(79, 70, 229, 0.2)' : '#eef2ff',
    accentGradient: 'var(--app-accent-gradient, linear-gradient(135deg, #4f46e5 0%, #6366f1 100%))',
    scrollbarThumb: isDark ? '#475569' : '#cbd5e1',
    scrollbarTrack: isDark ? '#1e293b' : '#f1f5f9'
  };

  // Helper components and date functions moved outside to prevent focus loss on typing

  const renderLedgerModal = () => {
    if (!isLedgerModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-xl shadow-2xl w-[600px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
          <button onClick={() => setIsLedgerModalOpen(false)} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full border text-slate-400 hover:text-red-500 transition-colors" style={{ borderColor: theme.border }}>
            <X size={16} />
          </button>
          <h2 className="text-[14px] font-black text-indigo-600 mb-8 tracking-tight">Add Ledger</h2>
          
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
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600 cursor-pointer" defaultChecked />
                    <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors" style={{ color: theme.text }}>Maintain Balance Bill by Bill</span>
                  </label>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-center mt-6">
            <button onClick={() => setIsLedgerModalOpen(false)} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black tracking-wide rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
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
        <div className="bg-white rounded-xl shadow-2xl w-[700px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
          <button onClick={() => setIsStockModalOpen(false)} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full border text-slate-400 hover:text-red-500 transition-colors" style={{ borderColor: theme.border }}>
            <X size={16} />
          </button>
          <h2 className="text-[14px] font-black text-indigo-600 mb-8 tracking-tight">Add Stock Ledger</h2>
          
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
              <input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600 cursor-pointer" />
              <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors" style={{ color: theme.text }}>RCM Applicable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group mt-1 pl-1">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600 cursor-pointer" />
              <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors" style={{ color: theme.text }}>ITC Ineligible</span>
            </label>
          </div>
          <div className="flex justify-center mt-6">
            <button onClick={() => setIsStockModalOpen(false)} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black tracking-wide rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      <div className="flex flex-col gap-2 h-full animate-in fade-in duration-500 overflow-hidden" style={{ backgroundColor: theme.bg }}>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme.accent}; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top Action Bar (Save/Approve) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 shrink-0 border-b" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <h1 className="text-[14px] font-black tracking-tight uppercase" style={{ color: theme.accent }}>Purchase Entry Engine</h1>
          <div className="flex gap-2.5">
            <button onClick={handleSaveDraft} disabled={loading.save} className="flex items-center gap-2 px-5 py-2 rounded-xl border text-[10px] font-black shadow-sm transition-all hover:scale-[1.03] active:scale-[0.97] hover:shadow-md" style={{ borderColor: theme.accent, color: theme.accent, backgroundColor: isDark ? 'rgba(79, 70, 229, 0.05)' : '#fff' }}>
              <Save size={13} strokeWidth={3} /> SAVE DRAFT
            </button>
            <button onClick={handlePushToReview} disabled={loading.save} className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black shadow-lg transition-all hover:scale-[1.03] active:scale-[0.97] hover:shadow-indigo-500/20 text-white" style={{ background: theme.accentGradient }}>
              <Send size={13} strokeWidth={3} /> PUSH TO REVIEW
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Add Ledger and Add Stock Ledger Buttons */}
          <button onClick={() => setIsLedgerModalOpen(true)} className="p-2 rounded-xl border text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50" style={{ borderColor: theme.border, backgroundColor: theme.panel }}><BookText size={15} strokeWidth={2.5} /></button>
          <button onClick={() => setIsStockModalOpen(true)} className="p-2 rounded-xl border text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50" style={{ borderColor: theme.border, backgroundColor: theme.panel }}><List size={15} strokeWidth={2.5} /></button>
          
          <button className="p-2 rounded-xl border text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50" style={{ borderColor: theme.border, backgroundColor: theme.panel }}><Layout size={15} /></button>
          <button onClick={onBack} className="p-2 rounded-xl border text-slate-400 hover:text-red-500 transition-all hover:bg-red-50" style={{ borderColor: theme.border, backgroundColor: theme.panel }}><X size={15} /></button>
        </div>
      </div>

      {/* Totals Row */}
      <div className="flex items-center border shadow-sm shrink-0 overflow-x-auto no-scrollbar py-1 rounded-xl mx-2" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <SummaryItem label="BaseTotal" value={`₹${form.baseTotal || '0.00'}`} />
        <SummaryItem label="SubTotal" value={`₹${form.subTotal || '0.00'}`} />
        <SummaryItem label="CGST" value={`₹${form.cgstTotal || '0.00'}`} />
        <SummaryItem label="SGST" value={`₹${form.sgstTotal || '0.00'}`} />
        <SummaryItem label="IGST" value={`₹${form.igstTotal || '0.00'}`} />
        <SummaryItem label="Round-off" value={`₹${form.roundOff || '0.00'}`} />
        <SummaryItem label="Grand Total" value={`₹${form.grandTotal || '0.00'}`} isLast />
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b shrink-0 px-2 mt-1" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        {['Without Item Invoice', 'With Item Invoice'].map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 py-3 text-[11px] font-black tracking-tight transition-all relative ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-indigo-600 rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 px-2 pb-10 mt-2">
        {/* Basic Details */}
        <FormSection title="Basic Details" zIndex={100}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6">
            {/* ── Debit Note: show these FIRST in Basic Details ── */}
            {form.voucherType === 'debit_note' && (
              <>
                <InputField
                  label="Debit Note Date"
                  icon={Calendar}
                  type="date"
                  value={form.debitNoteDate || ''}
                  onChange={(v) => updateForm({ debitNoteDate: v })}
                />
                <SearchableDropdown
                  label="Party Ledger"
                  placeholder="Select Party Ledger"
                  hasAdd
                  options={masterData.partyLedgers?.length > 0 ? masterData.partyLedgers : []}
                  value={form.partyLedger || ''}
                  onChange={(v) => {
                    updateForm({ partyLedger: v, referenceNumber: '' });
                    if (v) fetchPurchaseInvoicesForParty(v);
                    if (v && masterData.partyLedgerDetails && masterData.partyLedgerDetails[v]) {
                      const details = masterData.partyLedgerDetails[v];
                      updateForm({
                        partyGstin: details.gstin || '',
                        gstRegistration: details.gstState ? `${details.gstState} Registration` : '',
                        gstRegistrationType: details.registrationType || ''
                      });
                    } else {
                      updateForm({
                        partyGstin: '',
                        gstRegistration: '',
                        gstRegistrationType: ''
                      });
                    }
                  }}
                />
                <SearchableDropdown
                  label="Reference Number (Purchase Invoice)"
                  placeholder={form.partyLedger ? 'Select Purchase Invoice' : 'Select Party First'}
                  options={masterData.debitNoteInvoices || []}
                  value={form.referenceNumber || ''}
                  onChange={(v) => {
                    updateForm({ referenceNumber: v });
                    if (v) autofillFromPurchaseInvoice(v);
                  }}
                />
                <InputField
                  label="Party GSTIN"
                  placeholder="Party GSTIN"
                  value={form.partyGstin || ''}
                  onChange={(v) => updateForm({ partyGstin: v })}
                />
              </>
            )}

            {/* ── Common Fields ── */}
            <InputField label="Invoice Date" type="date" icon={Calendar} placeholder="Invoice Date" value={form.invoiceDate || ''} onChange={(val) => updateForm({ invoiceDate: val })} />
            <InputField label="Voucher Date" type="date" icon={Calendar} placeholder="Voucher Date" value={form.voucherDate || ''} onChange={(val) => updateForm({ voucherDate: val })} />
            <SearchableDropdown 
              label="Voucher Type" 
              placeholder="Purchase" 
              options={getVoucherTypeOptions()} 
              value={getDisplayVoucherType(form.voucherType)} 
              onChange={(val) => {
                const targetType = getDbVoucherType(val);
                updateForm({ voucherType: targetType });
                if (!form._id) {
                  fetchNextInvoiceNumber(targetType);
                }
              }} 
            />
            <SearchableDropdown label="Voucher Number Series" placeholder="Default" options={['Default', 'Manual']} value={form.voucherNumberSeries} onChange={(val) => updateForm({ voucherNumberSeries: val })} />
            <InputField 
              label="Voucher Number" 
              placeholder={form.voucherNumberSeries === 'Default' ? "Auto-generated" : "Enter Voucher Number"} 
              value={form.voucherNumber || ''} 
              readOnly={form.voucherNumberSeries === 'Default'} 
              onChange={(val) => updateForm({ voucherNumber: val })}
            />

            {/* Party Ledger, PO Number, and Party GSTIN for non-debit_note */}
            {form.voucherType !== 'debit_note' && (
              <>
                <SearchableDropdown 
                  label="Party Ledger" 
                  placeholder="Party Ledger" 
                  hasAdd 
                  options={masterData.partyLedgers?.length > 0 ? masterData.partyLedgers : ['HDFC Bank', 'Cash', 'General Supplier']} 
                  value={form.partyLedger || ''} 
                  onChange={(val) => {
                    updateForm({ partyLedger: val });
                    if (form.voucherType === 'purchase_invoice') {
                      fetchPurchaseOrdersForParty(val);
                      updateForm({ poNumber: '' });
                    }
                    if (val && masterData.partyLedgerDetails && masterData.partyLedgerDetails[val]) {
                      const details = masterData.partyLedgerDetails[val];
                      updateForm({
                        partyGstin: details.gstin || '',
                        gstRegistration: details.gstState ? `${details.gstState} Registration` : '',
                        gstRegistrationType: details.registrationType || ''
                      });
                    } else {
                      updateForm({
                        partyGstin: '',
                        gstRegistration: '',
                        gstRegistrationType: ''
                      });
                    }
                  }} 
                />

                {form.voucherType === 'purchase_invoice' ? (
                  <SearchableDropdown
                    label="Reference PO Number"
                    placeholder="Select PO Number"
                    options={masterData.purchaseOrders || []}
                    value={form.poNumber || ''}
                    onChange={(val) => {
                      updateForm({ poNumber: val });
                      if (val) autofillFromPurchaseOrder(val);
                    }}
                  />
                ) : (
                  <InputField label="PO Number" placeholder="PO Number" value={form.poNumber || ''} onChange={(val) => updateForm({ poNumber: val })} />
                )}

                <InputField label="Party GSTIN" placeholder="Party GSTIN" value={form.partyGstin || ''} onChange={(val) => updateForm({ partyGstin: val })} />
              </>
            )}

            <SearchableDropdown label="Consignee Ledger" placeholder="Consignee Ledger" hasAdd options={['Same as Party', ...(masterData.partyLedgers || [])]} value={form.consigneeLedger || 'Same as Party'} onChange={(val) => updateForm({ consigneeLedger: val })} />
          </div>
        </FormSection>

        {/* Dynamic Table Section based on Tab */}
        {activeTab === 'Without Item Invoice' && (
          <FormSection title="Purchase/ Expense Details" zIndex={90} headerAction={<button onClick={() => addRow('purchase')} className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><Plus size={12} strokeWidth={3} /></button>}>
            <div className="overflow-x-auto custom-scrollbar pb-32">
              <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[800px]">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-2 w-10"></th>
                    <th className="px-2 w-16 text-center">Sr. No.</th>
                    <th className="px-2 min-w-[200px]">Purchase/ Expense Ledger</th>
                    <th className="px-2">Description</th>
                    <th className="px-2">HSN/SAC Code</th>
                    <th className="px-2">GST Rate</th>
                    <th className="px-2 text-right pr-10">Amount</th>
                    <th className="px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {(form.purchaseLines || []).map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-2"><div className="w-7 h-7 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm"><Layout size={12} /></div></td>
                      <td className="px-2"><div className="h-9 w-full rounded-lg border flex items-center justify-center font-bold text-slate-500" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>{row.srNo}</div></td>
                      <td className="px-2"><SearchableDropdown placeholder="Select Ledger" compact options={masterData.purchaseLedgers?.length > 0 ? masterData.purchaseLedgers : ['General Purchase']} value={row.purchaseLedger || ''} onChange={(val) => {
                        const match = val.match(/(\d+(?:\.\d+)?)\s*%/);
                        const rate = match ? parseFloat(match[1]) : 0;
                        updatePurchaseLine(row.id, { purchaseLedger: val, gstRate: rate });
                      }} /></td>
                      <td className="px-2"><InputField placeholder="Description" compact value={row.description || ''} onChange={(val) => updatePurchaseLine(row.id, { description: val })} /></td>
                      <td className="px-2"><InputField placeholder="HSN/SAC" compact value={row.hsnSacCode || ''} onChange={(val) => updatePurchaseLine(row.id, { hsnSacCode: val })} /></td>
                      <td className="px-2"><SearchableDropdown placeholder="18%" value={row.gstRate !== undefined ? `${row.gstRate}%` : '0%'} compact options={['0%', '5%', '12%', '18%', '28%']} onChange={(val) => updatePurchaseLine(row.id, { gstRate: parseFloat(val) || 0 })} /></td>
                      <td className="px-2"><InputField value={row.amount || ''} align="right" compact onChange={(val) => updatePurchaseLine(row.id, { amount: val })} /></td>
                      <td className="px-2"><button onClick={() => removeRow('purchase', row.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Minus size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SummaryBar entries={(form.purchaseLines || []).length} base={form.baseTotal || "0.00"} cgst={form.cgstTotal || "0.00"} sgst={form.sgstTotal || "0.00"} igst={form.igstTotal || "0.00"} total={form.grandTotal || "0.00"} />
          </FormSection>
        )}

        {activeTab === 'With Item Invoice' && (
          <FormSection title="Product Details" zIndex={90} headerAction={<button onClick={() => addRow('product')} className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><Plus size={12} strokeWidth={3} /></button>}>
            <div className="overflow-x-auto custom-scrollbar pb-32">
              <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[1200px] mb-20">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-2 w-10"></th>
                    <th className="px-2 w-16 text-center">Sr. No.</th>
                    <th className="px-2 min-w-[200px]">Stock Item</th>
                    <th className="px-2 min-w-[150px]">Description</th>
                    <th className="px-2">HSN/SAC Code</th>
                    <th className="px-2">Bill Quantity</th>
                    <th className="px-2">Bill Rate</th>
                    <th className="px-2">Discount</th>
                    <th className="px-2 text-right">Amount</th>
                    <th className="px-2">RCM</th>
                    <th className="px-2">GST Rate</th>
                    <th className="px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {(form.productLines || []).map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-2"><div className="w-7 h-7 rounded-full border border-purple-200 bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm"><Layout size={12} /></div></td>
                      <td className="px-2"><div className="h-8 w-full rounded-lg border flex items-center justify-center font-bold text-slate-500" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>{row.srNo}</div></td>
                      <td className="px-2"><SearchableDropdown placeholder="Stock Item" hasAdd compact options={masterData.stockItems?.length > 0 ? masterData.stockItems : ['Monitor', 'Keyboard']} value={row.stockItem || ''} onChange={(val) => {
                        const updates = { 
                          stockItem: val,
                          hsnSacCode: '',
                          gstRate: 0,
                          unit: ''
                        };
                        if (val && masterData.stockItemDetails && masterData.stockItemDetails[val]) {
                          const sd = masterData.stockItemDetails[val];
                          if (sd.hsnCode) updates.hsnSacCode = sd.hsnCode;
                          if (sd.gstRate !== undefined) updates.gstRate = sd.gstRate;
                          if (sd.unit) updates.unit = sd.unit;
                        }
                        updateProductLine(row.id, updates);
                      }} /></td>
                      <td className="px-2"><InputField placeholder="Description" compact value={row.description || ''} onChange={(val) => updateProductLine(row.id, { description: val })} /></td>
                      <td className="px-2"><InputField placeholder="HSN/SAC" compact value={row.hsnSacCode || ''} onChange={(val) => updateProductLine(row.id, { hsnSacCode: val })} /></td>
                      <td className="px-2">
                        <div className="flex items-center gap-1">
                          <InputField value={row.billQuantity || ''} align="right" compact onChange={(val) => updateProductLine(row.id, { billQuantity: val })} />
                          {row.unit && <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border" style={{ color: 'var(--app-accent)', borderColor: 'rgba(99,102,241,0.2)', backgroundColor: 'rgba(99,102,241,0.07)' }}>{row.unit}</span>}
                        </div>
                      </td>
                      <td className="px-2"><InputField value={row.billRate || ''} align="right" compact onChange={(val) => updateProductLine(row.id, { billRate: val })} /></td>
                      <td className="px-2"><InputField value={row.discountPercent || ''} align="right" compact onChange={(val) => updateProductLine(row.id, { discountPercent: val })} /></td>
                      <td className="px-2"><InputField value={row.amount || "0.00"} align="right" readOnly compact /></td>
                      <td className="px-2 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600" checked={row.rcm || false} onChange={(e) => updateProductLine(row.id, { rcm: e.target.checked })} /></td>
                      <td className="px-2"><SearchableDropdown placeholder="18%" value={row.gstRate !== undefined ? `${row.gstRate}%` : '0%'} compact options={['0%', '5%', '12%', '18%', '28%']} onChange={(val) => updateProductLine(row.id, { gstRate: parseFloat(val) || 0 })} /></td>
                      <td className="px-2"><button onClick={() => removeRow('product', row.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Minus size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SummaryBar entries={(form.productLines || []).length} base={form.baseTotal || "0.00"} cgst={form.cgstTotal || "0.00"} sgst={form.sgstTotal || "0.00"} igst={form.igstTotal || "0.00"} total={form.grandTotal || "0.00"} />
          </FormSection>
        )}

        {/* Additional Item Details */}
        <FormSection title="Additional Item Details" zIndex={80} headerAction={<button onClick={() => addRow('additional')} className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><Plus size={12} strokeWidth={3} /></button>}>
          <div className="overflow-x-auto custom-scrollbar pb-32">
            <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[600px] mb-20">
              <thead>
                <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                  <th className="px-2 w-10 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600 shadow-sm" /></th>
                  <th className="px-2">Taxable Value</th>
                  <th className="px-2 min-w-[200px]">Ledger Name</th>
                  <th className="px-2 text-right pr-10">Amount</th>
                  <th className="px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {(form.additionalCharges || []).map((row) => (
                  <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                    <td className="px-2 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600 shadow-sm" checked={row.included || false} onChange={(e) => updateAdditionalCharge(row.id, { included: e.target.checked })} /></td>
                    <td className="px-2"><div className="h-8 flex items-center font-bold text-slate-500">{row.taxableValue || '0.00'}</div></td>
                    <td className="px-2"><SearchableDropdown placeholder="Select Ledger" compact options={masterData.additionalChargeLedgers?.length > 0 ? masterData.additionalChargeLedgers : ['Freight Charges']} value={row.ledgerName || ''} onChange={(val) => updateAdditionalCharge(row.id, { ledgerName: val })} /></td>
                    <td className="px-2"><div className="flex items-center gap-2"><InputField value={row.amount || ''} align="right" compact onChange={(val) => updateAdditionalCharge(row.id, { amount: val })} /><button onClick={() => removeRow('additional', row.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Minus size={14} /></button></div></td>
                    <td className="px-2 w-10"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SummaryBar entries={(form.additionalCharges || []).length} base={form.baseTotal || "0.00"} cgst={form.cgstTotal || "0.00"} sgst={form.sgstTotal || "0.00"} igst={form.igstTotal || "0.00"} total={form.grandTotal || "0.00"} />
        </FormSection>

        {/* GST Details */}
        <FormSection title="GST Details" zIndex={70}>
          <div className="border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
            <table className="w-full text-left text-[10px]">
              <thead className="border-y" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                  <th className="p-3">GST Type</th>
                  <th className="p-3">Ledger Name</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {form.gstDetails && form.gstDetails.length > 0 ? (
                  form.gstDetails.map((g, idx) => (
                    <tr key={idx} style={{ color: theme.text }}>
                      <td className="p-3 font-bold">{g.gstType}</td>
                      <td className="p-3 font-bold">{g.ledgerName}</td>
                      <td className="p-3 font-bold text-right">{g.rate > 0 ? `${g.rate}%` : '-'}</td>
                      <td className="p-3 font-bold text-right">₹{g.amount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.mutedText }}>
                      No GST Breakup Available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </FormSection>

        {/* TDS */}
        <div className="grid grid-cols-1 gap-4">
          {voucherType !== 'purchase_order' && (
            <FormSection title="TDS Details" zIndex={60}>
              <div className="overflow-x-auto custom-scrollbar pb-32">
                <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[400px] mb-20">
                  <thead>
                    <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                      <th className="px-2 min-w-[150px]">Ledger Name</th>
                      <th className="px-2">Assessable Value</th>
                      <th className="px-2">Rate</th>
                      <th className="px-2">Amount</th>
                      <th className="px-2 w-10 text-right">
                        <button onClick={() => addRow('tds')} className="w-7 h-7 rounded-full border border-emerald-200 bg-white shadow-sm flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all">
                          <Plus size={14} strokeWidth={3} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.tdsDetails || []).map((row) => (
                      <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <td className="px-1"><SearchableDropdown placeholder="TDS Ledger" compact options={masterData.tdsLedgers?.length > 0 ? masterData.tdsLedgers : ['TDS on Services', 'TDS on Goods']} value={row.ledgerName || ''} onChange={(val) => updateTdsDetail(row.id, { ledgerName: val })} /></td>
                        <td className="px-1"><InputField value={row.assessableValue || ''} align="right" compact onChange={(val) => updateTdsDetail(row.id, { assessableValue: val })} /></td>
                        <td className="px-1"><InputField value={row.rate || ''} align="right" compact onChange={(val) => updateTdsDetail(row.id, { rate: val })} /></td>
                        <td className="px-1"><InputField value={row.amount || "0.00"} align="right" readOnly compact /></td>
                        <td className="px-1 text-right">
                          <button onClick={() => removeRow('tds', row.id)} className="w-7 h-7 rounded-full border border-red-200 bg-white shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 transition-all">
                            <Minus size={14} strokeWidth={3} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-between font-black text-[9px] uppercase rounded-lg border px-3 py-1.5 shadow-sm" style={{ backgroundColor: theme.accentSoft, borderColor: theme.border, color: theme.accent }}>
                <span>Number Of Entries: {(form.tdsDetails || []).length}</span>
                <span>Total: ₹{form.tdsTotal || "0.00"}</span>
              </div>
            </FormSection>
          )}
        </div>

        {/* Narration */}
        <FormSection title="Narration" zIndex={10}>
          <textarea 
            className="w-full h-20 rounded-xl border p-4 text-[11px] font-bold outline-none transition-all focus:border-indigo-400 resize-none shadow-sm placeholder:text-slate-300"
            placeholder="Narration"
            value={form.narration || ''}
            onChange={(e) => updateForm({ narration: e.target.value })}
            style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
          />
        </FormSection>

      </div>

      {renderLedgerModal()}
      {renderStockModal()}
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
      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: theme.mutedText }}>{label}</span>
      <span className="text-[11.5px] font-black px-2.5 py-0.5 rounded-lg shadow-sm border transition-all group-hover:scale-105" style={{ backgroundColor: theme.accentSoft, color: theme.accent, borderColor: isDark ? 'rgba(79, 70, 229, 0.2)' : 'transparent' }}>{value}</span>
      {!isLast && <div className="h-4 w-[1.5px] ml-4 opacity-10" style={{ backgroundColor: theme.text }} />}
    </div>
  );
};

const FormSection = ({ title, children, hasSettings = true, defaultOpen = true, headerAction, zIndex = 1 }) => {
  const { theme, isDark } = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4 rounded-2xl border shadow-sm transition-all duration-500 hover:shadow-md" style={{ borderColor: theme.border, backgroundColor: theme.panel, backdropFilter: isDark ? 'blur(20px)' : undefined, zIndex: isOpen ? zIndex : 1, position: 'relative' }}>
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
      <div className={`transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? 'opacity-100 p-5 visible' : 'max-h-0 opacity-0 p-0 invisible overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
};

const SearchableDropdown = ({ label, placeholder, options = [], value, onChange, hasAdd, hasSearch = true, compact }) => {
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
    <div className="relative flex flex-col gap-1 w-full group" ref={dropdownRef} style={{ zIndex: isOpen ? 5000 : 1 }}>
      {label && (
        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-400 group-focus-within:text-indigo-600 transition-colors" style={{ backgroundColor: theme.panel }}>
          {label}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full ${compact ? 'h-8' : 'h-10'} rounded-xl border px-4 flex items-center justify-between cursor-pointer transition-all duration-300 group/input ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : 'hover:border-indigo-400'}`}
            style={{ borderColor: isOpen ? theme.accent : theme.border, backgroundColor: theme.inputBg }}
          >
            <span className={`text-[11.5px] font-bold truncate transition-colors ${value ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : 'text-slate-400'}`}>
              {value || placeholder}
            </span>
            <div className="flex items-center gap-1.5 text-slate-400 group-hover/input:text-indigo-500 transition-colors">
              {value && <X size={12} className="hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); onChange(''); }} />}
              <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>
          </div>
          
          {isOpen && (
            <div 
              className="absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[250px] z-[5000]" 
              style={{ backgroundColor: theme.panel, borderColor: theme.border }}
            >
              {hasSearch && (
                <div className="p-2 border-b" style={{ borderColor: theme.border }}>
                  <div className="relative">
                    <input 
                      autoFocus 
                      type="text" 
                      value={search} 
                      onChange={(e) => setSearch(e.target.value)} 
                      placeholder="Search..." 
                      className="w-full h-8 rounded-lg border px-8 text-[11px] font-bold outline-none focus:border-indigo-400 transition-all" 
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                  <div 
                    key={idx} 
                    className={`px-3 py-2 text-[11px] font-bold cursor-pointer rounded-lg transition-colors ${value === opt ? 'bg-indigo-500 text-white' : 'hover:bg-indigo-500/10 hover:text-indigo-400'}`}
                    style={{ color: value === opt ? '#fff' : theme.text }}
                    onClick={() => { onChange && onChange(opt); setIsOpen(false); setSearch(''); }}
                  >
                    {opt}
                  </div>
                )) : (
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">No results for "{search}"</p>
                    <button onClick={() => { onChange && onChange(search); setIsOpen(false); }} className="text-[9px] font-black text-indigo-600 hover:underline">Add "{search}" as new</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {hasAdd && (
          <button className="w-8 h-8 rounded-full border flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-all shadow-sm shrink-0" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
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
        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-400 group-focus-within:text-indigo-600 transition-colors" style={{ backgroundColor: theme.panel }}>
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
              className={`w-full ${compact ? 'h-8 px-3' : 'h-10 px-4'} rounded-xl border text-[11.5px] font-bold outline-none transition-all duration-300 focus:ring-2 focus:ring-indigo-500/20 ${isDark ? 'focus:border-[#09B6B9] placeholder:text-white/10' : 'focus:border-indigo-500 shadow-sm placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
              style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
            />
            {Icon && !readOnly && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center cursor-pointer">
                <Icon size={14} className="text-slate-400 hover:text-indigo-500 transition-colors pointer-events-none" />
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
            className={`w-full ${compact ? 'h-8 px-3' : 'h-10 px-4'} rounded-xl border text-[11.5px] font-bold outline-none transition-all duration-300 focus:ring-2 focus:ring-indigo-500/20 ${isDark ? 'focus:border-[#09B6B9] placeholder:text-white/10' : 'focus:border-indigo-500 shadow-sm placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
            style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
          />
        )}
        {type !== "date" && Icon && <Icon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={14} />}
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
