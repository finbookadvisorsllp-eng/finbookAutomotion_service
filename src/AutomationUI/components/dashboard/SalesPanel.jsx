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
  CloudUpload,
  FolderOpen,
  LayoutList,
  Menu,
  Paperclip,
  FileOutput
} from 'lucide-react';
import CreateSales from './CreateSales';
import VoucherEntryEngine from './VoucherEntryEngine';
import { AlertCircle, Bot, BarChart3, ScanLine, FileSpreadsheet } from 'lucide-react';

const SalesPanel = ({ mode, isDark, onAdd }) => {
  const [excelMode, setExcelMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState('inbox');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isUploadFilesOpen, setIsUploadFilesOpen] = useState(false);

  // Visibility state for Optional Columns only (from Configure popup)
  const [optionalColumns, setOptionalColumns] = useState({});

  // Header expansion state for Excel Mode
  const [expandedGroups, setExpandedGroups] = useState({
    basic: false,
    item: false,
    tds: false,
    tcs: false
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Define Groups for Excel Mode
  const excelBasicItems = ['Voucher Date', 'Voucher No.', 'Voucher Type', 'Consignee', 'Party GSTIN', 'Cost Center'];
  const excelItemDetails = ['Description', 'HSN / SAC', 'Amount', 'CGST', 'SGST', 'IGST', 'RCM', 'Taxability Type'];
  const excelTDSDetails = ['TDS Ledger', 'Assessable Value', 'Rate'];

  // Identify active optional columns per group
  const activeBasic = excelBasicItems.filter(item => optionalColumns[item]);
  const activeItem = excelItemDetails.filter(item => optionalColumns[item]);
  const activeTDS = excelTDSDetails.filter(item => optionalColumns[item]);
  const activeTCS = !!optionalColumns['TCS Details'];

  const canExpandBasic = activeBasic.length > 0;
  const canExpandItem = activeItem.length > 0;
  const canExpandTDS = activeTDS.length > 0;
  const canExpandTCS = activeTCS;

  const basicColSpan = 3 + (expandedGroups.basic ? activeBasic.length : 0);
  const itemColSpan = 1 + (expandedGroups.item ? activeItem.length : 0);
  const tdsColSpan = 2 + (expandedGroups.tds ? activeTDS.length : 0);
  const tcsColSpan = 1;

  const handleToggleExcel = () => {
    setIsLoading(true);
    setTimeout(() => {
      setExcelMode(!excelMode);
      setIsLoading(false);
    }, 600);
  };

  const getTitle = () => {
    if (viewMode === 'transaction') return 'Sales Entry';
    if (viewMode === 'ocr') return 'Sales OCR Engine';
    if (viewMode === 'csv') return 'Bulk CSV Import';
    switch (mode) {
      case 'Inbox': return 'Sales Inbox';
      case 'Review': return 'Sales Review';
      case 'Archive': return 'Sales Archive';
      default: return 'Sales Inbox';
    }
  };

  const IconButton = ({ icon: Icon, color, onClick, label, isPrimary }) => {
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

    if (label) {
      return (
        <button
          onClick={onClick}
          className={`h-9 px-4 rounded-xl flex items-center gap-2 font-bold text-[12px] transition-all hover:scale-[1.02] active:scale-95 shadow-sm ${isPrimary ? 'text-white shadow-lg' : 'border'}`}
          style={{
            borderColor: isPrimary ? 'transparent' : activeColor + '40',
            color: isPrimary ? '#fff' : activeColor,
            backgroundColor: isPrimary ? activeColor : (isDark ? 'var(--app-control-bg)' : '#fff'),
            boxShadow: isPrimary ? `0 4px 12px ${activeColor}40` : undefined
          }}
        >
          <Icon size={14} strokeWidth={2.5} />
          {label}
        </button>
      )
    }

    return (
      <button
        onClick={onClick}
        className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm bg-white/50 backdrop-blur-sm`}
        style={{
          borderColor: activeColor + '40',
          color: activeColor,
          backgroundColor: isDark ? 'var(--app-control-bg)' : 'rgba(255,255,255,0.7)'
        }}
      >
        <Icon size={15} strokeWidth={2.5} />
      </button>
    );
  };

  if (viewMode === 'transaction') {
    return <VoucherEntryEngine isDark={isDark} defaultMode="manual" onBack={() => setViewMode('inbox')} voucherType="sales" />;
  }
  if (viewMode === 'ocr') {
    return <VoucherEntryEngine isDark={isDark} defaultMode="ocr" onBack={() => setViewMode('inbox')} voucherType="sales" />;
  }
  if (viewMode === 'csv') {
    return <VoucherEntryEngine isDark={isDark} defaultMode="csv" onBack={() => setViewMode('inbox')} voucherType="sales" />;
  }

  const SummaryCard = ({ title, value, count, icon: Icon, color, trend }) => {
    return (
      <div className="relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-3 group transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
        style={{ 
          borderColor: isDark ? 'rgba(9, 182, 185, 0.15)' : 'rgba(255,255,255,0.1)', 
          background: isDark ? 'linear-gradient(145deg, rgba(8, 21, 46, 0.8) 0%, rgba(4, 16, 33, 0.9) 100%)' : 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.6) 100%)',
          backdropFilter: 'blur(10px)',
          boxShadow: isDark ? '0 4px 20px -5px rgba(0, 94, 217, 0.15), inset 0 0 0 1px rgba(9, 182, 185, 0.1)' : undefined
        }}>
        <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
          <Icon size={64} color={color} />
        </div>
        <div className="flex items-center justify-between z-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${color}15`, color: color }}>
            <Icon size={18} strokeWidth={2.5} />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <ArrowUpDown size={10} /> {trend}
            </div>
          )}
        </div>
        <div className="z-10">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">{title}</h4>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black tracking-tight" style={{ color: isDark ? '#fff' : '#0f172a' }}>{value}</span>
            <span className="text-[12px] font-bold text-slate-400 mb-1">({count})</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full animate-in fade-in duration-500 overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-300 rounded-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
              <Bot size={24} className="text-indigo-600 animate-pulse" />
            </div>
            <span className="text-sm font-black text-indigo-600 tracking-widest uppercase animate-pulse">Processing...</span>
          </div>
        </div>
      )}

      {/* Modals & Popups */}
      {isLedgerModalOpen && <AddLedgerModal onClose={() => setIsLedgerModalOpen(false)} />}
      {isStockModalOpen && <AddStockModal onClose={() => setIsStockModalOpen(false)} />}
      {isConfigOpen && (
        <ColumnConfigPopup
          isExcel={excelMode}
          optionalColumns={optionalColumns}
          setOptionalColumns={setOptionalColumns}
          onClose={() => setIsConfigOpen(false)}
        />
      )}

      {/* Premium Top Action Bar */}
      <div className="flex flex-col gap-3 shrink-0 p-3 rounded-2xl border shadow-sm backdrop-blur-md relative overflow-hidden" 
        style={{ 
          borderColor: isDark ? 'rgba(9, 182, 185, 0.2)' : 'rgba(255,255,255,0.5)', 
          background: isDark ? 'linear-gradient(180deg, rgba(8, 21, 46, 0.7) 0%, rgba(11, 23, 54, 0.9) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.8) 100%)',
          boxShadow: isDark ? '0 0 30px -10px rgba(0, 94, 217, 0.2), inset 0 0 0 1px rgba(9, 182, 185, 0.1)' : undefined
        }}>
        {isDark && (
          <>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#09B6B9]/20 rounded-full blur-[50px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#005ED9]/20 rounded-full blur-[50px] pointer-events-none"></div>
          </>
        )}
        {!isDark && (
          <>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-[40px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-[40px] pointer-events-none"></div>
          </>
        )}
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <BarChart3 size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[18px] font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                {getTitle()}
              </h1>
              <p className="text-[11px] font-bold text-slate-500">Manage and process all sales entries efficiently</p>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            {mode === 'Inbox' && (
              <>
                <IconButton icon={ScanLine} color="purple" label="OCR Upload" onClick={() => setViewMode('ocr')} />
                <IconButton icon={FileSpreadsheet} color="emerald" label="CSV Upload" onClick={() => setViewMode('csv')} />
                <IconButton icon={Plus} color="indigo" label="Create Entry" isPrimary onClick={() => setViewMode('transaction')} />
                <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <IconButton icon={CheckCircle2} color="emerald" />
                <IconButton icon={Trash2} color="red" />
              </>
            )}
            {mode === 'Review' && (
              <>
                <IconButton icon={CheckCircle2} color="emerald" label="Approve Selected" isPrimary />
                <IconButton icon={Trash2} color="red" />
                <IconButton icon={RefreshCw} color="emerald" />
              </>
            )}
            {mode === 'Archive' && (
              <>
                <IconButton icon={Download} color="purple" label="Export Data" />
                <IconButton icon={Trash2} color="red" />
                <IconButton icon={RefreshCw} color="emerald" />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between relative z-10 mt-1">
          {/* Centered Search Bar */}
          {!excelMode && (
            <div className="flex-1 max-w-[400px]">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" size={14} strokeWidth={3} />
                <input
                  type="text"
                  placeholder="Search on Party Name, Invoice No..."
                  className="w-full h-10 rounded-xl border px-10 text-[12px] font-bold outline-none transition-all shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#475569' }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3 cursor-pointer select-none px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={handleToggleExcel}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: excelMode ? '#4f46e5' : '#64748b' }}>Excel Mode</span>
              <div className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 ${excelMode ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-300 dark:bg-slate-700 shadow-inner'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${excelMode ? 'translate-x-5.5' : 'translate-x-1'}`} />
              </div>
            </div>

            <div className="flex gap-2">
              {excelMode && (
                <>
                  <IconButton icon={LayoutList} color="indigo" onClick={() => setIsLedgerModalOpen(true)} />
                  <IconButton icon={Menu} color="indigo" onClick={() => setIsStockModalOpen(true)} />
                </>
              )}
              <IconButton icon={Settings} color="slate" onClick={() => setIsConfigOpen(true)} />
              <IconButton icon={Filter} color="indigo" onClick={() => setIsFilterOpen(true)} />
            </div>
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

                  {/* Basic Details Group */}
                  <th colSpan={basicColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Basic Details</span>
                      {canExpandBasic && (
                        <button onClick={() => toggleGroup('basic')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                          {expandedGroups.basic ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
                        </button>
                      )}
                    </div>
                  </th>

                  {/* Item Details Group */}
                  <th colSpan={itemColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Item Details</span>
                      {canExpandItem && (
                        <button onClick={() => toggleGroup('item')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                          {expandedGroups.item ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
                        </button>
                      )}
                    </div>
                  </th>

                  {/* TDS Details Group */}
                  <th colSpan={tdsColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">TDS Details</span>
                      {canExpandTDS && (
                        <button onClick={() => toggleGroup('tds')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                          {expandedGroups.tds ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
                        </button>
                      )}
                    </div>
                  </th>

                  <th colSpan={tcsColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2">TCS Details</span>
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
                    {optionalColumns['Voucher Number'] && <TableHead label="Voucher Number" sortable borderRight />}
                    <TableHead label="Invoice Date" sortable borderRight />
                    {optionalColumns['Voucher Date'] && <TableHead label="Voucher Date" sortable borderRight />}
                    <TableHead label="Party Ledger" sortable borderRight />
                    {optionalColumns['Party Name'] && <TableHead label="Party Name" sortable borderRight />}
                    <TableHead label="Base Total" sortable borderRight />
                    {optionalColumns['Sub Total'] && <TableHead label="Sub Total" sortable borderRight />}
                    {optionalColumns['CGST'] && <TableHead label="CGST" sortable borderRight />}
                    {optionalColumns['SGST'] && <TableHead label="SGST" sortable borderRight />}
                    {optionalColumns['IGST'] && <TableHead label="IGST" sortable borderRight />}
                    <TableHead label="Grand Total" sortable borderRight />
                    {optionalColumns['TCS'] && <TableHead label="TCS" sortable borderRight />}
                    {optionalColumns['TDS'] && <TableHead label="TDS" sortable borderRight />}
                    <TableHead label="Status" sortable borderRight />
                  </>
                ) : (
                  <>
                    <TableHead label="Sr No." width="70px" borderRight />
                    <TableHead label="Invoice Date" borderRight />
                    <TableHead label="Invoice No." borderRight />
                    <TableHead label="Party Name" borderRight />
                    {expandedGroups.basic && activeBasic.map(col => (
                      <TableHead key={col} label={col} borderRight />
                    ))}
                    <TableHead label="Sales" borderRight />
                    {expandedGroups.item && activeItem.map(col => (
                      <TableHead key={col} label={col} borderRight />
                    ))}
                    <TableHead label="Sub Total" borderRight />
                    {expandedGroups.tds && activeTDS.map(col => (
                      <TableHead key={col} label={col} borderRight />
                    ))}
                    <TableHead label="TDS Amount" borderRight />
                    <TableHead label="TCS Amount" borderRight />
                    <TableHead label="Narration" borderRight />
                    <TableHead label="Round Off" borderRight />
                    <TableHead label="Total" borderRight />
                    <TableHead label="Status" borderRight />
                  </>
                )}
                <TableHead label="Action" center width="100px" />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={40} className="p-3 border-b text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>
                  No Inbox Data found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* --- Specialized Popups --- */

const ColumnConfigPopup = ({ onClose, isExcel, optionalColumns, setOptionalColumns }) => {
  const [localSelected, setLocalSelected] = useState({ ...optionalColumns });
  const [expanded, setExpanded] = useState({ basic: true, item: true, other: true });

  const excelBasic = ['Voucher Date', 'Voucher No.', 'Voucher Type', 'Consignee', 'Party GSTIN', 'Cost Center'];
  const excelItem = ['Description', 'HSN / SAC', 'Amount', 'CGST', 'SGST', 'IGST', 'RCM', 'Taxability Type'];
  const excelOther = ['TDS Details', 'TCS Details'];
  const standardItems = ['Sub Total', 'CGST', 'SGST', 'IGST', 'TDS', 'TCS', 'Party Name', 'Voucher Number', 'Voucher Date'];

  const allItems = isExcel ? [...excelBasic, ...excelItem, ...excelOther] : standardItems;

  const toggleAll = (checked) => {
    const newState = {};
    allItems.forEach(item => newState[item] = checked);
    setLocalSelected(newState);
  };

  const toggleCategory = (items, checked) => {
    setLocalSelected(prev => {
      const newState = { ...prev };
      items.forEach(item => newState[item] = checked);
      return newState;
    });
  };

  const toggleItem = (item) => setLocalSelected(prev => ({ ...prev, [item]: !prev[item] }));
  const isAllSelected = allItems.length > 0 && allItems.every(item => localSelected[item]);
  const isCategorySelected = (items) => items.every(item => localSelected[item]);

  const handleApply = () => {
    setOptionalColumns(localSelected);
    onClose();
  };

  const handleClear = () => {
    const cleared = {};
    allItems.forEach(k => cleared[k] = false);
    setLocalSelected(cleared);
  };

  return (
    <div className="fixed inset-0 z-[200] animate-in fade-in duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-black/5" onClick={onClose} />
      <div className="absolute top-4 right-4 bottom-4 w-[350px] bg-white rounded-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col animate-in slide-in-from-right-10 duration-300">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-indigo-600 tracking-tight">Configure</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded-lg transition-colors"><X size={18} className="text-slate-400" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <div className="flex flex-col">
            {/* Select All */}
            <label className="flex items-center gap-4 px-8 py-3 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50">
              <input type="checkbox" checked={isAllSelected} onChange={(e) => toggleAll(e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
              <span className="text-[13px] font-bold text-slate-700">All</span>
            </label>

            {isExcel ? (
              <div className="flex flex-col">
                {/* Basic Details Group */}
                <div className="flex flex-col border-b border-slate-50">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, basic: !prev.basic }))}>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded.basic ? '' : '-rotate-90'}`} />
                      <input
                        type="checkbox"
                        checked={isCategorySelected(excelBasic)}
                        onChange={(e) => toggleCategory(excelBasic, e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm"
                      />
                      <span className="text-[13px] font-bold text-slate-700">Basic Details</span>
                    </div>
                  </div>
                  {expanded.basic && (
                    <div className="flex flex-col ml-14 pb-2">
                      {excelBasic.map(item => (
                        <label key={item} className="flex items-center gap-4 py-2 cursor-pointer group">
                          <input type="checkbox" checked={!!localSelected[item]} onChange={() => toggleItem(item)} className="w-4 h-4 rounded border-gray-200 accent-indigo-600 shadow-sm" />
                          <span className={`text-[13px] font-medium transition-colors ${localSelected[item] ? 'text-indigo-600' : 'text-slate-500'}`}>{item}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Item Details Group */}
                <div className="flex flex-col border-b border-slate-50">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, item: !prev.item }))}>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded.item ? '' : '-rotate-90'}`} />
                      <input
                        type="checkbox"
                        checked={isCategorySelected(excelItem)}
                        onChange={(e) => toggleCategory(excelItem, e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm"
                      />
                      <span className="text-[13px] font-bold text-slate-700">Item Details</span>
                    </div>
                  </div>
                  {expanded.item && (
                    <div className="flex flex-col ml-14 pb-2">
                      {excelItem.map(item => (
                        <label key={item} className="flex items-center gap-4 py-2 cursor-pointer group">
                          <input type="checkbox" checked={!!localSelected[item]} onChange={() => toggleItem(item)} className="w-4 h-4 rounded border-gray-200 accent-indigo-600 shadow-sm" />
                          <span className={`text-[13px] font-medium transition-colors ${localSelected[item] ? 'text-indigo-600' : 'text-slate-500'}`}>{item}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Other Details Group */}
                <div className="flex flex-col border-b border-slate-50">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 px-8">
                      <input
                        type="checkbox"
                        checked={isCategorySelected(excelOther)}
                        onChange={(e) => toggleCategory(excelOther, e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm"
                      />
                      <span className="text-[13px] font-bold text-slate-700">Other Details</span>
                    </div>
                  </div>
                  <div className="flex flex-col ml-14 pb-2">
                    {excelOther.map(item => (
                      <label key={item} className="flex items-center gap-4 py-2 cursor-pointer group">
                        <input type="checkbox" checked={!!localSelected[item]} onChange={() => toggleItem(item)} className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
                        <span className={`text-[13px] font-medium transition-colors ${localSelected[item] ? 'text-indigo-600' : 'text-slate-500'}`}>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {standardItems.map(item => (
                  <label key={item} className="flex items-center gap-4 px-8 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 transition-colors">
                    <input type="checkbox" checked={!!localSelected[item]} onChange={() => toggleItem(item)} className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
                    <span className={`text-[13px] font-bold ${localSelected[item] ? 'text-indigo-600' : 'text-slate-700'}`}>{item}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex items-center justify-between gap-4">
          <button onClick={handleClear} className="flex-1 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-slate-50 shadow-sm">
            <X size={16} className="text-red-500" /> <span className="text-red-500">Clear</span>
          </button>
          <button onClick={handleApply} className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700">
            <Check size={16} strokeWidth={3} /> Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterPopup = ({ isExcel, onClose }) => {
  const Input = ({ placeholder, icon: Icon, type = "text", fullWidth }) => (
    <div className={`relative ${fullWidth ? 'w-full' : 'flex-1'}`}>
      <input type={type} placeholder={placeholder} className="w-full h-9 border rounded-lg px-3 text-[12px] font-medium outline-none transition-all focus:border-indigo-400 placeholder:text-slate-500" style={{ borderColor: '#e2e8f0', color: '#475569' }} />
      {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/5" onClick={onClose} />
      <div className="absolute top-24 right-8 w-[400px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border flex flex-col animate-in slide-in-from-top-4 duration-200 overflow-hidden max-h-[85vh]" style={{ borderColor: '#f1f5f9' }}>
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[15px] font-black text-indigo-600 tracking-tight px-1">Filter</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded-lg transition-colors"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-3.5">
          {!isExcel ? (
            <>
              <div className="flex gap-3">
                <Input placeholder="Invoice Number" />
                <Input placeholder="Party Name" />
              </div>
              <div className="flex gap-3">
                <Input placeholder="Invoice Date (From)" icon={Calendar} />
                <Input placeholder="Invoice Date (To)" icon={Calendar} />
              </div>
              <div className="flex gap-3">
                <Input placeholder="Base Total (From)" />
                <Input placeholder="Base Total (To)" />
              </div>
              <div className="flex gap-3">
                <Input placeholder="Sub Total (From)" />
                <Input placeholder="Sub Total (To)" />
              </div>
              <div className="flex gap-3">
                <Input placeholder="TDS/ TCS (From)" />
                <Input placeholder="TDS/ TCS (To)" />
              </div>
              <SearchableDropdown label="User" value="aman bhamuriya" options={['aman bhamuriya']} onChange={() => {}} showX legendStyle compact />
              <SearchableDropdown placeholder="Status" options={['Pending', 'Approved']} value="" onChange={() => {}} compact />
            </>
          ) : (
            <>
              <Input placeholder="invoice Date" icon={Calendar} fullWidth />
              <Input placeholder="Invoice Number" fullWidth />
              <div className="flex gap-3">
                <div className="flex-1"><Input placeholder="Party Name" fullWidth /></div>
                <div className="flex-1"><SearchableDropdown placeholder="Party Ledger" options={[]} value="" onChange={() => {}} compact /></div>
              </div>
              <Input placeholder="Party GSTIN" fullWidth />
              <div className="flex gap-3">
                <Input placeholder="Consignee" />
                <Input placeholder="Cost Center Name" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1"><Input placeholder="Sale Name" fullWidth /></div>
                <div className="flex-1"><SearchableDropdown placeholder="Sales Ledger" options={[]} value="" onChange={() => {}} compact /></div>
              </div>
              <div className="flex gap-3">
                <Input placeholder="Base Amount From" />
                <Input placeholder="Base Amount To" />
              </div>
              <div className="flex gap-3">
                <Input placeholder="Total Amount From" />
                <Input placeholder="Total Amount To" />
              </div>
              <div className="flex gap-3">
                <Input placeholder="TDS Rate" />
                <Input placeholder="TCS Rate" />
              </div>
              <div className="flex gap-2">
                <Input placeholder="CGST Rate" />
                <Input placeholder="SGST Rate" />
                <Input placeholder="IGST Rate" />
              </div>
              <Input placeholder="Narration" fullWidth />
            </>
          )}
        </div>

        <div className="p-4 border-t bg-white flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-red-500 text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-slate-50 shadow-sm">
            <X size={14} strokeWidth={2.5} /> Clear
          </button>
          <button onClick={onClose} className="px-6 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-md transition-all hover:bg-indigo-700">
            <Check size={14} strokeWidth={3} /> Apply
          </button>
        </div>
      </div>
    </div>
  );
};

/* --- Core UI Components --- */

const SearchableDropdown = ({ label, placeholder, options, value, onChange, isDark, compact, legendStyle, disabled, showX }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative group">
      {label && (value || legendStyle) && (
        <div className={`absolute left-3 bg-white px-1 z-10 font-bold uppercase tracking-tighter transition-all ${legendStyle ? '-top-2 text-[10px] text-blue-500' : (compact ? '-top-1.5 text-[8px] text-indigo-500' : '-top-2 text-[9px] text-indigo-500')}`}>
          {label}
        </div>
      )}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full border rounded-lg px-3 flex items-center justify-between cursor-pointer shadow-sm transition-all ${compact ? 'h-9' : 'h-10'} ${isOpen || (legendStyle && value) ? 'border-blue-500 ring-2 ring-blue-500/5' : 'hover:border-gray-300'} ${disabled ? 'bg-slate-100/80 cursor-not-allowed border-slate-200' : 'bg-white'}`}
        style={{ borderColor: isOpen || (legendStyle && value) ? '#3b82f6' : (disabled ? '#e2e8f0' : '#e2e8f0') }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className={`text-[12px] font-medium truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>{value || placeholder}</span>
        </div>
        <div className="flex items-center gap-1">
          {showX && value && !disabled && <X size={14} className="text-slate-300 hover:text-slate-500 transition-colors" onClick={(e) => { e.stopPropagation(); onChange(''); }} />}
          <ChevronDown size={14} className={`transition-transform duration-200 opacity-40 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[250px]">
          <div className="p-2 border-b" style={{ borderColor: '#f1f5f9' }}>
            <div className="relative group">
              <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full h-8 rounded-lg border px-8 text-[11px] font-bold outline-none transition-all focus:border-blue-400" style={{ borderColor: '#3b82f6' }} />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500" size={12} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
            {filtered.length > 0 ? filtered.map((option, idx) => (
              <div key={idx} className="px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 cursor-pointer rounded-lg transition-colors" onClick={() => { onChange(option); setIsOpen(false); setSearch(''); }}>{option}</div>
            )) : <div className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">Not Found</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const AddLedgerModal = ({ onClose }) => {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [billByBill, setBillByBill] = useState(true);
  const groups = ['Bank Accounts', 'Cash-in-Hand', 'Sales Accounts', 'Sundry Creditors', 'Sundry Debtors', 'Bank OD A/c'];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 animate-in zoom-in-95 duration-200 relative">
        <button onClick={onClose} className={`absolute right-6 top-6 transition-all duration-300 ${!selectedGroup ? 'w-10 h-10 border rounded-full flex items-center justify-center hover:bg-slate-50 border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
          <X size={20} />
        </button>

        <h2 className="text-[18px] font-black text-blue-600 mb-8 tracking-tight px-1">Add Ledger</h2>

        <div className="flex flex-col gap-5 px-1">
          <div className="flex items-center gap-6">
            <div className="flex-[1.2]">
              <input type="text" placeholder="Ledger Name" className="w-full h-10 border rounded-lg px-3 text-[12px] font-medium outline-none transition-all focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} />
            </div>

            <div className="flex-1">
              <SearchableDropdown
                label="Ledger Group"
                placeholder="Ledger Group"
                options={groups}
                value={selectedGroup}
                onChange={setSelectedGroup}
                legendStyle={!!selectedGroup}
                showX
              />
            </div>

            {selectedGroup && (
              <div className="flex items-center gap-3 min-w-[200px] animate-in slide-in-from-right-4 duration-300">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${billByBill ? 'bg-blue-600' : 'bg-slate-100 border border-slate-200'}`} onClick={() => setBillByBill(!billByBill)}>
                    {billByBill && <Check size={14} className="text-white" strokeWidth={4} />}
                  </div>
                  <span className="text-[12px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors whitespace-nowrap">Maintain Balance Bill by Bill</span>
                </label>
              </div>
            )}
          </div>

          {selectedGroup && (
            <div className="flex items-center gap-6 animate-in slide-in-from-top-2 duration-300">
              <div className="w-[calc(54.5%-1.5rem)]">
                <input type="text" placeholder="Credit Period" className="w-full h-10 border rounded-lg px-3 text-[12px] font-medium outline-none transition-all focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center mt-10">
          <button className="bg-blue-600 text-white px-10 py-2 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 hover:scale-105 active:scale-95">
            submit
          </button>
        </div>
      </div>
    </div>
  );
};

const AddStockModal = ({ onClose }) => {
  const [form, setForm] = useState({
    stockGroup: '', unit: '', gstApplicable: 'Applicable', hsnSource: 'As per Company/Stock', hsnClassification: '', hsnCode: '', gstSource: 'As per Company/Stock', gstClassification: '', taxabilityType: '', gstRate: '', typeOfSupply: 'Goods'
  });
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        <h2 className="text-[18px] font-black text-blue-600 mb-8 tracking-tight px-1">Add Stock Ledger</h2>

        <div className="grid grid-cols-3 gap-x-6 gap-y-5 px-1">
          <input type="text" placeholder="Stock Name" className="h-10 border rounded-lg px-3 text-[12px] font-medium outline-none transition-all focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} />
          <SearchableDropdown placeholder="Stock Group" options={['General', 'Electronics', 'Clothing']} value={form.stockGroup} onChange={v => update('stockGroup', v)} />
          <SearchableDropdown placeholder="Unit" options={['Nos', 'Pcs', 'Kgs', 'Mtrs']} value={form.unit} onChange={v => update('unit', v)} />

          <SearchableDropdown label="Gst Applicable" options={['Applicable', 'Not Applicable']} value={form.gstApplicable} onChange={v => update('gstApplicable', v)} legendStyle showX />
          <SearchableDropdown label="HSN Source" options={['As per Company/Stock', 'Manual']} value={form.hsnSource} onChange={v => update('hsnSource', v)} legendStyle />
          <SearchableDropdown placeholder="HSN Classification" options={[]} value={form.hsnClassification} onChange={v => update('hsnClassification', v)} disabled />

          <input type="text" placeholder="HSN Code" className="h-10 border rounded-lg px-3 text-[12px] font-medium outline-none bg-slate-100/80 cursor-not-allowed" style={{ borderColor: '#e2e8f0' }} disabled />
          <SearchableDropdown label="GST Source" options={['As per Company/Stock', 'Manual']} value={form.gstSource} onChange={v => update('gstSource', v)} legendStyle />
          <SearchableDropdown placeholder="GST Classification" options={[]} value={form.gstClassification} onChange={v => update('gstClassification', v)} disabled />

          <SearchableDropdown placeholder="Taxability Type" options={['Taxable', 'Exempt', 'Nil Rated']} value={form.taxabilityType} onChange={v => update('taxabilityType', v)} />
          <input type="text" placeholder="GST Rate" className="h-10 border rounded-lg px-3 text-[12px] font-medium outline-none bg-slate-100/80 cursor-not-allowed" style={{ borderColor: '#e2e8f0' }} disabled />
          <SearchableDropdown label="Type Of Supply" options={['Goods', 'Services']} value={form.typeOfSupply} onChange={v => update('typeOfSupply', v)} legendStyle showX />

          <div className="flex items-center gap-6 mt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="w-5 h-5 rounded border border-slate-200 bg-slate-100/50 flex items-center justify-center group-hover:border-blue-400 transition-all"></div>
              <span className="text-[12px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">RCM Applicable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border border-slate-200 bg-slate-100/50 flex items-center justify-center group-hover:border-blue-400 transition-all`}></div>
              <span className="text-[12px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">ITC Ineligible</span>
            </label>
          </div>
        </div>

        <div className="flex justify-center mt-10">
          <button className="bg-blue-600 text-white px-14 py-2.5 rounded-lg text-[14px] font-black tracking-widest shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 hover:scale-105 active:scale-95">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterInput = ({ placeholder, icon: Icon }) => (
  <div className="relative group w-full">
    <input type="text" placeholder={placeholder} className="w-full h-9 border rounded-lg px-3 text-[11px] font-bold outline-none transition-all focus:border-indigo-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
    {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />}
  </div>
);

const TableHead = ({ label, sortable, center, width, borderRight }) => (
  <th className={`p-3 border-b text-[10px] font-black uppercase tracking-tight ${center ? 'text-center' : ''} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: 'var(--app-row-border)', color: '#475569', width: width }}>
    <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''} ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
      {label} {sortable && <ArrowUpDown size={11} className="opacity-30" />}
    </div>
  </th>
);

/* --- Upload Modals (Sales) --- */

const UploadInvoiceModal = ({ onClose, isDark }) => (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
    <div className="bg-white rounded-2xl w-[650px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <button onClick={onClose} className="absolute right-6 top-6 w-8 h-8 flex items-center justify-center rounded-full border transition-colors hover:bg-slate-50" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}>
        <X size={16} />
      </button>
      <h2 className="text-[16px] font-black text-indigo-600 mb-6 tracking-tight">Upload Invoice</h2>
      <div className="text-center mb-6 text-[11px] font-bold text-red-500">Max limit: 10 files *</div>
      <div className="flex justify-between text-[11px] font-bold mb-10 px-2" style={{ color: isDark ? '#e2e8f0' : '#475569' }}>
        <div className="flex flex-col gap-3">
          <div>Credit Balance: <span className="font-medium">-372</span></div>
          <div>Uploaded Files: <span className="font-medium">0</span></div>
        </div>
        <div className="flex flex-col gap-3 text-right">
          <div>Total Pages: <span className="font-medium">0</span></div>
          <div>Remaining Files: <span className="font-medium">0</span></div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center mb-8">
        <div className="w-16 h-16 rounded-full border flex items-center justify-center mb-3 cursor-pointer shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors" style={{ borderColor: isDark ? '#334155' : '#cbd5e1', color: isDark ? '#94a3b8' : '#334155' }}>
          <CloudUpload size={24} strokeWidth={2} />
        </div>
        <div className="text-[11px] font-medium" style={{ color: isDark ? '#94a3b8' : '#475569' }}>Click here to Choose Files</div>
      </div>
      <div className="border border-dashed rounded-lg py-8 flex items-center justify-center text-[11px] font-medium cursor-pointer" style={{ borderColor: '#38bdf8', backgroundColor: isDark ? '#0f172a' : '#f0f9ff40', color: isDark ? '#94a3b8' : '#475569' }}>
        Drag and drop files here
      </div>
    </div>
  </div>
);

const BulkUploadInvoiceModal = ({ onClose, isDark }) => (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
    <div className="bg-white rounded-2xl w-[650px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <button onClick={onClose} className="absolute right-6 top-6 w-8 h-8 flex items-center justify-center rounded-full border transition-colors hover:bg-slate-50" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}>
        <X size={16} />
      </button>
      <h2 className="text-[16px] font-black text-indigo-600 mb-6 tracking-tight">Bulk Upload Invoice</h2>

      <div className="flex items-center justify-center mb-10 px-12 relative">
        <div className="absolute left-16 right-16 top-1/2 -translate-y-1/2 h-[1px]" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', zIndex: 0 }} />
        <div className="w-full flex justify-between relative" style={{ zIndex: 1 }}>
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md"><CloudUpload size={14} /></div>
          <div className="w-8 h-8 rounded-full border bg-white flex items-center justify-center shadow-sm" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: '#94a3b8' }}><Settings size={14} /></div>
          <div className="w-8 h-8 rounded-full border bg-white flex items-center justify-center shadow-sm" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: '#94a3b8' }}><Check size={14} /></div>
        </div>
      </div>

      <h3 className="text-center text-[13px] font-bold mb-4" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>Upload File</h3>
      <div className="text-center mb-6 text-[11px] font-bold text-red-500">Header in file must be Present*</div>

      <div className="flex flex-col items-center justify-center mb-8">
        <div className="w-14 h-14 rounded-full border flex items-center justify-center mb-3 cursor-pointer shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors" style={{ borderColor: isDark ? '#334155' : '#cbd5e1', color: isDark ? '#94a3b8' : '#334155' }}>
          <CloudUpload size={20} strokeWidth={2} />
        </div>
        <div className="text-[11px] font-medium" style={{ color: isDark ? '#94a3b8' : '#475569' }}>Click here to Choose Files</div>
      </div>

      <div className="border border-dashed rounded-lg py-8 flex items-center justify-center text-[11px] font-medium cursor-pointer" style={{ borderColor: '#38bdf8', backgroundColor: isDark ? '#0f172a' : '#f0f9ff40', color: isDark ? '#94a3b8' : '#475569' }}>
        Drag and drop files here
      </div>
      <div className="flex justify-end mt-8">
        <button className="px-6 py-2 bg-indigo-600 text-white text-[12px] font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md active:scale-95">Next</button>
      </div>
    </div>
  </div>
);

const UploadFilesModal = ({ onClose, isDark }) => (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
    <div className="bg-white rounded-2xl w-[900px] p-6 relative animate-in zoom-in-95 duration-200 shadow-2xl" style={{ backgroundColor: isDark ? '#1e293b' : '#fff' }}>
      <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 transition-colors">
        <X size={16} />
      </button>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-[15px] font-black text-indigo-600 tracking-tight">Upload Files</h2>
        <button className="w-6 h-6 rounded-full border flex items-center justify-center shadow-sm transition-colors" style={{ borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfdfe' }}>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr No.</th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500">Filename <ArrowUpDown size={10} className="opacity-40" /></div></th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500">Uploaded At <ArrowUpDown size={10} className="opacity-40" /></div></th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Uploaded By</th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500">Status <ArrowUpDown size={10} className="opacity-40" /></div></th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Inbox</th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Review</th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Archive</th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={9} className="p-6">
                <div className="text-[11px] font-bold text-slate-500">No Inbox Data found.</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default SalesPanel;
