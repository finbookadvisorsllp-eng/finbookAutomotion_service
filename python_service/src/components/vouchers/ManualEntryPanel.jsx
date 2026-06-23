import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X, Plus, RefreshCw, Edit3, Trash2, Send, CheckCircle2,
  ChevronLeft, ChevronRight, Loader2, ArrowUpDown, FileText,
  BookText, ArrowLeftRight, Layout, Settings, AlertCircle, Eye, Copy, ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';

import useSalesStore from '../../stores/useSalesStore';
import usePurchaseStore from '../../stores/usePurchaseStore';
import { useFundFlowStore } from '../../stores/useFundFlowStore';

import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from './CreateFundFlow';

const VOUCHER_TABS = [
  { id: 'sales_invoice', label: 'Sales Voucher', section: 'SALES', icon: FileText },
  { id: 'purchase_invoice', label: 'Purchase Voucher', section: 'PURCHASE', icon: BookText },
  { id: 'cash_payment', label: 'Payments', section: 'PAYMENTS', icon: ArrowLeftRight },
  { id: 'bank_payment', label: 'Receipts', section: 'RECEIPTS', icon: CheckCircle2 },
  { id: 'contra', label: 'Contra', section: 'CONTRA', icon: RefreshCw }
];

const checkIsFormDirty = (type, formState) => {
  if (!formState) return false;
  if (type.startsWith('sales_') || type === 'credit_note') {
    return (
      !!formState.partyLedger ||
      !!formState.narration ||
      (formState.productLines && formState.productLines.some(l => l.stockItem || parseFloat(l.amount) > 0)) ||
      (formState.salesLines && formState.salesLines.some(l => l.salesLedger || parseFloat(l.amount) > 0))
    );
  }
  if (type.startsWith('purchase_') || type === 'debit_note') {
    return (
      !!formState.partyLedger ||
      !!formState.narration ||
      (formState.productLines && formState.productLines.some(l => l.stockItem || parseFloat(l.amount) > 0)) ||
      (formState.purchaseLines && formState.purchaseLines.some(l => l.purchaseLedger || parseFloat(l.amount) > 0))
    );
  }
  return (
    !!formState.partyLedger ||
    !!formState.narration ||
    (parseFloat(formState.amount) > 0) ||
    (parseFloat(formState.transferAmount) > 0)
  );
};

const getUnifiedTx = (tx, tab) => {
  if (!tx) return null;
  let voucherNo = tx.voucherNumber || tx.invoiceNumber || '—';
  let date = tx.voucherDate || tx.invoiceDate || tx.createdAt || '';
  let typeLabel = tx.voucherType || '';
  if (typeLabel === 'sales_invoice') typeLabel = 'Sales Invoice';
  else if (typeLabel === 'sales_order') typeLabel = 'Sales Order';
  else if (typeLabel === 'credit_note') typeLabel = 'Credit Note';
  else if (typeLabel === 'purchase_invoice') typeLabel = 'Purchase Invoice';
  else if (typeLabel === 'purchase_order') typeLabel = 'Purchase Order';
  else if (typeLabel === 'debit_note') typeLabel = 'Debit Note';
  else if (typeLabel === 'cash_payment') typeLabel = 'Payment';
  else if (typeLabel === 'bank_payment') typeLabel = 'Receipt';
  else if (typeLabel === 'contra') typeLabel = 'Contra';
  else if (typeLabel) typeLabel = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1).replace('_', ' ');

  let party = tx.partyLedger || tx.partyLedgerName || '';
  if (!party && tx.sourceLedger && tx.destinationLedger) {
    party = `${tx.sourceLedger} → ${tx.destinationLedger}`;
  }
  if (!party) party = '—';

  let amount = tx.grandTotal || tx.amount || tx.transferAmount || 0;
  let createdBy = tx.createdBy?.name || tx.createdBy || 'System';
  let syncStatus = tx.isSynced ? 'Synced' : (tx.syncStatus || 'Pending');

  return {
    _id: tx._id,
    voucherNo,
    date,
    type: typeLabel,
    rawType: tx.voucherType,
    party,
    amount: parseFloat(amount) || 0,
    status: tx.status || 'draft',
    createdBy,
    syncStatus,
  };
};

