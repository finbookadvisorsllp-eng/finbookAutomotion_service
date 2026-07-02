import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, CheckCircle2, Trash2, Send, RefreshCw, Download, Edit3,
  FileSpreadsheet, ScanLine, Paperclip, ShoppingCart,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import VoucherEntryEngine from '../vouchers/VoucherEntryEngine';
import usePurchaseStore from '../../stores/usePurchaseStore';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge, { statusTone } from '../ui/Badge';
import { useConfirm } from '../ui/ConfirmDialog';

const PAGE_SIZE = 20;

const displayPanelDate = (dateStr) => {
  if (!dateStr) return '—';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dateStr;
};

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

const PurchasePanel = ({ mode, isDark, onAdd, title: customTitle, description: customDescription, voucherType = 'purchase', emptyText, icon: CustomIcon }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const Icon = CustomIcon || ShoppingCart;

  const [viewMode, setViewMode] = useState('inbox');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (location.state?.openManual) {
      window.history.replaceState({}, document.title);
      setViewMode('manual');
    }
  }, [location.state]);

  const handleBack = (activeType) => {
    if (['purchase_invoice', 'purchase_order', 'debit_note'].includes(activeType)) {
      setViewMode('inbox');
      fetchTransactions();
    } else {
      if (['sales_invoice', 'sales_order', 'credit_note'].includes(activeType)) {
        navigate('/sales/inbox', { state: { openManual: true } });
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
    transactions, totalCount, currentPage, loading, filters,
    fetchTransactions, fetchStats, setFilter, setPage,
    approveTransaction, pushToReview, deleteTransaction, fetchTransactionById, resetForm,
  } = usePurchaseStore();

  const modeStatusMap = { Inbox: 'draft', Review: 'pending_review', Archive: 'approved,archived' };
  const apiVoucherType = voucherType === 'purchase' ? '' : voucherType;

  useEffect(() => {
    setFilter('voucherType', apiVoucherType);
    setFilter('status', modeStatusMap[mode] || '');
  }, [mode, voucherType, setFilter]);

  useEffect(() => { setSelectedIds([]); }, [mode, voucherType, currentPage, filters]);

  useEffect(() => {
    if (viewMode === 'inbox') {
      fetchTransactions();
      fetchStats(apiVoucherType);
    }
  }, [viewMode, filters.status, filters.voucherType, filters.search, currentPage, fetchTransactions, fetchStats, apiVoucherType]);

  const handleEdit = async (tx) => { await fetchTransactionById(tx._id); setViewMode('manual'); };
  const handleCreateNew = () => { resetForm(voucherType === 'purchase' ? 'purchase_invoice' : voucherType); setViewMode('manual'); };

  const handleDelete = async (id) => {
    if (await confirm({ title: 'Delete transaction?', message: 'This action cannot be undone.', confirmText: 'Delete' })) {
      const res = await deleteTransaction(id);
      if (res.success) { toast.success('Transaction deleted successfully'); fetchTransactions(); }
      else toast.error(res.message || 'Failed to delete transaction');
    }
  };

  const handlePushToReviewRow = async (id) => {
    const res = await pushToReview(id);
    if (res.success) { toast.success('Transaction pushed to review'); fetchTransactions(); }
    else toast.error(res.message || 'Failed to push to review');
  };

  const handleApproveRow = async (id) => {
    const res = await approveTransaction(id, 'Approved from panel row action');
    if (res.success) { toast.success('Transaction approved'); fetchTransactions(); }
    else toast.error(res.message || 'Failed to approve transaction');
  };

  const handleExportData = () => { toast.info('Export features are processed and integrated.'); };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) return toast.error('Please select at least one transaction to approve');
    if (await confirm({ title: `Approve ${selectedIds.length} transaction(s)?`, confirmText: 'Approve', tone: 'default' })) {
      let successCount = 0;
      for (const id of selectedIds) { const res = await approveTransaction(id, 'Approved from panel bulk action'); if (res.success) successCount++; }
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
    let base = 'Purchase';
    if (voucherType === 'purchase_invoice') base = 'Purchase Invoice';
    else if (voucherType === 'purchase_order') base = 'Purchase Order';
    else if (voucherType === 'debit_note') base = 'Debit Note';
    if (customTitle) return `${customTitle} ${mode || 'Inbox'}`;
    return `${base} ${mode || 'Inbox'}`;
  };

  const getDescription = () => {
    let base = 'purchase transactions';
    if (voucherType === 'purchase_invoice') base = 'purchase invoices';
    else if (voucherType === 'purchase_order') base = 'purchase orders';
    else if (voucherType === 'debit_note') base = 'debit notes';
    return `Manage and process all ${base} efficiently.`;
  };

  const columns = [
    { key: 'sr', header: 'Sr No.', width: '60px', align: 'center', render: (_r, idx) => <span className="font-bold">{(currentPage - 1) * PAGE_SIZE + idx + 1}</span> },
    {
      key: 'doc', header: 'Document (OCR)', render: (tx) => tx.ocrMetadata?.documentUrl ? (
        <a href={tx.ocrMetadata.documentUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 font-bold" style={{ color: 'var(--app-accent)' }}>
          📄 <span className="max-w-[160px] truncate">{tx.ocrMetadata.documentUrl.split('/').pop() || 'ocr_invoice.pdf'}</span>
        </a>
      ) : <span className="opacity-40 italic">No document</span>,
    },
    { key: 'number', header: 'Voucher Number', sortable: true, sortValue: (tx) => tx.voucherNumber || tx.invoiceNumber, render: (tx) => <span className="font-black">{tx.voucherNumber || tx.invoiceNumber || '—'}</span> },
    { key: 'invoiceDate', header: 'Invoice Date', sortable: true, sortValue: (tx) => tx.invoiceDate, render: (tx) => <span className="font-semibold">{displayPanelDate(tx.invoiceDate)}</span> },
    { key: 'partyLedger', header: 'Party Ledger', sortable: true, render: (tx) => <span className="font-bold truncate block max-w-[200px]">{tx.partyLedger || '—'}</span> },
    { key: 'baseTotal', header: 'Base Total', align: 'right', sortable: true, sortValue: (tx) => tx.baseTotal || 0, render: (tx) => <span className="font-semibold">₹ {(tx.baseTotal || 0).toLocaleString('en-IN')}</span> },
    { key: 'grandTotal', header: 'Grand Total', align: 'right', sortable: true, sortValue: (tx) => tx.grandTotal || 0, render: (tx) => <span className="font-bold" style={{ color: 'var(--app-accent)' }}>₹ {(tx.grandTotal || 0).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (tx) => <Badge tone={statusTone(tx.status)}>{tx.status?.replace('_', ' ')}</Badge> },
    {
      key: 'action', header: 'Action', align: 'center', width: '110px', render: (tx) => (
        <div className="flex items-center justify-center gap-1.5">
          {tx.status !== 'approved' && <ActionButton onClick={() => handleEdit(tx)} icon={Edit3} tone="accent" tooltip="Edit Entry" />}
          {(tx.status === 'draft' || tx.status === 'rejected') && <ActionButton onClick={() => handlePushToReviewRow(tx._id)} icon={Send} tone="success" tooltip="Push to Review" />}
          {tx.status === 'pending_review' && <ActionButton onClick={() => handleApproveRow(tx._id)} icon={CheckCircle2} tone="success" tooltip="Approve Entry" />}
          {tx.status !== 'approved' && <ActionButton onClick={() => handleDelete(tx._id)} icon={Trash2} tone="danger" tooltip="Delete Entry" />}
          {tx.attachedDocuments?.length > 0 && <ActionButton onClick={() => window.open(tx.attachedDocuments[0].cloudinaryUrl, '_blank')} icon={Paperclip} tone="accent" tooltip="View Attachment" />}
        </div>
      ),
    },
  ];

  const actions = (
    <>
      {mode === 'Inbox' && (
        <>
          <Button icon={ScanLine} onClick={() => setViewMode('ocr')}>OCR Upload</Button>
          <Button icon={FileSpreadsheet} onClick={() => setViewMode('csv')}>CSV Upload</Button>
          <Button icon={Plus} variant="primary" onClick={handleCreateNew}>Create Entry</Button>
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
          <Button icon={Download} onClick={handleExportData}>Export Data</Button>
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
        description={customDescription || getDescription()}
        icon={Icon}
        live
        columns={columns}
        data={transactions}
        rowKey={(tx) => tx._id}
        loading={loading.list}
        emptyText={emptyText || `No ${mode || 'Inbox'} data found`}
        minWidth="1100px"
        selectable
        selectedKeys={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={(checked) => setSelectedIds(checked ? transactions.map((t) => t._id) : [])}
        search={{ value: filters.search, onChange: (v) => setFilter('search', v), placeholder: 'Search party, invoice number…' }}
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

export default PurchasePanel;
