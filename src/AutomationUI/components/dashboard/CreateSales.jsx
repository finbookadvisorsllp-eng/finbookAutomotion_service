import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Save,
  Send,
  CheckCircle2,
  Calendar,
  ChevronDown,
  Plus,
  Minus,
  Layout,
  Trash2,
  Settings,
  X,
  Search,
  MoreVertical,
  Check,
  ChevronUp,
  RefreshCw,
  Bot
} from 'lucide-react';

const CreateSales = ({ isDark, onBack }) => {
  const [activeTab, setActiveTab] = useState('With Item'); // Default to 'With Item' as requested
  const [salesRows, setSalesRows] = useState([{ id: Date.now(), srNo: 1 }]);
  const [productRows, setProductRows] = useState([{ id: Date.now(), srNo: 1 }]);
  const [journalRows, setJournalRows] = useState([{ id: Date.now(), srNo: 1 }]);
  const [additionalRows, setAdditionalRows] = useState([{ id: Date.now() + 1 }]);
  const [tdsRows, setTdsRows] = useState([{ id: Date.now() + 2 }]);
  const [tcsRows, setTcsRows] = useState([{ id: Date.now() + 3 }]);

  // Row Management Functions
  const addRow = (type) => {
    const id = Date.now();
    if (type === 'sales') setSalesRows([...salesRows, { id, srNo: salesRows.length + 1 }]);
    if (type === 'product') setProductRows([...productRows, { id, srNo: productRows.length + 1 }]);
    if (type === 'journal') setJournalRows([...journalRows, { id, srNo: journalRows.length + 1 }]);
    if (type === 'additional') setAdditionalRows([...additionalRows, { id }]);
    if (type === 'tds') setTdsRows([...tdsRows, { id }]);
    if (type === 'tcs') setTcsRows([...tcsRows, { id }]);
  };

  const removeRow = (type, id) => {
    if (type === 'sales' && salesRows.length > 1) {
      setSalesRows(salesRows.filter(r => r.id !== id).map((r, idx) => ({ ...r, srNo: idx + 1 })));
    }
    if (type === 'product' && productRows.length > 1) {
      setProductRows(productRows.filter(r => r.id !== id).map((r, idx) => ({ ...r, srNo: idx + 1 })));
    }
    if (type === 'journal' && journalRows.length > 1) {
      setJournalRows(journalRows.filter(r => r.id !== id).map((r, idx) => ({ ...r, srNo: idx + 1 })));
    }
    if (type === 'additional' && additionalRows.length > 1) {
      setAdditionalRows(additionalRows.filter(r => r.id !== id));
    }
    if (type === 'tds' && tdsRows.length > 1) {
      setTdsRows(tdsRows.filter(r => r.id !== id));
    }
    if (type === 'tcs' && tcsRows.length > 1) {
      setTcsRows(tcsRows.filter(r => r.id !== id));
    }
  };

  const theme = {
    bg: isDark ? 'transparent' : '#f8fafc',
    panel: isDark ? 'rgba(8, 21, 46, 0.4)' : '#fff',
    border: isDark ? 'rgba(9, 182, 185, 0.15)' : '#e2e8f0',
    headerBg: isDark ? 'rgba(11, 23, 54, 0.6)' : '#fcfdfe',
    text: isDark ? 'rgba(255, 255, 255, 0.82)' : '#1e293b',
    inputBg: isDark ? 'rgba(8, 21, 46, 0.6)' : '#fff',
    mutedText: isDark ? 'rgba(255, 255, 255, 0.58)' : '#64748b',
    accent: isDark ? '#09B6B9' : '#4f46e5',
    accentSoft: isDark ? 'rgba(9, 182, 185, 0.15)' : '#eef2ff',
    scrollbarThumb: isDark ? 'rgba(9, 182, 185, 0.3)' : '#cbd5e1',
    scrollbarTrack: isDark ? 'transparent' : '#f1f5f9'
  };

  const SummaryItem = ({ label, value, isLast }) => (
    <div className="flex items-center gap-1.5 px-4 h-8 shrink-0">
      <span className="text-[10px] font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>{label}:</span>
      <span className="text-[11px] font-black px-2 py-0.5 rounded" style={{ backgroundColor: theme.accentSoft, color: theme.accent }}>{value}</span>
      {!isLast && <div className="h-4 w-[1px] ml-4 opacity-20" style={{ backgroundColor: theme.border }} />}
    </div>
  );

  const FormSection = ({ title, children, hasSettings = true, defaultOpen = true, headerAction, zIndex = 1 }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
      <div className="mb-3 rounded-xl border shadow-sm transition-all duration-300" style={{ borderColor: theme.border, backgroundColor: theme.panel, backdropFilter: isDark ? 'blur(16px)' : undefined, zIndex: isOpen ? zIndex : 1, position: 'relative' }}>
        <div className="px-3 py-1.5 flex items-center justify-between border-b" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
          <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.text }}>{title}</h3>
          <div className="flex gap-2 items-center">
            {headerAction}
            {hasSettings && <button className="text-slate-400 hover:text-indigo-600 transition-colors"><Settings size={12} /></button>}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-5 h-5 rounded-full border flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all"
              style={{ borderColor: theme.border }}
            >
              {isOpen ? <Minus size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
            </button>
          </div>
        </div>
        <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 p-4 visible' : 'max-h-0 opacity-0 p-0 invisible overflow-hidden'}`}>
          {children}
        </div>
      </div>
    );
  };

  const SearchableDropdown = ({ label, placeholder, options = [], value, onChange, hasAdd, hasSearch = true, compact }) => {
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
              className={`w-full ${compact ? 'h-8' : 'h-9'} rounded-lg border px-3 flex items-center justify-between cursor-pointer transition-all ${isDark ? 'hover:border-[#09B6B9] focus-within:border-[#09B6B9] focus-within:shadow-[0_0_8px_rgba(9,182,185,0.4),inset_0_0_4px_rgba(0,0,0,0.5)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]' : 'hover:border-indigo-400 focus-within:border-indigo-400 shadow-sm'}`}
              style={{ borderColor: isOpen ? theme.accent : theme.border, backgroundColor: theme.inputBg }}
            >
              <span className={`text-[11px] font-bold truncate ${value ? 'text-indigo-500' : 'text-slate-400'}`}>
                {value || placeholder}
              </span>
              <div className="flex items-center gap-1 text-slate-400">
                {value && <X size={12} className="hover:text-red-500" onClick={(e) => { e.stopPropagation(); onChange(''); }} />}
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
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
                      onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                    >
                      {opt}
                    </div>
                  )) : (
                    <div className="p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">No results for "{search}"</p>
                      <button onClick={() => { onChange(search); setIsOpen(false); }} className="text-[9px] font-black text-indigo-600 hover:underline">Add "{search}" as new</button>
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

  const InputField = ({ label, placeholder, value, icon: Icon, type = "text", compact, readOnly, align = "left", onChange }) => (
    <div className="relative flex flex-col gap-1 w-full group">
      {label && (
        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-400 group-focus-within:text-indigo-600 transition-colors" style={{ backgroundColor: theme.panel }}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={`w-full ${compact ? 'h-8 px-2' : 'h-9 px-3'} rounded-lg border text-[11px] font-bold outline-none transition-all ${isDark ? 'focus:border-[#09B6B9] focus:shadow-[0_0_8px_rgba(9,182,185,0.4),inset_0_0_4px_rgba(0,0,0,0.5)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] placeholder:text-white/20' : 'focus:border-indigo-400 shadow-sm placeholder:text-slate-400'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60' : 'cursor-not-allowed bg-slate-50/50') : ''}`}
          style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
        />
        {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />}
      </div>
    </div>
  );

  const SummaryBar = ({ entries, base, cgst, sgst, igst, total }) => (
    <div className="mt-3 h-10 px-4 flex items-center justify-between border rounded-xl shadow-sm text-[10px] font-black uppercase tracking-tight overflow-x-auto no-scrollbar" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
      <div className="flex items-center gap-1.5 shrink-0">
        <span style={{ color: theme.mutedText }}>Number Of Entries :</span>
        <span className="bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded text-[11px]">{entries}</span>
      </div>
      <div className="flex items-center gap-6 shrink-0 ml-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><span style={{ color: theme.mutedText }}>BaseTotal :</span> <span className="text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">{base}</span></div>
          <div className="h-4 w-[1px] opacity-20" style={{ backgroundColor: theme.border }} />
          <div className="flex items-center gap-1.5"><span style={{ color: theme.mutedText }}>CGST :</span> <span className="text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">{cgst}</span></div>
          <div className="h-4 w-[1px] opacity-20" style={{ backgroundColor: theme.border }} />
          <div className="flex items-center gap-1.5"><span style={{ color: theme.mutedText }}>SGST :</span> <span className="text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">{sgst}</span></div>
          <div className="h-4 w-[1px] opacity-20" style={{ backgroundColor: theme.border }} />
          <div className="flex items-center gap-1.5"><span style={{ color: theme.mutedText }}>IGST :</span> <span className="text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">{igst}</span></div>
          <div className="h-4 w-[1px] opacity-20" style={{ backgroundColor: theme.border }} />
          <div className="flex items-center gap-1.5"><span style={{ color: theme.mutedText }}>Sub Total :</span> <span className="text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">{total}</span></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 h-full animate-in fade-in duration-500 overflow-hidden" style={{ backgroundColor: theme.bg }}>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme.accent}; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top Action Bar (Save/Approve) */}
      <div className="flex items-center justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black shadow-sm transition-all hover:scale-105 active:scale-95" style={{ borderColor: '#4f46e5', color: '#4f46e5', backgroundColor: theme.panel }}>
              <Save size={12} strokeWidth={3} /> Save Changes
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black shadow-sm transition-all hover:scale-105 active:scale-95" style={{ borderColor: '#a855f7', color: '#a855f7', backgroundColor: theme.panel }}>
              <Send size={12} strokeWidth={3} /> Push to Review
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black shadow-sm transition-all hover:scale-105 active:scale-95" style={{ borderColor: '#10b981', color: '#10b981', backgroundColor: theme.panel }}>
              <CheckCircle2 size={12} strokeWidth={3} /> Approve
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-1.5 rounded-lg border text-slate-400 hover:text-indigo-600 transition-colors" style={{ borderColor: theme.border, backgroundColor: theme.panel }}><Layout size={14} /></button>
        </div>
      </div>

      {/* Totals Row */}
      <div className="flex items-center border shadow-sm shrink-0 overflow-x-auto no-scrollbar py-1 rounded-xl mx-2" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <SummaryItem label="BaseTotal" value="0.00" />
        <SummaryItem label="SubTotal" value="0.00" />
        <SummaryItem label="CGST" value="0.00" />
        <SummaryItem label="SGST" value="0.00" />
        <SummaryItem label="IGST" value="0.00" />
        <SummaryItem label="TCS" value="0.00" />
        <SummaryItem label="Round-off" value="0.00" />
        <SummaryItem label="Grand Total" value="0.00" isLast />
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b shrink-0 px-2 mt-1" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        {['Without Item', 'With Item', 'Journal'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
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
            <InputField label="Invoice Date" icon={Calendar} placeholder="Invoice Date" />
            <InputField label="Voucher Date" icon={Calendar} placeholder="Voucher Date" />
            <SearchableDropdown label="Voucher Type" placeholder={activeTab === 'Journal' ? 'Journal' : 'Sales'} options={['Sales', 'Journal', 'Credit Note']} value={activeTab === 'Journal' ? 'Journal' : 'Sales'} />
            <SearchableDropdown label="Voucher Number Series" placeholder="Default" options={['Default', 'Manual']} value="Default" />
            <InputField label="Voucher Number" placeholder="Voucher Number" />
            <InputField label="Invoice Number" placeholder="Invoice Number" />
            {activeTab !== 'Journal' && <SearchableDropdown label="Sales Ledger" placeholder="Sales Ledger" options={['General Sales', 'Service Sales']} />}
            <SearchableDropdown label="GST Registration" placeholder="Madhya Pradesh Registration" options={['Madhya Pradesh Registration', 'Maharashtra Registration']} value="Madhya Pradesh Registration" />
            <InputField label="Party GSTIN" placeholder="Party GSTIN" />
            <SearchableDropdown label="Party Ledger" placeholder="Party Ledger" hasAdd options={['HDFC Bank', 'Cash']} />
            <SearchableDropdown label="Consignee Ledger" placeholder="Consignee Ledger" hasAdd options={['Same as Party', 'Branch A']} />
          </div>
        </FormSection>

        {/* Dynamic Table Section based on Tab */}
        {activeTab === 'Without Item' && (
          <FormSection title="Sales Details" zIndex={90} headerAction={<button onClick={() => addRow('sales')} className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><Plus size={12} strokeWidth={3} /></button>}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[800px]">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-2 w-10"></th>
                    <th className="px-2 w-16 text-center">Sr. No.</th>
                    <th className="px-2">Sales Ledger</th>
                    <th className="px-2">Description</th>
                    <th className="px-2">HSN/SAC Code</th>
                    <th className="px-2 text-right pr-10">Amount</th>
                    <th className="px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {salesRows.map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-2"><div className="w-7 h-7 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm"><Layout size={12} /></div></td>
                      <td className="px-2"><div className="h-9 w-full rounded-lg border flex items-center justify-center font-bold" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>{row.srNo}</div></td>
                      <td className="px-2"><SearchableDropdown placeholder="Select Sales Ledger" compact options={['General Sales']} /></td>
                      <td className="px-2"><InputField placeholder="Description" compact /></td>
                      <td className="px-2"><InputField placeholder="HSN/SAC" compact /></td>
                      <td className="px-2"><InputField value="0.00" align="right" compact /></td>
                      <td className="px-2"><button onClick={() => removeRow('sales', row.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Minus size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SummaryBar entries={salesRows.length} base="0.00" cgst="0.00" sgst="0.00" igst="0.00" total="0.00" />
          </FormSection>
        )}

        {activeTab === 'With Item' && (
          <FormSection title="Product Details" zIndex={90} headerAction={<button onClick={() => addRow('product')} className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><Plus size={12} strokeWidth={3} /></button>}>
            <div className="overflow-x-auto overflow-y-visible">
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
                    <th className="px-2">Taxability Type</th>
                    <th className="px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-2"><div className="w-7 h-7 rounded-full border border-purple-200 bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm"><Layout size={12} /></div></td>
                      <td className="px-2"><div className="h-8 w-full rounded-lg border flex items-center justify-center font-bold" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>{row.srNo}</div></td>
                      <td className="px-2"><SearchableDropdown placeholder="Stock Item" hasAdd compact options={['Monitor', 'Keyboard']} /></td>
                      <td className="px-2"><InputField placeholder="Description" compact /></td>
                      <td className="px-2"><InputField placeholder="HSN/SAC" compact /></td>
                      <td className="px-2"><InputField value="0.0000" align="right" compact /></td>
                      <td className="px-2"><InputField value="0.0000" align="right" compact /></td>
                      <td className="px-2"><InputField value="0.00%" align="right" compact /></td>
                      <td className="px-2"><InputField value="0.00" align="right" readOnly compact /></td>
                      <td className="px-2 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600" /></td>
                      <td className="px-2"><SearchableDropdown placeholder="Taxable" value="Taxable" compact options={['Taxable', 'Exempt']} /></td>
                      <td className="px-2"><button onClick={() => removeRow('product', row.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Minus size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SummaryBar entries={productRows.length} base="0.00" cgst="0.00" sgst="0.00" igst="0.00" total="0.00" />
          </FormSection>
        )}

        {activeTab === 'Journal' && (
          <FormSection title="Sales Details" zIndex={90} headerAction={<button onClick={() => addRow('journal')} className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><Plus size={12} strokeWidth={3} /></button>}>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[1000px] mb-20">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-2 w-10"></th>
                    <th className="px-2 w-16 text-center">Sr. No.</th>
                    <th className="px-2">Sales Ledger</th>
                    <th className="px-2">Description</th>
                    <th className="px-2">HSN/SAC Code</th>
                    <th className="px-2 text-right">Amount</th>
                    <th className="px-2">RCM</th>
                    <th className="px-2">Taxability Type</th>
                    <th className="px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {journalRows.map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-2"><div className="w-7 h-7 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm"><Layout size={12} /></div></td>
                      <td className="px-2"><div className="h-8 w-full rounded-lg border flex items-center justify-center font-bold" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>{row.srNo}</div></td>
                      <td className="px-2"><SearchableDropdown placeholder="Select Sales Ledger" compact options={['Sales Ledger A']} /></td>
                      <td className="px-2"><InputField placeholder="Description" compact /></td>
                      <td className="px-2"><InputField placeholder="HSN/SAC" compact /></td>
                      <td className="px-2"><InputField value="0.00" align="right" compact /></td>
                      <td className="px-2 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600" /></td>
                      <td className="px-2"><SearchableDropdown placeholder="Taxable" value="Taxable" compact options={['Taxable', 'Exempt']} /></td>
                      <td className="px-2"><button onClick={() => removeRow('journal', row.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Minus size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SummaryBar entries={journalRows.length} base="0.00" cgst="0.00" sgst="0.00" igst="0.00" total="0.00" />
          </FormSection>
        )}

        {/* Additional Item Details */}
        <FormSection title="Additional Item Details" zIndex={80} headerAction={<button onClick={() => addRow('additional')} className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><Plus size={12} strokeWidth={3} /></button>}>
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[600px] mb-20">
              <thead>
                <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                  <th className="px-2 w-10 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600 shadow-sm" /></th>
                  <th className="px-2">Taxable Value</th>
                  <th className="px-2">Ledger Name</th>
                  <th className="px-2 text-right pr-10">Amount</th>
                  <th className="px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {additionalRows.map((row) => (
                  <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                    <td className="px-2 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-200 accent-indigo-600 shadow-sm" /></td>
                    <td className="px-2"><InputField placeholder="Taxable Value" compact /></td>
                    <td className="px-2"><SearchableDropdown placeholder="Select Ledger" compact options={['Freight Charges']} /></td>
                    <td className="px-2"><div className="flex items-center gap-2"><InputField value="0.00" align="right" compact /><button onClick={() => removeRow('additional', row.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Minus size={14} /></button></div></td>
                    <td className="px-2 w-10"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SummaryBar entries={additionalRows.length} base="0.00" cgst="0.00" sgst="0.00" igst="0.00" total="0.00" />
        </FormSection>

        {/* GST Details */}
        <FormSection title="GST Details" zIndex={70}>
          <div className="border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
            <div className="p-6 text-center text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: theme.headerBg, color: theme.mutedText }}>
              No Entries Are Available
            </div>
            <table className="w-full text-left text-[10px]">
              <thead className="border-y" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                  <th className="p-3">GST Type</th>
                  <th className="p-3">Ledger Name</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </FormSection>

        {/* TDS & TCS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <FormSection title="TDS Details" zIndex={60}>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[400px] mb-20">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-2">Ledger Name</th>
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
                  {tdsRows.map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-1"><SearchableDropdown placeholder="TDS Ledger" compact options={['TDS on Services']} /></td>
                      <td className="px-1"><InputField value="0.00" align="right" compact /></td>
                      <td className="px-1"><InputField value="0.00%" align="right" compact /></td>
                      <td className="px-1"><InputField value="0.00" align="right" readOnly compact /></td>
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
              <span>Number Of Entries: {tdsRows.length}</span>
              <span>Total: 0.00</span>
            </div>
          </FormSection>

          <FormSection title="TCS Details" zIndex={60}>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left text-[10px] border-separate border-spacing-y-2 min-w-[400px] mb-20">
                <thead>
                  <tr className="font-black uppercase tracking-tight" style={{ color: theme.mutedText }}>
                    <th className="px-2">Ledger Name</th>
                    <th className="px-2">Assessable Value</th>
                    <th className="px-2">Rate</th>
                    <th className="px-2">Amount</th>
                    <th className="px-2 w-10 text-right">
                      <button onClick={() => addRow('tcs')} className="w-7 h-7 rounded-full border border-emerald-200 bg-white shadow-sm flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all">
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tcsRows.map((row) => (
                    <tr key={row.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-1"><SearchableDropdown placeholder="TCS Ledger" compact options={['TCS on Sales']} /></td>
                      <td className="px-1"><InputField value="0.00" align="right" compact /></td>
                      <td className="px-1"><InputField value="0.00%" align="right" compact /></td>
                      <td className="px-1"><InputField value="0.00" align="right" readOnly compact /></td>
                      <td className="px-1 text-right">
                        <button onClick={() => removeRow('tcs', row.id)} className="w-7 h-7 rounded-full border border-red-200 bg-white shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 transition-all">
                          <Minus size={14} strokeWidth={3} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between font-black text-[9px] uppercase rounded-lg border px-3 py-1.5 shadow-sm" style={{ backgroundColor: theme.accentSoft, borderColor: theme.border, color: theme.accent }}>
              <span>Number Of Entries: {tcsRows.length}</span>
              <span>Total: 0.00</span>
            </div>
          </FormSection>
        </div>

        <div className="text-center py-4 text-[10px] font-black uppercase tracking-widest opacity-30" style={{ color: theme.mutedText }}>
          Please Select Sundry Ledger
        </div>

        {/* Narration */}
        <FormSection title="Narration" zIndex={10}>
          <textarea
            className="w-full h-20 rounded-xl border p-4 text-[11px] font-bold outline-none transition-all focus:border-indigo-400 resize-none shadow-sm placeholder:text-slate-300"
            placeholder="Enter narration here..."
            style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
          />
        </FormSection>

        {/* ADVANCED SALES INBOX DETAILS */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <h2 className="text-[14px] font-black tracking-tight" style={{ color: theme.text }}>Sales Inbox Details</h2>
            <div className="h-[1px] flex-1 ml-4 opacity-20" style={{ backgroundColor: theme.text }}></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <FormSection title="AI-OCR Extracted Data" defaultOpen>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Confidence Score" value="98.5%" readOnly />
                  <InputField label="Extracted Invoice No" value="INV-2024-8892" readOnly />
                  <InputField label="Extracted Date" value="05-May-2026" readOnly />
                  <InputField label="Extracted Total" value="₹14,750.00" readOnly />
                </div>
                <div className="mt-4 p-3 rounded-lg border text-[10px] font-bold text-slate-500" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                  Original Document: <a href="#" className="text-indigo-600 hover:underline">Scan_05052026.pdf</a>
                </div>
              </FormSection>
              
              <FormSection title="Linked References" defaultOpen>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 rounded-lg border" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                    <div className="flex items-center gap-2">
                      <Layout size={14} className="text-indigo-500" />
                      <span className="text-[11px] font-bold">Sales Order: SO-2026-004</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Fulfilled</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                    <div className="flex items-center gap-2">
                      <Layout size={14} className="text-purple-500" />
                      <span className="text-[11px] font-bold">Quotation: QT-2026-012</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-500/10 px-2 py-0.5 rounded">Approved</span>
                  </div>
                </div>
              </FormSection>
            </div>

            <div className="space-y-4">
              <FormSection title="Transaction Tracking" defaultOpen>
                <div className="flex flex-col gap-4 relative before:absolute before:inset-0 before:ml-3 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-emerald-500 text-slate-50 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <Check size={12} />
                    </div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-2 rounded-lg border" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-slate-700 text-[10px]">Data Extracted</div>
                        <time className="text-[9px] font-medium text-slate-500">10:00 AM</time>
                      </div>
                      <div className="text-[9px] text-slate-500">System Auto-OCR</div>
                    </div>
                  </div>
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-indigo-500 text-slate-50 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <RefreshCw size={12} />
                    </div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-2 rounded-lg border" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-slate-700 text-[10px]">Verification Pending</div>
                        <time className="text-[9px] font-medium text-slate-500">10:05 AM</time>
                      </div>
                      <div className="text-[9px] text-slate-500">Awaiting user review</div>
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Activity Logs & Comments" defaultOpen>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0"></div>
                    <div className="flex-1 bg-slate-50 rounded-lg p-2 text-[10px] text-slate-600">
                      <span className="font-bold text-slate-700">Aman:</span> Please verify the HSN code for item 2.
                    </div>
                  </div>
                  <div className="flex gap-2 items-center mt-2">
                    <input type="text" placeholder="Add a comment..." className="flex-1 h-8 rounded-lg border px-2 text-[10px] outline-none" />
                    <button className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center"><Send size={12} /></button>
                  </div>
                </div>
              </FormSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSales;
