import React from 'react';
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
  Filter
} from 'lucide-react';

const InvoiceInbox = ({ isDark, onAdd }) => {
  return (
    <div className="flex flex-col gap-4 h-full animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-accent)' }}>Invoice Inbox</h1>
          <div className="flex gap-2">
            <button 
              onClick={onAdd}
              className="p-2 rounded-full border-none flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-[0_4px_10px_rgba(0,0,0,0.1)] text-white" 
              style={{ background: 'var(--app-accent-gradient)' }}>
              <Plus size={18} strokeWidth={3} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-sm" 
              style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Trash2 size={16} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-sm" 
              style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <ArrowLeftRight size={16} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-sm" 
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Settings size={16} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-sm" 
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Download size={16} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-sm" 
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity" size={14} style={{ color: 'var(--app-accent)' }} />
            <input 
              type="text" 
              placeholder="Search Here" 
              className="w-64 h-9 rounded-xl border px-9 text-xs outline-none transition-all shadow-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40"
              style={{ 
                backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', 
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)',
              }} 
            />
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg border transition hover:bg-gray-50 shadow-sm" style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <HelpCircle size={16} />
            </button>
            <button className="p-2 rounded-lg border transition hover:bg-gray-50 shadow-sm" style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Settings size={16} />
            </button>
            <button className="p-2 rounded-lg border transition hover:bg-gray-50 shadow-sm" style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Filter size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
        <div className="overflow-x-auto h-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <th className="p-2 border-b w-12" style={{ borderColor: 'var(--app-row-border)' }}>
                  <div className="flex items-center justify-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-emerald-600" />
                  </div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider text-center" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)', width: '70px' }}>Sr No.</th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition">Invoice Number <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition">Date <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition">Party Name <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition">Base Total <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition">Grand Total <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider text-center" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)', width: '100px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="8" className="p-10 text-center">
                  <div className="flex flex-col items-center justify-center opacity-40">
                    <p className="text-[11px] font-medium" style={{ color: 'var(--app-text)' }}>No Inbox Data found.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceInbox;
