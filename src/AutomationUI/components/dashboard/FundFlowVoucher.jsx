import React, { useState } from 'react';
import {
  FileText, ArrowLeft, Save, FileCode2, Eye, RotateCcw,
  Building2, Calendar, FileDigit, Hash, Link as LinkIcon,
  CreditCard, Landmark, Wallet, Plus, Minus, Search,
  ChevronDown, ChevronUp, FileUp, ShieldCheck, Banknote,
  Receipt, Calculator, CheckCircle2, X
} from 'lucide-react';

const mockLedgers = ['ABC Traders', 'Cash Account', 'SBI Bank', 'HDFC Bank', 'Vendor Account'];
const mockCostCategories = ['Primary Cost Category', 'Marketing', 'Operations'];
const mockCostCenters = ['Mumbai Branch', 'Delhi Branch', 'Web Campaign'];

const FundFlowVoucher = ({ isDark, defaultType = 'Payment', onBack }) => {
  const [voucherType, setVoucherType] = useState(defaultType);
  const [paymentMode, setPaymentMode] = useState('Bank');
  const [enableCostCenter, setEnableCostCenter] = useState(false);
  const [showBillAlloc, setShowBillAlloc] = useState(true);
  const [showGst, setShowGst] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    voucherDate: '2026-05-07',
    voucherNumber: 'VCH-2026-001',
    refNumber: '',
    narration: '',
    companyName: 'Main Company Ltd',
    currency: 'INR',
    partyLedger: '',
    againstLedger: '',
    amount: '',
    // Bank specific
    bankLedger: '',
    instNumber: '',
    instDate: '',
    transType: 'NEFT',
    utrNumber: '',
    ifscCode: '',
    branchName: '',
    // Cash specific
    cashLedger: '',
    cashAmount: '',
  });

  const theme = {
    bg: 'var(--app-content-bg)',
    panelBg: 'var(--app-panel-bg)',
    border: 'var(--app-border)',
    text: 'var(--app-heading)',
    mutedText: 'var(--app-muted)',
    primary: 'var(--app-accent)',
    inputBg: 'var(--app-control-bg)',
    cardGradient: isDark 
      ? 'linear-gradient(145deg, rgba(8,21,46,0.7) 0%, rgba(11,23,54,0.9) 100%)' 
      : 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.6) 100%)',
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const InputField = ({ label, type = 'text', icon: Icon, value, onChange, placeholder, readOnly }) => (
    <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
      <label className="text-[9.5px] font-black uppercase tracking-widest opacity-80" style={{ color: theme.mutedText }}>
        {label}
      </label>
      <div className="relative group">
        {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity" size={13} style={{ color: theme.primary }} />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={`w-full h-8 rounded-lg border text-[11px] font-bold outline-none transition-all shadow-sm
            ${Icon ? 'pl-8' : 'pl-3'} pr-3
            ${readOnly ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : 'focus:ring-4 hover:border-indigo-300 dark:hover:border-cyan-800'}`}
          style={{ 
            backgroundColor: readOnly ? undefined : theme.inputBg, 
            borderColor: theme.border, 
            color: theme.text,
            '--tw-ring-color': isDark ? 'rgba(9,182,185,0.1)' : 'rgba(79,70,229,0.1)'
          }}
        />
      </div>
    </div>
  );

  const SelectField = ({ label, icon: Icon, value, onChange, options }) => (
    <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
      <label className="text-[9.5px] font-black uppercase tracking-widest opacity-80" style={{ color: theme.mutedText }}>
        {label}
      </label>
      <div className="relative group">
        {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity z-10" size={13} style={{ color: theme.primary }} />}
        <select
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          className={`w-full h-8 rounded-lg border text-[11px] font-bold outline-none transition-all shadow-sm appearance-none
            ${Icon ? 'pl-8' : 'pl-3'} pr-8
            focus:ring-4 hover:border-indigo-300 dark:hover:border-cyan-800`}
          style={{ 
            backgroundColor: theme.inputBg, 
            borderColor: theme.border, 
            color: theme.text,
            '--tw-ring-color': isDark ? 'rgba(9,182,185,0.1)' : 'rgba(79,70,229,0.1)'
          }}
        >
          <option value="" disabled>Select {label}</option>
          {options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={13} />
      </div>
    </div>
  );

  const FormSection = ({ title, icon: Icon, children, collapsible, isCollapsed, onToggle }) => (
    <div className="rounded-xl border shadow-sm backdrop-blur-md overflow-hidden transition-all duration-300"
         style={{ background: theme.cardGradient, borderColor: theme.border }}>
      <div 
        className={`px-4 py-3 flex items-center justify-between border-b ${collapsible ? 'cursor-pointer hover:bg-white/5' : ''}`}
        style={{ borderColor: theme.border }}
        onClick={collapsible ? onToggle : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
            <Icon size={14} strokeWidth={2.5} />
          </div>
          <h2 className="text-[12px] font-black uppercase tracking-widest" style={{ color: theme.text }}>{title}</h2>
        </div>
        {collapsible && (
          <div className="opacity-50 transition-transform duration-300" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0)' }}>
            <ChevronUp size={14} />
          </div>
        )}
      </div>
      <div className={`transition-all duration-300 ease-in-out origin-top ${isCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'} grid`}>
        <div className="overflow-hidden">
          <div className="p-4 flex flex-wrap gap-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative" style={{ backgroundColor: theme.bg }}>
      {/* Background Ambience */}
      {isDark && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] opacity-20" style={{ backgroundColor: '#005ED9' }}></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-10" style={{ backgroundColor: '#09B6B9' }}></div>
          <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] rounded-full blur-[80px] opacity-15" style={{ backgroundColor: '#8b5cf6' }}></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
        </div>
      )}
      {!isDark && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-40" style={{ backgroundColor: '#e0e7ff' }}></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-40" style={{ backgroundColor: '#cffafe' }}></div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar z-10 p-4 lg:p-6 pb-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:scale-110 shadow-sm bg-white/50 backdrop-blur-sm"
              style={{ borderColor: theme.border, color: theme.text }}>
              <ArrowLeft size={16} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                  Fund Flow
                </div>
                <div className="text-[10px] font-bold opacity-50 uppercase tracking-widest" style={{ color: theme.text }}>Tally XML Generator</div>
              </div>
              <h1 className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>
                Voucher Entry
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
                    style={{ borderColor: theme.border, color: theme.text }} title="Reset Form">
              <RotateCcw size={14} />
            </button>
            <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:scale-[1.02] active:scale-95 shadow-sm font-bold text-[11px]"
                    style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.inputBg }}>
              <Eye size={13} className="text-purple-500" />
              Preview XML
            </button>
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-md font-bold text-[11px] text-white"
                    style={{ backgroundImage: 'linear-gradient(to right, #4f46e5, #6366f1)' }}>
              <Save size={13} />
              Save Draft
            </button>
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-md font-bold text-[11px] text-white"
                    style={{ backgroundImage: 'linear-gradient(to right, #10b981, #059669)' }}>
              <FileCode2 size={13} />
              Generate
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 fill-mode-both">
          
          {/* Main Controls - Type & Mode */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 rounded-xl border shadow-sm backdrop-blur-md p-3 flex items-center justify-between" style={{ background: theme.cardGradient, borderColor: theme.border }}>
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                   <FileText size={15} />
                 </div>
                 <div>
                   <h3 className="text-[11px] font-black uppercase tracking-widest" style={{ color: theme.text }}>Voucher Type</h3>
                   <p className="text-[9px] font-bold opacity-60" style={{ color: theme.mutedText }}>Select the transaction context</p>
                 </div>
               </div>
               <div className="flex items-center rounded-lg p-1 bg-black/5 dark:bg-white/5">
                 {['Payment', 'Receipt'].map(type => (
                   <button 
                     key={type} onClick={() => setVoucherType(type)}
                     className={`px-5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${voucherType === type ? 'shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                     style={{ backgroundColor: voucherType === type ? theme.inputBg : 'transparent', color: voucherType === type ? theme.primary : theme.text }}
                   >
                     {type}
                   </button>
                 ))}
               </div>
            </div>

            <div className="flex-1 rounded-xl border shadow-sm backdrop-blur-md p-3 flex items-center justify-between" style={{ background: theme.cardGradient, borderColor: theme.border }}>
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                   <CreditCard size={15} />
                 </div>
                 <div>
                   <h3 className="text-[11px] font-black uppercase tracking-widest" style={{ color: theme.text }}>Payment Mode</h3>
                   <p className="text-[9px] font-bold opacity-60" style={{ color: theme.mutedText }}>Source of funds</p>
                 </div>
               </div>
               <div className="flex items-center rounded-lg p-1 bg-black/5 dark:bg-white/5">
                 {['Cash', 'Bank'].map(mode => (
                   <button 
                     key={mode} onClick={() => setPaymentMode(mode)}
                     className={`px-5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${paymentMode === mode ? 'shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                     style={{ backgroundColor: paymentMode === mode ? theme.inputBg : 'transparent', color: paymentMode === mode ? (mode === 'Cash' ? '#10b981' : '#3b82f6') : theme.text }}
                   >
                     {mode}
                   </button>
                 ))}
               </div>
            </div>
          </div>
          
          {/* 1. Header Section */}
          <FormSection title="Voucher Details" icon={FileText}>
            <InputField label="Voucher Date" type="date" icon={Calendar} value={formData.voucherDate} onChange={v => handleInputChange('voucherDate', v)} />
            <InputField label="Voucher Number" icon={Hash} value={formData.voucherNumber} onChange={v => handleInputChange('voucherNumber', v)} />
            <InputField label="Reference Number" icon={LinkIcon} value={formData.refNumber} onChange={v => handleInputChange('refNumber', v)} placeholder="e.g. REF-001" />
            <SelectField label="Company Name" icon={Building2} value={formData.companyName} onChange={v => handleInputChange('companyName', v)} options={['Main Company Ltd', 'Subsidiary Pvt Ltd']} />
            <SelectField label="Currency" icon={Banknote} value={formData.currency} onChange={v => handleInputChange('currency', v)} options={['INR', 'USD', 'EUR', 'GBP']} />
          </FormSection>

          {/* 2. Party Details */}
          <FormSection title="Party & Allocation" icon={ShieldCheck}>
            <SelectField label="Party Ledger" icon={Search} value={formData.partyLedger} onChange={v => handleInputChange('partyLedger', v)} options={mockLedgers} />
            <SelectField label="Against Ledger" icon={Search} value={formData.againstLedger} onChange={v => handleInputChange('againstLedger', v)} options={mockLedgers} />
            <InputField label="Amount" type="number" icon={Calculator} value={formData.amount} onChange={v => handleInputChange('amount', v)} placeholder="0.00" />
            <InputField label="Dr/Cr Type" value={voucherType === 'Payment' ? 'Debit (Dr)' : 'Credit (Cr)'} readOnly />
            <InputField label="Ledger Group" value="Sundry Creditors" readOnly />
          </FormSection>

          {/* 3. Conditional Bank Section */}
          {paymentMode === 'Bank' && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <FormSection title="Bank Instrument Details" icon={Landmark}>
                <SelectField label="Bank Ledger" icon={Landmark} value={formData.bankLedger} onChange={v => handleInputChange('bankLedger', v)} options={['SBI Bank', 'HDFC Bank', 'ICICI Bank']} />
                <SelectField label="Transaction Type" value={formData.transType} onChange={v => handleInputChange('transType', v)} options={['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque']} />
                <InputField label="Instrument Number" icon={FileDigit} value={formData.instNumber} onChange={v => handleInputChange('instNumber', v)} placeholder="Cheque/Ref No" />
                <InputField label="Instrument Date" type="date" icon={Calendar} value={formData.instDate} onChange={v => handleInputChange('instDate', v)} />
                <InputField label="UTR Number" icon={Hash} value={formData.utrNumber} onChange={v => handleInputChange('utrNumber', v)} placeholder="UTR..." />
                <InputField label="IFSC Code" value={formData.ifscCode} onChange={v => handleInputChange('ifscCode', v)} placeholder="SBIN0001234" />
                <InputField label="Branch Name" value={formData.branchName} onChange={v => handleInputChange('branchName', v)} placeholder="Mumbai Main" />
              </FormSection>
            </div>
          )}

          {/* 4. Conditional Cash Section */}
          {paymentMode === 'Cash' && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <FormSection title="Cash Details" icon={Wallet}>
                <SelectField label="Cash Ledger" icon={Wallet} value={formData.cashLedger} onChange={v => handleInputChange('cashLedger', v)} options={['Main Cash Account', 'Fund Flow Cash']} />
                <InputField label="Cash Amount" type="number" icon={Calculator} value={formData.cashAmount} onChange={v => handleInputChange('cashAmount', v)} placeholder="0.00" />
              </FormSection>
            </div>
          )}

          {/* 5. Bill Allocation (Collapsible) */}
          <FormSection title="Bill Allocation" icon={Receipt} collapsible isCollapsed={!showBillAlloc} onToggle={() => setShowBillAlloc(!showBillAlloc)}>
            <SelectField label="Bill Type" options={['New Ref', 'Against Ref', 'Advance', 'On Account']} />
            <InputField label="Bill Reference" placeholder="Inv-001" />
            <InputField label="Bill Amount" type="number" placeholder="0.00" />
            <InputField label="Due Date" type="date" />
          </FormSection>

          {/* 6. Cost Center Section */}
          <div className="rounded-xl border shadow-sm backdrop-blur-md overflow-hidden transition-all duration-300 p-4 flex flex-col gap-4"
               style={{ background: theme.cardGradient, borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm bg-purple-500/10 text-purple-500">
                  <Building2 size={16} strokeWidth={2.5} />
                </div>
                <h2 className="text-[13px] font-black uppercase tracking-widest" style={{ color: theme.text }}>Cost Center Allocation</h2>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={enableCostCenter}
                  onChange={(e) => setEnableCostCenter(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500 cursor-pointer shadow-sm" 
                  style={{ borderColor: theme.border }} 
                />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.mutedText }}>Enable Cost Center</span>
              </label>
            </div>
            
            {enableCostCenter && (
              <div className="flex flex-wrap gap-5 animate-in fade-in slide-in-from-top-2 duration-300 pt-4 border-t" style={{ borderColor: theme.border }}>
                <SelectField label="Cost Category" options={mockCostCategories} />
                <SelectField label="Cost Center" options={mockCostCenters} />
                <InputField label="Allocation Amount" type="number" placeholder="0.00" />
              </div>
            )}
          </div>

          {/* 7. GST / TDS Section */}
          <FormSection title="Taxation Details (GST/TDS)" icon={Calculator} collapsible isCollapsed={!showGst} onToggle={() => setShowGst(!showGst)}>
             <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="flex flex-col gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded accent-indigo-500 cursor-pointer shadow-sm" />
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.text }}>GST Applicable</span>
                  </label>
                  <SelectField label="GST Ledger" options={['CGST @ 9%', 'SGST @ 9%', 'IGST @ 18%']} />
                  <SelectField label="GST Rate" options={['5%', '12%', '18%', '28%']} />
               </div>
               <div className="flex flex-col gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded accent-indigo-500 cursor-pointer shadow-sm" />
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.text }}>TDS Applicable</span>
                  </label>
                  <SelectField label="TDS Ledger" options={['TDS on Professional Fees', 'TDS on Rent']} />
                  <SelectField label="TDS Percentage" options={['1%', '2%', '10%']} />
               </div>
             </div>
          </FormSection>

          {/* Narration & Attachments */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-2xl border shadow-sm backdrop-blur-md overflow-hidden p-5 flex flex-col gap-3"
                 style={{ background: theme.cardGradient, borderColor: theme.border }}>
               <label className="text-[10px] font-black uppercase tracking-widest opacity-80" style={{ color: theme.mutedText }}>
                 Voucher Narration
               </label>
               <textarea 
                  className="w-full flex-1 rounded-xl border p-4 text-[12px] font-bold outline-none transition-all focus:border-indigo-400 resize-none shadow-sm placeholder:text-slate-400"
                  placeholder="Enter detailed narration here..."
                  value={formData.narration}
                  onChange={e => handleInputChange('narration', e.target.value)}
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
               />
            </div>
            
            <div className="rounded-2xl border shadow-sm backdrop-blur-md overflow-hidden p-5 flex flex-col gap-4"
                 style={{ background: theme.cardGradient, borderColor: theme.border }}>
               <h2 className="text-[13px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: theme.text }}>
                 <FileUp size={16} className="text-indigo-500" />
                 Attachments
               </h2>
               <div className="flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 p-6 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/10 cursor-pointer"
                    style={{ borderColor: theme.border }}>
                  <FileUp size={24} className="text-indigo-400" />
                  <div className="text-center">
                    <div className="text-[11px] font-bold" style={{ color: theme.primary }}>Click to upload</div>
                    <div className="text-[9px] font-bold mt-1" style={{ color: theme.mutedText }}>Invoice or Receipt (Max 5MB)</div>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>

          {/* Main action buttons have been moved to the top header for a modern SaaS feel. */}

      {/* Preview Modal Overlay */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
               style={{ backgroundColor: theme.panelBg, borderColor: theme.border, borderStyle: 'solid', borderWidth: 1 }}>
            <div className="px-6 py-4 border-b flex items-center justify-between bg-white/50 dark:bg-slate-900/50" style={{ borderColor: theme.border }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
                  <FileCode2 size={16} />
                </div>
                <div>
                  <h3 className="font-black text-[14px] uppercase tracking-widest" style={{ color: theme.text }}>Tally XML Payload</h3>
                  <p className="text-[10px] font-bold" style={{ color: theme.mutedText }}>Preview Mode - Read Only</p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      style={{ borderColor: theme.border, color: theme.text }}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 bg-[#1e1e1e] font-mono text-[12px] text-[#d4d4d4] overflow-y-auto max-h-[60vh] leading-relaxed custom-scrollbar">
{`<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="${voucherType}" ACTION="Create">
            <DATE>${formData.voucherDate.replace(/-/g, '')}</DATE>
            <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${formData.voucherNumber}</VOUCHERNUMBER>
            <REFERENCE>${formData.refNumber}</REFERENCE>
            <NARRATION>${formData.narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${formData.partyLedger || 'ABC Traders'}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${voucherType === 'Payment' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${voucherType === 'Payment' ? '-' : ''}${formData.amount || '0'}</AMOUNT>
              ${showBillAlloc ? `
              <BILLALLOCATIONS.LIST>
                <NAME>Inv-001</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>${voucherType === 'Payment' ? '-' : ''}${formData.amount || '0'}</AMOUNT>
              </BILLALLOCATIONS.LIST>` : ''}
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${paymentMode === 'Bank' ? formData.bankLedger : formData.cashLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${voucherType === 'Payment' ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${voucherType === 'Payment' ? '' : '-'}${formData.amount || '0'}</AMOUNT>
              ${paymentMode === 'Bank' ? `
              <BANKALLOCATIONS.LIST>
                <DATE>${formData.instDate.replace(/-/g, '')}</DATE>
                <INSTRUMENTNUMBER>${formData.instNumber}</INSTRUMENTNUMBER>
                <TRANSACTIONTYPE>${formData.transType}</TRANSACTIONTYPE>
                <AMOUNT>${voucherType === 'Payment' ? '' : '-'}${formData.amount || '0'}</AMOUNT>
              </BANKALLOCATIONS.LIST>` : ''}
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`}
            </div>
            <div className="p-4 border-t flex justify-end gap-3 bg-white/50 dark:bg-slate-900/50" style={{ borderColor: theme.border }}>
              <button onClick={() => setShowPreview(false)} className="px-5 py-2 rounded-lg font-bold text-[12px] border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                      style={{ borderColor: theme.border, color: theme.text }}>
                Close Preview
              </button>
              <button className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-[12px] text-white shadow-md hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: theme.primary }}>
                <CheckCircle2 size={14} />
                Confirm & Generate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FundFlowVoucher;
