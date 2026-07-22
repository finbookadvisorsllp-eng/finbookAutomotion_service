import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, CheckCircle2, Trash2, RefreshCw, Download, Edit3,
  MessageSquare, Wallet, ScanLine, FileSpreadsheet, Send,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import VoucherEntryEngine from '../vouchers/VoucherEntryEngine';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge, { statusTone } from '../ui/Badge';
import { useConfirm } from '../ui/ConfirmDialog';

const PAGE_SIZE = 20;

const ActionButton = ({ onClick, icon: Icon, tone = 'accent', tooltip }) => {
  const tones = {
    accent: 'hover:text-[var(--app-accent)]',
    success: 'hover:text-emerald-600',
    danger: 'hover:text-rose-500',
  };
  return (
    <div className="relative group flex items-center justify-center">
      <button onClick={onClick} className={`p-1 rounded-lg transition-all text-[var(--app-muted)] hover:bg-[var(--app-control-hover)] ${tones[tone] || tones.accent}`}>
        <Icon size={12} strokeWidth={2.5} />
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900/95 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
        {tooltip}
      </span>
    </div>
  );
};

const PettyCashPanel = ({ mode, isDark, voucherType, title: customTitle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const [viewMode, setViewMode] = useState('inbox');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (location.state?.openManual) {
      window.history.replaceState({}, document.title);
      setViewMode('manual');
    }
  }, [location.state]);

  const handleBack = (activeType) => {
    if (activeType === voucherType) {
      setViewMode('inbox');
      fetchTransactions();
    } else {
      if (['sales_invoice', 'sales_order', 'credit_note'].includes(activeType)) {
        navigate('/sales/inbox', { state: { openManual: true } });
      } else if (['purchase_invoice', 'purchase_order', 'debit_note'].includes(activeType)) {
        navigate('/purchase/inbox', { state: { openManual: true } });
      } else if (activeType === 'cash_payment') {
        navigate('/fund-flow/cash-payment', { state: { openManual: true } });
      } else if (activeType === 'bank_payment') {
        navigate('/fund-flow/bank-payment', { state: { openManual: true } });
      } else if (activeType === 'contra') {
        navigate('/fund-flow/contra', { state: { openManual: true } });
      } else {
        setViewMode('inbox');
        fetchTransactions();
      }
    }
  };

  const {
    transactions, totalCount, currentPage, filters, loading,
    setFilter, setPage, fetchTransactions, deleteTransaction, updateStatus, fetchTransaction,
  } = useFundFlowStore();

  useEffect(() => {
    let statusFilter = '';
    if (mode === 'Inbox') statusFilter = 'draft,rejected';
    else if (mode === 'Review') statusFilter = 'pending_review';
    else if (mode === 'Archive') statusFilter = 'approved,archived';
    setFilter('status', statusFilter);
    if (voucherType) setFilter('voucherType', voucherType);
  }, [mode, voucherType, setFilter]);

  useEffect(() => { setSelectedIds([]); }, [mode, voucherType, currentPage, filters]);
  useEffect(() => { fetchTransactions(); }, [filters, currentPage, fetchTransactions]);

  const handleEdit = (tx) => { fetchTransaction(tx._id); setViewMode('manual'); };

  const handleDelete = async (id) => {
    if (await confirm({ title: 'Delete draft entry?', message: 'This action cannot be undone.', confirmText: 'Delete' })) {
      const res = await deleteTransaction(id);
      if (res.success) { toast.success('Entry deleted successfully'); fetchTransactions(); }
      else toast.error(res.message || 'Failed to delete entry');
    }
  };

  const handlePushToReviewRow = async (id) => {
    if (await confirm({ title: 'Push entry to review?', confirmText: 'Push', tone: 'default' })) {
      const res = await updateStatus(id, 'pending_review');
      if (res.success) { toast.success('Pushed to review successfully'); fetchTransactions(); }
      else toast.error(res.message || 'Failed to push to review');
    }
  };

  const handleApproveRow = async (id) => {
    if (await confirm({ title: 'Approve this entry?', confirmText: 'Approve', tone: 'default' })) {
      const res = await updateStatus(id, 'approved');
      if (res.success) { toast.success('Entry approved successfully'); fetchTransactions(); }
      else toast.error(res.message || 'Failed to approve entry');
    }
  };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) return toast.error('Please select at least one transaction to approve');
    if (await confirm({ title: `Approve ${selectedIds.length} transaction(s)?`, confirmText: 'Approve', tone: 'default' })) {
      let successCount = 0;
      for (const id of selectedIds) { const res = await updateStatus(id, 'approved'); if (res.success) successCount++; }
      toast.success(`Successfully approved ${successCount} transaction(s)`);
      setSelectedIds([]); fetchTransactions();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return toast.error('Please select at least one transaction to delete');
    if (await confirm({ title: `Delete ${selectedIds.length} draft transaction(s)?`, message: 'This action cannot be undone.', confirmText: 'Delete' })) {
      let successCount = 0;
      for (const id of selectedIds) { const res = await deleteTransaction(id); if (res.success) successCount++; }
      toast.success(`Successfully deleted ${successCount} transaction(s)`);
      setSelectedIds([]); fetchTransactions();
    }
  };

  const toggleRow = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const getTitle = () => {
    let base = 'Fund Flow';
    if (voucherType === 'cash_payment') base = 'Payment';
    else if (voucherType === 'bank_payment') base = 'Receipt';
    else if (voucherType === 'contra') base = 'Contra';
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

  const columns = [
    { key: 'sr', header: 'Sr No.', width: '60px', align: 'center', render: (_r, idx) => <span className="font-bold">{(currentPage - 1) * PAGE_SIZE + idx + 1}</span> },
    { key: 'referenceNumber', header: 'Reference No.', sortable: true, render: (tx) => <span className="font-bold" style={{ color: 'var(--app-accent)' }}>{tx.referenceNumber || 'N/A'}</span> },
    { key: 'voucherNumber', header: 'Voucher Number', sortable: true, render: (tx) => <span className="font-black">{tx.voucherNumber || 'DRAFT'}</span> },
    { key: 'voucherDate', header: 'Voucher Date', sortable: true, render: (tx) => <span className="font-semibold">{tx.voucherDate ? tx.voucherDate.substring(0, 10) : 'N/A'}</span> },
    { key: 'partyLedger', header: 'Party Name', sortable: true, render: (tx) => <span className="font-bold">{tx.partyLedger || 'N/A'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (tx) => tx.amount || 0, render: (tx) => <span className="font-semibold">₹ {(tx.amount || 0).toLocaleString('en-IN')}</span> },
    { key: 'totalDebit', header: 'Total Debit', align: 'right', sortable: true, sortValue: (tx) => tx.totalDebit || 0, render: (tx) => <span className="font-semibold">₹ {(tx.totalDebit || 0).toLocaleString('en-IN')}</span> },
    { key: 'totalCredit', header: 'Total Credit', align: 'right', sortable: true, sortValue: (tx) => tx.totalCredit || 0, render: (tx) => <span className="font-bold" style={{ color: 'var(--app-accent)' }}>₹ {(tx.totalCredit || 0).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (tx) => <Badge tone={statusTone(tx.status)}>{tx.status}</Badge> },
    { key: 'chat', header: 'Chat', align: 'center', width: '50px', render: () => <MessageSquare size={11.5} className="mx-auto cursor-pointer text-[var(--app-muted)] hover:text-[var(--app-accent)]" /> },
    {
      key: 'action', header: 'Action', align: 'center', width: '90px', render: (tx) => (
        <div className="flex items-center justify-center gap-1">
          <ActionButton onClick={() => handleEdit(tx)} icon={Edit3} tone="accent" tooltip="Edit Entry" />
          {(tx.status === 'draft' || tx.status === 'rejected') && <ActionButton onClick={() => handlePushToReviewRow(tx._id)} icon={Send} tone="success" tooltip="Push to Review" />}
          {tx.status === 'pending_review' && <ActionButton onClick={() => handleApproveRow(tx._id)} icon={CheckCircle2} tone="success" tooltip="Approve Entry" />}
          <ActionButton onClick={() => handleDelete(tx._id)} icon={Trash2} tone="danger" tooltip="Delete Entry" />
        </div>
      ),
    },
  ];

  const actions = (
    <>
      {mode === 'Inbox' && (
        <>
          <Button icon={ScanLine} onClick={() => setViewMode('ocr')}>OCR</Button>
          <Button icon={FileSpreadsheet} onClick={() => setViewMode('csv')}>CSV</Button>
          <Button icon={Plus} variant="primary" onClick={() => setViewMode('manual')}>Create</Button>
          <div className="w-px h-6 mx-0.5 hidden sm:block" style={{ backgroundColor: 'var(--app-border)' }} />
          <Button icon={CheckCircle2} iconOnly onClick={handleApproveSelected} />
          <Button icon={Trash2} variant="danger" iconOnly onClick={handleDeleteSelected} />
        </>
      )}
      {mode === 'Review' && (
        <>
          <Button icon={CheckCircle2} variant="primary" onClick={handleApproveSelected}>Approve Selected</Button>
          <Button icon={Trash2} variant="danger" iconOnly onClick={handleDeleteSelected} />
          <Button icon={RefreshCw} iconOnly onClick={fetchTransactions} />
        </>
      )}
      {mode === 'Archive' && (
        <>
          <Button icon={Download} onClick={() => toast.info('Export features are processed and integrated.')}>Export Data</Button>
          <Button icon={Trash2} variant="danger" iconOnly onClick={handleDeleteSelected} />
          <Button icon={RefreshCw} iconOnly onClick={fetchTransactions} />
        </>
      )}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col h-full overflow-hidden relative">
      {viewMode !== 'inbox' && voucherType && (
        <div className="absolute inset-0 z-40">
          <VoucherEntryEngine isDark={isDark} defaultMode={viewMode} voucherType={voucherType} onBack={handleBack} />
        </div>
      )}

      <DataTable
        title={getTitle()}
        description={getDescription()}
        icon={Wallet}
        live
        columns={columns}
        data={transactions}
        rowKey={(tx) => tx._id}
        loading={loading.list}
        emptyText="No Inbox Data found."
        minWidth="1100px"
        selectable
        selectedKeys={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={(checked) => setSelectedIds(checked ? transactions.map((t) => t._id) : [])}
        search={{ value: filters.search, onChange: (v) => setFilter('search', v), placeholder: 'Search by party name…' }}
        actions={actions}
        pagination={{
          page: currentPage,
          total: totalCount,
          label: `Showing ${transactions.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to ${Math.min(currentPage * PAGE_SIZE, totalCount)} of ${totalCount} entries`,
          onPrev: () => setPage(currentPage - 1),
          onNext: () => setPage(currentPage + 1),
          disableNext: currentPage * PAGE_SIZE >= totalCount,
        }}
      />
    </motion.div>
  );
};

export default PettyCashPanel;
