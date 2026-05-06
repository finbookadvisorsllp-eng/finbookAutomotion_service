import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowLeftRight,
  Settings,
  Download,
  RefreshCw,
  Search,
  ArrowUpDown,
  HelpCircle,
  Filter,
  LayoutList,
  Menu,
  X,
  ChevronDown,
  Check
} from 'lucide-react';

const InvoiceInbox = ({ isDark, onAdd }) => {
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [inboxData] = useState([
    { id: 1, invNo: 'INV-001/25-26', date: '05/05/2026', party: 'Finolax Advisors', base: '45,000.00', grand: '53,100.00', status: 'Pending' },
    { id: 2, invNo: 'INV-002/25-26', date: '04/05/2026', party: 'Greenline Ventures', base: '12,500.00', grand: '14,750.00', status: 'Reviewed' },
    { id: 3, invNo: 'INV-003/25-26', date: '02/05/2026', party: 'Apex Holdings', base: '89,000.00', grand: '1,05,020.00', status: 'Pending' },
  ]);

  const IconButton = ({ icon: Icon, color, onClick, title }) => {
    const colorMap = {
      red: '#ef4444', purple: '#8b5cf6', blue: '#3b82f6',
      emerald: '#10b981', indigo: '#4f46e5', slate: '#64748b'
    };
    const activeColor = colorMap[color] || '#64748b';
    return (
      <button
        onClick={onClick}
        title={title}
        className="w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
        style={{
          borderColor: activeColor + '40',
          color: activeColor,
          backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff'
        }}
      >
        <Icon size={14} strokeWidth={2.5} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2 h-full animate-in fade-in duration-500 overflow-hidden relative">

      {/* Modals */}
      {isLedgerOpen && <AddLedgerModal onClose={() => setIsLedgerOpen(false)} isDark={isDark} />}
      {isStockOpen && <AddStockModal onClose={() => setIsStockOpen(false)} isDark={isDark} />}

      {/* Header */}
      <div
        className="flex items-center justify-between px-2 py-2 shrink-0 border-b bg-white/50 backdrop-blur-sm"
        style={{ borderColor: 'rgba(226, 232, 240, 0.5)' }}
      >
        {/* Left: Title + Action Buttons */}
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-black tracking-tight" style={{ color: '#4f46e5' }}>
            Invoice Inbox
          </h1>
          <div className="flex gap-2 ml-2">
            <IconButton icon={Plus} color="emerald" onClick={onAdd} title="Create Invoice" />
            <IconButton icon={Trash2} color="red" title="Delete" />
            <IconButton icon={ArrowLeftRight} color="purple" title="Transfer" />
            <IconButton icon={Download} color="indigo" title="Download" />
            <IconButton icon={RefreshCw} color="emerald" title="Refresh" />
          </div>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-[400px] px-4">
          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500"
              size={13} strokeWidth={3}
            />
            <input
              type="text"
              placeholder="Search on Party Name..."
              className="w-full h-8 rounded-lg border px-9 text-[11px] font-bold outline-none transition-all shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5"
              style={{
                backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff',
                borderColor: '#e2e8f0',
                color: isDark ? '#f1f5f9' : '#475569'
              }}
            />
          </div>
        </div>

        {/* Right: Add Ledger + Add Stock + Help + Settings + Filter */}
        <div className="flex items-center gap-2">
          <IconButton icon={LayoutList} color="slate" onClick={() => setIsLedgerOpen(true)} title="Add Ledger" />
          <IconButton icon={Menu} color="slate" onClick={() => setIsStockOpen(true)} title="Add Stock Item" />
          <IconButton icon={HelpCircle} color="blue" title="Help" />
          <IconButton icon={Settings} color="indigo" onClick={() => setIsConfigOpen(true)} title="Configure" />
          <IconButton icon={Filter} color="emerald" onClick={() => setIsFilterOpen(true)} title="Filter" />
        </div>
      </div>

      {/* Table */}
      <div
        className="flex-1 overflow-hidden rounded-xl border shadow-sm flex flex-col mt-1"
        style={{ borderColor: '#e2e8f0', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#fff' }}
      >
        <div className="overflow-x-auto h-full custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfdfe' }}>
                <th className="p-3 border-b w-10" style={{ borderColor: '#e2e8f0' }}>
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600" />
                </th>
                {[
                  { label: 'Sr No.', width: '70px' },
                  { label: 'Invoice Number', sortable: true },
                  { label: 'Date', sortable: true },
                  { label: 'Party Name', sortable: true },
                  { label: 'Base Total', sortable: true },
                  { label: 'Grand Total', sortable: true },
                  { label: 'Status', sortable: true },
                  { label: 'Action', center: true, width: '100px' }
                ].map(({ label, sortable, center, width }) => (
                  <th
                    key={label}
                    className={`p-3 border-b text-[10px] font-black uppercase tracking-tight ${center ? 'text-center' : ''}`}
                    style={{ borderColor: '#e2e8f0', color: '#475569', width }}
                  >
                    <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''} ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
                      {label} {sortable && <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inboxData.length > 0 ? (
                inboxData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600" />
                    </td>
                    <td className="p-3 border-b text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>{idx + 1}</td>
                    <td className="p-3 border-b text-[11px] font-black text-blue-600" style={{ borderColor: '#f1f5f9' }}>{row.invNo}</td>
                    <td className="p-3 border-b text-[11px] font-bold text-slate-600" style={{ borderColor: '#f1f5f9' }}>{row.date}</td>
                    <td className="p-3 border-b text-[11px] font-black text-slate-700" style={{ borderColor: '#f1f5f9' }}>{row.party}</td>
                    <td className="p-3 border-b text-[11px] font-bold text-slate-600" style={{ borderColor: '#f1f5f9' }}>{row.base}</td>
                    <td className="p-3 border-b text-[11px] font-black text-slate-800" style={{ borderColor: '#f1f5f9' }}>{row.grand}</td>
                    <td className="p-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        row.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 border-b text-center" style={{ borderColor: '#f1f5f9' }}>
                      <button className="text-slate-400 hover:text-blue-600 transition-colors"><Settings size={14} /></button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-10 text-center border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex flex-col items-center justify-center opacity-30">
                      <p className="text-[11px] font-black uppercase tracking-widest">No Inbox Data found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceInbox;

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
          <button onClick={onClose} className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-black rounded-lg shadow-lg shadow-blue-100 transition-all hover:scale-105 active:scale-95">submit</button>
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
          <button onClick={onClose} className="px-14 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-black rounded-lg shadow-lg shadow-blue-100 transition-all hover:scale-105 active:scale-95">Save</button>
        </div>
      </div>
    </div>
  );
};
