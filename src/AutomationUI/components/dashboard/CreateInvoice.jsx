import React, { useState } from 'react';
import { 
  Save, 
  Search, 
  Plus, 
  Minus, 
  ChevronUp, 
  ChevronDown,
  Calendar,
  Hash,
  X,
  List,
  LayoutGrid
} from 'lucide-react';

const FormCard = ({ title, children, isDark, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border mb-4 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]" 
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

const InputField = ({ label, placeholder, type = "text", isDark, value, readOnly, icon: Icon, search }) => (
  <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
    <div className="flex items-center justify-between px-1">
      <label className="text-[10px] font-semibold opacity-60 truncate" style={{ color: 'var(--app-text)' }}>{label}</label>
    </div>
    <div className="relative group">
      <input 
        type={type}
        defaultValue={value}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full h-8 rounded-md border px-2 text-[11px] outline-none transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 ${readOnly ? 'bg-gray-50/50 cursor-not-allowed opacity-70' : ''}`}
        style={{ 
          backgroundColor: isDark ? 'var(--app-control-bg)' : (readOnly ? '#f8fafc' : '#ffffff'), 
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
        }}
      />
      {search && (
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30 cursor-pointer hover:opacity-100 transition" size={12} style={{ color: 'var(--app-accent)' }} />
      )}
      {Icon && (
        <Icon className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" size={12} />
      )}
    </div>
  </div>
);

const SelectField = ({ label, options, isDark, value }) => (
  <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
    <label className="text-[10px] font-semibold opacity-60 px-1" style={{ color: 'var(--app-text)' }}>{label}</label>
    <div className="relative">
      <select 
        defaultValue={value}
        className="w-full h-8 rounded-md border px-2 pr-8 text-[11px] outline-none appearance-none transition-all focus:border-indigo-400"
        style={{ 
          backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', 
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
        }}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none opacity-40">
        <X size={10} className="mb-[-2px] hover:opacity-100 cursor-pointer" />
        <ChevronDown size={12} />
      </div>
    </div>
  </div>
);

const SummaryBadge = ({ label, value, isDark }) => (
  <div className="flex items-center gap-1.5 px-3 h-8">
    <span className="text-[10px] font-bold opacity-70 uppercase tracking-tight" style={{ color: 'var(--app-text)' }}>{label}:</span>
    <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-indigo-100 shadow-sm" style={{ background: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>{value}</span>
  </div>
);

const CreateInvoice = ({ isDark, onBack }) => {
  const [isWithItem, setIsWithItem] = useState(true);

  return (
    <div className="flex flex-col gap-2.5 h-full animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden" style={{ color: 'var(--app-text)' }}>
      {/* Header Row */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <h1 className="text-xl font-extrabold tracking-tighter" style={{ color: 'var(--app-accent)' }}>Invoice - Transaction mode</h1>
        <div className="flex items-center gap-2">
          <button 
            className="flex items-center gap-1.5 px-6 py-2 rounded-full text-[11px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:scale-105 active:scale-95 group text-white border-none"
            style={{ background: 'var(--app-accent-gradient)' }}
          >
            <Save size={14} className="group-hover:rotate-12 transition-transform" /> Save Changes
          </button>
        <div className="flex gap-1.5">
          <button className="p-2 rounded-lg border hover:bg-gray-50 transition shadow-sm" style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}><List size={14} /></button>
          <button className="p-2 rounded-lg border hover:bg-gray-50 transition shadow-sm" style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}><LayoutGrid size={14} /></button>
        </div>
      </div>
    </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap items-center bg-white rounded-xl border shadow-[0_4px_12px_rgba(0,0,0,0.03)] shrink-0 overflow-x-auto no-scrollbar p-1" 
        style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#ffffff' }}>
        <SummaryBadge label="BaseTotal" value="0.00" isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="SubTotal" value="0.00" isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="CGST" value="0.00" isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="SGST" value="0.00" isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="IGST" value="0.00" isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="TCS" value="0.00" isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="Round-off" value="0.00" isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="Grand Total" value="0.00" isDark={isDark} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-8">
        {/* Toggle Bar */}
        <div className="flex items-center gap-5 p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md" 
          style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#ffffff' }}>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold opacity-60 uppercase tracking-wider" style={{ color: 'var(--app-text)' }}>Is With Item?</span>
            <span className={`text-[10px] font-extrabold tracking-widest mt-0.5 ${isWithItem ? 'text-emerald-500' : 'text-gray-400'}`}>
              {isWithItem ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
          <button 
            onClick={() => setIsWithItem(!isWithItem)}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${isWithItem ? 'bg-emerald-500' : 'bg-gray-300'}`}
            style={{ backgroundColor: isWithItem ? 'var(--app-accent)' : '' }}
          >
            <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isWithItem ? 'translate-x-6.5' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Basic Details */}
        <FormCard title="Basic Details" isDark={isDark}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <SelectField label="Voucher Type" options={['Sales']} value="Sales" isDark={isDark} />
            <SelectField label="Voucher Number Series" options={['Default']} value="Default" isDark={isDark} />
            <InputField label="Bill No" value="1" readOnly isDark={isDark} />
            <InputField label="Invoice No" value="FG-1/2025-26" isDark={isDark} />
            <InputField label="Bill Date" type="date" value="2026-05-01" icon={Calendar} isDark={isDark} />
          </div>
        </FormCard>

        {/* Party Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Bill From */}
          <FormCard title="Bill From" isDark={isDark}>
            <div className="space-y-2.5">
              <SelectField label="GST Registration" options={['GST Registration']} isDark={isDark} />
              <InputField label="Company Name" value="FRIENDS GRAFIX" isDark={isDark} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Company GSTIN" isDark={isDark} />
                <InputField label="Company Contact" isDark={isDark} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Company Email" isDark={isDark} />
                <InputField label="Company PAN" isDark={isDark} />
              </div>
              <SelectField label="State" options={['Select State']} isDark={isDark} />
              <InputField label="Company Address 1" isDark={isDark} />
              <InputField label="Company Address 2" isDark={isDark} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Company City" isDark={isDark} />
                <InputField label="Pincode" isDark={isDark} />
              </div>
            </div>
          </FormCard>

          {/* Bill To */}
          <FormCard title="Bill To" isDark={isDark}>
            <div className="space-y-2.5">
              <InputField label="Bill To Name" search isDark={isDark} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Party GSTIN" isDark={isDark} />
                <InputField label="Party Contact" isDark={isDark} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Party Email" isDark={isDark} />
                <InputField label="Party PAN" isDark={isDark} />
              </div>
              <SelectField label="State" options={['Select State']} isDark={isDark} />
              <InputField label="Party Address 1" isDark={isDark} />
              <InputField label="Party Address 2" isDark={isDark} />
              <InputField label="Party Address 3" isDark={isDark} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Party City" isDark={isDark} />
                <InputField label="Pin Code" isDark={isDark} />
              </div>
            </div>
          </FormCard>

          {/* Ship To */}
          <FormCard title="Ship To" isDark={isDark}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <input type="checkbox" id="sameAsBillTo" className="rounded text-indigo-600" />
              <label htmlFor="sameAsBillTo" className="text-[10px] font-bold opacity-60">Same as Bill To</label>
            </div>
            <div className="space-y-2.5">
              <InputField label="Ship To Name" search isDark={isDark} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Ship To GSTIN" isDark={isDark} />
                <InputField label="Ship To Contact" isDark={isDark} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Ship To Email" isDark={isDark} />
                <InputField label="Ship To PAN" isDark={isDark} />
              </div>
              <SelectField label="State" options={['Select State']} isDark={isDark} />
              <InputField label="Ship To Address 1" isDark={isDark} />
              <InputField label="Ship To Address 2" isDark={isDark} />
              <InputField label="Ship To Address 3" isDark={isDark} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Ship To City" isDark={isDark} />
                <InputField label="Pin Code" isDark={isDark} />
              </div>
            </div>
          </FormCard>
        </div>

        {/* Product Details Table */}
        <FormCard title="Product Details" isDark={isDark}>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--app-row-border)' }}>
            <table className="w-full text-left text-[11px] border-collapse min-w-[1200px]">
              <thead style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <tr className="divide-x divide-gray-100" style={{ borderColor: 'var(--app-row-border)' }}>
                  <th className="p-2 font-bold opacity-70">Product Name</th>
                  <th className="p-2 font-bold opacity-70">Description</th>
                  <th className="p-2 font-bold opacity-70">HSN/SAC Code</th>
                  <th className="p-2 font-bold opacity-70">Unit</th>
                  <th className="p-2 font-bold opacity-70">Quantity</th>
                  <th className="p-2 font-bold opacity-70">Rate</th>
                  <th className="p-2 font-bold opacity-70">Discount</th>
                  <th className="p-2 font-bold opacity-70">Amount</th>
                  <th className="p-2 w-10 text-center"><Plus size={14} className="mx-auto cursor-pointer" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" style={{ borderColor: 'var(--app-row-border)' }}>
                <tr className="divide-x divide-gray-100">
                  <td className="p-1.5 min-w-[200px]"><InputField search isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[200px]"><InputField isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[120px]"><InputField isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[80px]"><InputField isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[100px]"><InputField value="0.0000" isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[100px]"><InputField value="0.0000" isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[80px]"><InputField value="0.00%" isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[100px]"><InputField value="0.00" readOnly isDark={isDark} /></td>
                  <td className="p-1.5">
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
        </FormCard>

        {/* Additional Item Details */}
        <FormCard title="Additional Item Details" isDark={isDark}>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--app-row-border)' }}>
            <table className="w-full text-left text-[11px] border-collapse min-w-[1000px]">
              <thead style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <tr className="divide-x divide-gray-100">
                  <th className="p-2 w-10 text-center"><input type="checkbox" className="rounded" /></th>
                  <th className="p-2 font-bold opacity-70">Taxable Value</th>
                  <th className="p-2 font-bold opacity-70">Ledger Name</th>
                  <th className="p-2 font-bold opacity-70 text-right">Amount</th>
                  <th className="p-2 font-bold opacity-70 text-center">CGST</th>
                  <th className="p-2 font-bold opacity-70 text-center">SGST</th>
                  <th className="p-2 font-bold opacity-70 text-center">IGST</th>
                  <th className="p-2 font-bold opacity-70 text-right">Total Amount</th>
                  <th className="p-2 w-10 text-center"><Plus size={14} className="mx-auto" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="divide-x divide-gray-100">
                  <td className="p-2 text-center"><input type="checkbox" className="rounded" /></td>
                  <td className="p-1.5"><InputField isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[250px]"><InputField search isDark={isDark} /></td>
                  <td className="p-1.5"><InputField value="0.00" isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[100px]">
                    <div className="flex flex-col gap-1">
                      <InputField value="0.00" readOnly isDark={isDark} />
                      <InputField value="0.00%" isDark={isDark} />
                    </div>
                  </td>
                  <td className="p-1.5 min-w-[100px]">
                    <div className="flex flex-col gap-1">
                      <InputField value="0.00" readOnly isDark={isDark} />
                      <InputField value="0.00%" isDark={isDark} />
                    </div>
                  </td>
                  <td className="p-1.5 min-w-[100px]">
                    <div className="flex flex-col gap-1">
                      <InputField value="0.00" readOnly isDark={isDark} />
                      <InputField value="0.00%" isDark={isDark} />
                    </div>
                  </td>
                  <td className="p-1.5"><InputField value="0.00" readOnly isDark={isDark} /></td>
                  <td className="p-1.5">
                    <div className="flex flex-col gap-1 items-center">
                      <button className="p-1 rounded-full text-green-600 hover:bg-green-50 border border-green-100"><Plus size={12} /></button>
                      <button className="p-1 rounded-full text-red-600 hover:bg-red-50 border border-red-100"><Minus size={12} /></button>
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
        </FormCard>

        {/* TCS Details */}
        <FormCard title="TCS Details" isDark={isDark}>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--app-row-border)' }}>
            <table className="w-full text-left text-[11px] border-collapse">
              <thead style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <tr className="divide-x divide-gray-100">
                  <th className="p-2 font-bold opacity-70">Ledger Name</th>
                  <th className="p-2 font-bold opacity-70">Assessable Value</th>
                  <th className="p-2 font-bold opacity-70 text-center">Rate</th>
                  <th className="p-2 font-bold opacity-70 text-right">Amount</th>
                  <th className="p-2 w-10 text-center"><Plus size={14} className="mx-auto" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="divide-x divide-gray-100">
                  <td className="p-1.5 min-w-[300px]"><InputField search isDark={isDark} /></td>
                  <td className="p-1.5"><InputField value="0.00" isDark={isDark} /></td>
                  <td className="p-1.5 min-w-[100px]"><InputField value="0.00%" isDark={isDark} /></td>
                  <td className="p-1.5"><InputField value="0.00" readOnly isDark={isDark} /></td>
                  <td className="p-1.5">
                    <div className="flex flex-col gap-1 items-center">
                      <button className="p-1 rounded-full text-green-600 hover:bg-green-50 border border-green-100"><Plus size={12} /></button>
                      <button className="p-1 rounded-full text-red-600 hover:bg-red-50 border border-red-100"><Minus size={12} /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-2 px-3 flex items-center justify-between bg-indigo-50/30 rounded-lg border border-indigo-100 text-[10px] font-bold uppercase tracking-wider text-indigo-900">
            <div className="flex items-center gap-2">Number Of Entries: <span className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm">1</span></div>
            <div className="flex items-center gap-2">Total: <span className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm ml-2">0</span></div>
          </div>
        </FormCard>

        {/* Bottom Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormCard title="Other Details" isDark={isDark}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="PO No" isDark={isDark} />
              <InputField label="PO Date" type="date" isDark={isDark} icon={Calendar} />
              <InputField label="Challan No" isDark={isDark} />
              <InputField label="Challan Date" type="date" isDark={isDark} icon={Calendar} />
              <InputField label="Vehicle No." isDark={isDark} />
              <InputField label="Credit Days" isDark={isDark} />
              <InputField label="Transporter" isDark={isDark} />
              <InputField label="LR No." isDark={isDark} />
            </div>
          </FormCard>

          <FormCard title="Remarks" isDark={isDark}>
            <textarea 
              className="w-full h-[155px] rounded-lg border p-3 text-[11px] outline-none transition-all focus:border-indigo-400"
              style={{ backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              placeholder="Enter remarks here..."
            />
          </FormCard>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex justify-end gap-3 mt-auto pt-2 shrink-0 px-1 border-t border-gray-100" style={{ borderColor: 'var(--app-row-border)' }}>
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
          Save Invoice
        </button>
      </div>
    </div>
  );
};

export default CreateInvoice;
