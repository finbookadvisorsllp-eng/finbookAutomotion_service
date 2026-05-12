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
  FileText,
  CloudUpload,
  Wrench,
  Wallet
} from 'lucide-react';
import { motion } from 'motion/react';
import VoucherEntryEngine from '../vouchers/VoucherEntryEngine';

const PettyCashPanel = ({ mode, isDark, voucherType, title: customTitle }) => {
  const [createMode, setCreateMode] = useState(false);
  const [excelMode, setExcelMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Visibility state for Optional Columns only (from Configure popup)
  const [optionalColumns, setOptionalColumns] = useState({});

  // Header expansion state for Excel Mode
  const [expandedGroups, setExpandedGroups] = useState({
    basic: false,
    payment: false,
    item: false
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Define Groups for Excel Mode
  const excelBasicItems = ['Voucher Date', 'Voucher Number Serial', 'GST Registration', 'Voucher Type'];
  const excelPaymentItems = ['Voucher Type', 'Description'];
  const excelItemDetails = ['Description', 'Amount'];

  // Identify active optional columns per group
  const activeBasic = excelBasicItems.filter(item => optionalColumns[item]);
  const activePayment = excelPaymentItems.filter(item => optionalColumns[item]);
  const activeItem = excelItemDetails.filter(item => optionalColumns[item]);

  // Logic to show '+' icon only if at least one column from the group is selected in Configure
  const canExpandBasic = activeBasic.length > 0;
  const canExpandPayment = activePayment.length > 0;
  const canExpandItem = activeItem.length > 0;

  // Calculate dynamic colspans
  const basicColSpan = 4 + (expandedGroups.basic ? activeBasic.length : 0);
  const paymentColSpan = 1 + (expandedGroups.payment ? activePayment.length : 0);
  const itemColSpan = 1 + (expandedGroups.item ? activeItem.length : 0);
  const otherColSpan = 3; // Narration, Round Off, Total

  const handleToggleExcel = () => {
    setIsLoading(true);
    setTimeout(() => {
      setExcelMode(!excelMode);
      setIsLoading(false);
    }, 600);
  };

  const getTitle = () => {
    if (customTitle && mode === 'Inbox') return customTitle;
    switch (mode) {
      case 'Inbox': return 'Fund Flow Inbox';
      case 'Review': return 'Fund Flow Review';
      case 'Archive': return 'Fund Flow Archive';
      default: return 'Fund Flow Inbox';
    }
  };

  const IconButton = ({ icon: Icon, color, onClick }) => {
    const toneMap = {
      red: '#EF4444', purple: '#8B5CF6', blue: '#3B82F6',
      emerald: '#10B981', indigo: '#6366F1', 'light-blue': '#0EA5E9',
      slate: 'var(--app-text)',
    };
    const tone = toneMap[color] || 'var(--app-text)';
    return (
      <motion.button
        whileTap={{ scale: 0.94 }}
        whileHover={{ y: -1 }}
        onClick={onClick}
        className="h-8 w-8 rounded-lg border flex items-center justify-center transition-colors focus-ring hover:bg-[var(--app-control-hover)]"
        style={{ borderColor: 'var(--app-border)', color: tone, backgroundColor: 'var(--app-control-bg)' }}
      >
        <Icon size={13} strokeWidth={2.2} />
      </motion.button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 h-full overflow-hidden relative"
    >
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <div className="flex flex-col items-center gap-3 px-5 py-4 rounded-xl glass-surface">
            <Loader2 className="animate-spin" size={20} style={{ color: 'var(--app-accent)' }} />
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--app-heading)' }}>Processing…</span>
          </div>
        </div>
      )}

      {/* VoucherEntryEngine overlay for Create mode */}
      {createMode && voucherType && (
        <div className="absolute inset-0 z-40">
          <VoucherEntryEngine isDark={isDark} voucherType={voucherType} onBack={() => setCreateMode(false)} />
        </div>
      )}

      {/* Popups */}
      {isConfigOpen && (
        <ColumnConfigPopup
          isExcel={excelMode}
          optionalColumns={optionalColumns}
          setOptionalColumns={setOptionalColumns}
          onClose={() => setIsConfigOpen(false)}
        />
      )}
      {isFilterOpen && <FilterPopup isExcel={excelMode} onClose={() => setIsFilterOpen(false)} />}
      {isLedgerOpen && <AddLedgerPopup onClose={() => setIsLedgerOpen(false)} />}
      {isUploadOpen && <UploadPopup isExcel={excelMode} onClose={() => setIsUploadOpen(false)} />}

      {/* Header */}
      <div
        className="rounded-xl border p-3.5 shrink-0"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ background: 'var(--app-accent-gradient)' }}
          >
            <Wallet size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight leading-tight" style={{ color: 'var(--app-heading)' }}>{getTitle()}</h1>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--app-muted)' }}>
              {customTitle ? `Manage ${customTitle.toLowerCase()} transactions.` : 'Track petty-cash and fund-flow movement.'}
            </p>
          </div>
          {mode === 'Inbox' && voucherType && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setCreateMode(true)}
              className="ml-2 flex items-center gap-2 px-4 h-9 rounded-lg text-white text-[11px] font-bold uppercase tracking-widest shadow-md transition-all hover:scale-[1.02]"
              style={{ background: 'var(--app-accent-gradient)' }}
            >
              <Plus size={14} strokeWidth={3} /> Create
            </motion.button>
          )}
          <div className="flex gap-2 ml-2 items-center flex-wrap">
            {!excelMode ? (
              // Non-Excel Mode Icons
              <>
                {mode === 'Inbox' && (
                  <>
                    <IconButton icon={Upload} color="emerald" onClick={() => setIsUploadOpen(true)} />
                    <IconButton icon={ChevronsRight} color="purple" />
                    <IconButton icon={CheckCircle2} color="emerald" />
                  </>
                )}
                {mode === 'Review' && (
                  <>
                    <IconButton icon={ChevronsLeft} color="purple" />
                    <IconButton icon={CheckCircle2} color="emerald" />
                  </>
                )}
                <IconButton icon={Trash2} color="red" />
                {mode === 'Archive' && <IconButton icon={Download} color="purple" />}
                <IconButton icon={RefreshCw} color="emerald" />
              </>
            ) : (
              // Excel Mode Icons
              <>
                {mode === 'Inbox' && (
                  <>
                    <IconButton icon={Upload} color="emerald" onClick={() => setIsUploadOpen(true)} />
                    <IconButton icon={Edit3} color="emerald" />
                    <IconButton icon={ChevronsRight} color="purple" />
                    <IconButton icon={CheckCircle2} color="emerald" />
                  </>
                )}
                {mode === 'Review' && (
                  <>
                    <IconButton icon={ChevronsLeft} color="purple" />
                    <IconButton icon={CheckCircle2} color="emerald" />
                  </>
                )}
                <IconButton icon={Trash2} color="red" />
                <IconButton icon={Folder} color="purple" />
                {mode === 'Inbox' && <IconButton icon={Download} color="purple" />}
                
                <div className="ml-2 relative min-w-[200px]">
                  <select
                    className="w-full h-8 pl-3 pr-8 rounded-lg border text-[12px] appearance-none outline-none focus-ring cursor-pointer"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}
                  >
                    <option>Select File</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-muted)' }} size={14} />
                </div>
              </>
            )}
          </div>
        </div>

        {!excelMode && (
          <div className="flex-1 min-w-[220px] max-w-[400px] px-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted)' }} size={13} />
              <input
                type="text"
                placeholder="Search on Party Name…"
                className="w-full h-9 rounded-lg border pl-9 pr-3 text-[12.5px] outline-none transition-all focus-ring"
                style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <button
            type="button"
            onClick={handleToggleExcel}
            className="flex items-center gap-2.5 px-3 h-9 rounded-lg border focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
            style={{ borderColor: excelMode ? 'var(--app-accent)' : 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: excelMode ? 'var(--app-accent)' : 'var(--app-muted)' }}>Excel mode</span>
            <span className="relative inline-flex h-4 w-7 items-center rounded-full" style={{ background: excelMode ? 'var(--app-accent-gradient)' : 'var(--app-border)' }}>
              <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="inline-block h-3 w-3 rounded-full bg-white shadow" style={{ marginLeft: excelMode ? 14 : 2 }} />
            </span>
          </button>

          <div className="flex gap-2 items-center">
            {excelMode && mode === 'Inbox' && <IconButton icon={FileText} color="blue" onClick={() => setIsLedgerOpen(true)} />}
            <IconButton icon={HelpCircle} color="purple" />
            {excelMode && <IconButton icon={Settings} color="light-blue" onClick={() => setIsConfigOpen(true)} />}
            <IconButton icon={Filter} color="blue" onClick={() => setIsFilterOpen(true)} />
          </div>
        </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden rounded-xl border flex flex-col"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
        <div className="overflow-x-auto h-full themed-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-10">
              {excelMode && (
                <tr style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfdfe' }}>
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

                  {/* Payment Details Group */}
                  <th colSpan={paymentColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Payment Details</span>
                      {canExpandPayment && (
                        <button onClick={() => toggleGroup('payment')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                          {expandedGroups.payment ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
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

                  {/* Other Details Group */}
                  <th colSpan={otherColSpan} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Other Details</span>
                    </div>
                  </th>

                  <th className="p-2 border-b border-r" style={{ borderColor: '#e2e8f0' }}></th>
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
                    <TableHead label="Voucher Date" sortable borderRight />
                    <TableHead label="Party Name" sortable borderRight />
                    <TableHead label="Base Total" sortable borderRight />
                    <TableHead label="Sub Total" sortable borderRight />
                    <TableHead label="Grand Total" sortable borderRight />
                    <TableHead label="Status" sortable borderRight />
                    <TableHead label="Chat" center width="60px" />
                  </>
                ) : (
                  <>
                    <TableHead label="Sr No." width="70px" borderRight />
                    <TableHead label="Invoice Date" borderRight />
                    <TableHead label="Invoice No." borderRight />
                    <TableHead label="Party/Petty Cash Ledger" borderRight />
                    {expandedGroups.basic && activeBasic.map(col => (
                      <TableHead key={col} label={col} borderRight />
                    ))}
                    <TableHead label="Payment Ledger" borderRight />
                    {expandedGroups.payment && activePayment.map(col => (
                      <TableHead key={col} label={col} borderRight />
                    ))}
                    <TableHead label="Purchase / Expense" borderRight />
                    {expandedGroups.item && activeItem.map(col => (
                      <TableHead key={col} label={col} borderRight />
                    ))}
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
                <td colSpan={40} className="p-32 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>No Inbox Data found.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

/* --- Specialized Popups --- */

const UploadPopup = ({ onClose, isExcel }) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[850px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        {/* Modal Header */}
        <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-indigo-600 tracking-tight">{isExcel ? 'Bulk Upload Invoice' : 'Upload Invoice'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {isExcel && (
            /* Stepper for Excel Mode */
            <div className="flex items-center justify-center gap-0 mb-8 px-20">
              <div className="flex flex-col items-center gap-2 relative z-10">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200 transition-all">
                  <CloudUpload size={18} />
                </div>
              </div>
              <div className="flex-1 h-0.5 bg-slate-100 mx-[-4px]" />
              <div className="flex flex-col items-center gap-2 relative z-10">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-slate-400 transition-all">
                  <Wrench size={18} />
                </div>
              </div>
              <div className="flex-1 h-0.5 bg-slate-100 mx-[-4px]" />
              <div className="flex flex-col items-center gap-2 relative z-10">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-slate-400 transition-all">
                  <Check size={18} />
                </div>
              </div>
            </div>
          )}

          <div className="text-center space-y-2">
            {isExcel && <h3 className="text-[15px] font-black text-slate-700 tracking-tight">Upload File</h3>}
            <span className="text-[12px] font-black text-red-500 uppercase tracking-widest block">
              {isExcel ? 'Header in file must be Present*' : 'Max limit: 10 files *'}
            </span>
          </div>

          {!isExcel && (
            /* Stats for Standard Mode */
            <div className="grid grid-cols-2 gap-x-20 gap-y-4 px-10">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-600">Credit Balance: <span className="text-slate-400 font-medium">-372</span></span>
              </div>
              <div className="flex items-center justify-between text-right">
                <span className="text-[13px] font-bold text-slate-600">Total Pages: <span className="text-slate-400 font-medium">0</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-600">Uploaded Files: <span className="text-slate-400 font-medium">0</span></span>
              </div>
              <div className="flex items-center justify-between text-right">
                <span className="text-[13px] font-bold text-slate-600">Remaining Files: <span className="text-slate-400 font-medium">0</span></span>
              </div>
            </div>
          )}

          <div className="px-6">
            <div className="border border-slate-100 rounded-2xl p-10 bg-slate-50/30">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm group cursor-pointer hover:scale-110 transition-transform">
                  <CloudUpload size={32} className="text-slate-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <button className="text-[13px] font-bold text-slate-600 hover:text-blue-600 transition-colors">Click here to Choose Files</button>
              </div>

              <div className="mt-8">
                <div className="h-24 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center bg-white transition-all hover:bg-blue-50/20">
                  <span className="text-[13px] font-bold text-slate-400">Drag and drop files here</span>
                </div>
              </div>
            </div>
          </div>

          {isExcel && (
            /* Next Button for Excel Mode */
            <div className="flex justify-end px-6">
              <button className="h-9 px-8 rounded-lg bg-blue-600 text-white text-[12px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95">
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AddLedgerPopup = ({ onClose }) => {
  const [ledgerGroup, setLedgerGroup] = useState('');
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const groups = [
    'Bank Accounts',
    'Bank OD A/c',
    'Branch / Divisions',
    'Capital Account',
    'Cash-in-Hand'
  ];

  const filteredGroups = groups.filter(g => g.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-20 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[700px] bg-white rounded-xl shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-blue-600 tracking-tight">Add Ledger</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-1.5">
              <input 
                type="text" 
                placeholder="Ledger Name" 
                className="w-full h-10 border rounded-lg px-4 text-[13px] font-medium outline-none transition-all focus:border-blue-400 shadow-sm"
                style={{ borderColor: '#e2e8f0' }}
              />
            </div>
            
            <div className="flex-1 relative">
              <div 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-10 border rounded-lg px-4 flex items-center justify-between cursor-pointer bg-white transition-all focus-within:border-blue-400 shadow-sm"
                style={{ borderColor: '#e2e8f0' }}
              >
                <span className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-bold text-blue-500">Ledger Group</span>
                <span className={`text-[13px] font-medium ${ledgerGroup ? 'text-slate-700' : 'text-slate-400'}`}>
                  {ledgerGroup || ''}
                </span>
                <div className="flex items-center gap-1">
                  {ledgerGroup && <X size={14} className="text-slate-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setLedgerGroup(''); }} />}
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                  <div className="p-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div className="relative">
                      <input 
                        autoFocus
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-8 border rounded px-8 text-[12px] outline-none focus:border-blue-300"
                        style={{ borderColor: '#e2e8f0' }}
                      />
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                    {filteredGroups.map(g => (
                      <div 
                        key={g}
                        onClick={() => { setLedgerGroup(g); setIsOpen(false); setSearch(''); }}
                        className="px-4 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer border-b last:border-0 border-slate-50 transition-colors"
                      >
                        {g}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {ledgerGroup && (
            <div className="flex gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="Credit Period" 
                  className="w-full h-10 border rounded-lg px-4 text-[13px] font-medium outline-none transition-all focus:border-blue-400 shadow-sm"
                  style={{ borderColor: '#e2e8f0' }}
                />
              </div>
              <div className="flex-1 flex items-center gap-3">
                <input type="checkbox" id="maintainBill" className="w-5 h-5 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                <label htmlFor="maintainBill" className="text-[13px] font-bold text-slate-700 cursor-pointer">Maintain Balance Bill by Bill</label>
              </div>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button className="h-10 px-8 rounded-lg bg-blue-600 text-white text-[13px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95">
              submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ColumnConfigPopup = ({ onClose, isExcel, optionalColumns, setOptionalColumns }) => {
  const [localSelected, setLocalSelected] = useState({ ...optionalColumns });
  const [expanded, setExpanded] = useState({ basic: true, payment: true, item: true });

  const excelBasic = ['Voucher Date', 'Voucher Number Serial', 'GST Registration', 'Voucher Type'];
  const excelPayment = ['Voucher Type', 'Description'];
  const excelItem = ['Description', 'Amount'];
  
  const standardItems = ['Voucher Date', 'Party Name', 'Base Total', 'Sub Total', 'Grand Total', 'Status'];

  const allItems = isExcel ? [...excelBasic, ...excelPayment, ...excelItem] : standardItems;

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
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-blue-600 tracking-tight">Configure</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded-lg transition-colors"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <div className="flex flex-col">
            <label className="flex items-center gap-4 px-8 py-3 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50">
              <input type="checkbox" checked={isAllSelected} onChange={(e) => toggleAll(e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
              <span className="text-[13px] font-bold text-slate-700">All</span>
            </label>

            {isExcel ? (
              <div className="flex flex-col">
                <div className="flex flex-col border-b border-slate-50">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, basic: !prev.basic }))}>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded.basic ? '' : '-rotate-90'}`} />
                      <input type="checkbox" checked={isCategorySelected(excelBasic)} onChange={(e) => toggleCategory(excelBasic, e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
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

                <div className="flex flex-col border-b border-slate-50">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, payment: !prev.payment }))}>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded.payment ? '' : '-rotate-90'}`} />
                      <input type="checkbox" checked={isCategorySelected(excelPayment)} onChange={(e) => toggleCategory(excelPayment, e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
                      <span className="text-[13px] font-bold text-slate-700">Payment Details</span>
                    </div>
                  </div>
                  {expanded.payment && (
                    <div className="flex flex-col ml-14 pb-2">
                      {excelPayment.map(item => (
                        <label key={item} className="flex items-center gap-4 py-2 cursor-pointer group">
                          <input type="checkbox" checked={!!localSelected[item]} onChange={() => toggleItem(item)} className="w-4 h-4 rounded border-gray-200 accent-indigo-600 shadow-sm" />
                          <span className={`text-[13px] font-medium transition-colors ${localSelected[item] ? 'text-indigo-600' : 'text-slate-500'}`}>{item}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col border-b border-slate-50">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, item: !prev.item }))}>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded.item ? '' : '-rotate-90'}`} />
                      <input type="checkbox" checked={isCategorySelected(excelItem)} onChange={(e) => toggleCategory(excelItem, e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-indigo-600 shadow-sm" />
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

        <div className="p-4 border-t bg-white flex items-center justify-between gap-4">
          <button onClick={handleClear} className="flex-1 h-10 rounded-xl border border-slate-100 bg-white text-red-500 text-[12px] font-bold flex items-center justify-center gap-2 transition-all hover:bg-red-50 shadow-sm"><X size={16} /> Clear</button>
          <button onClick={handleApply} className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-[12px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all hover:bg-blue-700"><Check size={16} strokeWidth={3} /> Apply</button>
        </div>
      </div>
    </div>
  );
};

const FilterPopup = ({ onClose, isExcel }) => {
  const [values, setValues] = useState({});
  const update = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-[200] animate-in fade-in duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-black/5" onClick={onClose} />
      <div className="absolute top-4 right-4 bottom-4 w-[400px] bg-white rounded-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col animate-in slide-in-from-right-10 duration-300">
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-blue-600 tracking-tight">Filter</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded-lg transition-colors"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className="space-y-4">
            <div className="relative group">
              <input type="text" placeholder="invoice Date" className="w-full h-9 border rounded-lg px-3 text-[11px] font-medium outline-none transition-all focus:border-blue-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            </div>
            <FilterInput placeholder="Invoice Number" />
            <div className="grid grid-cols-2 gap-3">
              <FilterInput placeholder="Party Name" />
              <FilterInput placeholder="Cost Center Name" />
            </div>
            <div className="relative group">
              <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold text-blue-600">Party Ledger</span>
              <select className="w-full h-10 border rounded-lg px-3 text-[11px] font-medium appearance-none bg-white outline-none focus:border-blue-400" style={{ borderColor: '#3b82f6' }}>
                <option></option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FilterInput placeholder="Base Amount From" />
              <FilterInput placeholder="Base Amount To" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FilterInput placeholder="Total Amount From" />
              <FilterInput placeholder="Total Amount To" />
            </div>
            <FilterInput placeholder="Narration" />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50/50 flex items-center justify-between gap-3" style={{ borderColor: '#f1f5f9' }}>
          <button onClick={() => setValues({})} className="flex-1 h-10 rounded-xl border border-slate-100 bg-white text-red-500 text-[12px] font-bold flex items-center justify-center gap-2 transition-all hover:bg-red-50 shadow-sm"><X size={16} /> Clear</button>
          <button className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-[12px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all hover:bg-blue-700"><Check size={16} strokeWidth={3} /> Apply</button>
        </div>
      </div>
    </div>
  );
};

const FilterInput = ({ placeholder, icon: Icon }) => (
  <div className="relative group w-full">
    <input type="text" placeholder={placeholder} className="w-full h-9 border rounded-lg px-3 text-[11px] font-medium outline-none transition-all focus:border-blue-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
    {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />}
  </div>
);

const TableHead = ({ label, sortable, center, width, borderRight }) => (
  <th className={`px-3 py-2.5 border-b text-[10.5px] font-semibold uppercase tracking-wider ${center ? 'text-center' : 'text-left'} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)', backgroundColor: 'var(--app-table-head-bg)', width: width }}>
    <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''} ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
      {label} {sortable && <ArrowUpDown size={11} className="opacity-50" />}
    </div>
  </th>
);

export default PettyCashPanel;
