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
  LayoutGrid,
  LayoutList,
  Menu,
  Check
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

const InputField = ({ label, placeholder, type = "text", isDark, value, readOnly, icon: Icon, search, onChange }) => (
  <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
    <div className="flex items-center justify-between px-1">
      <label className="text-[10px] font-semibold opacity-60 truncate" style={{ color: 'var(--app-text)' }}>{label}</label>
    </div>
    <div className="relative group">
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
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
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  
  const [productRows, setProductRows] = useState([
    { id: 1, name: '', description: '', hsn: '', unit: '', qty: 0, rate: 0, disc: 0, amount: 0 }
  ]);

  const addRow = () => {
    const newId = productRows.length > 0 ? Math.max(...productRows.map(r => r.id)) + 1 : 1;
    setProductRows([...productRows, { id: newId, name: '', description: '', hsn: '', unit: '', qty: 0, rate: 0, disc: 0, amount: 0 }]);
  };

  const removeRow = (id) => {
    if (productRows.length > 1) {
      setProductRows(productRows.filter(r => r.id !== id));
    }
  };

  const updateRow = (id, field, value) => {
    setProductRows(productRows.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };
        if (field === 'qty' || field === 'rate' || field === 'disc') {
          const qty = field === 'qty' ? parseFloat(value) || 0 : row.qty;
          const rate = field === 'rate' ? parseFloat(value) || 0 : row.rate;
          const disc = field === 'disc' ? parseFloat(value) || 0 : row.disc;
          updatedRow.amount = (qty * rate) * (1 - disc / 100);
        }
        return updatedRow;
      }
      return row;
    }));
  };

  const calculateTotal = () => {
    return productRows.reduce((sum, row) => sum + (row.amount || 0), 0).toFixed(2);
  };

  const totalAmount = calculateTotal();

  return (
    <div className="flex flex-col gap-2.5 h-full animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden" style={{ color: 'var(--app-text)' }}>
      {/* Modals */}
      {isLedgerOpen && <AddLedgerModal onClose={() => setIsLedgerOpen(false)} isDark={isDark} />}
      {isStockOpen && <AddStockModal onClose={() => setIsStockOpen(false)} isDark={isDark} />}
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
            <button
              onClick={() => setIsLedgerOpen(true)}
              className="p-2 rounded-lg border hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
              style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', color: 'var(--app-text)' }}
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setIsStockOpen(true)}
              className="p-2 rounded-lg border hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
              style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', color: 'var(--app-text)' }}
            >
              <Menu size={14} />
            </button>
            <button className="p-2 rounded-lg border hover:bg-gray-50 transition shadow-sm" style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}><List size={14} /></button>
            <button className="p-2 rounded-lg border hover:bg-gray-50 transition shadow-sm" style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}><LayoutGrid size={14} /></button>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap items-center bg-white rounded-xl border shadow-[0_4px_12px_rgba(0,0,0,0.03)] shrink-0 overflow-x-auto no-scrollbar p-1" 
        style={{ borderColor: 'var(--app-border)', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#ffffff' }}>
        <SummaryBadge label="BaseTotal" value={totalAmount} isDark={isDark} />
        <div className="w-[1px] h-4 bg-gray-200 mx-1" />
        <SummaryBadge label="SubTotal" value={totalAmount} isDark={isDark} />
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
        <SummaryBadge label="Grand Total" value={totalAmount} isDark={isDark} />
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
                {productRows.map((row) => (
                  <tr key={row.id} className="divide-x divide-gray-100">
                    <td className="p-1.5 min-w-[200px]"><InputField search isDark={isDark} value={row.name} onChange={(v) => updateRow(row.id, 'name', v)} /></td>
                    <td className="p-1.5 min-w-[200px]"><InputField isDark={isDark} value={row.description} onChange={(v) => updateRow(row.id, 'description', v)} /></td>
                    <td className="p-1.5 min-w-[120px]"><InputField isDark={isDark} value={row.hsn} onChange={(v) => updateRow(row.id, 'hsn', v)} /></td>
                    <td className="p-1.5 min-w-[80px]"><InputField isDark={isDark} value={row.unit} onChange={(v) => updateRow(row.id, 'unit', v)} /></td>
                    <td className="p-1.5 min-w-[100px]"><InputField value={row.qty} isDark={isDark} type="number" onChange={(v) => updateRow(row.id, 'qty', v)} /></td>
                    <td className="p-1.5 min-w-[100px]"><InputField value={row.rate} isDark={isDark} type="number" onChange={(v) => updateRow(row.id, 'rate', v)} /></td>
                    <td className="p-1.5 min-w-[80px]"><InputField value={row.disc} isDark={isDark} type="number" onChange={(v) => updateRow(row.id, 'disc', v)} /></td>
                    <td className="p-1.5 min-w-[100px]"><InputField value={row.amount.toFixed(2)} readOnly isDark={isDark} /></td>
                    <td className="p-1.5">
                      <div className="flex flex-col gap-1 items-center">
                        <button onClick={addRow} className="p-1 rounded-full text-green-600 hover:bg-green-50 transition border border-green-100"><Plus size={12} /></button>
                        <button onClick={() => removeRow(row.id)} className="p-1 rounded-full text-red-600 hover:bg-red-50 transition border border-red-100"><Minus size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
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

/* ─────────────────────────────────────────────────────────
   AddLedgerModal — matches design images 2 & 3
───────────────────────────────────────────────────────── */
const AddLedgerModal = ({ onClose, isDark }) => {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [billByBill, setBillByBill] = useState(true);
  const [groupOpen, setGroupOpen] = useState(false);
  const groups = ['Bank Accounts', 'Cash-in-Hand', 'Sales Accounts', 'Sundry Creditors', 'Sundry Debtors', 'Bank OD A/c'];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-5 top-5 w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
          <X size={16} strokeWidth={2} />
        </button>
        <h2 className="text-[18px] font-black text-blue-600 mb-7 tracking-tight">Add Ledger</h2>

        <div className="flex items-start gap-4 mb-5">
          <div className="flex-[1.3]">
            <input type="text" placeholder="Ledger Name"
              className="w-full h-11 border rounded-lg px-4 text-[13px] font-medium outline-none transition-all focus:border-blue-500 placeholder:text-slate-400"
              style={{ borderColor: '#e2e8f0', color: '#1e293b' }}
            />
          </div>
          <div className="flex-1 relative">
            {selectedGroup && (
              <span className="absolute -top-2 left-3 text-[10px] font-bold text-blue-500 bg-white px-1 z-10">Ledger Group</span>
            )}
            <div onClick={() => setGroupOpen(!groupOpen)}
              className="w-full h-11 border rounded-lg px-4 flex items-center justify-between cursor-pointer transition-all"
              style={{ borderColor: selectedGroup ? '#3b82f6' : '#e2e8f0', boxShadow: selectedGroup ? '0 0 0 3px rgba(59,130,246,0.08)' : 'none' }}
            >
              <span className={`text-[13px] font-medium ${selectedGroup ? 'text-slate-700' : 'text-slate-400'}`}>{selectedGroup || 'Ledger Group'}</span>
              <div className="flex items-center gap-1.5">
                {selectedGroup && <X size={14} className="text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); setSelectedGroup(''); }} />}
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {groupOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl z-[300] overflow-hidden max-h-[200px] overflow-y-auto" style={{ borderColor: '#e2e8f0' }}>
                {groups.map(g => (
                  <div key={g}
                    className={`px-4 py-2.5 text-[12px] font-medium cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors ${selectedGroup === g ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600'}`}
                    onClick={() => { setSelectedGroup(g); setGroupOpen(false); }}
                  >{g}</div>
                ))}
              </div>
            )}
          </div>
          {selectedGroup && (
            <div className="flex items-center gap-2.5 pt-3 shrink-0 animate-in slide-in-from-right-4 duration-200">
              <div className="w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all"
                style={{ borderColor: billByBill ? '#4f46e5' : '#cbd5e1', backgroundColor: billByBill ? '#4f46e5' : '#fff' }}
                onClick={() => setBillByBill(!billByBill)}
              >
                {billByBill && <Check size={12} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-[12px] font-semibold text-slate-600 whitespace-nowrap select-none">Maintain Balance Bill by Bill</span>
            </div>
          )}
        </div>

        {selectedGroup && (
          <div className="mb-6 animate-in slide-in-from-top-2 duration-200" style={{ width: 'calc(54% - 0.5rem)' }}>
            <input type="text" placeholder="Credit Period"
              className="w-full h-11 border rounded-lg px-4 text-[13px] font-medium outline-none transition-all focus:border-blue-500 placeholder:text-slate-400"
              style={{ borderColor: '#e2e8f0', color: '#1e293b' }}
            />
          </div>
        )}

        <div className="flex justify-center mt-2">
          <button className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-black rounded-lg shadow-lg shadow-blue-100 transition-all hover:scale-105 active:scale-95">submit</button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   AddStockModal — matches design image 4
───────────────────────────────────────────────────────── */
const AddStockModal = ({ onClose, isDark }) => {
  const [form, setForm] = useState({
    stockGroup: '', unit: '', gstApplicable: 'Applicable',
    hsnSource: 'As per Company/Stock', hsnClassification: '',
    hsnCode: '', gstSource: 'As per Company/Stock',
    gstClassification: '', taxabilityType: '', gstRate: '',
    typeOfSupply: 'Goods', rcm: false, itc: false
  });
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const Dropdown = ({ placeholder, label, options = [], fieldKey, disabled, legendStyle }) => {
    const [open, setOpen] = useState(false);
    const val = form[fieldKey];
    return (
      <div className="relative">
        {legendStyle && val && <span className="absolute -top-2 left-3 text-[10px] font-bold text-blue-500 bg-white px-1 z-10">{label || placeholder}</span>}
        <div onClick={() => !disabled && setOpen(!open)}
          className="w-full h-10 border rounded-lg px-3 flex items-center justify-between transition-all"
          style={{ borderColor: disabled ? '#f1f5f9' : (legendStyle && val ? '#3b82f6' : '#e2e8f0'), backgroundColor: disabled ? '#f8fafc' : '#fff', boxShadow: legendStyle && val ? '0 0 0 3px rgba(59,130,246,0.08)' : 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <span className={`text-[12px] font-medium truncate ${val ? 'text-slate-700' : 'text-slate-400'}`}>{val || placeholder}</span>
          <div className="flex items-center gap-1">
            {legendStyle && val && !disabled && <X size={13} className="text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); update(fieldKey, ''); }} />}
            <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
        {open && options.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl z-[300] overflow-hidden max-h-[180px] overflow-y-auto" style={{ borderColor: '#e2e8f0' }}>
            {options.map(o => <div key={o} className="px-3 py-2 text-[12px] font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer" onClick={() => { update(fieldKey, o); setOpen(false); }}>{o}</div>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-8 relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} strokeWidth={2} /></button>
        <h2 className="text-[18px] font-black text-blue-600 mb-7 tracking-tight">Add Stock Ledger</h2>

        <div className="grid grid-cols-3 gap-x-5 gap-y-4">
          <input type="text" placeholder="Stock Name" className="h-10 border rounded-lg px-3 text-[12px] font-medium outline-none transition-all focus:border-blue-500 placeholder:text-slate-400" style={{ borderColor: '#e2e8f0', color: '#1e293b' }} />
          <Dropdown placeholder="Stock Group" fieldKey="stockGroup" options={['General', 'Electronics', 'Clothing', 'Raw Materials']} />
          <Dropdown placeholder="Unit" fieldKey="unit" options={['Nos', 'Pcs', 'Kgs', 'Mtrs', 'Ltrs']} />

          <Dropdown placeholder="Gst Applicable" label="Gst Applicable" fieldKey="gstApplicable" legendStyle options={['Applicable', 'Not Applicable']} />
          <Dropdown placeholder="HSN Source" label="HSN Source" fieldKey="hsnSource" legendStyle options={['As per Company/Stock', 'Manual']} />
          <Dropdown placeholder="HSN Classification" fieldKey="hsnClassification" options={[]} disabled />

          <input type="text" placeholder="HSN Code" disabled className="h-10 border rounded-lg px-3 text-[12px] font-medium outline-none cursor-not-allowed" style={{ borderColor: '#f1f5f9', backgroundColor: '#f8fafc', color: '#94a3b8' }} />
          <Dropdown placeholder="GST Source" label="GST Source" fieldKey="gstSource" legendStyle options={['As per Company/Stock', 'Manual']} />
          <Dropdown placeholder="GST Classification" fieldKey="gstClassification" options={[]} disabled />

          <Dropdown placeholder="Taxability Type" fieldKey="taxabilityType" options={['Taxable', 'Exempt', 'Nil Rated', 'Non-GST']} />
          <input type="text" placeholder="GST Rate" disabled className="h-10 border rounded-lg px-3 text-[12px] font-medium outline-none cursor-not-allowed" style={{ borderColor: '#f1f5f9', backgroundColor: '#f8fafc', color: '#94a3b8' }} />
          <Dropdown placeholder="Type Of Supply" label="Type Of Supply" fieldKey="typeOfSupply" legendStyle options={['Goods', 'Services']} />

          <div className="col-span-3 flex items-center gap-8 mt-1">
            {[{ key: 'rcm', label: 'RCM Applicable' }, { key: 'itc', label: 'ITC Ineligible' }].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group select-none" onClick={() => update(key, !form[key])}>
                <div className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all" style={{ borderColor: form[key] ? '#4f46e5' : '#cbd5e1', backgroundColor: form[key] ? '#4f46e5' : '#f8fafc' }}>
                  {form[key] && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-[12px] font-semibold text-slate-500 group-hover:text-blue-600 transition-colors">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button className="px-14 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-black rounded-lg shadow-lg shadow-blue-100 transition-all hover:scale-105 active:scale-95">Save</button>
        </div>
      </div>
    </div>
  );
};
