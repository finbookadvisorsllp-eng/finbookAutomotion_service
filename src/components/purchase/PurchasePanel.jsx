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
  Lock,
  CloudUpload,
  Link,
  Inbox,
  FileOutput,
  Paperclip,
  Archive,
  FolderOpen,
  LayoutList,
  Menu,
  Info,
  History,
  ScanLine,
  BarChart3,
  AlertCircle,
  FileSpreadsheet,
  ShoppingCart
} from 'lucide-react';
import { motion } from 'motion/react';
import VoucherEntryEngine from '../vouchers/VoucherEntryEngine';

const PurchasePanel = ({ mode, isDark, onAdd, title: customTitle, description: customDescription, voucherType = "purchase", emptyText, icon: CustomIcon }) => {
  const Icon = CustomIcon || ShoppingCart;
  const [excelMode, setExcelMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState('inbox');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isGstLoginOpen, setIsGstLoginOpen] = useState(false);
  const [isUploadFilesOpen, setIsUploadFilesOpen] = useState(false);

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const excelBasicItems = ['Voucher Date', 'Voucher No.', 'Voucher Type', 'Consignee', 'Party GSTIN', 'Cost Center', 'PO Number'];
  const excelItemDetails = ['Description', 'HSN / SAC', 'CGST', 'SGST', 'IGST', 'ITC', 'RCM', 'Taxability Type', 'Amount'];

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
    if (viewMode === 'transaction') return `${customTitle || 'Purchase/Expense'} Entry`;
    if (viewMode === 'ocr') return `${customTitle || 'Purchase/Expense'} OCR Engine`;
    if (viewMode === 'csv') return `Bulk ${customTitle || 'Purchase/Expense'} CSV Import`;
    if (customTitle) return `${customTitle} ${mode || 'Inbox'}`;
    switch (mode) {
      case 'Inbox': return 'Purchase/Expense Inbox';
      case 'Review': return 'Purchase/Expense Review';
      case 'Archive': return 'Purchase/Expense Archive';
      default: return 'Purchase/Expense Inbox';
    }
  };

  const IconButton = ({ icon: Icon, color, onClick, label, isPrimary }) => {
    const toneMap = {
      red: '#EF4444', purple: '#8B5CF6', blue: '#3B82F6',
      emerald: '#10B981', indigo: '#6366F1', slate: 'var(--app-text)',
    };
    const tone = toneMap[color] || 'var(--app-text)';

    if (label) {
      return (
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -1 }}
          onClick={onClick}
          className="h-9 px-3.5 rounded-lg flex items-center gap-1.5 font-semibold text-[12px] transition-shadow shadow-sm focus-ring"
          style={
            isPrimary
              ? { color: '#fff', background: 'var(--app-accent-gradient)', borderColor: 'transparent' }
              : { border: '1px solid var(--app-border)', color: tone, backgroundColor: 'var(--app-control-bg)' }
          }
        >
          <Icon size={14} strokeWidth={2.2} />
          {label}
        </motion.button>
      );
    }

    return (
      <motion.button
        whileTap={{ scale: 0.94 }}
        whileHover={{ y: -1 }}
        onClick={onClick}
        className="h-9 w-9 rounded-lg border flex items-center justify-center transition-colors focus-ring hover:bg-[var(--app-control-hover)]"
        style={{ borderColor: 'var(--app-border)', color: tone, backgroundColor: 'var(--app-control-bg)' }}
      >
        <Icon size={14} strokeWidth={2.2} />
      </motion.button>
    );
  };

  if (viewMode === 'transaction') {
    return <VoucherEntryEngine isDark={isDark} defaultMode="manual" onBack={() => setViewMode('inbox')} voucherType={voucherType} />;
  }
  if (viewMode === 'ocr') {
    return <VoucherEntryEngine isDark={isDark} defaultMode="ocr" onBack={() => setViewMode('inbox')} voucherType={voucherType} />;
  }
  if (viewMode === 'csv') {
    return <VoucherEntryEngine isDark={isDark} defaultMode="csv" onBack={() => setViewMode('inbox')} voucherType={voucherType} />;
  }

  const SummaryCard = ({ title, value, count, icon: Icon, color, trend }) => (
    <div className="relative overflow-hidden rounded-[24px] border p-5 flex flex-col gap-4 group transition-all duration-500 hover:shadow-xl hover:-translate-y-1.5"
      style={{ 
        borderColor: isDark ? 'rgba(9, 182, 185, 0.15)' : 'rgba(255,255,255,0.8)', 
        background: isDark ? 'linear-gradient(145deg, rgba(8, 21, 46, 0.9) 0%, rgba(4, 16, 33, 0.95) 100%)' : 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(241,245,249,0.7) 100%)',
        backdropFilter: 'blur(12px)',
        boxShadow: isDark ? '0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(9, 182, 185, 0.1)' : '0 10px 25px -10px rgba(0,0,0,0.05)'
      }}>
      <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.08] transform group-hover:scale-125 transition-all duration-700 ease-out" style={{ color: color }}>
        <Icon size={120} strokeWidth={1} />
      </div>
      <div className="flex items-start justify-between z-10">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-500" style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm" style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <ArrowUpDown size={10} /> {trend}
          </div>
        )}
      </div>
      <div className="z-10 mt-1">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{title}</h4>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight" style={{ color: isDark ? '#fff' : '#0f172a' }}>{value}</span>
          <span className="text-[13px] font-bold opacity-40" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{count} items</span>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-[3px] w-0 group-hover:w-full transition-all duration-700 ease-out rounded-full" style={{ backgroundColor: color, opacity: 0.4 }}></div>
    </div>
  );

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
            <div className="relative h-10 w-10 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--app-accent-soft)', borderTopColor: 'var(--app-accent)' }} />
              <Loader2 size={16} style={{ color: 'var(--app-accent)' }} />
            </div>
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--app-heading)' }}>Processing…</span>
          </div>
        </div>
      )}

      {isUploadOpen && <UploadInvoiceModal onClose={() => setIsUploadOpen(false)} isDark={isDark} />}
      {isBulkUploadOpen && <BulkUploadInvoiceModal onClose={() => setIsBulkUploadOpen(false)} isDark={isDark} />}
      {isGstLoginOpen && <LoginToGstModal onClose={() => setIsGstLoginOpen(false)} isDark={isDark} />}
      {isUploadFilesOpen && <UploadFilesModal onClose={() => setIsUploadFilesOpen(false)} isDark={isDark} />}
      {isLedgerModalOpen && <AddLedgerModal onClose={() => setIsLedgerModalOpen(false)} />}
      {isStockModalOpen && <AddStockModal onClose={() => setIsStockModalOpen(false)} />}
      {isFilterOpen && <FilterPopup isExcel={excelMode} onClose={() => setIsFilterOpen(false)} />}
      {isHistoryOpen && <EventHistoryModal onClose={() => setIsHistoryOpen(false)} isDark={isDark} />}
      {isConfigOpen && (
        <ColumnConfigPopup
          isExcel={excelMode}
          optionalColumns={optionalColumns}
          setOptionalColumns={setOptionalColumns}
          onClose={() => setIsConfigOpen(false)}
        />
      )}

      <div
        className="rounded-[20px] border p-4 shadow-sm transition-all duration-500"
        style={{
          borderColor: 'var(--app-border)',
          backgroundColor: 'var(--app-panel-bg)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform hover:rotate-3 duration-300"
              style={{ background: 'var(--app-accent-gradient)' }}
            >
              <Icon size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1
                className="text-[20px] font-black tracking-tight leading-tight flex items-center gap-2"
                style={{ color: 'var(--app-heading)' }}
              >
                {getTitle()}
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </h1>
              <p className="text-[12px] mt-0.5 font-medium opacity-60" style={{ color: 'var(--app-muted)' }}>
                {customDescription || `Real-time management for all ${voucherType.replace('_', ' ')} transactions and reporting.`}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 items-center flex-wrap">
            {mode === 'Inbox' && (
              <>
                {excelMode ? (
                  <>
                    <IconButton icon={Upload} color="emerald" onClick={() => setIsBulkUploadOpen(true)} />
                    <IconButton icon={FileOutput} color="purple" onClick={() => setIsGstLoginOpen(true)} />
                    <IconButton icon={Paperclip} color="emerald" />
                    <IconButton icon={ChevronsRight} color="purple" />
                    <IconButton icon={CheckCircle2} color="emerald" />
                    <IconButton icon={Archive} color="red" />
                    <IconButton icon={FolderOpen} color="purple" onClick={() => setIsUploadFilesOpen(true)} />
                    <IconButton icon={Download} color="purple" />
                  </>
                ) : (
                  <>
                    <IconButton icon={ScanLine} color="purple" label="OCR Upload" onClick={() => setViewMode('ocr')} />
                    <IconButton icon={FileSpreadsheet} color="emerald" label="CSV Upload" onClick={() => setViewMode('csv')} />
                    <IconButton icon={Plus} color="indigo" label="Create Entry" isPrimary onClick={() => setViewMode('transaction')} />
                    <div className="w-px h-7 mx-1" style={{ backgroundColor: 'var(--app-border)' }} />
                    <IconButton icon={CheckCircle2} color="emerald" />
                    <IconButton icon={Trash2} color="red" />
                  </>
                )}
              </>
            )}
            {mode === 'Review' && (
              <>
                {excelMode ? (
                  <>
                    <IconButton icon={ChevronsLeft} color="purple" />
                    <IconButton icon={CheckCircle2} color="emerald" />
                    <IconButton icon={Trash2} color="red" />
                    <IconButton icon={FolderOpen} color="purple" onClick={() => setIsUploadFilesOpen(true)} />
                  </>
                ) : (
                  <>
                    <IconButton icon={CheckCircle2} color="emerald" label="Approve Selected" isPrimary />
                    <IconButton icon={Trash2} color="red" />
                    <IconButton icon={RefreshCw} color="emerald" />
                  </>
                )}
              </>
            )}
            {mode === 'Archive' && (
              <>
                {excelMode ? (
                  <>
                    <IconButton icon={Trash2} color="red" />
                    <IconButton icon={FolderOpen} color="purple" onClick={() => setIsUploadFilesOpen(true)} />
                  </>
                ) : (
                  <>
                    <IconButton icon={Download} color="purple" label="Export Data" />
                    <IconButton icon={Trash2} color="red" />
                    <IconButton icon={RefreshCw} color="emerald" />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div className="flex-1 min-w-[240px] flex items-center gap-3 flex-wrap">
            {!excelMode ? (
              <div className="w-full max-w-[420px]">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted)' }} size={14} />
                  <input
                    type="text"
                    placeholder="Search on Party Name, Invoice No…"
                    className="w-full h-9 rounded-lg border pl-9 pr-3 text-[12.5px] outline-none transition-all focus-ring"
                    style={{
                      backgroundColor: 'var(--app-control-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-heading)',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  className="h-9 w-40 rounded-lg border px-3 text-[12.5px] outline-none focus-ring"
                  style={{
                    backgroundColor: 'var(--app-control-bg)',
                    color: 'var(--app-heading)',
                    borderColor: 'var(--app-border)',
                  }}
                >
                  <option>Select File</option>
                </select>
                {mode === 'Inbox' && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded accent-[var(--app-accent)]" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>
                        Not Selected Ledger
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded accent-[var(--app-accent)]" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>
                        Selected Ledger
                      </span>
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={handleToggleExcel}
              className="flex items-center gap-2.5 px-3 h-9 rounded-lg border focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
              style={{
                borderColor: excelMode ? 'var(--app-accent)' : 'var(--app-border)',
                backgroundColor: 'var(--app-control-bg)',
              }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: excelMode ? 'var(--app-accent)' : 'var(--app-muted)' }}
              >
                Excel mode
              </span>
              <span
                className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                style={{ background: excelMode ? 'var(--app-accent-gradient)' : 'var(--app-border)' }}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="inline-block h-3 w-3 rounded-full bg-white shadow"
                  style={{ marginLeft: excelMode ? 14 : 2 }}
                />
              </span>
            </button>

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
      <div
        className="flex-1 overflow-hidden rounded-xl border flex flex-col"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
      >
        <div className="overflow-x-auto h-full themed-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-10">
              {excelMode && (
                <tr style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfdfe' }}>
                  <th className="p-2 border-r border-b" style={{ borderColor: '#e2e8f0' }}></th>
                  <th className="p-2 border-r border-b" style={{ borderColor: '#e2e8f0' }}></th>
                  <th colSpan={3 + (expandedGroups.basic ? activeBasic.length : 0)} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Basic Details</span>
                      <button onClick={() => toggleGroup('basic')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                        {expandedGroups.basic ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
                      </button>
                    </div>
                  </th>
                  <th colSpan={2 + (expandedGroups.item ? activeItem.length : 0)} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Item Details</span>
                      <button onClick={() => toggleGroup('item')} className="w-5 h-5 rounded-full border border-indigo-100 flex items-center justify-center bg-white shadow-sm hover:bg-indigo-50 transition-all">
                        {expandedGroups.item ? <Minus size={10} className="text-indigo-500" /> : <Plus size={10} className="text-indigo-500" />}
                      </button>
                    </div>
                  </th>
                  <th colSpan={2} className="p-1 border-r border-b" style={{ borderColor: '#e2e8f0' }}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2">Other Details</span>
                  </th>
                  <th colSpan={3} className="p-2 border-b" style={{ borderColor: '#e2e8f0' }}></th>
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
                    {mode === 'Inbox' && <TableHead label="Chat" borderRight />}
                  </>
                ) : (
                  <>
                    <th className="p-3 border-b border-r w-8" style={{ borderColor: '#e2e8f0' }}></th>
                    <TableHead label="Sr No." width="70px" borderRight />
                    <TableHead label="Invoice Date" borderRight />
                    <TableHead label="Invoice No." borderRight />
                    <TableHead label="Party Name" borderRight />
                    {expandedGroups.basic && activeBasic.map(col => <TableHead key={col} label={col} borderRight />)}
                    <TableHead label="Purchase / Expense" borderRight />
                    <TableHead label="Sub Total" borderRight />
                    {expandedGroups.item && activeItem.map(col => <TableHead key={col} label={col} borderRight />)}
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
              {mode === 'Archive' && !excelMode ? (
                <tr className="group hover:bg-indigo-50/30 transition-colors" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td className="p-3 border-b border-r text-center" style={{ borderColor: '#f1f5f9' }}>
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600" />
                  </td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-600 text-center" style={{ borderColor: '#f1f5f9' }}>1</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-indigo-500" style={{ borderColor: '#f1f5f9' }}>Sales_AT_25-26_3.pdf</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>AT/25-26/3</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>30-01-2026</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500" style={{ borderColor: '#f1f5f9' }}>A K TRADING</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500 text-right" style={{ borderColor: '#f1f5f9' }}>1,12,700.00</td>
                  <td className="p-3 border-b border-r text-[11px] font-bold text-slate-500 text-right" style={{ borderColor: '#f1f5f9' }}>1,26,224.00</td>
                  <td className="p-3 border-b border-r" style={{ borderColor: '#f1f5f9' }}>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-tighter">Archived</span>
                  </td>
                  <td className="p-3 border-b text-center" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center justify-center gap-2">
                      <button className="w-7 h-7 rounded-full border flex items-center justify-center text-purple-500 hover:bg-purple-50 transition-all shadow-sm" style={{ borderColor: '#e9d5ff' }}><Info size={13} strokeWidth={2.5} /></button>
                      <button className="w-7 h-7 rounded-full border flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all shadow-sm" style={{ borderColor: '#a7f3d0' }} onClick={() => setIsHistoryOpen(true)}><History size={13} strokeWidth={2.5} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={20} className="p-10">
                    <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ color: 'var(--app-muted)' }}>
                      <span className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
                        <Icon size={18} />
                      </span>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--app-heading)' }}>{emptyText || `No ${mode || 'Inbox'} Data found`}</p>
                      <p className="text-[11.5px]">Create or upload a {voucherType.replace('_', ' ')} entry to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

const TableHead = ({ label, sortable, center, width, borderRight }) => (
  <th className={`px-3 py-2.5 border-b text-[10.5px] font-semibold uppercase tracking-wider ${center ? 'text-center' : 'text-left'} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)', backgroundColor: 'var(--app-table-head-bg)', width: width }}>
    <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''} ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
      {label} {sortable && <ArrowUpDown size={11} className="opacity-30" />}
    </div>
  </th>
);

const UploadInvoiceModal = ({ onClose, isDark }) => {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl w-[650px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <button onClick={onClose} className="absolute right-6 top-6 w-8 h-8 flex items-center justify-center rounded-full border transition-colors hover:bg-slate-50" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}>
          <X size={16} />
        </button>
        <h2 className="text-[16px] font-black text-indigo-600 mb-6 tracking-tight">Upload Invoice</h2>

        <div className="text-center mb-6 text-[11px] font-bold text-red-500">
          Max limit: 10 files *
        </div>

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

        <div className="flex flex-col items-center justify-center mb-8 mt-4">
          <div className="w-16 h-16 rounded-full border flex items-center justify-center mb-3 transition-colors cursor-pointer shadow-sm hover:border-indigo-400 hover:text-indigo-600" style={{ borderColor: isDark ? '#334155' : '#cbd5e1', color: isDark ? '#94a3b8' : '#334155' }}>
            <CloudUpload size={24} strokeWidth={2} />
          </div>
          <div className="text-[11px] font-medium" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
            Click here to Choose Files
          </div>
        </div>

        <div className="border border-dashed rounded-lg py-8 flex items-center justify-center text-[11px] font-medium cursor-pointer transition-colors" style={{ borderColor: '#38bdf8', backgroundColor: isDark ? '#0f172a' : '#f0f9ff40', color: isDark ? '#94a3b8' : '#475569' }}>
          Drag and drop files here
        </div>
      </div>
    </div>
  );
};

const BulkUploadInvoiceModal = ({ onClose, isDark }) => {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl w-[650px] p-8 relative animate-in zoom-in-95 duration-200" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <button onClick={onClose} className="absolute right-6 top-6 w-8 h-8 flex items-center justify-center rounded-full border transition-colors hover:bg-slate-50" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}>
          <X size={16} />
        </button>
        <h2 className="text-[16px] font-black text-indigo-600 mb-6 tracking-tight">Bulk Upload Invoice</h2>

        <div className="flex items-center justify-center mb-10 px-12 relative">
          <div className="absolute left-16 right-16 top-1/2 -translate-y-1/2 h-[1px]" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', zIndex: 0 }} />
          <div className="w-full flex justify-between relative" style={{ zIndex: 1 }}>
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <CloudUpload size={14} />
            </div>
            <div className="w-8 h-8 rounded-full border bg-white flex items-center justify-center shadow-sm" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : '#fff', color: isDark ? '#94a3b8' : '#94a3b8' }}>
              <Settings size={14} />
            </div>
            <div className="w-8 h-8 rounded-full border bg-white flex items-center justify-center shadow-sm" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : '#fff', color: isDark ? '#94a3b8' : '#94a3b8' }}>
              <Check size={14} />
            </div>
          </div>
        </div>

        <h3 className="text-center text-[13px] font-bold mb-4" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>Upload File</h3>
        
        <div className="text-center mb-6 text-[11px] font-bold text-red-500">
          Header in file must be Present*
        </div>

        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-14 h-14 rounded-full border flex items-center justify-center mb-3 transition-colors cursor-pointer shadow-sm hover:border-indigo-400 hover:text-indigo-600" style={{ borderColor: isDark ? '#334155' : '#cbd5e1', color: isDark ? '#94a3b8' : '#334155' }}>
            <CloudUpload size={20} strokeWidth={2} />
          </div>
          <div className="text-[11px] font-medium" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
            Click here to Choose Files
          </div>
        </div>

        <div className="border border-dashed rounded-lg py-8 flex items-center justify-center text-[11px] font-medium cursor-pointer transition-colors" style={{ borderColor: '#38bdf8', backgroundColor: isDark ? '#0f172a' : '#f0f9ff40', color: isDark ? '#94a3b8' : '#475569' }}>
          Drag and drop files here
        </div>
        
        <div className="flex justify-end mt-8">
          <button className="px-6 py-2 bg-indigo-600 text-white text-[12px] font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md active:scale-95">
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

const LoginToGstModal = ({ onClose, isDark }) => {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl w-[450px] p-8 relative animate-in zoom-in-95 duration-200 shadow-2xl" style={{ backgroundColor: isDark ? '#1e293b' : '#fff' }}>
        <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 transition-colors" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}>
          <X size={16} />
        </button>
        <h2 className="text-[15px] font-black text-indigo-600 mb-6 tracking-tight">Login to GST</h2>
        
        <div className="text-center text-[12px] font-bold mb-8" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
          Authenticate to file your GSTR-2 securely.
        </div>
        
        <div className="flex flex-col gap-5 mb-6">
          <div className="relative">
            <label className="text-[10px] font-bold absolute -top-2 left-2 px-1 rounded-sm" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#94a3b8' : '#94a3b8' }}>Gst Number</label>
            <input type="text" value="23AAFFF9731L1Z7" readOnly className="w-full h-10 rounded-lg border px-3 text-[12px] font-bold outline-none" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#64748b' : '#94a3b8' }} />
          </div>
          
          <div className="relative">
            <input type="text" placeholder="Taxpayer Username" className="w-full h-10 rounded-lg border px-3 text-[12px] font-bold outline-none border-red-400 focus:border-red-500 bg-transparent text-slate-700" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }} />
            <div className="text-[10px] font-bold text-red-500 mt-1 pl-1">Taxpayer Username is required.</div>
          </div>
        </div>
        
        <button className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mb-6 shadow-md active:scale-95">
          Send OTP <span className="text-[14px]">→</span>
        </button>
        
        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
          <ShieldCheck size={12} className="text-indigo-300" />
          <span>We use secure GSTN APIs for authentication.</span>
        </div>
      </div>
    </div>
  );
};

const UploadFilesModal = ({ onClose, isDark }) => {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl w-[900px] p-6 relative animate-in zoom-in-95 duration-200 shadow-2xl" style={{ backgroundColor: isDark ? '#1e293b' : '#fff' }}>
        <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 transition-colors" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}>
          <X size={16} />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-[15px] font-black text-indigo-600 tracking-tight">Upload Files</h2>
          <button className="w-6 h-6 rounded-full border flex items-center justify-center transition-colors shadow-sm" style={{ borderColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', backgroundColor: isDark ? '#0f172a' : '#fff' }}>
            <RefreshCw size={12} />
          </button>
        </div>
        
        <div className="border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfdfe' }}>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr No.</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors">Filename <ArrowUpDown size={10} className="opacity-40" /></div>
                </th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors">Uploaded At <ArrowUpDown size={10} className="opacity-40" /></div>
                </th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Uploaded By</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors">Status <ArrowUpDown size={10} className="opacity-40" /></div>
                </th>
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
};

/* --- Specialized Popups --- */

const ColumnConfigPopup = ({ onClose, isExcel, optionalColumns, setOptionalColumns }) => {
  const [localSelected, setLocalSelected] = useState({ ...optionalColumns });
  const [expanded, setExpanded] = useState({ basic: true, item: true, other: true });

  const excelBasic = ['Voucher Date', 'Voucher No.', 'Voucher Type', 'Consignee', 'Party GSTIN', 'Cost Center', 'PO Number'];
  const excelItem = ['Description', 'HSN / SAC', 'CGST', 'SGST', 'IGST', 'ITC', 'RCM', 'Taxability Type', 'Amount'];
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
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-indigo-600 tracking-tight">Configure</h2>
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

                <div className="flex flex-col border-b border-slate-50">
                  <div className="flex flex-col ml-14 pb-2 pt-2">
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

const SearchableDropdown = ({ label, placeholder, options, value, onChange, isDark, compact, legendStyle, disabled, showX }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative group">
      {label && (value || legendStyle) && (
        <div className={`absolute left-3 bg-white px-1 z-10 font-bold uppercase tracking-tighter transition-all ${legendStyle ? '-top-2 text-[10px] text-indigo-500' : (compact ? '-top-1.5 text-[8px] text-indigo-500' : '-top-2 text-[9px] text-indigo-500')}`}>
          {label}
        </div>
      )}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full border rounded-lg px-3 flex items-center justify-between cursor-pointer shadow-sm transition-all ${compact ? 'h-9' : 'h-10'} ${isOpen || (legendStyle && value) ? 'border-indigo-500 ring-2 ring-indigo-500/5' : 'hover:border-gray-300'} ${disabled ? 'bg-slate-100/80 cursor-not-allowed border-slate-200' : 'bg-white'}`}
        style={{ borderColor: isOpen || (legendStyle && value) ? '#4f46e5' : (disabled ? '#e2e8f0' : '#e2e8f0') }}
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
              <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full h-8 rounded-lg border px-8 text-[11px] font-bold outline-none transition-all focus:border-indigo-400" style={{ borderColor: '#4f46e5' }} />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-500" size={12} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
            {filtered.length > 0 ? filtered.map((option, idx) => (
              <div key={idx} className="px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 cursor-pointer rounded-lg transition-colors" onClick={() => { onChange(option); setIsOpen(false); setSearch(''); }}>{option}</div>
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
                <div className="flex-1"><Input placeholder="Expense Name" fullWidth /></div>
                <div className="flex-1"><SearchableDropdown placeholder="Expense Ledger" options={[]} value="" onChange={() => {}} compact /></div>
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

const EventHistoryModal = ({ onClose, isDark }) => {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl w-[450px] p-8 relative animate-in zoom-in-95 duration-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]" style={{ backgroundColor: isDark ? '#1e293b' : '#fff' }}>
        <button onClick={onClose} className="absolute right-5 top-5 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 transition-colors">
          <X size={18} />
        </button>
        <h2 className="text-[18px] font-black tracking-tight mb-8" style={{ color: isDark ? '#f8fafc' : '#334155' }}>Event History</h2>

        <div className="flex flex-col ml-4">
          
          <div className="flex items-start gap-5 mb-8">
            <div className="w-28 flex flex-col items-end text-right">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">Wed 29 Apr, 2026</div>
              <div className="inline-block px-2.5 py-1 bg-blue-100 text-blue-600 text-[10px] font-black rounded">Updated</div>
            </div>
            <div className="relative flex flex-col items-center">
              <div className="w-3.5 h-3.5 rounded-full bg-white border-[3px] border-indigo-500 z-10 shadow-sm" />
              <div className="w-[1.5px] bg-slate-200 absolute top-3.5 bottom-[-45px]" />
            </div>
            <div className="flex-1 text-[13px] font-bold text-slate-500 leading-snug pt-0.5">
              <span className="text-slate-800 font-black">aman bhamuriya</span> updated Purchase/Expense
            </div>
          </div>

          <div className="flex items-start gap-5 mb-8">
            <div className="w-28 flex flex-col items-end text-right">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">Wed 29 Apr, 2026</div>
              <div className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded">Approved</div>
            </div>
            <div className="relative flex flex-col items-center">
              <div className="w-3.5 h-3.5 rounded-full bg-white border-[3px] border-indigo-500 z-10 shadow-sm" />
              <div className="w-[1.5px] bg-slate-200 absolute top-3.5 bottom-[-45px]" />
            </div>
            <div className="flex-1 text-[13px] font-bold text-slate-500 leading-snug pt-0.5">
              <span className="text-slate-800 font-black">aman bhamuriya</span> approved Purchase/Expense
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className="w-28 flex flex-col items-end text-right">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">Wed 29 Apr, 2026</div>
              <div className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded">Uploaded</div>
            </div>
            <div className="relative flex flex-col items-center">
              <div className="w-3.5 h-3.5 rounded-full bg-white border-[3px] border-indigo-500 z-10 shadow-sm" />
            </div>
            <div className="flex-1 text-[13px] font-bold text-slate-500 leading-snug pt-0.5">
              <span className="text-slate-800 font-black">aman bhamuriya</span> uploaded a new Purchase/Expense
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PurchasePanel;