const ManualEntryPanel = ({ isDark }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Stores
  const salesStore = useSalesStore();
  const purchaseStore = usePurchaseStore();
  const fundFlowStore = useFundFlowStore();

  // Component UI State
  const [activeTab, setActiveTab] = useState('sales_invoice'); // active tab category
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [activeFormType, setActiveFormType] = useState('sales_invoice'); // active form type
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Unsaved Warning State
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingTabSwitch, setPendingTabSwitch] = useState(null);
  const [pendingCloseSwitch, setPendingCloseSwitch] = useState(false);

  // Save Success Popup State
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savedVoucherId, setSavedVoucherId] = useState(null);

  // Search Filter State (Local list view search)
  const [searchQuery, setSearchQuery] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('all');

  // Reset filter when tab changes
  useEffect(() => {
    setVoucherTypeFilter('all');
  }, [activeTab]);

  // Fetch list helper
  const fetchList = () => {
    if (activeTab === 'sales_invoice') {
      const typeFilter = voucherTypeFilter === 'all' ? '' : voucherTypeFilter;
      salesStore.setFilter('voucherType', typeFilter);
      salesStore.setFilter('search', searchQuery);
      salesStore.fetchTransactions();
    } else if (activeTab === 'purchase_invoice') {
      const typeFilter = voucherTypeFilter === 'all' ? '' : voucherTypeFilter;
      purchaseStore.setFilter('voucherType', typeFilter);
      purchaseStore.setFilter('search', searchQuery);
      purchaseStore.fetchTransactions();
    } else {
      fundFlowStore.setFilter('voucherType', activeTab);
      fundFlowStore.setFilter('search', searchQuery);
      fundFlowStore.fetchTransactions();
    }
  };

  useEffect(() => {
    if (viewMode === 'list') {
      fetchList();
    }
  }, [activeTab, viewMode, voucherTypeFilter]);

  useEffect(() => {
    if (location.state && location.state.voucherType) {
      const type = location.state.voucherType;
      salesStore.resetForm();
      purchaseStore.resetForm('purchase_invoice');
      fundFlowStore.resetForm(type);

      setActiveFormType(type);
      setActiveTab(type);
      setIsEditing(false);
      setEditingId(null);
      setViewMode('form');

      if (type.startsWith('sales_') || type === 'credit_note') {
        salesStore.fetchNextInvoiceNumber(type);
      } else if (type.startsWith('purchase_') || type === 'debit_note') {
        purchaseStore.fetchNextInvoiceNumber(type);
      } else {
        fundFlowStore.fetchNextVoucherNumber(type);
      }

      // Clear location state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Handle Search Input Submission/Enter
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      fetchList();
    }
  };

  // Helper to check if current form is dirty
  const isCurrentFormDirty = () => {
    if (activeFormType.startsWith('sales_') || activeFormType === 'credit_note') {
      return checkIsFormDirty('sales_invoice', salesStore.form);
    }
    if (activeFormType.startsWith('purchase_') || activeFormType === 'debit_note') {
      return checkIsFormDirty('purchase_invoice', purchaseStore.form);
    }
    return checkIsFormDirty(activeFormType, fundFlowStore.form);
  };

  // Handle Tab click
  const handleTabClick = (tabId) => {
    if (viewMode === 'form') {
      if (tabId === activeFormType) return;
      if (isCurrentFormDirty()) {
        setPendingTabSwitch(tabId);
        setShowUnsavedWarning(true);
      } else {
        performTabSwitch(tabId);
      }
    } else {
      setActiveTab(tabId);
      setSearchQuery('');
    }
  };

  // Force Tab Switch (discard changes)
  const performTabSwitch = (tabId) => {
    // Reset stores
    salesStore.resetForm();
    purchaseStore.resetForm('purchase_invoice');
    fundFlowStore.resetForm(tabId);

    setActiveFormType(tabId);
    setActiveTab(tabId);
    setIsEditing(false);
    setEditingId(null);

    // Fetch next number
    if (tabId.startsWith('sales_') || tabId === 'credit_note') {
      salesStore.fetchNextInvoiceNumber(tabId);
    } else if (tabId.startsWith('purchase_') || tabId === 'debit_note') {
      purchaseStore.fetchNextInvoiceNumber(tabId);
    } else {
      fundFlowStore.fetchNextVoucherNumber(tabId);
    }
  };

  // Handle Close (X) Click beside Create Voucher Heading
  const handleCloseForm = () => {
    if (isCurrentFormDirty()) {
      setPendingCloseSwitch(true);
      setShowUnsavedWarning(true);
    } else {
      performCloseForm();
    }
  };

  const performCloseForm = () => {
    setViewMode('list');
    setIsEditing(false);
    setEditingId(null);
    fetchList();
  };

  // Warning Modal Actions
  const handleConfirmDiscard = () => {
    setShowUnsavedWarning(false);
    if (pendingCloseSwitch) {
      setPendingCloseSwitch(false);
      performCloseForm();
    } else if (pendingTabSwitch) {
      const target = pendingTabSwitch;
      setPendingTabSwitch(null);
      performTabSwitch(target);
    }
  };

  const handleCancelDiscard = () => {
    setShowUnsavedWarning(false);
    setPendingTabSwitch(null);
    setPendingCloseSwitch(false);
  };

  // Create Voucher Trigger
  const handleCreateVoucher = () => {
    salesStore.resetForm();
    purchaseStore.resetForm('purchase_invoice');
    fundFlowStore.resetForm(activeTab);

    setActiveFormType(activeTab);
    setIsEditing(false);
    setEditingId(null);
    setViewMode('form');

    // Fetch next number
    if (activeTab.startsWith('sales_') || activeTab === 'credit_note') {
      salesStore.fetchNextInvoiceNumber(activeTab);
    } else if (activeTab.startsWith('purchase_') || activeTab === 'debit_note') {
      purchaseStore.fetchNextInvoiceNumber(activeTab);
    } else {
      fundFlowStore.fetchNextVoucherNumber(activeTab);
    }
  };

  // Row Edit Trigger
  const handleEditRow = async (id, type) => {
    setEditingId(id);
    setIsEditing(true);
    let targetType = type;

    if (activeTab === 'sales_invoice') {
      const data = await salesStore.fetchById(id);
      targetType = data?.voucherType || 'sales_invoice';
    } else if (activeTab === 'purchase_invoice') {
      const data = await purchaseStore.fetchTransactionById(id);
      targetType = data?.voucherType || 'purchase_invoice';
    } else {
      await fundFlowStore.fetchTransaction(id);
      targetType = activeTab;
    }

    setActiveFormType(targetType);
    setViewMode('form');
  };

  // Row Clone Trigger
  const handleCloneRow = async (id, type) => {
    toast.info('Cloning voucher...');
    if (activeTab === 'sales_invoice') {
      const data = await salesStore.fetchById(id);
      salesStore.setFormField('_id', undefined);
      salesStore.setFormField('invoiceNumber', '');
      salesStore.setFormField('voucherNumber', '');
      await salesStore.fetchNextInvoiceNumber(data.voucherType || 'sales_invoice');
      setActiveFormType(data.voucherType || 'sales_invoice');
    } else if (activeTab === 'purchase_invoice') {
      const data = await purchaseStore.fetchTransactionById(id);
      purchaseStore.updateForm({ _id: undefined, invoiceNumber: '', voucherNumber: '' });
      await purchaseStore.fetchNextInvoiceNumber(data.voucherType || 'purchase_invoice');
      setActiveFormType(data.voucherType || 'purchase_invoice');
    } else {
      const data = await fundFlowStore.fetchTransaction(id);
      fundFlowStore.setFormValue('_id', undefined);
      await fundFlowStore.fetchNextVoucherNumber(activeTab);
      setActiveFormType(activeTab);
    }

    setIsEditing(false);
    setEditingId(null);
    setViewMode('form');
    toast.success('Voucher details cloned successfully. Ready to edit and save.');
  };

  // Row Delete Trigger
  const handleDeleteRow = async (id) => {
    if (window.confirm('Are you sure you want to delete this voucher?')) {
      let res;
      if (activeTab === 'sales_invoice') {
        res = await salesStore.deleteTransaction(id);
      } else if (activeTab === 'purchase_invoice') {
        res = await purchaseStore.deleteTransaction(id);
      } else {
        res = await fundFlowStore.deleteTransaction(id);
      }

      if (res?.success) {
        toast.success('Voucher deleted successfully');
        fetchList();
      } else {
        toast.error(res?.message || 'Delete failed');
      }
    }
  };

  // Push to Tally Trigger
  const handlePushToTallyRow = async (id) => {
    toast.info('Pushing voucher to Tally database...');
    let res;
    if (activeTab === 'sales_invoice') {
      res = await salesStore.approveTransaction(id, 'Pushed from manual entry');
    } else if (activeTab === 'purchase_invoice') {
      res = await purchaseStore.approveTransaction(id, 'Pushed from manual entry');
    } else {
      res = await fundFlowStore.updateStatus(id, 'approved');
    }

    if (res?.success) {
      toast.success('Successfully posted voucher to Tally database!');
      fetchList();
    } else {
      toast.error(res?.message || 'Push to Tally failed');
    }
  };

  // Handle successful save
  const handleSaveSuccess = (id) => {
    setSavedVoucherId(id);
    setShowSavePopup(true);
  };

  // Save Popup Actions
  const handleContinueEditing = async () => {
    setShowSavePopup(false);
    setIsEditing(true);
    setEditingId(savedVoucherId);

    // Reload document
    if (activeFormType.startsWith('sales_') || activeFormType === 'credit_note') {
      await salesStore.fetchById(savedVoucherId);
    } else if (activeFormType.startsWith('purchase_') || activeFormType === 'debit_note') {
      await purchaseStore.fetchTransactionById(savedVoucherId);
    } else {
      await fundFlowStore.fetchTransaction(savedVoucherId);
    }
  };

  const handleCreateNewSuccess = () => {
    setShowSavePopup(false);
    setIsEditing(false);
    setEditingId(null);

    // Reset current form type
    if (activeFormType.startsWith('sales_') || activeFormType === 'credit_note') {
      salesStore.resetForm();
      salesStore.fetchNextInvoiceNumber(activeFormType);
    } else if (activeFormType.startsWith('purchase_') || activeFormType === 'debit_note') {
      purchaseStore.resetForm('purchase_invoice');
      purchaseStore.fetchNextInvoiceNumber(activeFormType);
    } else {
      fundFlowStore.resetForm(activeFormType);
      fundFlowStore.fetchNextVoucherNumber(activeFormType);
    }
  };

  const handleBackToListSuccess = () => {
    setShowSavePopup(false);
    performCloseForm();
  };

  // Extract table rows/loading/count based on active store
  let transactions = [];
  let totalCount = 0;
  let currentPage = 1;
  let listLoading = false;
  let setPage = () => {};

  if (activeTab === 'sales_invoice') {
    transactions = salesStore.transactions || [];
    totalCount = salesStore.totalCount || 0;
    currentPage = salesStore.currentPage || 1;
    listLoading = salesStore.loading?.list;
    setPage = salesStore.setPage;
  } else if (activeTab === 'purchase_invoice') {
    transactions = purchaseStore.transactions || [];
    totalCount = purchaseStore.totalCount || 0;
    currentPage = purchaseStore.currentPage || 1;
    listLoading = purchaseStore.loading?.list;
    setPage = purchaseStore.setPage;
  } else {
    transactions = fundFlowStore.transactions || [];
    totalCount = fundFlowStore.totalCount || 0;
    currentPage = fundFlowStore.currentPage || 1;
    listLoading = fundFlowStore.loading?.list;
    setPage = fundFlowStore.setPage;
  }

  const unifiedList = transactions.map(t => getUnifiedTx(t, activeTab)).filter(Boolean);

  const theme = {
    bg: 'var(--app-content-bg)',
    panel: 'var(--app-panel-bg)',
    border: 'var(--app-border)',
    headerBg: 'var(--app-table-head-bg)',
    text: 'var(--app-heading)',
    mutedText: 'var(--app-muted)',
    inputBg: 'var(--app-control-bg)',
    accent: '#4f46e5',
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative bg-slate-50 dark:bg-[#0b0c10]" style={{ backgroundColor: theme.bg }}>
       {/* ─── TABS HEADER ROW (STAYS ALWAYS VISIBLE) ─── */}
      <div className="flex items-center justify-between border-b bg-white dark:bg-[#0d0f12] px-4 py-2 shrink-0 select-none shadow-sm z-10" style={{ borderColor: theme.border }}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {VOUCHER_TABS.map(tab => {
            const isSelected = viewMode === 'form' ? activeFormType === tab.id : activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border text-left min-w-[135px] shrink-0 transition-all duration-200 ${
                  isSelected
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 shadow-sm font-extrabold scale-[1.01]'
                    : 'bg-slate-50/50 hover:bg-slate-100/70 dark:bg-[#12161a] dark:hover:bg-[#171d22] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm font-semibold'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200/50 dark:bg-[#1b2026] text-slate-400'}`}>
                  <tab.icon size={13} />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] block font-extrabold tracking-wider opacity-70 uppercase leading-none">{tab.section}</span>
                  <span className="text-[11.5px] block font-extrabold leading-none">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── MAIN WORK AREA ─── */}
      <div className={`flex-1 overflow-hidden relative flex flex-col ${viewMode === 'form' ? 'p-1.5 gap-1.5' : 'p-3 gap-3'}`}>
        
        {/* LIST VIEW */}
        {viewMode === 'list' && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* List Controls */}
            <div className="flex items-center justify-between gap-4 bg-white dark:bg-[#0d0f12] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm">
              <div className="flex items-center gap-2 max-w-lg w-full">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search and press Enter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    className="w-full h-8 pl-8 pr-3 text-[11px] font-bold border rounded-lg outline-none bg-slate-50 dark:bg-[#12161a] focus:border-indigo-500 transition-all"
                    style={{ borderColor: theme.border, color: theme.text }}
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">🔍</span>
                </div>
                {(activeTab === 'sales_invoice' || activeTab === 'purchase_invoice') && (
                  <select
                    value={voucherTypeFilter}
                    onChange={(e) => setVoucherTypeFilter(e.target.value)}
                    className="h-8 px-2 text-[11px] font-bold border rounded-lg outline-none bg-slate-50 dark:bg-[#12161a] cursor-pointer focus:border-indigo-500 transition-all"
                    style={{ borderColor: theme.border, color: theme.text }}
                  >
                    {activeTab === 'sales_invoice' ? (
                      <>
                        <option value="all">All Sales Types</option>
                        <option value="sales_invoice">Sales Invoice</option>
                        <option value="sales_order">Sales Order</option>
                        <option value="credit_note">Credit Note</option>
                      </>
                    ) : (
                      <>
                        <option value="all">All Purchase Types</option>
                        <option value="purchase_invoice">Purchase Invoice</option>
                        <option value="purchase_order">Purchase Order</option>
                        <option value="debit_note">Debit Note</option>
                      </>
                    )}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchList}
                  className="p-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition-colors"
                  style={{ borderColor: theme.border }}
                >
                  <RefreshCw size={13} className={listLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={handleCreateVoucher}
                  className="px-4 py-1.5 bg-[#4f46e5] hover:bg-indigo-700 text-white font-black text-[10.5px] uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Plus size={13} strokeWidth={3} />
                  Create Voucher
                </button>
              </div>
            </div>

            {/* List Table container */}
            <div className="flex-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d0f12] overflow-hidden flex flex-col relative rounded-xl shadow-sm">
              {listLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-xl bg-white dark:bg-[#12161a]" style={{ borderColor: theme.border }}>
                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Loading list data...</span>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px] text-[10.5px]">
                  <thead className="sticky top-0 z-10 select-none bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r" style={{ borderColor: theme.border }}>Voucher No</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r" style={{ borderColor: theme.border }}>Voucher Date</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r" style={{ borderColor: theme.border }}>Voucher Type</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r" style={{ borderColor: theme.border }}>Party / Ledger</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r text-right" style={{ borderColor: theme.border }}>Amount</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r text-center" style={{ borderColor: theme.border }}>Status</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r text-center" style={{ borderColor: theme.border }}>Created By</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-500 border-r text-center" style={{ borderColor: theme.border }}>Sync Status</th>
                      <th className="p-2.5 font-black uppercase tracking-wider text-slate-505 text-center w-[160px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedList.length > 0 ? (
                      unifiedList.map((tx, idx) => (
                        <tr
                          key={tx._id || idx}
                          className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors font-bold text-slate-700 dark:text-slate-300"
                          style={{ borderColor: theme.border }}
                        >
                          <td className="p-2.5 border-r font-black" style={{ borderColor: theme.border }}>{tx.voucherNo}</td>
                          <td className="p-2.5 border-r text-slate-505" style={{ borderColor: theme.border }}>
                            {tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="p-2.5 border-r font-black text-indigo-600 dark:text-indigo-400" style={{ borderColor: theme.border }}>
                            {tx.type}
                          </td>
                          <td className="p-2.5 border-r truncate max-w-[200px]" style={{ borderColor: theme.border }}>{tx.party}</td>
                          <td className="p-2.5 border-r text-right font-black text-emerald-600 dark:text-emerald-400" style={{ borderColor: theme.border }}>
                            ₹ {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 border-r text-center uppercase text-[9px]" style={{ borderColor: theme.border }}>
                            <span className={`px-2.5 py-0.5 rounded-full font-black ${
                              tx.status === 'approved' ? 'bg-emerald-105 text-emerald-700' :
                              tx.status === 'pending_review' ? 'bg-amber-105 text-amber-700' :
                              tx.status === 'rejected' ? 'bg-rose-105 text-rose-700' : 'bg-slate-105 text-slate-700'
                            }`}>
                              {tx.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-2.5 border-r text-center text-slate-505" style={{ borderColor: theme.border }}>{tx.createdBy}</td>
                          <td className="p-2.5 border-r text-center" style={{ borderColor: theme.border }}>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                              tx.syncStatus === 'Synced' ? 'bg-blue-105 text-blue-700' : 'bg-slate-105 text-slate-500'
                            }`}>
                              {tx.syncStatus}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditRow(tx._id, tx.rawType)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-650 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit3 size={12.5} />
                              </button>
                              <button
                                onClick={() => handleCloneRow(tx._id, tx.rawType)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-teal-650 rounded-lg transition-all"
                                title="Clone"
                              >
                                <Copy size={12.5} />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(tx._id)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-650 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 size={12.5} />
                              </button>
                              {tx.status !== 'approved' && (
                                <button
                                  onClick={() => handlePushToTallyRow(tx._id)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-650 rounded-lg transition-all"
                                  title="Push to Tally"
                                >
                                  <Send size={12.5} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="p-12 text-center text-slate-400 font-bold">
                          No saved vouchers found for this type. Click "+ Create Voucher" to add one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Row */}
              {totalCount > 20 && (
                <div className="flex items-center justify-between px-6 py-2 border-t bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500">
                  <span>Total {totalCount} records</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1 border rounded-lg bg-white disabled:opacity-40 disabled:hover:bg-white hover:bg-slate-100"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span>Page {currentPage} of {Math.ceil(totalCount / 20)}</span>
                    <button
                      onClick={() => setPage(Math.min(currentPage + 1, Math.ceil(totalCount / 20)))}
                      disabled={currentPage >= Math.ceil(totalCount / 20)}
                      className="p-1 border rounded-lg bg-white disabled:opacity-40 disabled:hover:bg-white hover:bg-slate-100"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FORM VIEW */}
        {viewMode === 'form' && (
          <div className="flex-1 flex flex-col gap-0 overflow-hidden bg-white dark:bg-[#0d0f12] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-0">
            {/* Dynamic Form wrapper */}
            <div className="flex-1 overflow-hidden relative">
              {activeFormType.startsWith('sales_') || activeFormType === 'credit_note' ? (
                <CreateSales
                  isDark={isDark}
                  voucherType={activeFormType}
                  onBack={handleCloseForm}
                  onVoucherTypeChange={setActiveFormType}
                  onSaveSuccess={handleSaveSuccess}
                />
              ) : activeFormType.startsWith('purchase_') || activeFormType === 'debit_note' ? (
                <CreatePurchase
                  isDark={isDark}
                  voucherType={activeFormType}
                  onBack={handleCloseForm}
                  onVoucherTypeChange={setActiveFormType}
                  onSaveSuccess={handleSaveSuccess}
                />
              ) : (
                <CreateFundFlow
                  isDark={isDark}
                  voucherType={activeFormType}
                  onBack={handleCloseForm}
                  onSaveSuccess={handleSaveSuccess}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── UNSAVED CHANGES WARNING POPUP ─── */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0d0f12] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-[400px] rounded-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-[13px] font-black uppercase tracking-wide">Unsaved Changes</h3>
            </div>
            <p className="text-[11px] font-bold text-slate-655 dark:text-slate-400 mb-6 leading-relaxed">
              You have unsaved changes on this form. Are you sure you want to discard them and continue?
            </p>
            <div className="flex justify-end gap-2 text-[10px] font-black uppercase tracking-wider">
              <button
                onClick={handleCancelDiscard}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                style={{ borderColor: theme.border, color: theme.text }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-4 py-2 bg-red-655 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all"
              >
                Discard & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SAVE SUCCESS POPUP ─── */}
      {showSavePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0d0f12] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-[420px] rounded-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-emerald-500 mb-4">
              <CheckCircle2 size={24} />
              <h3 className="text-[13px] font-black uppercase tracking-wide">Voucher Saved</h3>
            </div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              The voucher has been saved to your draft database. Please select your next step.
            </p>
            <div className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-wider">
              <button
                onClick={handleContinueEditing}
                className="w-full py-2.5 border rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                style={{ borderColor: theme.border }}
              >
                Continue Editing
              </button>
              <button
                onClick={handleCreateNewSuccess}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all"
              >
                Create New Voucher
              </button>
              <button
                onClick={handleBackToListSuccess}
                className="w-full py-2.5 border rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
                style={{ borderColor: theme.border }}
              >
                Back to Voucher List
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManualEntryPanel;
