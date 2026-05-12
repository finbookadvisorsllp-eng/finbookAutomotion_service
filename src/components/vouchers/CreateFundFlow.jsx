import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Minus, X, Settings, ChevronDown, Search,
  Calendar, Save, Send, Layout, FileText, Hash,
  Landmark, Wallet, CreditCard, Building2, Receipt,
  Calculator, ArrowRightLeft, Banknote, ShieldCheck
} from 'lucide-react';

const CreateFundFlow = ({ isDark, onBack, voucherType = 'cash_payment' }) => {
  // Row state
  const [rows, setRows] = useState([{ id: 1 }]);
  const [billRows, setBillRows] = useState([{ id: 1 }]);
  const nextId = useRef(2);

  const addRow = () => {
    setRows(prev => [...prev, { id: nextId.current++ }]);
  };
  const removeRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };
  const addBillRow = () => {
    setBillRows(prev => [...prev, { id: nextId.current++ }]);
  };
  const removeBillRow = (id) => {
    setBillRows(prev => prev.filter(r => r.id !== id));
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

  const FormSection = ({ title, children, hasSettings = true, defaultOpen = true, headerAction, zIndex = 1 }) => {
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
        <div className={`transition-all duration-500 ${isOpen ? 'opacity-100 p-5 visible' : 'max-h-0 opacity-0 p-0 invisible overflow-hidden'}`}>
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
      <div className="flex flex-col gap-1" ref={dropdownRef}>
        {label && <label className="text-[9px] font-black uppercase tracking-widest" style={{ color: theme.mutedText }}>{label}</label>}
        <div className="relative">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full ${compact ? 'h-8' : 'h-10'} rounded-xl border px-4 flex items-center justify-between cursor-pointer transition-all duration-300 group/input ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : 'hover:border-indigo-400'}`}
            style={{ backgroundColor: theme.inputBg, borderColor: isOpen ? theme.accent : theme.border }}
          >
            <span className={`text-[11.5px] font-bold truncate transition-colors ${value ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : 'text-slate-400'}`}>
              {value || placeholder}
            </span>
            <div className="flex items-center gap-1.5 text-slate-400 group-hover/input:text-indigo-500 transition-colors">
              {value && <X size={12} className="hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); onChange && onChange(''); }} />}
              <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>
          </div>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 overflow-hidden" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.border }}>
              <div className="p-2 border-b" style={{ borderColor: theme.border }}>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-8 rounded-lg border pl-8 pr-3 text-[11px] font-bold outline-none transition-all focus:border-indigo-400"
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {filtered.length > 0 ? filtered.map((opt, i) => (
                  <button key={i} onClick={() => { onChange && onChange(opt); setIsOpen(false); setSearch(''); }}
                    className="w-full text-left px-3 py-2 text-[11px] font-bold hover:bg-indigo-50 transition-colors"
                    style={{ color: theme.text }}
                  >{opt}</button>
                )) : (
                  <div className="px-3 py-3 text-[11px] text-center" style={{ color: theme.mutedText }}>No results</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const InputField = ({ label, placeholder, value, onChange, type = 'text', readOnly, Icon, align, compact }) => (
    <div className="flex flex-col gap-1 group">
      {label && <label className="text-[9px] font-black uppercase tracking-widest" style={{ color: theme.mutedText }}>{label}</label>}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={`w-full ${compact ? 'h-8 px-3' : 'h-10 px-4'} rounded-xl border text-[11.5px] font-bold outline-none transition-all duration-300 focus:ring-2 focus:ring-indigo-500/20 ${isDark ? 'focus:border-[#09B6B9] placeholder:text-white/10' : 'focus:border-indigo-500 shadow-sm placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
          style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
        />
        {Icon && <Icon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />}
      </div>
    </div>
  );

  const SummaryBar = ({ entries, total }) => (
    <div className="mt-4 h-11 px-5 flex items-center justify-between border rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ color: theme.mutedText }}>Entries</span>
        <span className="bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-lg text-[11px] border border-indigo-500/10">{entries}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ color: theme.mutedText }}>Total</span>
        <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg text-[11px] border border-indigo-600 shadow-lg shadow-indigo-200">{total}</span>
      </div>
    </div>
  );

  // --- Determine visible sections per voucher type ---
  const showBankInstrument = voucherType === 'bank_payment';
  const showCashLedger = voucherType === 'cash_payment';
  const showContraTransfer = voucherType === 'contra';

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: theme.bg }}>
      <style>{`
        .themed-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .themed-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; border-radius: 10px; }
        .themed-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <TypeIcon size={18} className="text-indigo-500" />
            <h1 className="text-[14px] font-black tracking-tight uppercase" style={{ color: theme.accent }}>
              {typeLabels[voucherType] || 'Fund Flow'} Entry
            </h1>
          </div>
          <div className="flex gap-2.5">
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl border text-[10px] font-black shadow-sm transition-all hover:scale-[1.03] active:scale-[0.97] hover:shadow-md" style={{ borderColor: theme.accent, color: theme.accent, backgroundColor: isDark ? 'rgba(9, 182, 185, 0.05)' : '#fff' }}>
              <Save size={13} strokeWidth={3} /> SAVE CHANGES
            </button>
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black shadow-lg transition-all hover:scale-[1.03] active:scale-[0.97] hover:shadow-indigo-500/20 text-white" style={{ background: theme.accentGradient }}>
              <Send size={13} strokeWidth={3} /> PUSH TO REVIEW
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2 rounded-xl border text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50" style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}><Layout size={15} /></button>
          <button className="p-2 rounded-xl border text-slate-400 hover:text-red-500 transition-all hover:bg-red-50" style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}><X size={15} /></button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto themed-scrollbar px-4 py-5 space-y-0">

        {/* 1. Voucher Details */}
        <FormSection title="Voucher Details" zIndex={90}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputField label="Voucher Date" type="date" value="2026-05-09" Icon={Calendar} />
            <InputField label="Voucher Number" value="VCH-2026-001" Icon={Hash} />
            <InputField label="Reference Number" placeholder="e.g. REF-001" />
            <SearchableDropdown label="Company" placeholder="Select Company" options={['Main Company Ltd', 'Subsidiary Pvt Ltd']} />
          </div>
        </FormSection>

        {/* 2. Party & Ledger Selection */}
        <FormSection title="Party & Ledger Details" zIndex={80}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SearchableDropdown label="Party Ledger (Dr/Cr)" placeholder="Select Party" options={['ABC Traders', 'XYZ Corp', 'Vendor Account', 'Sundry Debtors']} />
            <SearchableDropdown label="Against Ledger" placeholder="Select Ledger" options={['SBI Bank', 'HDFC Bank', 'Cash Account', 'Fund Flow Cash']} />
            <InputField label="Amount (₹)" type="number" placeholder="0.00" align="right" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <InputField label="Dr/Cr Type" value={voucherType === 'contra' ? 'Transfer' : 'Debit (Dr)'} readOnly />
            <InputField label="Ledger Group" value="Sundry Creditors" readOnly />
            <InputField label="Currency" value="INR" readOnly />
          </div>
        </FormSection>

        {/* 3. Cash Ledger Details — Only for Cash Payment */}
        {showCashLedger && (
          <FormSection title="Cash Ledger Details" zIndex={70}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SearchableDropdown label="Cash Ledger" placeholder="Select Cash Ledger" options={['Main Cash Account', 'Fund Flow Cash', 'Office Cash']} />
              <InputField label="Cash Amount (₹)" type="number" placeholder="0.00" align="right" />
              <InputField label="Opening Balance" value="₹ 25,000.00" readOnly />
            </div>
          </FormSection>
        )}

        {/* 4. Bank Instrument Details — Only for Bank Payment */}
        {showBankInstrument && (
          <FormSection title="Bank Instrument Details" zIndex={70}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SearchableDropdown label="Bank Ledger" placeholder="Select Bank" options={['SBI Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank']} />
              <SearchableDropdown label="Transaction Type" placeholder="Select Type" options={['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'DD']} />
              <InputField label="Instrument Number" placeholder="Cheque/Ref No" />
              <InputField label="Instrument Date" type="date" Icon={Calendar} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <InputField label="UTR Number" placeholder="UTR..." />
              <InputField label="IFSC Code" placeholder="SBIN0001234" />
              <InputField label="Branch Name" placeholder="Mumbai Main" />
              <InputField label="Bank Balance" value="₹ 1,50,000.00" readOnly />
            </div>
          </FormSection>
        )}

        {/* 5. Contra Transfer Details — Only for Contra */}
        {showContraTransfer && (
          <FormSection title="Contra Transfer Details" zIndex={70}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4' }}>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-1.5">
                  <Wallet size={12} /> Source (From)
                </h4>
                <div className="space-y-3">
                  <SearchableDropdown placeholder="Source Ledger (Cash / Bank)" options={['Main Cash Account', 'SBI Bank', 'HDFC Bank']} />
                  <InputField label="Transfer Amount (₹)" type="number" placeholder="0.00" align="right" />
                </div>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : '#eff6ff' }}>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-3 flex items-center gap-1.5">
                  <Landmark size={12} /> Destination (To)
                </h4>
                <div className="space-y-3">
                  <SearchableDropdown placeholder="Destination Ledger (Cash / Bank)" options={['Main Cash Account', 'SBI Bank', 'HDFC Bank', 'ICICI Bank']} />
                  <InputField label="Amount Received (₹)" type="number" placeholder="0.00" align="right" />
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {/* 6. Allocation & Bill Matching — for Cash & Bank Payment */}
        {!showContraTransfer && (
          <FormSection title="Bill Allocation" zIndex={60}>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[500px] mb-10">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-2">Bill Type</th>
                    <th className="px-2">Bill Reference</th>
                    <th className="px-2">Bill Amount</th>
                    <th className="px-2">Due Date</th>
                    <th className="px-2 w-10 text-right">
                      <button onClick={addBillRow} className="w-7 h-7 rounded-full border border-emerald-200 bg-white shadow-sm flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all">
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {billRows.map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-1"><SearchableDropdown placeholder="Bill Type" compact options={['New Ref', 'Against Ref', 'Advance', 'On Account']} /></td>
                      <td className="px-1"><InputField placeholder="Inv-001" compact /></td>
                      <td className="px-1"><InputField value="0.00" align="right" compact /></td>
                      <td className="px-1"><InputField type="date" compact /></td>
                      <td className="px-1 text-right">
                        <button onClick={() => removeBillRow(row.id)} className="w-7 h-7 rounded-full border border-red-200 bg-white shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 transition-all">
                          <Minus size={14} strokeWidth={3} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SummaryBar entries={billRows.length} total="0.00" />
          </FormSection>
        )}

        {/* 7. Cost Center Allocation */}
        <FormSection title="Cost Center Allocation" hasSettings={false} defaultOpen={false} zIndex={50}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SearchableDropdown label="Cost Category" placeholder="Select Category" options={['Primary Cost Category', 'Marketing', 'Operations']} />
            <SearchableDropdown label="Cost Center" placeholder="Select Center" options={['Mumbai Branch', 'Delhi Branch', 'Web Campaign']} />
            <InputField label="Allocation Amount (₹)" type="number" placeholder="0.00" align="right" />
          </div>
        </FormSection>

        {/* 8. GST / TDS — Only for Cash & Bank Payment */}
        {!showContraTransfer && (
          <FormSection title="Taxation Details (GST / TDS)" defaultOpen={false} zIndex={40}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* GST */}
              <div className="rounded-xl border p-4" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(79,70,229,0.03)' : '#f8faff' }}>
                <div className="flex items-center gap-2 mb-3">
                  <input type="checkbox" className="w-4 h-4 rounded accent-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.text }}>GST Applicable</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SearchableDropdown placeholder="GST Ledger" compact options={['CGST @ 9%', 'SGST @ 9%', 'IGST @ 18%']} />
                  <SearchableDropdown placeholder="GST Rate" compact options={['5%', '12%', '18%', '28%']} />
                </div>
              </div>
              {/* TDS */}
              <div className="rounded-xl border p-4" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(79,70,229,0.03)' : '#f8faff' }}>
                <div className="flex items-center gap-2 mb-3">
                  <input type="checkbox" className="w-4 h-4 rounded accent-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.text }}>TDS Applicable</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SearchableDropdown placeholder="TDS Ledger" compact options={['TDS on Prof. Fees', 'TDS on Rent', 'TDS on Contract']} />
                  <SearchableDropdown placeholder="TDS %" compact options={['1%', '2%', '5%', '10%']} />
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {/* 9. Narration */}
        <FormSection title="Narration" zIndex={10}>
          <textarea
            className="w-full h-20 rounded-xl border p-4 text-[11px] font-bold outline-none transition-all focus:border-indigo-400 resize-none shadow-sm placeholder:text-slate-300"
            placeholder="Enter detailed narration here..."
            style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
          />
        </FormSection>

        {/* 10. Summary Footer */}
        <div className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Debit', value: '₹ 0.00' },
              { label: 'Total Credit', value: '₹ 0.00' },
              { label: 'Difference', value: '₹ 0.00' },
              { label: 'Status', value: 'Balanced', highlight: true },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 py-2">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.mutedText }}>{item.label}</span>
                <span className={`text-[14px] font-black ${item.highlight ? 'text-emerald-600' : ''}`} style={{ color: item.highlight ? undefined : theme.text }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-4 text-[10px] font-black uppercase tracking-widest opacity-30" style={{ color: theme.mutedText }}>
          Please Select Sundry Ledger
        </div>
      </div>
    </div>
  );
};

export default CreateFundFlow;
