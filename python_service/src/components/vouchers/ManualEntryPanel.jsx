import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, RefreshCw, Edit3, Trash2, Send, CheckCircle2,
  FileText, BookText, ArrowLeftRight, AlertCircle, Copy, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

import useSalesStore from '../../stores/useSalesStore';
import usePurchaseStore from '../../stores/usePurchaseStore';
import { useFundFlowStore } from '../../stores/useFundFlowStore';

import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from './CreateFundFlow';
import { useConfirm } from '../ui/ConfirmDialog';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Badge, { statusTone } from '../ui/Badge';

const VOUCHER_TABS = [
  { id: 'sales_invoice', label: 'Sales Voucher', section: 'SALES', icon: FileText },
  { id: 'purchase_invoice', label: 'Purchase Voucher', section: 'PURCHASE', icon: BookText },
  { id: 'cash_payment', label: 'Payments', section: 'PAYMENTS', icon: ArrowLeftRight },
  { id: 'bank_payment', label: 'Receipts', section: 'RECEIPTS', icon: CheckCircle2 },
  { id: 'contra', label: 'Contra', section: 'CONTRA', icon: RefreshCw },
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

  let party = tx.partyLedger || tx.partyLedgerName || tx.againstLedger || '';
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
  const confirm = useConfirm();

  // Stores
  const salesStore = useSalesStore();
  const purchaseStore = usePurchaseStore();
  const fundFlowStore = useFundFlowStore();

  // Component UI State
  const [activeTab, setActiveTab] = useState('sales_invoice');
  const [viewMode, setViewMode] = useState('list');
  const [activeFormType, setActiveFormType] = useState('sales_invoice');
  const [, setIsEditing] = useState(false);
  const [, setEditingId] = useState(null);

  // Unsaved Warning State
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingTabSwitch, setPendingTabSwitch] = useState(null);
  const [pendingCloseSwitch, setPendingCloseSwitch] = useState(false);

  // Save Success Popup State
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savedVoucherId, setSavedVoucherId] = useState(null);

  // Search + filter
  const [searchQuery, setSearchQuery] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('all');

  useEffect(() => { setVoucherTypeFilter('all'); }, [activeTab]);

  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const createDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target)) {
        setShowCreateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if (viewMode === 'list') fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, viewMode, voucherTypeFilter]);

  // Debounced search
  useEffect(() => {
    if (viewMode !== 'list') return;
    const id = setTimeout(() => fetchList(), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    if (location.state && location.state.voucherType) {
      const type = location.state.voucherType;
      const editId = location.state.editId;
      salesStore.resetForm();
      purchaseStore.resetForm('purchase_invoice');
      fundFlowStore.resetForm(type);

      setActiveFormType(type);
      setActiveTab(type);

      if (editId) {
        setIsEditing(true);
        setEditingId(editId);
        setViewMode('form');
        if (type.startsWith('sales_') || type === 'credit_note') {
          salesStore.fetchById(editId);
        } else if (type.startsWith('purchase_') || type === 'debit_note') {
          purchaseStore.fetchTransactionById(editId);
        } else {
          fundFlowStore.fetchTransaction(editId);
        }
      } else {
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
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const isCurrentFormDirty = () => {
    if (activeFormType.startsWith('sales_') || activeFormType === 'credit_note') {
      return checkIsFormDirty('sales_invoice', salesStore.form);
    }
    if (activeFormType.startsWith('purchase_') || activeFormType === 'debit_note') {
      return checkIsFormDirty('purchase_invoice', purchaseStore.form);
    }
    return checkIsFormDirty(activeFormType, fundFlowStore.form);
  };

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

  const performTabSwitch = (tabId) => {
    salesStore.resetForm();
    purchaseStore.resetForm('purchase_invoice');
    fundFlowStore.resetForm(tabId);
    setActiveFormType(tabId);
    setActiveTab(tabId);
    setIsEditing(false);
    setEditingId(null);
    if (tabId.startsWith('sales_') || tabId === 'credit_note') {
      salesStore.fetchNextInvoiceNumber(tabId);
    } else if (tabId.startsWith('purchase_') || tabId === 'debit_note') {
      purchaseStore.fetchNextInvoiceNumber(tabId);
    } else {
      fundFlowStore.fetchNextVoucherNumber(tabId);
    }
  };

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

  const handleCreateVoucherWithType = (type) => {
    salesStore.resetForm();
    purchaseStore.resetForm('purchase_invoice');
    fundFlowStore.resetForm(type);
    setActiveFormType(type);
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
  };

  const handleCreateVoucher = () => handleCreateVoucherWithType(activeTab);

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

  const handleCloneRow = async (id) => {
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
      await fundFlowStore.fetchTransaction(id);
      fundFlowStore.setFormValue('_id', undefined);
      await fundFlowStore.fetchNextVoucherNumber(activeTab);
      setActiveFormType(activeTab);
    }
    setIsEditing(false);
    setEditingId(null);
    setViewMode('form');
    toast.success('Voucher details cloned successfully. Ready to edit and save.');
  };

  const handleDeleteRow = async (id) => {
    if (await confirm({ title: 'Delete this voucher?', message: 'This action cannot be undone.', confirmText: 'Delete' })) {
      let res;
      if (activeTab === 'sales_invoice') res = await salesStore.deleteTransaction(id);
      else if (activeTab === 'purchase_invoice') res = await purchaseStore.deleteTransaction(id);
      else res = await fundFlowStore.deleteTransaction(id);
      if (res?.success) { toast.success('Voucher deleted successfully'); fetchList(); }
      else toast.error(res?.message || 'Delete failed');
    }
  };

  const handlePushToTallyRow = async (id) => {
    toast.info('Pushing voucher to Tally database...');
    let res;
    if (activeTab === 'sales_invoice') res = await salesStore.approveTransaction(id, 'Pushed from manual entry');
    else if (activeTab === 'purchase_invoice') res = await purchaseStore.approveTransaction(id, 'Pushed from manual entry');
    else res = await fundFlowStore.updateStatus(id, 'approved');
    if (res?.success) { toast.success('Successfully posted voucher to Tally database!'); fetchList(); }
    else toast.error(res?.message || 'Push to Tally failed');
  };

  const handleSaveSuccess = (id) => { setSavedVoucherId(id); setShowSavePopup(true); };

  const handleContinueEditing = async () => {
    setShowSavePopup(false);
    setIsEditing(true);
    setEditingId(savedVoucherId);
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

  const handleBackToListSuccess = () => { setShowSavePopup(false); performCloseForm(); };

  // Active store → list data
  let transactions = [], totalCount = 0, currentPage = 1, listLoading = false, setPage = () => {};
  if (activeTab === 'sales_invoice') {
    transactions = salesStore.transactions || []; totalCount = salesStore.totalCount || 0;
    currentPage = salesStore.currentPage || 1; listLoading = salesStore.loading?.list; setPage = salesStore.setPage;
  } else if (activeTab === 'purchase_invoice') {
    transactions = purchaseStore.transactions || []; totalCount = purchaseStore.totalCount || 0;
    currentPage = purchaseStore.currentPage || 1; listLoading = purchaseStore.loading?.list; setPage = purchaseStore.setPage;
  } else {
    transactions = fundFlowStore.transactions || []; totalCount = fundFlowStore.totalCount || 0;
    currentPage = fundFlowStore.currentPage || 1; listLoading = fundFlowStore.loading?.list; setPage = fundFlowStore.setPage;
  }
  const unifiedList = transactions.map(t => getUnifiedTx(t, activeTab)).filter(Boolean);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const createOptions = activeTab === 'sales_invoice'
    ? [['sales_order', 'Sales Order'], ['sales_invoice', 'Sales Invoice'], ['credit_note', 'Credit Note']]
    : activeTab === 'purchase_invoice'
      ? [['purchase_order', 'Purchase Order'], ['purchase_invoice', 'Purchase Invoice'], ['debit_note', 'Debit Note']]
      : null;

  const typeFilterOptions = activeTab === 'sales_invoice'
    ? [{ value: 'all', label: 'All Sales Types' }, { value: 'sales_invoice', label: 'Sales Invoice' }, { value: 'sales_order', label: 'Sales Order' }, { value: 'credit_note', label: 'Credit Note' }]
    : activeTab === 'purchase_invoice'
      ? [{ value: 'all', label: 'All Purchase Types' }, { value: 'purchase_invoice', label: 'Purchase Invoice' }, { value: 'purchase_order', label: 'Purchase Order' }, { value: 'debit_note', label: 'Debit Note' }]
      : null;

  const RowAction = ({ icon: Icon, onClick, title, cls }) => (
    <button onClick={onClick} title={title} aria-label={title || Icon?.displayName} className={`p-1 rounded-lg transition-all hover:scale-110 active:scale-95 text-[var(--app-muted)] hover:bg-[var(--app-control-hover)] ${cls}`}>
      <Icon size={13} strokeWidth={2.4} />
    </button>
  );

  const columns = [
    { key: 'voucherNo', header: 'Voucher No', sortable: true, render: (tx) => <span className="font-black" style={{ color: 'var(--app-heading)' }}>{tx.voucherNo}</span> },
    { key: 'date', header: 'Date', sortable: true, sortValue: (tx) => tx.date, render: (tx) => <span className="font-semibold">{tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '—'}</span> },
    { key: 'type', header: 'Type', sortable: true, render: (tx) => <span className="font-bold" style={{ color: 'var(--app-accent)' }}>{tx.type}</span> },
    { key: 'party', header: ['cash_payment', 'bank_payment'].includes(activeTab) ? 'Payment Account' : 'Party / Ledger', sortable: true, render: (tx) => <span className="font-semibold truncate block max-w-[200px]">{tx.party}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (tx) => tx.amount, render: (tx) => <span className="font-bold" style={{ color: 'var(--app-accent)' }}>₹ {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (tx) => <Badge tone={statusTone(tx.status)}>{tx.status.replace('_', ' ')}</Badge> },
    { key: 'createdBy', header: 'Created By', align: 'center', render: (tx) => <span style={{ color: 'var(--app-muted)' }}>{tx.createdBy}</span> },
    { key: 'sync', header: 'Sync', align: 'center', render: (tx) => <Badge tone={tx.syncStatus === 'Synced' ? 'accent' : 'neutral'}>{tx.syncStatus}</Badge> },
    {
      key: 'actions', header: 'Actions', align: 'center', width: '150px', render: (tx) => (
        <div className="flex items-center justify-center gap-1">
          <RowAction icon={Edit3} title="Edit" cls="hover:text-[var(--app-accent)]" onClick={() => handleEditRow(tx._id, tx.rawType)} />
          <RowAction icon={Copy} title="Clone" cls="hover:text-teal-500" onClick={() => handleCloneRow(tx._id)} />
          <RowAction icon={Trash2} title="Delete" cls="hover:text-rose-500" onClick={() => handleDeleteRow(tx._id)} />
          {tx.status !== 'approved' && <RowAction icon={Send} title="Push to Tally" cls="hover:text-emerald-500" onClick={() => handlePushToTallyRow(tx._id)} />}
        </div>
      ),
    },
  ];

  const listActions = (
    <>
      <Button icon={RefreshCw} iconOnly onClick={fetchList} />
      <div className="relative" ref={createDropdownRef}>
        <Button variant="primary" icon={Plus} onClick={() => (createOptions ? setShowCreateDropdown((p) => !p) : handleCreateVoucher())}>
          Create Voucher {createOptions && <ChevronDown size={12} />}
        </Button>
        <AnimatePresence>
          {createOptions && showCreateDropdown && (
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
              className="absolute right-0 mt-1.5 w-48 rounded-xl border p-1 shadow-2xl z-50 glass-surface" style={{ borderColor: 'var(--app-border)' }}>
              {createOptions.map(([type, label]) => (
                <button key={type} onClick={() => { setShowCreateDropdown(false); handleCreateVoucherWithType(type); }}
                  className="w-full text-left rounded-lg px-2.5 py-2 text-[11.5px] font-semibold transition-colors hover:bg-[var(--app-control-hover)]" style={{ color: 'var(--app-heading)' }}>
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Voucher type tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto themed-scrollbar pb-2 mb-2.5 shrink-0">
        {VOUCHER_TABS.map((tab) => {
          const sel = viewMode === 'form' ? activeFormType === tab.id : activeTab === tab.id;
          return (
            <motion.button key={tab.id} onClick={() => handleTabClick(tab.id)} whileTap={{ scale: 0.98 }}
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-colors"
              style={{ borderColor: sel ? 'var(--app-accent)' : 'var(--app-border)', backgroundColor: sel ? 'var(--app-accent-soft)' : 'var(--app-control-bg)', color: sel ? 'var(--app-accent)' : 'var(--app-text)' }}>
              <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sel ? 'var(--app-accent)' : 'var(--app-control-hover)', color: sel ? '#fff' : 'var(--app-muted)' }}>
                <tab.icon size={12} strokeWidth={2.4} />
              </span>
              <span className="text-left leading-tight">
                <span className="block text-[7.5px] font-extrabold uppercase tracking-wider opacity-70">{tab.section}</span>
                <span className="block text-[11.5px] font-bold">{tab.label}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Work area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <DataTable
            columns={columns}
            data={unifiedList}
            rowKey={(tx) => tx._id}
            loading={listLoading}
            emptyText="No saved vouchers yet — create your first one."
            minWidth="980px"
            search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search vouchers…' }}
            filters={typeFilterOptions ? <Select value={voucherTypeFilter} options={typeFilterOptions} onChange={setVoucherTypeFilter} align="right" minWidth={150} /> : null}
            actions={listActions}
            pagination={{ page: currentPage, total: totalCount, label: `${totalCount} voucher${totalCount === 1 ? '' : 's'}`, onPrev: () => setPage(Math.max(currentPage - 1, 1)), onNext: () => setPage(Math.min(currentPage + 1, totalPages)), disableNext: currentPage >= totalPages }}
          />
        ) : (
          <div className="h-full rounded-xl border overflow-hidden" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
            {activeFormType.startsWith('sales_') || activeFormType === 'credit_note' ? (
              <CreateSales isDark={isDark} voucherType={activeFormType} onBack={handleCloseForm} onVoucherTypeChange={setActiveFormType} onSaveSuccess={handleSaveSuccess} />
            ) : activeFormType.startsWith('purchase_') || activeFormType === 'debit_note' ? (
              <CreatePurchase isDark={isDark} voucherType={activeFormType} onBack={handleCloseForm} onVoucherTypeChange={setActiveFormType} onSaveSuccess={handleSaveSuccess} />
            ) : (
              <CreateFundFlow isDark={isDark} voucherType={activeFormType} onBack={handleCloseForm} onSaveSuccess={handleSaveSuccess} />
            )}
          </div>
        )}
      </div>

      {/* Unsaved changes modal */}
      <AnimatePresence>
        {showUnsavedWarning && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCancelDiscard} />
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="relative w-full max-w-sm rounded-2xl border p-5 glass-surface" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow-lg)' }}>
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/12 text-amber-500"><AlertCircle size={18} /></span>
                <div>
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--app-heading)' }}>Unsaved changes</h3>
                  <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--app-muted)' }}>You have unsaved changes on this form. Discard them and continue?</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <Button variant="subtle" size="md" onClick={handleCancelDiscard}>Cancel</Button>
                <Button variant="danger" size="md" onClick={handleConfirmDiscard}>Discard &amp; Continue</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save success modal */}
      <AnimatePresence>
        {showSavePopup && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="relative w-full max-w-sm rounded-2xl border p-5 glass-surface" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow-lg)' }}>
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/12 text-emerald-500"><CheckCircle2 size={18} /></span>
                <div>
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--app-heading)' }}>Voucher saved</h3>
                  <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--app-muted)' }}>Saved to your draft database. What next?</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-5">
                <Button variant="primary" size="md" className="w-full" onClick={handleCreateNewSuccess}>Create new voucher</Button>
                <Button variant="subtle" size="md" className="w-full" onClick={handleContinueEditing}>Continue editing</Button>
                <Button variant="ghost" size="md" className="w-full" onClick={handleBackToListSuccess}>Back to voucher list</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManualEntryPanel;
