import React, { useState } from 'react';
import { 
  Save, 
  Search, 
  Plus, 
  Minus, 
  ChevronUp, 
  ChevronDown,
  Calendar,
  User,
  Hash
} from 'lucide-react';

const FormSection = ({ title, children, isDark }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="rounded-xl border mb-4 overflow-hidden shadow-sm" 
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
      <div 
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer border-b" 
        style={{ borderColor: 'var(--app-row-border)', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-[12px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>{title}</h3>
        {isOpen ? <ChevronUp size={14} className="opacity-40" /> : <ChevronDown size={14} className="opacity-40" />}
      </div>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};

const SummaryItem = ({ label, value, isLast, isDark }) => (
  <div className="flex items-center gap-1.5 px-3 h-8">
    <span className="text-[10px] font-bold opacity-70 uppercase tracking-tight" style={{ color: 'var(--app-text)' }}>{label}:</span>
    <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-indigo-100 shadow-sm" style={{ background: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>{value}</span>
    {!isLast && <div className="ml-3 w-[1px] h-4 opacity-10" style={{ backgroundColor: 'var(--app-text)' }} />}
  </div>
);

const InputField = ({ label, icon: Icon, placeholder, type = "text", isDark, value }) => (
  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
    <label className="text-[10px] font-semibold opacity-60 px-1" style={{ color: 'var(--app-text)' }}>{label}</label>
    <div className="relative group">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity" size={12} />}
      <input 
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="w-full h-8 rounded-md border text-[11px] outline-none transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
        style={{ 
          backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', 
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
          paddingLeft: Icon ? '32px' : '10px'
        }}
      />
    </div>
  </div>
);

const CreateQuotation = ({ isDark, onBack }) => {
  return (
    <div className="flex flex-col gap-2.5 h-full animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden" style={{ color: 'var(--app-text)' }}>
      {/* Header Row */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <h1 className="text-xl font-extrabold tracking-tighter" style={{ color: 'var(--app-accent)' }}>Quotation - Transaction mode</h1>
        <div className="flex items-center gap-2">
          <button 
            className="flex items-center gap-1.5 px-6 py-2 rounded-full text-[11px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:scale-105 active:scale-95 group text-white border-none"
            style={{ background: 'var(--app-accent-gradient)' }}
          >
            <Save size={14} className="group-hover:rotate-12 transition-transform" /> Save Changes
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap items-center bg-white rounded-xl border shadow-[0_4px_12px_rgba(0,0,0,0.03)] shrink-0 overflow-x-auto no-scrollbar p-1" 
        style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#ffffff' }}>
        <SummaryItem label="BaseTotal" value="0.00" isDark={isDark} />
        <SummaryItem label="SubTotal" value="0.00" isDark={isDark} />
        <SummaryItem label="CGST" value="0.00" isDark={isDark} />
        <SummaryItem label="SGST" value="0.00" isDark={isDark} />
        <SummaryItem label="IGST" value="0.00" isDark={isDark} />
        <SummaryItem label="Round-off" value="0.00" isDark={isDark} />
        <SummaryItem label="Grand Total" value="0.00" isLast isDark={isDark} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-8">
        {/* Toggle Bar */}
        <div className="flex items-center gap-5 p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md" 
          style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#ffffff' }}>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold opacity-60 uppercase tracking-wider" style={{ color: 'var(--app-text)' }}>Is With Item?</span>
            <span className="text-[10px] font-extrabold tracking-widest mt-0.5 text-emerald-500">ENABLED</span>
          </div>
          <button 
            className="relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner bg-emerald-500"
            style={{ backgroundColor: 'var(--app-accent)' }}
          >
            <span className="inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md transition-transform duration-300 translate-x-6.5" />
          </button>
        </div>

        <FormSection title="Basic Details" isDark={isDark}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <InputField label="Quotation Number" icon={Hash} value="2" isDark={isDark} />
            <InputField label="Quotation Date" icon={Calendar} type="date" isDark={isDark} />
            <InputField label="Party Name" icon={User} placeholder="Search Party" isDark={isDark} />
            <InputField label="Party GSTIN" placeholder="GSTIN Number" isDark={isDark} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputField label="Address" placeholder="Enter Address" isDark={isDark} />
            <InputField label="Phone No" placeholder="Phone Number" isDark={isDark} />
            <InputField label="Email Id" placeholder="Email Address" isDark={isDark} />
            <InputField label="Valid Upto" type="date" isDark={isDark} />
          </div>
        </FormSection>

        <FormSection title="Product Details" isDark={isDark}>
          <div className="overflow-hidden border rounded-lg" style={{ borderColor: 'var(--app-row-border)' }}>
            <table className="w-full text-left text-[11px] border-collapse">
              <thead style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <tr>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Product Name</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Description</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>HSN/SAC Code</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Quantity</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Unit</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Rate</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Discount</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Amount</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                <tr className="transition hover:bg-gray-50/50" style={{ backgroundColor: isDark ? 'transparent' : '#ffffff' }}>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <div className="relative group">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100" size={12} />
                      <input className="w-full h-8 border rounded px-2 text-[11px] outline-none transition focus:border-indigo-400" 
                        style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                    </div>
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input className="w-full h-8 border rounded px-2 text-[11px] outline-none" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input className="w-full h-8 border rounded px-2 text-[11px] outline-none" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input type="number" defaultValue="0.0000" className="w-full h-8 border rounded px-2 text-[11px] outline-none text-right font-medium" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input className="w-full h-8 border rounded px-2 text-[11px] outline-none" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input type="number" defaultValue="0.0000" className="w-full h-8 border rounded px-2 text-[11px] outline-none text-right font-medium" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input defaultValue="0.00%" className="w-full h-8 border rounded px-2 text-[11px] outline-none text-right font-medium" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input defaultValue="0.00" readOnly className="w-full h-8 border rounded px-2 text-[11px] outline-none text-right font-bold" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#f8fafc', color: 'var(--app-accent)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <div className="flex flex-col gap-1 items-center">
                      <button className="p-1 rounded-full text-green-600 hover:bg-green-50 transition border border-green-100"><Plus size={12} /></button>
                      <button className="p-1 rounded-full text-red-600 hover:bg-red-50 transition border border-red-100"><Minus size={12} /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 flex flex-wrap items-center justify-between bg-indigo-50/30 rounded-lg border border-indigo-100 text-[10px] font-bold uppercase tracking-wider text-indigo-900">
            <div className="flex items-center gap-2">Number Of Entries: <span className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm">1</span></div>
            <div className="flex gap-6">
              <span>BaseTotal: <span className="text-indigo-600 ml-1">0.00</span></span>
              <span>CGST: <span className="text-indigo-600 ml-1">0.00</span></span>
              <span>SGST: <span className="text-indigo-600 ml-1">0.00</span></span>
              <span>IGST: <span className="text-indigo-600 ml-1">0.00</span></span>
              <span>Sub Total: <span className="text-indigo-600 ml-1">0.00</span></span>
            </div>
          </div>
        </FormSection>

        <FormSection title="Additional Item Details" isDark={isDark}>
          <div className="overflow-hidden border rounded-lg" style={{ borderColor: 'var(--app-row-border)' }}>
            <table className="w-full text-left text-[11px] border-collapse">
              <thead style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <tr>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Taxable Value</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Ledger Name</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}>Amount</th>
                  <th className="p-2.5 border-b font-bold opacity-70" style={{ borderColor: 'var(--app-row-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                <tr className="transition hover:bg-gray-50/50" style={{ backgroundColor: isDark ? 'transparent' : '#ffffff' }}>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input className="w-full h-8 border rounded px-2 text-[11px] outline-none" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <div className="relative group">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100" size={12} />
                      <input className="w-full h-8 border rounded px-2 text-[11px] outline-none transition focus:border-indigo-400" 
                        style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }} />
                    </div>
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <input type="number" defaultValue="0.00" className="w-full h-8 border rounded px-2 text-[11px] outline-none text-right font-bold" 
                      style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-accent)' }} />
                  </td>
                  <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                    <div className="flex gap-2 justify-center">
                      <button className="p-1 rounded-full text-green-600 hover:bg-green-50 border border-green-100"><Plus size={14} /></button>
                      <button className="p-1 rounded-full text-red-600 hover:bg-red-50 border border-red-100"><Minus size={14} /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </FormSection>
      </div>

      {/* Action Footer */}
      <div className="flex justify-end gap-3 mt-auto pt-2 shrink-0 px-1 border-t" style={{ borderColor: 'var(--app-row-border)' }}>
        <button 
          onClick={onBack}
          className="px-6 py-2 rounded-full border text-[11px] font-bold transition-all hover:bg-gray-50 active:scale-95"
          style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', color: 'var(--app-text)' }}
        >
          Cancel
        </button>
        <button 
          className="px-10 py-2.5 rounded-full text-[11px] font-extrabold shadow-[0_4px_15px_rgba(0,0,0,0.15)] transition-all hover:brightness-110 hover:translate-y-[-1px] active:scale-95 text-white border-none"
          style={{ background: 'var(--app-accent-gradient)' }}
        >
          Save Quotation
        </button>
      </div>
    </div>
  );
};

export default CreateQuotation;
