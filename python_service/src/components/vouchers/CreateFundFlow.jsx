import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Minus, X, Settings, ChevronDown, Search,
  Calendar, Save, Send, Layout, Hash,
  Landmark, Wallet, ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useFundFlowStore } from '../../stores/useFundFlowStore';

const CreateFundFlow = ({ isDark, onBack, voucherType = 'cash_payment' }) => {
  const {
    form,
    loading,
    setFormValue,
    resetForm,
    saveDraft,
    pushToReview
  } = useFundFlowStore();

  // Sync voucherType on mount
  useEffect(() => {
    resetForm(voucherType);
  }, [voucherType, resetForm]);

  const handleSaveDraft = async () => {
    const res = await saveDraft();
    if (res.success) {
      toast.success('Draft saved successfully');
      if (onBack) onBack();
    } else {
      toast.error(res.message || 'Failed to save draft');
    }
  };

  const handlePushToReview = async () => {
    const res = await pushToReview();
    if (res.success) {
      toast.success('Pushed to review successfully');
      if (onBack) onBack();
    } else {
      toast.error(res.message || 'Failed to push to review');
    }
  };

  // Row operations for Bill Allocations
  const addBillRow = () => {
    const newBillRows = [...(form.billRows || []), { id: Date.now(), billType: '', billRef: '', billAmount: 0, dueDate: '' }];
    setFormValue('billRows', newBillRows);
  };

  const removeBillRow = (id) => {
    const newBillRows = (form.billRows || []).filter(r => r.id !== id && r._id !== id);
    setFormValue('billRows', newBillRows);
  };

  const updateBillRow = (index, key, val) => {
    const newBillRows = [...(form.billRows || [])];
    newBillRows[index] = { ...newBillRows[index], [key]: val };
    setFormValue('billRows', newBillRows);
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
    scrollbarThumb: isDark ? 'rgba(9, 182, 185, 0.3)' : '#cbd5e1',
    scrollbarTrack: isDark ? 'transparent' : '#f1f5f9'
  };

  // --- Voucher type labels ---
  const typeLabels = {
    cash_payment: 'Cash Payment',
    bank_payment: 'Bank Payment',
    contra: 'Contra'
  };
  const typeIcons = {
    cash_payment: Wallet,
    bank_payment: Landmark,
    contra: ArrowRightLeft
  };
  const TypeIcon = typeIcons[voucherType] || Wallet;

  // --- Reusable Sub-Components ---

  const FormSection = ({ title, children, hasSettings = false, defaultOpen = true, headerAction, zIndex = 1 }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div className="mb-1.5 rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md" style={{ borderColor: theme.border, backgroundColor: theme.panel, backdropFilter: isDark ? 'blur(20px)' : undefined, zIndex: isOpen ? zIndex : 1, position: 'relative' }}>
        <div className="px-2.5 py-1 flex items-center justify-between border-b rounded-t-xl" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
          <h3 className="text-[9px] font-black uppercase tracking-[0.12em]" style={{ color: theme.text }}>{title}</h3>
          <div className="flex gap-1.5 items-center">
            {headerAction}
            {hasSettings && <button className="text-slate-400 hover:text-indigo-600 transition-all hover:scale-110 active:scale-90"><Settings size={11} /></button>}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-4 h-4 rounded-full border flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all hover:rotate-180 active:scale-90"
              style={{ borderColor: theme.border }}
            >
              {isOpen ? <Minus size={8} strokeWidth={3} /> : <Plus size={8} strokeWidth={3} />}
            </button>
          </div>
        </div>
        <div className={`transition-all duration-300 ${isOpen ? 'opacity-100 p-2.5 px-3 visible overflow-visible' : 'max-h-0 opacity-0 p-0 invisible overflow-hidden'}`}>
          {children}
        </div>
      </div>
    );
  };

  const SearchableDropdown = ({ label, placeholder, options = [], value, onChange, compact }) => {
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

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="flex flex-col gap-0.5" ref={dropdownRef}>
        {label && <label className="text-[7.5px] font-black uppercase tracking-widest leading-none mb-0.5" style={{ color: theme.mutedText }}>{label}</label>}
        <div className="relative">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full ${compact ? 'h-6 px-2' : 'h-7 px-2.5'} rounded-lg border flex items-center justify-between cursor-pointer transition-all duration-200 group/input ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : 'hover:border-indigo-400'}`}
            style={{ backgroundColor: theme.inputBg, borderColor: isOpen ? theme.accent : theme.border }}
          >
            <span className={`text-[9.5px] font-bold truncate transition-colors ${value ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : 'text-slate-400'}`}>
              {value || placeholder}
            </span>
            <div className="flex items-center gap-1 text-slate-400 group-hover/input:text-indigo-500 transition-colors">
              {value && <X size={10} className="hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); onChange && onChange(''); }} />}
              <ChevronDown size={11} className={`transition-transform duration-200 ease-out ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>
          </div>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl z-50 overflow-hidden" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.border }}>
              <div className="p-1 border-b" style={{ borderColor: theme.border }}>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-6 rounded border pl-6 pr-2 text-[9.5px] font-bold outline-none transition-all focus:border-indigo-400"
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-24 overflow-y-auto">
                {filtered.length > 0 ? filtered.map((opt, i) => (
                  <button key={i} onClick={() => { onChange && onChange(opt); setIsOpen(false); setSearch(''); }}
                    className="w-full text-left px-2 py-1 text-[9.5px] font-bold hover:bg-indigo-50/50 transition-colors"
                    style={{ color: theme.text }}
                  >{opt}</button>
                )) : (
                  <div className="px-2 py-1.5 text-[9.5px] text-center" style={{ color: theme.mutedText }}>No results</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const InputField = ({ label, placeholder, value, onChange, type = 'text', readOnly, Icon, align, compact }) => (
    <div className="flex flex-col gap-0.5 group">
      {label && <label className="text-[7.5px] font-black uppercase tracking-widest leading-none mb-0.5" style={{ color: theme.mutedText }}>{label}</label>}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={`w-full ${compact ? 'h-6 px-2' : 'h-7 px-2.5'} rounded-lg border text-[9.5px] font-bold outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/15 ${isDark ? 'focus:border-[#09B6B9] placeholder:text-white/10' : 'focus:border-indigo-500 shadow-sm placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
          style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
        />
        {Icon && <Icon className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={11} />}
      </div>
    </div>
  );

  const SummaryBar = ({ entries, total }) => (
    <div className="mt-2 h-7.5 px-3 flex items-center justify-between border rounded-xl shadow-sm text-[8.5px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
      <div className="flex items-center gap-1.5 shrink-0">
        <span style={{ color: theme.mutedText }}>Entries</span>
        <span className="bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 rounded-md text-[9px] border border-indigo-500/10">{entries}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span style={{ color: theme.mutedText }}>Total</span>
        <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-md text-[9px] border border-indigo-600 shadow-md shadow-indigo-200/50">{total}</span>
      </div>
    </div>
  );

  // --- Determine visible sections per voucher type ---
  const showBankInstrument = voucherType === 'bank_payment';
  const showCashLedger = voucherType === 'cash_payment';
  const showContraTransfer = voucherType === 'contra';

  // Compute live bill allocations sum
  const billTotal = (form.billRows || []).reduce((acc, row) => acc + (parseFloat(row.billAmount) || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: theme.bg }}>
      <style>{`
        .themed-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .themed-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; border-radius: 10px; }
        .themed-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-2.5 py-1 shrink-0 border-b" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <TypeIcon size={13} className="text-indigo-500" />
            <h1 className="text-[11px] font-black tracking-tight uppercase" style={{ color: theme.accent }}>
              {typeLabels[voucherType] || 'Fund Flow'} Entry
            </h1>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleSaveDraft}
              disabled={loading.save}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[8.5px] font-black shadow-sm transition-all hover:scale-[1.03] active:scale-[0.97] hover:shadow-md"
              style={{ borderColor: theme.accent, color: theme.accent, backgroundColor: isDark ? 'rgba(9, 182, 185, 0.05)' : '#fff' }}
            >
              <Save size={10} strokeWidth={3} /> {loading.save ? 'SAVING...' : 'SAVE DRAFT'}
            </button>
            <button
              onClick={handlePushToReview}
              disabled={loading.save}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8.5px] font-black shadow-md transition-all hover:scale-[1.03] active:scale-[0.97] hover:shadow-indigo-500/10 text-white"
              style={{ background: theme.accentGradient }}
            >
              <Send size={10} strokeWidth={3} /> PUSH TO REVIEW
            </button>
          </div>
        </div>
        <div className="flex gap-1">
          <button className="p-1 rounded-md border text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50" style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}><Layout size={11} /></button>
          <button onClick={onBack} className="p-1 rounded-md border text-slate-400 hover:text-red-500 transition-all hover:bg-red-50" style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}><X size={11} /></button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto themed-scrollbar px-2.5 py-2 space-y-0.5">

        {/* 1. Voucher Details */}
        <FormSection title="Voucher Details" zIndex={90}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <InputField label="Voucher Date" type="date" value={form.voucherDate || ''} onChange={val => setFormValue('voucherDate', val)} Icon={Calendar} />
            <InputField label="Voucher Number" value={form.voucherNumber || 'AUTO'} readOnly Icon={Hash} />
            <InputField label="Reference Number" placeholder="e.g. REF-001" value={form.referenceNumber || ''} onChange={val => setFormValue('referenceNumber', val)} />
            <SearchableDropdown label="Company" placeholder="Select Company" value={form.company || ''} onChange={val => setFormValue('company', val)} options={['Main Company Ltd', 'Subsidiary Pvt Ltd']} />
          </div>
        </FormSection>

        {/* 2. Party & Ledger Selection */}
        <FormSection title="Party & Ledger Details" zIndex={80}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <SearchableDropdown label="Party Ledger (Dr/Cr)" placeholder="Select Party" value={form.partyLedger || ''} onChange={val => setFormValue('partyLedger', val)} options={['ABC Traders', 'XYZ Corp', 'Vendor Account', 'Sundry Debtors']} />
            <SearchableDropdown label="Against Ledger" placeholder="Select Ledger" value={form.againstLedger || ''} onChange={val => setFormValue('againstLedger', val)} options={['SBI Bank', 'HDFC Bank', 'Cash Account', 'Fund Flow Cash']} />
            <InputField label="Amount (₹)" type="number" placeholder="0.00" value={form.amount || ''} onChange={val => setFormValue('amount', val)} align="right" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            <InputField label="Dr/Cr Type" value={voucherType === 'contra' ? 'Transfer' : 'Debit (Dr)'} readOnly />
            <InputField label="Ledger Group" value={form.ledgerGroup || 'Sundry Creditors'} readOnly />
            <InputField label="Currency" value={form.currency || 'INR'} readOnly />
          </div>
        </FormSection>

        {/* 3. Cash Ledger Details — Only for Cash Payment */}
        {showCashLedger && (
          <FormSection title="Cash Ledger Details" zIndex={70}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <SearchableDropdown label="Cash Ledger" placeholder="Select Cash Ledger" value={form.cashLedger || ''} onChange={val => setFormValue('cashLedger', val)} options={['Main Cash Account', 'Fund Flow Cash', 'Office Cash']} />
              <InputField label="Cash Amount (₹)" type="number" placeholder="0.00" value={form.cashAmount || ''} onChange={val => setFormValue('cashAmount', val)} align="right" />
              <InputField label="Opening Balance" value={`₹ ${(form.openingBalance || 0).toLocaleString('en-IN')}`} readOnly />
            </div>
          </FormSection>
        )}

        {/* 4. Bank Instrument Details — Only for Bank Payment */}
        {showBankInstrument && (
          <FormSection title="Bank Instrument Details" zIndex={70}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              <SearchableDropdown label="Bank Ledger" placeholder="Select Bank" value={form.bankLedger || ''} onChange={val => setFormValue('bankLedger', val)} options={['SBI Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank']} />
              <SearchableDropdown label="Transaction Type" placeholder="Select Type" value={form.transType || ''} onChange={val => setFormValue('transType', val)} options={['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'DD']} />
              <InputField label="Instrument Number" placeholder="Cheque/Ref No" value={form.instNumber || ''} onChange={val => setFormValue('instNumber', val)} />
              <InputField label="Instrument Date" type="date" value={form.instDate || ''} onChange={val => setFormValue('instDate', val)} Icon={Calendar} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
              <InputField label="UTR Number" placeholder="UTR..." value={form.utr || ''} onChange={val => setFormValue('utr', val)} />
              <InputField label="IFSC Code" placeholder="SBIN0001234" value={form.ifscCode || ''} onChange={val => setFormValue('ifscCode', val)} />
              <InputField label="Branch Name" placeholder="Mumbai Main" value={form.branchName || ''} onChange={val => setFormValue('branchName', val)} />
              <InputField label="Bank Balance" value={`₹ ${(form.bankBalance || 0).toLocaleString('en-IN')}`} readOnly />
            </div>
          </FormSection>
        )}

        {/* 5. Contra Transfer Details — Only for Contra */}
        {showContraTransfer && (
          <FormSection title="Contra Transfer Details" zIndex={70}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="rounded-lg border p-2" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4' }}>
                <h4 className="text-[8.5px] font-black uppercase tracking-wider text-emerald-600 mb-1.5 flex items-center gap-1">
                  <Wallet size={9.5} /> Source (From)
                </h4>
                <div className="space-y-1.5">
                  <SearchableDropdown placeholder="Source Ledger (Cash / Bank)" value={form.sourceLedger || ''} onChange={val => setFormValue('sourceLedger', val)} options={['Main Cash Account', 'SBI Bank', 'HDFC Bank']} />
                  <InputField label="Transfer Amount (₹)" type="number" placeholder="0.00" value={form.transferAmount || ''} onChange={val => setFormValue('transferAmount', val)} align="right" />
                </div>
              </div>
              <div className="rounded-lg border p-2" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : '#eff6ff' }}>
                <h4 className="text-[8.5px] font-black uppercase tracking-wider text-blue-600 mb-1.5 flex items-center gap-1">
                  <Landmark size={9.5} /> Destination (To)
                </h4>
                <div className="space-y-1.5">
                  <SearchableDropdown placeholder="Destination Ledger (Cash / Bank)" value={form.destinationLedger || ''} onChange={val => setFormValue('destinationLedger', val)} options={['Main Cash Account', 'SBI Bank', 'HDFC Bank', 'ICICI Bank']} />
                  <InputField label="Amount Received (₹)" type="number" placeholder="0.00" value={form.amountReceived || ''} onChange={val => setFormValue('amountReceived', val)} align="right" />
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {/* 6. Allocation & Bill Matching — for Cash & Bank Payment */}
        {!showContraTransfer && (
          <FormSection title="Bill Allocation" zIndex={60}>
            <div className="overflow-x-auto overflow-y-visible animate-in fade-in duration-300">
              <table className="w-full text-left text-[9px] border-separate border-spacing-y-1 min-w-[500px] mb-1.5">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-1.5 pb-0.5 text-[8.5px]">Bill Type</th>
                    <th className="px-1.5 pb-0.5 text-[8.5px]">Bill Reference</th>
                    <th className="px-1.5 pb-0.5 text-[8.5px]">Bill Amount</th>
                    <th className="px-1.5 pb-0.5 text-[8.5px]">Due Date</th>
                    <th className="px-1.5 pb-0.5 w-8 text-right">
                      <button onClick={addBillRow} className="w-5 h-5 rounded-full border border-emerald-200 bg-white shadow-sm flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all">
                        <Plus size={10} strokeWidth={3} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(form.billRows || []).map((row, idx) => (
                    <tr key={row.id || idx} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-0.5">
                        <SearchableDropdown
                          placeholder="Bill Type"
                          compact
                          value={row.billType || ''}
                          onChange={val => updateBillRow(idx, 'billType', val)}
                          options={['New Ref', 'Against Ref', 'Advance', 'On Account']}
                        />
                      </td>
                      <td className="px-0.5">
                        <InputField
                          placeholder="Inv-001"
                          compact
                          value={row.billRef || ''}
                          onChange={val => updateBillRow(idx, 'billRef', val)}
                        />
                      </td>
                      <td className="px-0.5">
                        <InputField
                          align="right"
                          compact
                          value={row.billAmount || ''}
                          onChange={val => updateBillRow(idx, 'billAmount', val)}
                        />
                      </td>
                      <td className="px-0.5">
                        <InputField
                          type="date"
                          compact
                          value={row.dueDate ? row.dueDate.substring(0, 10) : ''}
                          onChange={val => updateBillRow(idx, 'dueDate', val)}
                        />
                      </td>
                      <td className="px-0.5 text-right">
                        <button onClick={() => removeBillRow(row.id || row._id)} className="w-5 h-5 rounded-full border border-red-200 bg-white shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 transition-all">
                          <Minus size={10} strokeWidth={3} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SummaryBar entries={(form.billRows || []).length} total={billTotal.toFixed(2)} />
          </FormSection>
        )}

        {/* 7. Cost Center Allocation */}
        <FormSection title="Cost Center Allocation" zIndex={50}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <SearchableDropdown label="Cost Category" placeholder="Select Category" options={['Primary Cost Category', 'Marketing', 'Operations']} />
            <SearchableDropdown label="Cost Center" placeholder="Select Center" options={['Mumbai Branch', 'Delhi Branch', 'Web Campaign']} />
            <InputField label="Allocation Amount (₹)" type="number" placeholder="0.00" align="right" />
          </div>
        </FormSection>

        {/* 8. GST / TDS — Only for Cash & Bank Payment */}
        {!showContraTransfer && (
          <FormSection title="Taxation Details (GST / TDS)" zIndex={40}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              {/* GST */}
              <div className="rounded-lg border p-2" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(79,70,229,0.03)' : '#f8faff' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="checkbox"
                    className="w-3 h-3 rounded accent-indigo-500 cursor-pointer"
                    checked={form.gstApplicable || false}
                    onChange={e => setFormValue('gstApplicable', e.target.checked)}
                  />
                  <span className="text-[8.5px] font-black uppercase tracking-widest" style={{ color: theme.text }}>GST Applicable</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SearchableDropdown placeholder="GST Ledger" value={form.gstLedger || ''} onChange={val => setFormValue('gstLedger', val)} compact options={['CGST @ 9%', 'SGST @ 9%', 'IGST @ 18%']} />
                  <SearchableDropdown placeholder="GST Rate" value={form.gstRate || ''} onChange={val => setFormValue('gstRate', val)} compact options={['5%', '12%', '18%', '28%']} />
                </div>
              </div>
              {/* TDS */}
              <div className="rounded-lg border p-2" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(79,70,229,0.03)' : '#f8faff' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="checkbox"
                    className="w-3 h-3 rounded accent-indigo-500 cursor-pointer"
                    checked={form.tdsApplicable || false}
                    onChange={e => setFormValue('tdsApplicable', e.target.checked)}
                  />
                  <span className="text-[8.5px] font-black uppercase tracking-widest" style={{ color: theme.text }}>TDS Applicable</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SearchableDropdown placeholder="TDS Ledger" value={form.tdsLedger || ''} onChange={val => setFormValue('tdsLedger', val)} compact options={['TDS on Prof. Fees', 'TDS on Rent', 'TDS on Contract']} />
                  <SearchableDropdown placeholder="TDS %" value={form.tdsRate || ''} onChange={val => setFormValue('tdsRate', val)} compact options={['1%', '2%', '5%', '10%']} />
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {/* 9. Narration */}
        <FormSection title="Narration" zIndex={10}>
          <textarea
            className="w-full h-10 rounded-lg border p-2 text-[9.5px] font-bold outline-none transition-all focus:border-indigo-400 resize-none shadow-sm placeholder:text-slate-300"
            placeholder="Enter detailed narration here..."
            value={form.narration || ''}
            onChange={e => setFormValue('narration', e.target.value)}
            style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
          />
        </FormSection>

        {/* 10. Summary Footer */}
        <div className="rounded-xl border p-2 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Total Debit', value: `₹ ${(form.totalDebit || 0).toLocaleString('en-IN')}` },
              { label: 'Total Credit', value: `₹ ${(form.totalCredit || 0).toLocaleString('en-IN')}` },
              { label: 'Difference', value: `₹ ${(form.difference || 0).toLocaleString('en-IN')}` },
              { label: 'Status', value: form.difference === 0 ? 'Balanced' : 'Unbalanced', highlight: form.difference === 0 },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-0.5 py-0.5">
                <span className="text-[7.5px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.mutedText }}>{item.label}</span>
                <span className={`text-[11px] font-black ${item.highlight ? 'text-emerald-600' : ''}`} style={{ color: item.highlight ? undefined : theme.text }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-1 text-[8.5px] font-black uppercase tracking-widest opacity-35" style={{ color: theme.mutedText }}>
          {form.partyLedger ? 'Review and Save Transaction' : 'Please Select Sundry Ledger'}
        </div>
      </div>
    </div>
  );
};

export default CreateFundFlow;
