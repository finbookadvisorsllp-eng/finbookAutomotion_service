import React, { useState, useEffect } from 'react';
import {
  Plus, CheckCircle2, Trash2, RefreshCw, Search, Download,
  ArrowUpDown, MessageSquare, ChevronLeft, ChevronRight, Edit3,
  Loader2, X, Wallet, ScanLine, FileSpreadsheet, Send
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import VoucherEntryEngine from '../vouchers/VoucherEntryEngine';
import { useFundFlowStore } from '../../stores/useFundFlowStore';

const PettyCashPanel = ({ mode, isDark, voucherType, title: customTitle }) => {
  const [viewMode, setViewMode] = useState('inbox'); // 'inbox', 'manual', 'ocr', 'csv'
  const [selectedIds, setSelectedIds] = useState([]);

  // Zustand Store
  const {
    transactions,
    totalCount,
    currentPage,
    filters,
    loading,
    setFilter,
    setPage,
    fetchTransactions,
    deleteTransaction,
    updateStatus,
    fetchTransaction
  } = useFundFlowStore();

  // Sync filters and trigger fetch
  useEffect(() => {
    let statusFilter = '';
    if (mode === 'Inbox') statusFilter = 'draft,rejected';
    else if (mode === 'Review') statusFilter = 'pending_review';
    else if (mode === 'Archive') statusFilter = 'approved,archived';

    setFilter('status', statusFilter);
    if (voucherType) {
      setFilter('voucherType', voucherType);
    }
  }, [mode, voucherType, setFilter]);

  // Reset selected IDs when filters, mode, or pagination change
  useEffect(() => {
    setSelectedIds([]);
  }, [mode, voucherType, currentPage, filters]);

  // Fetch transactions on filter/page change
  useEffect(() => {
    fetchTransactions();
  }, [filters, currentPage, fetchTransactions]);

  const handleEdit = (tx) => {
    fetchTransaction(tx._id);
    setViewMode('manual');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this draft entry?')) {
      const res = await deleteTransaction(id);
      if (res.success) {
        toast.success('Entry deleted successfully');
        fetchTransactions();
      } else {
        toast.error(res.message || 'Failed to delete entry');
      }
    }
  };

  const handlePushToReviewRow = async (id) => {
    if (window.confirm('Are you sure you want to push this entry to review?')) {
      const res = await updateStatus(id, 'pending_review');
      if (res.success) {
        toast.success('Pushed to review successfully');
        fetchTransactions();
      } else {
        toast.error(res.message || 'Failed to push to review');
      }
    }
  };

  const handleApproveRow = async (id) => {
    if (window.confirm('Are you sure you want to approve this entry?')) {
      const res = await updateStatus(id, 'approved');
      if (res.success) {
        toast.success('Entry approved successfully');
        fetchTransactions();
      } else {
        toast.error(res.message || 'Failed to approve entry');
      }
    }
  };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one transaction to approve');
      return;
    }
    if (window.confirm(`Are you sure you want to approve ${selectedIds.length} selected transaction(s)?`)) {
      let successCount = 0;
      for (const id of selectedIds) {
        const res = await updateStatus(id, 'approved');
        if (res.success) successCount++;
      }
      toast.success(`Successfully approved ${successCount} transaction(s)`);
      setSelectedIds([]);
      fetchTransactions();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one transaction to delete');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected draft transaction(s)?`)) {
      let successCount = 0;
      for (const id of selectedIds) {
        const res = await deleteTransaction(id);
        if (res.success) successCount++;
      }
      toast.success(`Successfully deleted ${successCount} transaction(s)`);
      setSelectedIds([]);
      fetchTransactions();
    }
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(transactions.map(tx => tx._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getTitle = () => {
    let base = 'Fund Flow';
    if (voucherType === 'cash_payment') base = 'Payment';
    else if (voucherType === 'bank_payment') base = 'Receipt';
    else if (voucherType === 'contra') base = 'Contra';

    if (viewMode === 'manual') return `${base} Entry`;
    if (viewMode === 'ocr') return `${base} OCR Engine`;
    if (viewMode === 'csv') return `Bulk ${base} CSV Import`;

    if (customTitle) return `${customTitle} ${mode || 'Inbox'}`;
    return `${base} ${mode || 'Inbox'}`;
  };

  const getDescription = () => {
    let base = 'petty-cash and fund-flow movement';
    if (voucherType === 'cash_payment') base = 'payment transactions';
    else if (voucherType === 'bank_payment') base = 'receipt transactions';
    else if (voucherType === 'contra') base = 'contra transitions';

    return `Manage and process all ${base} efficiently.`;
  };

  const IconButton = ({ icon: Icon, color, onClick, label, isPrimary }) => {
    const toneMap = {
      red: '#EF4444',
      purple: '#8B5CF6',
      blue: '#3B82F6',
      emerald: '#10B981',
      indigo: '#6366F1',
      'light-blue': '#0EA5E9',
      slate: 'var(--app-text)',
    };
    const tone = toneMap[color] || 'var(--app-text)';

    if (label) {
      return (
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -1 }}
          onClick={onClick}
          className="h-7.5 px-2.5 rounded-lg flex items-center gap-1 font-semibold text-[10.5px] transition-shadow shadow-sm focus-ring"
          style={
            isPrimary
              ? {
                  color: '#fff',
                  background: 'var(--app-accent-gradient)',
                  borderColor: 'transparent',
                }
              : {
                  border: '1px solid var(--app-border)',
                  color: tone,
                  backgroundColor: 'var(--app-control-bg)',
                }
          }
        >
          <Icon size={12} strokeWidth={2.2} />
          {label}
        </motion.button>
      );
    }

    return (
      <motion.button
        whileTap={{ scale: 0.94 }}
        whileHover={{ y: -1 }}
        onClick={onClick}
        className="h-7.5 w-7.5 rounded-lg border flex items-center justify-center transition-colors focus-ring hover:bg-[var(--app-control-hover)]"
        style={{
          borderColor: 'var(--app-border)',
          color: tone,
          backgroundColor: 'var(--app-control-bg)',
        }}
      >
        <Icon size={12} strokeWidth={2.2} />
      </motion.button>
    );
  };

  // Reusable row action button with premium tooltip
  const ActionButton = ({ onClick, icon: Icon, color, tooltip }) => {
    const colorMap = {
      indigo: 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50',
      emerald: 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50',
      red: 'text-slate-400 hover:text-red-500 hover:bg-red-50/50',
      blue: 'text-slate-400 hover:text-blue-600 hover:bg-blue-50/50'
    };

    const classes = colorMap[color] || 'text-slate-400 hover:text-slate-600 hover:bg-slate-50';

    return (
      <div className="relative group flex items-center justify-center">
        <button
          onClick={onClick}
          className={`p-1 rounded-lg transition-all hover:scale-110 active:scale-95 ${classes}`}
        >
          <Icon size={12} strokeWidth={2.5} />
        </button>
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900/95 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
        </span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 h-full overflow-hidden relative"
    >
      {loading.list && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <div className="flex flex-col items-center gap-3 px-5 py-4 rounded-xl glass-surface">
            <Loader2 className="animate-spin text-indigo-600 animate-duration-1000" size={20} />
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--app-heading)' }}>Processing…</span>
          </div>
        </div>
      )}

      {/* VoucherEntryEngine overlay for Create/Edit mode */}
      {viewMode !== 'inbox' && voucherType && (
        <div className="absolute inset-0 z-40">
          <VoucherEntryEngine isDark={isDark} defaultMode={viewMode} voucherType={voucherType} onBack={() => { setViewMode('inbox'); fetchTransactions(); }} />
        </div>
      )}

      {/* Header Panel */}
      <div
        className="rounded-[16px] border p-3 px-4 shadow-sm transition-all duration-500 hover:shadow-md"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', backdropFilter: 'blur(10px)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left Block: Icon, Title & Meta */}
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 duration-300 shadow-indigo-500/10 shrink-0"
              style={{ background: 'var(--app-accent-gradient)' }}
            >
              <Wallet size={16} strokeWidth={2.2} />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="text-base md:text-[17px] font-black tracking-tight leading-none"
                  style={{ color: 'var(--app-heading)' }}
                >
                  {getTitle()}
                </h1>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/10 animate-pulse">
                  <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                  Live
                </span>
              </div>
              <p className="text-[10.5px] font-medium opacity-60 leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                {getDescription()}
              </p>
            </div>
          </div>

          {/* Right Block: Integrated Search and Actions Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {/* Elegant Search Input */}
            <div className="relative min-w-[220px] sm:max-w-xs group">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors text-slate-400 group-focus-within:text-indigo-500"
                size={12}
              />
              <input
                type="text"
                placeholder="Search by party name..."
                value={filters.search || ''}
                onChange={(e) => setFilter('search', e.target.value)}
                className="w-full h-7.5 rounded-lg border pl-8.5 pr-3 text-[11px] font-semibold outline-none transition-all duration-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 shadow-sm"
                style={{
                  backgroundColor: 'var(--app-control-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-heading)',
                }}
              />
            </div>

            {/* Actions Group */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {mode === 'Inbox' && (
                <>
                  <IconButton icon={ScanLine} color="purple" label="OCR" onClick={() => setViewMode('ocr')} />
                  <IconButton icon={FileSpreadsheet} color="emerald" label="CSV" onClick={() => setViewMode('csv')} />
                  <IconButton icon={Plus} color="indigo" label="Create" isPrimary onClick={() => setViewMode('manual')} />
                  <div className="w-px h-6 mx-0.5 hidden sm:block" style={{ backgroundColor: 'var(--app-border)' }} />
                  <div className="flex items-center gap-1">
                    <IconButton icon={CheckCircle2} color="emerald" onClick={handleApproveSelected} />
                    <IconButton icon={Trash2} color="red" onClick={handleDeleteSelected} />
                  </div>
                </>
              )}
              {mode === 'Review' && (
                <>
                  <IconButton icon={CheckCircle2} color="emerald" label="Approve Selected" isPrimary onClick={handleApproveSelected} />
                  <IconButton icon={Trash2} color="red" onClick={handleDeleteSelected} />
                  <IconButton icon={RefreshCw} color="emerald" onClick={fetchTransactions} />
                </>
              )}
              {mode === 'Archive' && (
                <>
                  <IconButton icon={Download} color="purple" label="Export Data" />
                  <IconButton icon={Trash2} color="red" onClick={handleDeleteSelected} />
                  <IconButton icon={RefreshCw} color="emerald" onClick={fetchTransactions} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden rounded-xl border flex flex-col animate-in fade-in duration-500"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
        <div className="overflow-x-auto h-full themed-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: isDark ? 'var(--app-table-head-bg)' : '#fcfdfe' }}>
                <th className="p-1.5 border-b border-r w-10 text-center" style={{ borderColor: '#e2e8f0' }}>
                  <input
                    type="checkbox"
                    className="w-3 h-3 rounded border-gray-300 accent-indigo-600 shadow-sm cursor-pointer"
                    checked={transactions.length > 0 && selectedIds.length === transactions.length}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <TableHead label="Sr No." width="60px" borderRight />
                <TableHead label="Reference No." sortable borderRight />
                <TableHead label="Voucher Number" sortable borderRight />
                <TableHead label="Voucher Date" sortable borderRight />
                <TableHead label="Party Name" sortable borderRight />
                <TableHead label="Amount" sortable borderRight />
                <TableHead label="Total Debit" sortable borderRight />
                <TableHead label="Total Credit" sortable borderRight />
                <TableHead label="Status" sortable borderRight />
                <TableHead label="Chat" center width="50px" borderRight />
                <TableHead label="Action" center width="90px" />
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((tx, idx) => (
                  <tr key={tx._id} className="hover:bg-[var(--app-control-hover)] transition-colors text-[10px] border-b" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                    <td className="p-1.5 px-2 border-r text-center">
                      <input
                        type="checkbox"
                        className="w-3 h-3 rounded cursor-pointer accent-indigo-600"
                        checked={selectedIds.includes(tx._id)}
                        onChange={() => handleToggleSelectRow(tx._id)}
                      />
                    </td>
                    <td className="p-1.5 px-2 border-r font-bold text-center">{(currentPage - 1) * 20 + idx + 1}</td>
                    <td className="p-1.5 px-2 border-r font-bold text-indigo-600 truncate">{tx.referenceNumber || 'N/A'}</td>
                    <td className="p-1.5 px-2 border-r font-black">{tx.voucherNumber || 'DRAFT'}</td>
                    <td className="p-1.5 px-2 border-r font-semibold">{tx.voucherDate ? tx.voucherDate.substring(0, 10) : 'N/A'}</td>
                    <td className="p-1.5 px-2 border-r font-bold">{tx.partyLedger || 'N/A'}</td>
                    <td className="p-1.5 px-2 border-r font-semibold text-right">₹ {(tx.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-1.5 px-2 border-r font-semibold text-right">₹ {(tx.totalDebit || 0).toLocaleString('en-IN')}</td>
                    <td className="p-1.5 px-2 border-r font-bold text-right" style={{ color: 'var(--app-accent)' }}>₹ {(tx.totalCredit || 0).toLocaleString('en-IN')}</td>
                    <td className="p-1.5 px-2 border-r text-center font-bold uppercase">
                      <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-black tracking-wider ${
                        tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        tx.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                        tx.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-1.5 px-2 border-r text-center">
                      <MessageSquare size={11.5} className="mx-auto text-slate-400 cursor-pointer hover:text-indigo-500" />
                    </td>
                    <td className="p-1.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ActionButton
                          onClick={() => handleEdit(tx)}
                          icon={Edit3}
                          color="indigo"
                          tooltip="Edit Entry"
                        />
                        {(tx.status === 'draft' || tx.status === 'rejected') && (
                          <ActionButton
                            onClick={() => handlePushToReviewRow(tx._id)}
                            icon={Send}
                            color="emerald"
                            tooltip="Push to Review"
                          />
                        )}
                        {tx.status === 'pending_review' && (
                          <ActionButton
                            onClick={() => handleApproveRow(tx._id)}
                            icon={CheckCircle2}
                            color="emerald"
                            tooltip="Approve Entry"
                          />
                        )}
                        <ActionButton
                          onClick={() => handleDelete(tx._id)}
                          icon={Trash2}
                          color="red"
                          tooltip="Delete Entry"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={40} className="p-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>No Inbox Data found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="py-1.5 px-3 shrink-0 flex items-center justify-between border-t" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-table-head-bg)' }}>
          <span className="text-[10px] font-semibold" style={{ color: 'var(--app-muted)' }}>
            Showing {transactions.length > 0 ? (currentPage - 1) * 20 + 1 : 0} to {Math.min(currentPage * 20, totalCount)} of {totalCount} entries
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-6.5 w-6.5 rounded-md border flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              style={{ borderColor: 'var(--app-border)' }}
            >
              <ChevronLeft size={11.5} />
            </button>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/10">
              {currentPage}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage * 20 >= totalCount}
              className="h-6.5 w-6.5 rounded-md border flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              style={{ borderColor: 'var(--app-border)' }}
            >
              <ChevronRight size={11.5} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const TableHead = ({ label, sortable, center, width, borderRight }) => (
  <th className={`px-2 py-1.5 border-b text-[9.5px] font-bold uppercase tracking-wider ${center ? 'text-center' : 'text-left'} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)', backgroundColor: 'var(--app-table-head-bg)', width: width }}>
    <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''} ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
      {label} {sortable && <ArrowUpDown size={9.5} className="opacity-50" />}
    </div>
  </th>
);

export default PettyCashPanel;
