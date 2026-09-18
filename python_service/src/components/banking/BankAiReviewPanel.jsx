import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText, CheckCircle2, AlertCircle, RefreshCw, Check, Search, Filter,
  Eye, Edit3, X, Sparkles, ArrowRight, ShieldCheck, HelpCircle, Layers, Building, ChevronRight, ChevronLeft, Lock, Plus, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import bankStatementAiApi from '../../services/bankStatementAiApi';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import apiClient from '../../lib/apiClient';

export default function BankAiReviewPanel({ batchData: initialBatchData, onClose, onRefreshList }) {
  const [batchData, setBatchData] = useState(initialBatchData);
  const [activeFilter, setActiveFilter] = useState('all'); // all, ready, review_required, already_processed, saved
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [editingItem, setEditingItem] = useState(null); // Item open in Split-Screen Drawer
  const [savingLoading, setSavingLoading] = useState(false);
  
  // Pagination state for ultra-fast rendering of large statements
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 25, 50, 100, 'all'
  
  // Master Creation Modal state
  const [isAddMasterOpen, setIsAddMasterOpen] = useState(false);
  const [targetItemForMaster, setTargetItemForMaster] = useState(null);
  const [newMasterName, setNewMasterName] = useState('');
  const [newMasterGroup, setNewMasterGroup] = useState('Sundry Creditors');
  const [creatingMaster, setCreatingMaster] = useState(false);

  const fundFlowStore = useFundFlowStore();

  useEffect(() => {
    fundFlowStore.fetchMasterData();
  }, []);

  // Precompute sorted master ledger lists once with useMemo to avoid 300+ expensive sorting operations on every render
  const allLedgersList = useMemo(() => {
    return Array.from(new Set([
      ...(fundFlowStore.masterData?.allLedgers || []),
      ...(fundFlowStore.masterData?.partyLedgers || []),
      ...((fundFlowStore.masterData?.ledgers || []).map(l => (typeof l === 'string' ? l : (l.ledgerName || l.name || '')))),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [fundFlowStore.masterData]);

  const purchaseOptionsList = useMemo(() => {
    const purchaseParties = (fundFlowStore.masterData?.purchasePartyLedgers || []).filter(Boolean);
    if (!purchaseParties.length) return allLedgersList;
    const purchaseSet = new Set(purchaseParties);
    const otherLedgers = allLedgersList.filter(l => !purchaseSet.has(l));
    return [...[...purchaseParties].sort((a, b) => a.localeCompare(b)), ...otherLedgers];
  }, [fundFlowStore.masterData, allLedgersList]);

  const salesOptionsList = useMemo(() => {
    const salesParties = (fundFlowStore.masterData?.salesPartyLedgers || []).filter(Boolean);
    if (!salesParties.length) return allLedgersList;
    const salesSet = new Set(salesParties);
    const otherLedgers = allLedgersList.filter(l => !salesSet.has(l));
    return [...[...salesParties].sort((a, b) => a.localeCompare(b)), ...otherLedgers];
  }, [fundFlowStore.masterData, allLedgersList]);

  const contraOptionsList = useMemo(() => {
    const cashBankParties = (fundFlowStore.masterData?.cashBankLedgers || []).filter(Boolean);
    if (!cashBankParties.length) return allLedgersList;
    const cashBankSet = new Set(cashBankParties);
    const otherLedgers = allLedgersList.filter(l => !cashBankSet.has(l));
    return [...[...cashBankParties].sort((a, b) => a.localeCompare(b)), ...otherLedgers];
  }, [fundFlowStore.masterData, allLedgersList]);

  const getPartyLedgerOptions = (voucherType, currentParty) => {
    let list = allLedgersList;
    if (voucherType === 'Payment') list = purchaseOptionsList;
    else if (voucherType === 'Receipt') list = salesOptionsList;
    else if (voucherType === 'Contra') list = contraOptionsList;

    if (currentParty && !list.includes(currentParty)) {
      return [currentParty, ...list];
    }
    return list;
  };

  const masterLedgers = allLedgersList;

  const items = batchData?.items || [];
  const summary = batchData?.summary || { total_count: 0, ready_count: 0, review_required_count: 0, already_processed_count: 0, saved_count: 0 };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (activeFilter === 'ready' && item.status !== 'ready' && item.status !== 'user_edited') return false;
      if (activeFilter === 'review_required' && item.status !== 'review_required') return false;
      if (activeFilter === 'already_processed' && item.status !== 'already_processed') return false;
      if (activeFilter === 'saved' && item.status !== 'saved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNarr = (item.narration || '').toLowerCase().includes(q);
        const matchParty = (item.partyLedger || '').toLowerCase().includes(q);
        const matchNum = (item.voucherNumber || '').toLowerCase().includes(q);
        const matchRef = (item.referenceNumber || item.instNumber || '').toLowerCase().includes(q);
        if (!matchNarr && !matchParty && !matchNum && !matchRef) return false;
      }
      return true;
    });
  }, [items, activeFilter, searchQuery]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  // Paginated slice for instant 60fps rendering
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const toggleSelectItem = (itemId) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      const saveableIds = filteredItems.filter(i => i.status !== 'already_processed' && i.status !== 'saved').map(i => i.item_id);
      setSelectedItemIds(saveableIds);
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleUpdateItemField = async (itemId, field, value) => {
    try {
      const res = await bankStatementAiApi.updateTransaction(batchData.batch_id, itemId, { [field]: value });
      if (res.success && res.data) {
        setBatchData(prev => ({
          ...prev,
          items: prev.items.map(i => i.item_id === itemId ? res.data : i)
        }));
        if (editingItem && editingItem.item_id === itemId) {
          setEditingItem(res.data);
        }
      }
    } catch (err) {
      toast.error('Failed to update transaction field');
    }
  };

  const handleCreateNewMaster = async () => {
    if (!newMasterName.trim()) {
      toast.error('Please enter a master ledger name');
      return;
    }
    setCreatingMaster(true);
    try {
      const payload = {
        ledgerName: newMasterName.trim(),
        groupName: newMasterGroup,
        status: 'ACTIVE'
      };
      const res = await apiClient.post('/ledgers', payload);
      if (res.data?.success || res.status === 200) {
        toast.success(`Created Master Ledger '${newMasterName.trim()}'`);
        await fundFlowStore.fetchMasterData();
        
        if (targetItemForMaster) {
          await handleUpdateItemField(targetItemForMaster, 'partyLedger', newMasterName.trim());
        }
        setIsAddMasterOpen(false);
        setNewMasterName('');
        setTargetItemForMaster(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create master ledger');
    } finally {
      setCreatingMaster(false);
    }
  };

  const handleSaveSelectedVouchers = async () => {
    if (selectedItemIds.length === 0) {
      toast.error('Please select at least one voucher to save');
      return;
    }
    setSavingLoading(true);
    try {
      const res = await bankStatementAiApi.saveVouchers(batchData.batch_id, selectedItemIds);
      if (res.success) {
        toast.success(`Successfully generated ${res.saved_count} accounting vouchers!`);
        // Refresh batch data
        const updatedBatch = await bankStatementAiApi.getBatchReview(batchData.batch_id);
        if (updatedBatch.success) {
          setBatchData(updatedBatch.data);
        }
        setSelectedItemIds([]);
        if (onRefreshList) onRefreshList();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving accounting vouchers');
    } finally {
      setSavingLoading(false);
    }
  };

  const getStatusBadge = (status, confidence) => {
    switch (status) {
      case 'saved':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center justify-center gap-1"><CheckCircle2 size={11} /> Saved</span>;
      case 'user_edited':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase bg-blue-500/15 text-blue-600 border border-blue-500/30 flex items-center justify-center gap-1"><Edit3 size={11} /> User Verified</span>;
      case 'ready':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center justify-center gap-1"><Check size={11} /> Ready</span>;
      case 'already_processed':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase bg-rose-500/15 text-rose-600 border border-rose-500/30 flex items-center justify-center gap-1"><Lock size={11} /> Duplicate</span>;
      case 'review_required':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center justify-center gap-1"><AlertCircle size={11} /> Review Required</span>;
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden bg-[var(--app-panel-bg)] rounded-xl border p-3.5" style={{ borderColor: 'var(--app-border)' }}>
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b shrink-0" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-[16px] font-black text-[var(--app-heading)] tracking-tight">
              AI Bank Statement & Master Mapping Review
            </h1>
            <p className="text-[11px] font-medium text-[var(--app-muted)] mt-0.5">
              Statement: <span className="font-bold text-[var(--app-heading)]">{batchData.file_name}</span> | Bank Ledger: <span className="font-bold text-[var(--app-heading)]">{batchData.bank_ledger}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[var(--app-control-hover)] transition-all cursor-pointer"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          >
            ← Back to Bank
          </button>
          <button
            onClick={async () => {
              if (!window.confirm(`Are you sure you want to delete "${batchData.file_name}"? All extracted drafts will be removed.`)) {
                return;
              }
              try {
                const res = await bankStatementAiApi.deleteBatch(batchData.batch_id || batchData._id);
                if (res?.success) {
                  toast.success(`Deleted statement "${batchData.file_name}" successfully`);
                  onClose?.();
                } else {
                  toast.error(res?.message || 'Failed to delete statement');
                }
              } catch (err) {
                toast.error(err?.response?.data?.detail || 'Failed to delete statement');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-500/30 rounded-lg text-[11px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
          <button
            onClick={handleSaveSelectedVouchers}
            disabled={selectedItemIds.length === 0 || savingLoading}
            className="flex items-center gap-2 px-5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
          >
            {savingLoading ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            <span>Approve & Save Vouchers ({selectedItemIds.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
        {[
          { id: 'all', label: 'Total Statement Items', count: summary.total_count, color: 'text-[var(--app-heading)]' },
          { id: 'ready', label: 'Mapped & Ready', count: summary.ready_count, color: 'text-emerald-500' },
          { id: 'review_required', label: 'Review Required', count: summary.review_required_count, color: 'text-amber-500' },
          { id: 'already_processed', label: 'Duplicates', count: summary.already_processed_count, color: 'text-rose-500' },
          { id: 'saved', label: 'Saved Vouchers', count: summary.saved_count, color: 'text-purple-500' }
        ].map(kpi => (
          <button
            key={kpi.id}
            onClick={() => setActiveFilter(kpi.id)}
            className={`p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
              activeFilter === kpi.id ? 'ring-2 ring-[var(--app-accent)] bg-[var(--app-control-bg)]' : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-control-hover)]'
            }`}
            style={{ borderColor: 'var(--app-border)' }}
          >
            <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">{kpi.label}</span>
            <span className={`text-[17px] font-black mt-0.5 block ${kpi.color}`}>{kpi.count}</span>
          </button>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border bg-[var(--app-control-bg)] shrink-0" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-extrabold text-[11px] text-[var(--app-heading)]">
            <input
              type="checkbox"
              onChange={(e) => toggleSelectAll(e.target.checked)}
              checked={selectedItemIds.length > 0 && selectedItemIds.length === filteredItems.filter(i => i.status !== 'already_processed' && i.status !== 'saved').length}
              className="w-4 h-4 rounded accent-[var(--app-accent)]"
            />
            Select All Eligible ({filteredItems.filter(i => i.status !== 'already_processed' && i.status !== 'saved').length})
          </label>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={13} />
            <input
              type="text"
              placeholder="Search narration, master, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 border rounded-lg text-[11px] font-semibold outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
            />
          </div>

          <button
            onClick={() => {
              setTargetItemForMaster(null);
              setIsAddMasterOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-extrabold text-[var(--app-accent)] bg-[var(--app-accent-soft)]/30 hover:bg-[var(--app-accent-soft)] transition-colors cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <Plus size={13} />
            <span>+ Create New Master</span>
          </button>
        </div>
      </div>

      {/* Main Review Table matching Manual Entry Form Layout */}
      <div className="flex-1 overflow-auto border rounded-xl" style={{ borderColor: 'var(--app-border)' }}>
        <table className="w-full text-left border-collapse text-[11px] min-w-[1150px]">
          <thead className="sticky top-0 bg-[var(--app-control-bg)] z-10 border-b" style={{ borderColor: 'var(--app-border)' }}>
            <tr>
              <th className="py-2.5 px-2 w-10 text-center">SR #</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider w-26">Voucher Date</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider w-28">Voucher Type</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider w-60">Party / Ledger Name</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider">Description / Narration</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider text-right w-36">Amount (₹)</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider w-28">Reference No.</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-20">Confidence</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-28">Status</th>
              <th className="py-2.5 px-2.5 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-14">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item, idx) => {
                const isSelected = selectedItemIds.includes(item.item_id);
                const canSelect = item.status !== 'already_processed' && item.status !== 'saved';
                const hasMaster = Boolean(item.partyLedger);
                const isOutflow = item.voucherType === 'Payment' || (item.debit > 0 && !item.credit);
                const isReceipt = item.voucherType === 'Receipt' || (item.credit > 0 && !item.debit);
                const rowNumber = pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;

                return (
                  <tr
                    key={item.item_id}
                    className={`border-b last:border-0 transition-colors hover:bg-[var(--app-content-bg)]/60 ${
                      isSelected ? 'bg-[var(--app-accent-soft)]/20' : ''
                    } ${!hasMaster && item.status === 'review_required' ? 'bg-amber-500/5' : ''}`}
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    {/* SR # & Select Checkbox */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          disabled={!canSelect}
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.item_id)}
                          className="w-3.5 h-3.5 rounded accent-[var(--app-accent)] disabled:opacity-30 cursor-pointer"
                        />
                        <span className="font-mono text-[10px] font-bold text-[var(--app-muted)]">{rowNumber}</span>
                      </div>
                    </td>

                    {/* Editable Voucher Date */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.voucherDate || ''}
                        onChange={(e) => handleUpdateItemField(item.item_id, 'voucherDate', e.target.value)}
                        className="w-full h-7 px-1.5 border rounded text-[11px] font-mono font-semibold bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                        style={{ borderColor: 'var(--app-border)' }}
                      />
                    </td>

                    {/* Editable Voucher Type Dropdown (Payment / Receipt / Contra) */}
                    <td className="py-2 px-2">
                      <select
                        value={item.voucherType || (isOutflow ? 'Payment' : 'Receipt')}
                        onChange={(e) => {
                          const newType = e.target.value;
                          const amt = item.amount || item.debit || item.credit || 0;
                          handleUpdateItemField(item.item_id, 'voucherType', newType);
                          if (newType === 'Payment') {
                            handleUpdateItemField(item.item_id, 'debit', amt);
                            handleUpdateItemField(item.item_id, 'credit', 0);
                          } else if (newType === 'Receipt') {
                            handleUpdateItemField(item.item_id, 'credit', amt);
                            handleUpdateItemField(item.item_id, 'debit', 0);
                          }
                        }}
                        className={`w-full h-7 px-1.5 border rounded-md text-[10.5px] font-extrabold outline-none bg-[var(--app-panel-bg)] focus:border-[var(--app-accent)] cursor-pointer ${
                          item.voucherType === 'Receipt' ? 'text-emerald-600 font-black' : item.voucherType === 'Contra' ? 'text-indigo-600 font-black' : 'text-rose-600 font-black'
                        }`}
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <option value="Payment">Payment (Out)</option>
                        <option value="Receipt">Receipt (In)</option>
                        <option value="Contra">Contra (Transfer)</option>
                      </select>
                    </td>

                    {/* Editable Accounting Master Dropdown with + Create Option */}
                    <td className="py-2 px-2">
                      <select
                        value={item.partyLedger || ''}
                        onChange={(e) => {
                          if (e.target.value === '__CREATE_NEW__') {
                            setTargetItemForMaster(item.item_id);
                            setIsAddMasterOpen(true);
                          } else {
                            handleUpdateItemField(item.item_id, 'partyLedger', e.target.value);
                          }
                        }}
                        className={`w-full h-7 px-2 border rounded-md text-[11px] font-extrabold outline-none bg-[var(--app-panel-bg)] focus:border-[var(--app-accent)] cursor-pointer ${
                          !hasMaster ? 'border-amber-500 text-amber-600 bg-amber-500/5' : 'text-[var(--app-heading)]'
                        }`}
                        style={hasMaster ? { borderColor: 'var(--app-border)' } : {}}
                      >
                        <option value="">-- Select Master Party Ledger --</option>
                        <option value="__CREATE_NEW__" className="font-bold text-[var(--app-accent)]">+ Create New Master...</option>
                        {getPartyLedgerOptions(item.voucherType, item.partyLedger).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>

                    {/* Editable Narration / Description */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.narration || ''}
                        onChange={(e) => handleUpdateItemField(item.item_id, 'narration', e.target.value)}
                        className="w-full h-7 px-2 border rounded text-[11px] font-medium bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] truncate"
                        style={{ borderColor: 'var(--app-border)' }}
                        title={item.narration}
                      />
                    </td>

                    {/* Single Amount (₹) Column with Dr/Cr Badge */}
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                          isOutflow ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
                        }`}>
                          {isOutflow ? 'Dr' : 'Cr'}
                        </span>
                        <input
                          type="number"
                          value={item.amount || item.debit || item.credit || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateItemField(item.item_id, 'amount', val);
                            if (isOutflow) {
                              handleUpdateItemField(item.item_id, 'debit', val);
                            } else {
                              handleUpdateItemField(item.item_id, 'credit', val);
                            }
                          }}
                          className="w-full h-7 px-2 border rounded text-[11px] font-mono font-black text-right bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                          style={{ borderColor: 'var(--app-border)' }}
                        />
                      </div>
                    </td>

                    {/* Editable Reference / Cheque No. */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.referenceNumber || item.instNumber || ''}
                        onChange={(e) => {
                          handleUpdateItemField(item.item_id, 'referenceNumber', e.target.value);
                          handleUpdateItemField(item.item_id, 'instNumber', e.target.value);
                        }}
                        className="w-full h-7 px-2 border rounded text-[10.5px] font-mono font-medium bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] truncate"
                        style={{ borderColor: 'var(--app-border)' }}
                        placeholder="Ref/UTR"
                      />
                    </td>

                    {/* Confidence */}
                    <td className="py-2 px-2 text-center">
                      <span className={`font-mono text-[10.5px] font-black ${
                        (item.confidence || 0) >= 80 ? 'text-emerald-500' : (item.confidence || 0) >= 60 ? 'text-amber-500' : 'text-rose-500'
                      }`}>
                        {item.confidence || 0}%
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2 px-2 text-center">
                      {getStatusBadge(item.status, item.confidence)}
                    </td>

                    {/* Action */}
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 rounded-lg border hover:bg-[var(--app-control-hover)] text-[var(--app-accent)] transition-all cursor-pointer"
                        style={{ borderColor: 'var(--app-border)' }}
                        title="View Full Context & Split-Screen Review"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[var(--app-muted)] font-semibold italic">
                  No statement items match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Bar */}
      {filteredItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border rounded-xl bg-[var(--app-control-bg)] shrink-0 text-[11px]" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center gap-2 text-[var(--app-muted)] font-semibold">
            <span>
              Showing <strong className="text-[var(--app-heading)] font-black">
                {pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1}
              </strong> to <strong className="text-[var(--app-heading)] font-black">
                {pageSize === 'all' ? filteredItems.length : Math.min(currentPage * pageSize, filteredItems.length)}
              </strong> of <strong className="text-[var(--app-heading)] font-black">{filteredItems.length}</strong> items
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Rows Per Page */}
            <div className="flex items-center gap-1.5 font-bold text-[var(--app-muted)]">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(v);
                  setCurrentPage(1);
                }}
                className="h-6 px-1.5 rounded border text-[11px] font-bold bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none cursor-pointer"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">All ({filteredItems.length})</option>
              </select>
            </div>

            {/* Page Navigation */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded border hover:bg-[var(--app-control-hover)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                  title="Previous Page"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="px-2 font-bold text-[var(--app-heading)] text-[10.5px]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border hover:bg-[var(--app-control-hover)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Master Creation Modal */}
      {isAddMasterOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsAddMasterOpen(false)} />
          <div className="relative w-[500px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden z-10 p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <Plus className="text-[var(--app-accent)]" size={18} />
                <h3 className="text-base font-black text-[var(--app-heading)]">Create New Accounting Master</h3>
              </div>
              <button onClick={() => setIsAddMasterOpen(false)} className="text-[var(--app-muted)] hover:text-[var(--app-heading)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold uppercase text-[var(--app-muted)] block mb-1">Ledger Name</label>
                <input
                  type="text"
                  placeholder="e.g. ABC Traders, Office Supplies"
                  value={newMasterName}
                  onChange={(e) => setNewMasterName(e.target.value)}
                  className="w-full h-10 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                  style={{ borderColor: 'var(--app-border)' }}
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase text-[var(--app-muted)] block mb-1">Parent Group</label>
                <select
                  value={newMasterGroup}
                  onChange={(e) => setNewMasterGroup(e.target.value)}
                  className="w-full h-10 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)] cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <option value="Sundry Creditors">Sundry Creditors (Suppliers)</option>
                  <option value="Sundry Debtors">Sundry Debtors (Customers)</option>
                  <option value="Indirect Expenses">Indirect Expenses</option>
                  <option value="Direct Expenses">Direct Expenses</option>
                  <option value="Indirect Incomes">Indirect Incomes</option>
                  <option value="Duties & Taxes">Duties & Taxes</option>
                  <option value="Current Assets">Current Assets</option>
                  <option value="Capital Account">Capital Account</option>
                  <option value="Suspense Account">Suspense Account</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                onClick={() => setIsAddMasterOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-[var(--app-control-hover)]"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewMaster}
                disabled={creatingMaster || !newMasterName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
              >
                {creatingMaster ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                <span>Create Master</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split-Screen Review Detail Modal / Drawer */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[500] flex items-center justify-end p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setEditingItem(null)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-5xl h-[92vh] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b shrink-0 bg-[var(--app-control-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[var(--app-accent)] text-white">
                    <Eye size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--app-heading)] uppercase tracking-tight">
                      Voucher Review & Split-Screen Preview
                    </h3>
                    <p className="text-[10px] text-[var(--app-muted)] font-bold">
                      Item ID: {editingItem.item_id.slice(0, 8)} | Source Document: {editingItem.source_document}
                    </p>
                  </div>
                </div>

                <button onClick={() => setEditingItem(null)} className="p-1.5 rounded-lg text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)]">
                  <X size={18} />
                </button>
              </div>

              {/* Split Screen Body */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden divider-x">
                
                {/* LEFT SIDE: Original Bank Statement Document Context */}
                <div className="p-5 overflow-y-auto space-y-4 bg-[var(--app-content-bg)]/30 border-r" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
                    <h4 className="text-[11px] font-black uppercase text-[var(--app-accent)] tracking-wider flex items-center gap-1.5">
                      <FileText size={14} /> Original Bank Statement Entry
                    </h4>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] font-mono">Original Document Context</span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border bg-[var(--app-panel-bg)] space-y-2 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                      <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider block">Statement Narration / Description</span>
                      <p className="text-[12px] font-bold text-[var(--app-heading)] leading-snug break-words">
                        "{editingItem.narration}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl border bg-[var(--app-panel-bg)] space-y-1 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                        <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Statement Date</span>
                        <div className="text-[13px] font-extrabold text-[var(--app-heading)]">{editingItem.voucherDate}</div>
                      </div>
                      <div className="p-3 rounded-xl border bg-[var(--app-panel-bg)] space-y-1 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                        <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Extracted Amount</span>
                        <div className={`text-[13px] font-extrabold ${editingItem.voucherType === 'Receipt' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          ₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border bg-[var(--app-panel-bg)] space-y-1 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                      <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Reference / UTR / Cheque No.</span>
                      <div className="text-[12px] font-bold font-mono text-[var(--app-heading)]">{editingItem.referenceNumber || editingItem.instNumber || '—'}</div>
                    </div>

                    {/* AI Explanation Card */}
                    <div className="p-3.5 rounded-xl border bg-indigo-500/10 border-indigo-500/20 space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-indigo-500 flex items-center gap-1">
                        <Sparkles size={12} /> AI Classification Reasoning
                      </span>
                      <p className="text-[11px] font-semibold text-[var(--app-heading)] leading-snug">
                        {editingItem.user_reasoning || 'AI matched transaction narration against active company master ledgers.'}
                      </p>
                      <div className="text-[9.5px] font-bold text-[var(--app-muted)] mt-1">
                        Review Note: {editingItem.review_reason}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE: Accounting Voucher Preview matching Manual Voucher Entry fields */}
                <div className="p-5 overflow-y-auto space-y-4 bg-[var(--app-panel-bg)]">
                  <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
                    <h4 className="text-[11px] font-black uppercase text-[var(--app-accent)] tracking-wider flex items-center gap-1.5">
                      <Layers size={14} /> Accounting Voucher Entry Preview
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Draft Voucher
                    </span>
                  </div>

                  {/* Manual Voucher Entry Form Field Mapping */}
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Voucher Type</label>
                        <select
                          value={editingItem.voucherType}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'voucherType', e.target.value)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          style={{ borderColor: 'var(--app-border)' }}
                        >
                          <option value="Receipt">Receipt Voucher (Money In)</option>
                          <option value="Payment">Payment Voucher (Money Out)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Voucher Date</label>
                        <input
                          type="text"
                          value={editingItem.voucherDate}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'voucherDate', e.target.value)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)] font-mono"
                          style={{ borderColor: 'var(--app-border)' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Bank Ledger (Dr/Cr Account)</label>
                      <input
                        type="text"
                        disabled
                        value={editingItem.bankLedger}
                        className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] cursor-not-allowed opacity-80"
                        style={{ borderColor: 'var(--app-border)' }}
                      />
                    </div>

                    <div>
                      <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Counterpart Party / Ledger</label>
                      <select
                        value={editingItem.partyLedger || ''}
                        onChange={(e) => handleUpdateItemField(editingItem.item_id, 'partyLedger', e.target.value)}
                        className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <option value="">-- Select Counterpart Ledger --</option>
                        {getPartyLedgerOptions(editingItem.voucherType, editingItem.partyLedger).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Transaction Amount (₹)</label>
                        <input
                          type="number"
                          value={editingItem.amount}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)] font-mono"
                          style={{ borderColor: 'var(--app-border)' }}
                        />
                      </div>

                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Payment Mode</label>
                        <select
                          value={editingItem.paymentMode || 'NEFT'}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'paymentMode', e.target.value)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          style={{ borderColor: 'var(--app-border)' }}
                        >
                          <option value="NEFT">NEFT</option>
                          <option value="RTGS">RTGS</option>
                          <option value="UPI">UPI</option>
                          <option value="IMPS">IMPS</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>

                    {/* Accounting Entry Box */}
                    <div className="p-3.5 rounded-xl border bg-[var(--app-control-bg)] space-y-2" style={{ borderColor: 'var(--app-border)' }}>
                      <span className="text-[9px] font-black uppercase text-[var(--app-accent)] tracking-wider block">Generated Accounting Entry</span>
                      {editingItem.voucherType === 'Receipt' ? (
                        <div className="space-y-1 font-mono text-[11px] font-bold">
                          <div className="flex justify-between text-emerald-600">
                            <span>Dr. {editingItem.bankLedger}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between pl-4 text-emerald-700">
                            <span>To {editingItem.partyLedger || '[Counterpart Ledger]'}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 font-mono text-[11px] font-bold">
                          <div className="flex justify-between text-rose-600">
                            <span>Dr. {editingItem.partyLedger || '[Counterpart Ledger]'}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between pl-4 text-rose-700">
                            <span>To {editingItem.bankLedger}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => setEditingItem(null)}
                      className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
                    >
                      Done Editing
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
