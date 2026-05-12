import React from 'react';
import { 
  Plus, 
  Download, 
  RefreshCw, 
  Trash2, 
  Settings, 
  Search, 
  Info,
  Copy,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ChevronDown
} from 'lucide-react';

const QuotationInbox = ({ isDark, onAdd }) => {
  return (
    <div className="flex flex-col gap-4 h-full animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-accent)' }}>Quotation Inbox</h1>
          <div className="flex gap-2">
            <button 
              onClick={onAdd}
              className="p-2 rounded-full border-none flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-[0_4px_10px_rgba(0,0,0,0.1)] text-white" 
              style={{ background: 'var(--app-accent-gradient)' }}>
              <Plus size={18} strokeWidth={3} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-105" 
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Download size={16} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-105" 
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <RefreshCw size={16} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-105" 
              style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Trash2 size={16} />
            </button>
            <button className="p-1.5 rounded-full border flex items-center justify-center transition hover:scale-105" 
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff' }}>
              <Settings size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 max-w-sm mx-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={14} style={{ color: 'var(--app-text)' }} />
          <input 
            type="text" 
            placeholder="Search Here" 
            className="w-full h-9 rounded-lg border px-9 text-xs outline-none focus:ring-1"
            style={{ 
              backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', 
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)',
              '--tw-ring-color': 'var(--app-accent)'
            }} 
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
        <div className="overflow-x-auto h-full flex flex-col">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <th className="p-2 border-b w-10" style={{ borderColor: 'var(--app-row-border)' }}><input type="checkbox" className="rounded" /></th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider text-center" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)', width: '50px' }}>Sr No.</th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer">Quotation Number <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer">Date <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer">Party Name <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer">Base Total <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer">Total <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                  <div className="flex items-center gap-1 cursor-pointer">Status <ArrowUpDown size={10} className="opacity-50" /></div>
                </th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider text-center" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)', width: '100px' }}>Action</th>
                <th className="p-2 border-b text-[10px] font-bold uppercase tracking-wider text-center" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)', width: '60px' }}>Chat</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-opacity-50 transition" style={{ backgroundColor: isDark ? 'transparent' : '#fff' }}>
                <td className="p-2 border-b text-center" style={{ borderColor: 'var(--app-row-border)' }}><input type="checkbox" className="rounded" /></td>
                <td className="p-2 border-b text-[11px] text-center" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>1</td>
                <td className="p-2 border-b text-[11px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-accent)' }}>1</td>
                <td className="p-2 border-b text-[11px]" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>29-04-2026</td>
                <td className="p-2 border-b text-[11px]" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>aman</td>
                <td className="p-2 border-b text-[11px]" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>120.00</td>
                <td className="p-2 border-b text-[11px]" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>120.00</td>
                <td className="p-2 border-b text-[11px]" style={{ borderColor: 'var(--app-row-border)' }}>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>Downloaded</span>
                </td>
                <td className="p-2 border-b" style={{ borderColor: 'var(--app-row-border)' }}>
                  <div className="flex gap-1.5 justify-center">
                    <button className="p-1 rounded-full border flex items-center justify-center hover:bg-gray-50 transition" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}><Info size={11} /></button>
                    <button className="p-1 rounded-full border flex items-center justify-center hover:bg-emerald-50 transition" style={{ borderColor: 'var(--app-border)', color: '#10b981' }}><Copy size={11} /></button>
                    <button className="p-1 rounded-full border flex items-center justify-center hover:bg-blue-50 transition" style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}><RefreshCw size={11} /></button>
                    <button className="p-1 rounded-full border flex items-center justify-center hover:bg-sky-50 transition" style={{ borderColor: 'var(--app-border)', color: '#0369a1' }}><Eye size={11} /></button>
                  </div>
                </td>
                <td className="p-2 border-b text-center" style={{ borderColor: 'var(--app-row-border)' }}>
                  <button className="p-1 rounded-full border flex items-center justify-center hover:bg-emerald-50 transition mx-auto" style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}><MessageSquare size={11} /></button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Pagination */}
          <div className="mt-auto p-4 flex items-center justify-between border-t" style={{ borderColor: 'var(--app-row-border)' }}>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--app-text)' }}>
              <span>1 - 1 of 1</span>
              <div className="flex gap-1">
                <ChevronLeft className="cursor-pointer opacity-50" size={14} />
                <ChevronRight className="cursor-pointer opacity-50" size={14} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select className="appearance-none border rounded px-3 py-1 pr-8 text-xs outline-none" 
                  style={{ backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                  <option>10</option>
                  <option>20</option>
                  <option>50</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" size={12} style={{ color: 'var(--app-text)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationInbox;
