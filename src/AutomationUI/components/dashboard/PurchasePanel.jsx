import React, { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  ChevronsRight,
  ChevronsLeft,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  Download,
  HelpCircle,
  Settings,
  Filter,
  ArrowUpDown,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit3,
  Folder,
  Layout,
  List,
  Loader2,
  X,
  UserPlus,
  BookOpen,
  Check,
  Calendar,
  Minus,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Lock
} from 'lucide-react';

const PurchasePanel = ({ mode, isDark }) => {
  const [excelMode, setExcelMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [optionalColumns, setOptionalColumns] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({
    basic: false,
    item: false,
    tds: false,
    tcs: false
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const excelBasicItems = ['Voucher Date', 'Voucher No.', 'Voucher Type', 'Consignee', 'Party GSTIN', 'Cost Center'];
  const excelItemDetails = ['Description', 'HSN / SAC', 'Amount', 'CGST', 'SGST', 'IGST', 'RCM', 'Taxability Type'];

  const activeBasic = excelBasicItems.filter(item => optionalColumns[item]);
  const activeItem = excelItemDetails.filter(item => optionalColumns[item]);

  const basicColSpan = 3 + (expandedGroups.basic ? activeBasic.length : 0);
  const itemColSpan = 1 + (expandedGroups.item ? activeItem.length : 0);

  const handleToggleExcel = () => {
    setIsLoading(true);
    setTimeout(() => {
      setExcelMode(!excelMode);
      setIsLoading(false);
    }, 600);
  };

  const getTitle = () => {
    switch (mode) {
      case 'Inbox': return 'Purchase/Expense Inbox';
      case 'Review': return 'Purchase/Expense Review';
      case 'Archive': return 'Purchase/Expense Archive';
      default: return 'Purchase/Expense Inbox';
    }
  };

  const IconButton = ({ icon: Icon, color, onClick }) => {
    const getColor = () => {
      switch (color) {
        case 'red': return '#ef4444';
        case 'purple': return '#8b5cf6';
        case 'blue': return '#3b82f6';
        case 'emerald': return '#10b981';
        case 'indigo': return '#4f46e5';
        default: return '#64748b';
      }
    };
    const activeColor = getColor();

    return (
      <button
        onClick={onClick}
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm`}
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
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center animate-in fade-in duration-300">
          <Loader2 className="text-blue-600 animate-spin" size={32} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 shrink-0 border-b bg-white/50 backdrop-blur-sm" style={{ borderColor: 'rgba(226, 232, 240, 0.5)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-black tracking-tight" style={{ color: '#4f46e5' }}>{getTitle()}</h1>
          <div className="flex gap-2 ml-2">
            {mode === 'Inbox' && (
              <>
                <IconButton icon={Upload} color="emerald" />
                <IconButton icon={Plus} color="emerald" />
                <IconButton icon={ChevronsRight} color="purple" />
                <IconButton icon={CheckCircle2} color="emerald" />
                <IconButton icon={Lock} color="red" />
              </>
            )}
            {mode === 'Review' && (
              <>
                <IconButton icon={ChevronsLeft} color="purple" />
                <IconButton icon={CheckCircle2} color="emerald" />
                <IconButton icon={Trash2} color="red" />
              </>
            )}
            {mode === 'Archive' && (
              <>
                <IconButton icon={Lock} color="red" />
                <IconButton icon={Download} color="purple" />
              </>
            )}
            <IconButton icon={RefreshCw} color="emerald" />
            {mode === 'Archive' && <IconButton icon={FileText} color="blue" />}
          </div>
        </div>

        <div className="flex-1 max-w-[400px] px-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500" size={13} strokeWidth={3} />
            <input
              type="text"
              placeholder="Search on Party Name..."
              className="w-full h-8 rounded-lg border px-9 text-[11px] font-bold outline-none transition-all shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5"
              style={{ backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', borderColor: '#e2e8f0', color: isDark ? '#f1f5f9' : '#475569' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleToggleExcel}>
            <div className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 ${excelMode ? 'bg-indigo-600' : 'bg-slate-200 shadow-inner'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${excelMode ? 'translate-x-5.5' : 'translate-x-1'}`} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: excelMode ? '#4f46e5' : '#64748b' }}>Excel Mode</span>
          </div>

          <div className="flex gap-2">
            <IconButton icon={HelpCircle} color="blue" />
            <IconButton icon={Settings} color="indigo" onClick={() => setIsConfigOpen(true)} />
            <IconButton icon={Filter} color="emerald" onClick={() => setIsFilterOpen(true)} />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden rounded-xl border shadow-sm flex flex-col mt-1"
        style={{ borderColor: '#e2e8f0', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#fff' }}>
        <div className="overflow-x-auto h-full custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-10">
              {excelMode && (
                <tr style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfdfe' }}>
                  <th className="p-2 border-r border-b" style={{ borderColor: '#e2e8f0' }}></th>
                  <th className="p-2 border-r border-b" style={{ borderColor: '#e2e8f0' }}></th>
                  <th colSpan={basicColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Basic Details</span>
                      <button onClick={() => toggleGroup('basic')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                        {expandedGroups.basic ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
                      </button>
                    </div>
                  </th>
                  <th colSpan={itemColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Item Details</span>
                      <button onClick={() => toggleGroup('item')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                        {expandedGroups.item ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
                      </button>
                    </div>
                  </th>
                  <th colSpan={4} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2">Other Details</span>
                  </th>
                  <th className="p-2 border-b" style={{ borderColor: '#e2e8f0' }}></th>
                </tr>
              )}

              <tr style={{ backgroundColor: isDark ? 'var(--app-table-head-bg)' : '#fcfdfe' }}>
                <th className="p-3 border-b border-r w-10 text-center" style={{ borderColor: '#e2e8f0' }}>
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
                </th>
                {!excelMode ? (
                  <>
                    <TableHead label="Sr No." width="70px" borderRight />
                    <TableHead label="Filename" sortable borderRight />
                    <TableHead label="Invoice Number" sortable borderRight />
                    <TableHead label="Invoice Date" sortable borderRight />
                    <TableHead label="Party Ledger" sortable borderRight />
                    <TableHead label="Base Total" sortable borderRight />
                    <TableHead label="Grand Total" sortable borderRight />
                    <TableHead label="Status" sortable borderRight />
                    {mode === 'Inbox' && <TableHead label="Chat" borderRight />}
                  </>
                ) : (
                  <>
                    <TableHead label="Sr No." width="70px" borderRight />
                    <TableHead label="Invoice Date" borderRight />
                    <TableHead label="Invoice No." borderRight />
                    <TableHead label="Party Name" borderRight />
                    {expandedGroups.basic && activeBasic.map(col => <TableHead key={col} label={col} borderRight />)}
                    <TableHead label="Purchase" borderRight />
                    {expandedGroups.item && activeItem.map(col => <TableHead key={col} label={col} borderRight />)}
                    <TableHead label="Total" borderRight />
                    <TableHead label="Status" borderRight />
                  </>
                )}
                <TableHead label="Action" center width="100px" />
              </tr>
            </thead>
            <tbody>
              {mode === 'Archive' ? (
                <tr className="group hover:bg-indigo-50/30 transition-colors" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td className="p-3 border-b border-r text-center" style={{ borderColor: '#f1f5f9' }}>
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600" />
                  </td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-600 text-center" style={{ borderColor: '#f1f5f9' }}>1</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-indigo-500" style={{ borderColor: '#f1f5f9' }}>Sales_AT_25-26_3.pdf</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>AT/25-26/3</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>30-01-2025</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>A K TRADING</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500 text-right" style={{ borderColor: '#f1f5f9' }}>1,12,700.00</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500 text-right" style={{ borderColor: '#f1f5f9' }}>1,26,224.00</td>
                  <td className="p-3 border-b border-r" style={{ borderColor: '#f1f5f9' }}>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-tighter">Archived</span>
                  </td>
                  <td className="p-3 border-b text-center" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center justify-center gap-2">
                      <button className="w-7 h-7 rounded-lg border border-indigo-100 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 transition-all"><HelpCircle size={14} /></button>
                      <button className="w-7 h-7 rounded-lg border border-emerald-100 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all"><RefreshCw size={14} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={20} className="p-32 text-center">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 animate-pulse">No {mode} Data found.</p>
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

const TableHead = ({ label, sortable, center, width, borderRight }) => (
  <th className={`p-3 border-b text-[10px] font-black uppercase tracking-tight ${center ? 'text-center' : ''} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: '#e2e8f0', color: '#475569', width: width }}>
    <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''} ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
      {label} {sortable && <ArrowUpDown size={11} className="opacity-30" />}
    </div>
  </th>
);

export default PurchasePanel;
