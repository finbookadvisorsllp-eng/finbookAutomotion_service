import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Upload,
  Download,
  Trash2,
  Search,
  HelpCircle,
  Settings,
  Filter,
  Edit3,
  RefreshCw,
  ChevronDown,
  ChevronsRight,
  ChevronsLeft,
  CheckCircle2,
  MoreHorizontal,
  Info,
  Calendar,
  Layout,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,

  Check,
  Landmark,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import DataTable from '../ui/DataTable';
import Badge, { statusTone } from '../ui/Badge';
import StatCard from '../ui/StatCard';
import ObjectDoodle from '../ui/ObjectDoodle';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import fundflowApi from '../../services/fundflowApi';
import bankStatementAiApi from '../../services/bankStatementAiApi';
import BulkUploadPanel from '../bulk-upload/BulkUploadPanel';
import BankAiReviewPanel from './BankAiReviewPanel';
import BankRuleMappingModal from './BankRuleMappingModal';

// All dropdown data is fetched dynamically from the database via useFundFlowStore.
// No hardcoded arrays — see BankPanel component body for dynamic derivations.

const TAB_META = {
  'Manage Bank': { title: 'Bank Ledgers & Accounts', subtitle: 'Manage linked bank accounts, Tally ledgers and current balances.' },
  'Inbox': { title: 'Bank Reconciliation (BRS)', subtitle: 'Reconcile bank statement entries with Tally ledgers.' },
  'AI Voucher Review': { title: 'AI Bank Statement Voucher Review', subtitle: 'Review AI categorizations, edit counterpart ledgers, and save approved vouchers.' },
  'Add Bank Rule': { title: 'Bank Mapping', subtitle: 'Automatically identify bank transaction patterns and map them to the correct party ledgers.' },
  'Review': { title: 'Bank Review', subtitle: 'Verify and approve matched transactions before posting.' },
  'Archive': { title: 'Bank Archive', subtitle: 'Approved transactions posted to Tally.' },
};

const BANK_SUB_TABS = [
  { id: 'Inbox', label: 'Bank Reconciliation (BRS)', icon: FileText },
  { id: 'Manage Bank', label: 'Bank Ledgers & Accounts', icon: Landmark },
  { id: 'AI Voucher Review', label: 'AI Voucher Review', icon: Sparkles },
  { id: 'Add Bank Rule', label: 'Bank Mapping', icon: SlidersHorizontal },
];


const BankPanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Manage Bank');
  const [selectedBank, setSelectedBank] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedBankRow, setSelectedBankRow] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [bankDetailsLoading, setBankDetailsLoading] = useState(false);

  // Modals for Bank Main
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [isUploadStatementOpen, setIsUploadStatementOpen] = useState(false);
  const [isBankFilterOpen, setIsBankFilterOpen] = useState(false);
  const [isAddBankLedgerOpen, setIsAddBankLedgerOpen] = useState(false);
  const [selectedUploadLedger, setSelectedUploadLedger] = useState('');
  const [aiStatementBankFilter, setAiStatementBankFilter] = useState('');

  // AI Statement & Batch Review State
  const [activeBatchData, setActiveBatchData] = useState(null);
  const [aiBatches, setAiBatches] = useState([]);
  const [aiBatchesLoading, setAiBatchesLoading] = useState(false);
  const [isAiStatementModalOpen, setIsAiStatementModalOpen] = useState(false);
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isInboxFilterOpen, setIsInboxFilterOpen] = useState(false);

  const fundFlowStore = useFundFlowStore();

  useEffect(() => {
    fundFlowStore.fetchMasterData();
    fundFlowStore.setFilter('voucherType', '');
    fundFlowStore.setFilter('search', '');
    fundFlowStore.fetchTransactions();
  }, []);

  const isStrictBankLedger = (l) => {
    if (!l) return false;
    const g = (l.groupName || l.parentGroup || '').toLowerCase().trim();
    const name = (l.ledgerName || l.name || '').toLowerCase().trim();

    // Explicitly exclude non-bank groups: Expenses, Incomes, Debtors, Creditors, Taxes, etc.
    const nonBankGroups = [
      'indirect expenses', 'direct expenses', 'indirect incomes', 'direct incomes',
      'expenses', 'incomes', 'sundry debtors', 'sundry creditors', 'debtors', 'creditors',
      'duties & taxes', 'current liabilities', 'provisions', 'loans (liability)',
      'capital account', 'reserves & surplus', 'sales accounts', 'purchase accounts',
      'fixed assets', 'investments', 'miscellaneous expenses', 'suspense account',
      'branch / divisions', 'cash-in-hand'
    ];
    if (nonBankGroups.some(nb => g === nb || g.startsWith(nb))) {
      return false;
    }

    // Exclude expense / non-bank items by name even if group is ambiguous
    const nonBankKeywords = ['charges', 'interest', 'commission', 'fee', 'tax', 'tds', 'gst', 'salary', 'rent', 'exp', 'expense', 'income', 'round off'];
    if (nonBankKeywords.some(kw => name.includes(kw))) {
      return false;
    }

    // Must be in Bank Accounts or Bank OD A/c or Bank OCC A/c
    return g === 'bank accounts' || g === 'bank account' || g === 'bank od a/c' || g === 'bank od account' || g === 'bank occ a/c' || g.includes('bank account') || g.includes('bank od');
  };

  const verifiedBankLedgerNames = new Set(
    (fundFlowStore.masterData?.cashBankLedgers || [])
      .filter(name => {
        const lower = name.toLowerCase();
        return !lower.includes('cash') && !lower.includes('petty') && !lower.includes('charges') && !lower.includes('interest');
      })
  );

  const dbBankLedgers = (fundFlowStore.masterData?.ledgers || []).filter(l => {
    const name = l.ledgerName || l.name || '';
    if (verifiedBankLedgerNames.has(name)) return true;
    return isStrictBankLedger(l);
  });

  const detectBankName = (ledgerName) => {
    if (!ledgerName) return '';
    const lower = ledgerName.toLowerCase();
    if (lower.includes('hdfc')) return 'HDFC Bank';
    if (lower.includes('icici')) return 'ICICI Bank';
    if (lower.includes('axis')) return 'Axis Bank';
    if (lower.includes('kotak')) return 'Kotak Mahindra Bank';
    if (lower.includes('sbi') || lower.includes('state bank')) return 'State Bank of India';
    if (lower.includes('pnb') || lower.includes('punjab national')) return 'Punjab National Bank';
    if (lower.includes('yes')) return 'Yes Bank';
    if (lower.includes('hsbc')) return 'HSBC';
    if (lower.includes('standard chartered')) return 'Standard Chartered';
    if (lower.includes('dbs')) return 'DBS Bank';
    return '';
  };

  const detectAccountNumber = (ledgerName) => {
    if (!ledgerName) return '';
    const match = ledgerName.match(/\d{9,18}/);
    return match ? match[0] : '';
  };

  const [bankBalances, setBankBalances] = useState({});

  const dbBankAccounts = dbBankLedgers.length > 0
    ? dbBankLedgers.map((l, i) => {
      const ledgerName = l.ledgerName || l.name || '';
      return {
        id: l.id || l._id || String(i + 1),
        bank: ledgerName,
        accountName: l.companyName || 'Primary Account',
        accountNumber: detectAccountNumber(ledgerName) || '—',
        ledger: ledgerName
      };
    })
    : [];

  useEffect(() => {
    if (dbBankAccounts.length === 0) return;
    const fetched = new Set();
    const fetchBalances = async () => {
      for (const acc of dbBankAccounts) {
        if (acc.ledger && !fetched.has(acc.ledger) && bankBalances[acc.ledger] === undefined) {
          fetched.add(acc.ledger);
          try {
            const res = await fundflowApi.getPartyDetails(acc.ledger);
            if (res.success && res.data) {
              setBankBalances(prev => ({ ...prev, [acc.ledger]: res.data.outstandingBalance || 0 }));
            }
          } catch (e) {
            console.error("Failed to fetch balance for ledger: " + acc.ledger, e);
          }
        }
      }
    };
    fetchBalances();
  }, [dbBankLedgers.length]);

  // Fetch full ledger details when a bank row is selected
  useEffect(() => {
    if (!selectedBankRow?.ledger) { setBankDetails(null); return; }
    setBankDetailsLoading(true);
    fundflowApi.getPartyDetails(selectedBankRow.ledger)
      .then(res => {
        if (res.success && res.data) setBankDetails(res.data);
        else setBankDetails(null);
      })
      .catch(() => setBankDetails(null))
      .finally(() => setBankDetailsLoading(false));
  }, [selectedBankRow?.ledger]);

  const allTransactions = fundFlowStore.transactions || [];

  const inboxData = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) return [];
    return allTransactions
      .filter(tx => tx.status === 'draft' || tx.status === 'failed_tally')
      .map(tx => {
        const partyNames = (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || tx.partyLedgerName || '—';
        const typeStr = tx.voucherTypeName || (tx.voucherType === 'bank_payment' ? 'Receipt' : tx.voucherType === 'cash_payment' ? 'Payment' : (tx.voucherType || 'Payment'));
        const vDate = tx.voucherDate || tx.dates?.voucherDate || (tx.dates?.date ? new Date(tx.dates.date).toLocaleDateString('en-IN') : '—');
        return {
          id: tx._id,
          date: typeof vDate === 'string' ? vDate : new Date(vDate).toLocaleDateString('en-IN'),
          description: tx.narration || `Manual Entry Voucher ${tx.voucherNumber}`,
          amount: (parseFloat(tx.amount || tx.totals?.grandTotal || 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          type: typeStr,
          party: partyNames
        };
      });
  }, [allTransactions]);

  const reviewData = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) return [];
    return allTransactions
      .filter(tx => tx.status === 'pending_approval' || tx.status === 'review_required')
      .map(tx => {
        const partyNames = (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || tx.partyLedgerName || '—';
        const typeStr = tx.voucherTypeName || (tx.voucherType === 'bank_payment' ? 'Receipt' : tx.voucherType === 'cash_payment' ? 'Payment' : (tx.voucherType || 'Payment'));
        const vDate = tx.voucherDate || tx.dates?.voucherDate || (tx.dates?.date ? new Date(tx.dates.date).toLocaleDateString('en-IN') : '—');
        return {
          id: tx._id,
          date: typeof vDate === 'string' ? vDate : new Date(vDate).toLocaleDateString('en-IN'),
          description: tx.narration || `Voucher ${tx.voucherNumber}`,
          amount: (parseFloat(tx.amount || tx.totals?.grandTotal || 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          type: typeStr,
          party: partyNames,
          status: 'Pending'
        };
      });
  }, [allTransactions]);

  const archiveData = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) return [];
    return allTransactions
      .filter(tx => tx.status === 'approved' || tx.status === 'posted_to_tally' || tx.status === 'ACTIVE' || tx.entryMode === 'bank_upload' || tx.source === 'bank_upload')
      .map(tx => {
        const partyNames = (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || tx.partyLedgerName || '—';
        const typeStr = tx.voucherTypeName || (tx.voucherType === 'bank_payment' ? 'Receipt' : tx.voucherType === 'cash_payment' ? 'Payment' : (tx.voucherType || 'Receipt'));
        const vDate = tx.voucherDate || tx.dates?.voucherDate || (tx.dates?.date ? new Date(tx.dates.date).toLocaleDateString('en-IN') : '—');
        return {
          id: tx._id,
          date: typeof vDate === 'string' ? vDate : new Date(vDate).toLocaleDateString('en-IN'),
          description: tx.narration || `Voucher ${tx.voucherNumber}`,
          amount: (parseFloat(tx.amount || tx.totals?.grandTotal || 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          type: typeStr,
          party: partyNames,
          status: tx.status === 'posted_to_tally' ? 'Posted' : 'Approved'
        };
      });
  }, [allTransactions]);

  const allLedgers = useMemo(() => {
    return Array.from(new Set([
      ...(fundFlowStore.masterData?.allLedgers || []),
      ...(fundFlowStore.masterData?.partyLedgers || []),
      ...((fundFlowStore.masterData?.ledgers || []).map(l => (typeof l === 'string' ? l : (l.ledgerName || l.name || '')))),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [fundFlowStore.masterData]);

  const dynamicBanks = useMemo(() => Array.from(new Set(dbBankAccounts.map(a => a.bank))).filter(Boolean), [dbBankAccounts]);
  const storeBankLedgers = useMemo(() => Array.from(verifiedBankLedgerNames), [verifiedBankLedgerNames]);
  const derivedBankLedgers = useMemo(() => dbBankAccounts.map(a => a.ledger).filter(Boolean), [dbBankAccounts]);
  const batchBankLedgers = useMemo(() => (aiBatches || []).map(b => b.bank_ledger || b.bankLedger).filter(Boolean), [aiBatches]);
  const realBankLedgers = useMemo(() => Array.from(new Set([...batchBankLedgers, ...derivedBankLedgers, ...storeBankLedgers])).filter(Boolean), [batchBankLedgers, derivedBankLedgers, storeBankLedgers]);
  const dynamicBankLedgers = realBankLedgers;

  const dynamicLedgerGroups = Array.from(new Set((fundFlowStore.masterData?.ledgers || []).map(l => l.groupName).filter(Boolean)));
  const finalLedgerGroups = dynamicLedgerGroups;

  const dynamicAccountNumbers = dbBankAccounts.map(a => a.accountNumber).filter(num => num && num !== '—');

  const dynamicPaymentModes = Array.from(new Set(
    allTransactions.map(tx => tx.instType || tx.paymentMode).filter(Boolean)
  ));
  const finalPaymentModes = dynamicPaymentModes;

  const dynamicTransactionTypes = Array.from(new Set(
    (fundFlowStore.masterData?.voucherTypesFull || []).map(vt => vt.parent || vt.name).filter(Boolean)
  ));
  const finalTransactionTypes = dynamicTransactionTypes;

  const dynamicReplacedTypesObj = Array.from(new Set(
    (fundFlowStore.masterData?.ledgers || []).map(l => l.groupName).filter(Boolean)
  ));
  const dynamicReplacedTypes = dynamicReplacedTypesObj;

  const dynamicPartyLedgers = Array.from(new Set(
    (fundFlowStore.masterData?.ledgers || [])
      .filter(l => {
        const g = l.groupName ? l.groupName.toLowerCase().trim() : '';
        return g !== 'bank accounts' && g !== 'bank od a/c' && g !== 'cash-in-hand';
      })
      .map(l => l.ledgerName || l.name)
      .filter(Boolean)
  ));

  useEffect(() => {
    if (propMode) {
      setActiveTab(propMode);
    }
  }, [propMode]);

  const IconButton = ({ icon: Icon, color, onClick, label }) => {
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
        title={label || Icon?.displayName}
        aria-label={label || Icon?.displayName}
        className="h-8 w-8 rounded-lg border flex items-center justify-center transition-colors focus-ring hover:bg-[var(--app-control-hover)]"
        style={{ borderColor: 'var(--app-border)', color: tone, backgroundColor: 'var(--app-control-bg)' }}
      >
        <Icon size={13} strokeWidth={2.2} />
      </motion.button>
    );
  };

  const getHeaderIcons = () => {
    switch (activeTab) {
      case 'Manage Bank':
        return (
          <>
            <IconButton icon={Plus} color="emerald" onClick={() => setIsAddBankOpen(true)} />
            <IconButton icon={Upload} color="emerald" onClick={() => setIsUploadStatementOpen(true)} />
            <IconButton icon={Download} color="purple" />
          </>
        );

      case 'Inbox':
        return (
          <>
            <IconButton icon={ChevronsRight} color="purple" />
            <IconButton icon={CheckCircle2} color="emerald" />
            <IconButton icon={Edit3} color="emerald" />
            <IconButton icon={Trash2} color="red" />
          </>
        );
      case 'Review':
        return (
          <>
            <IconButton icon={ChevronsLeft} color="purple" />
            <IconButton icon={CheckCircle2} color="emerald" />
            <IconButton icon={Trash2} color="red" />
          </>
        );
      case 'Archive':
        return <IconButton icon={Trash2} color="red" />;
      default: return null;
    }
  };

  // ── DataTable migration: one config per bank segment ──────────────────
  const RowAct = ({ icon: Icon, onClick, title, tone = 'hover:text-[var(--app-accent)]' }) => (
    <button onClick={onClick} title={title || Icon?.displayName} aria-label={title || Icon?.displayName} className={`p-1 rounded-lg transition-all text-[var(--app-muted)] hover:bg-[var(--app-control-hover)] ${tone}`}>
      <Icon size={13} strokeWidth={2.2} />
    </button>
  );
  const typeTone = (t) => (t === 'Receipt' ? 'success' : t === 'Contra' ? 'accent' : t === 'Payment' ? 'warning' : 'neutral');
  const srCol = { key: 'sr', header: 'Sr', width: '50px', align: 'center', render: (_r, i) => <span className="font-bold" style={{ color: 'var(--app-muted)' }}>{i + 1}</span> };
  const amtCol = { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (r) => parseFloat(String(r.amount).replace(/,/g, '')) || 0, render: (r) => <span className="font-bold tabular-nums" style={{ color: 'var(--app-heading)' }}>₹ {r.amount}</span> };

  const COLUMNS = {
    'Manage Bank': [
      srCol,
      { key: 'bank', header: 'Bank Name', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{r.bank}</span> },
      { key: 'accountName', header: 'Account Name', sortable: true, render: (r) => <span className="font-semibold">{r.accountName}</span> },
      { key: 'accountNumber', header: 'Account Number', sortable: true, render: (r) => <span className="font-mono font-semibold">{r.accountNumber}</span> },
      { key: 'ledger', header: 'Bank Ledger', render: (r) => <span className="font-semibold">{r.ledger}</span> },
      {
        key: 'balance',
        header: 'Bank Balance',
        align: 'right',
        render: (r) => {
          const bal = bankBalances[r.ledger];
          if (bal === undefined) {
            return <span className="text-gray-400 italic">Loading...</span>;
          }
          const isCr = bal < 0;
          const absBal = Math.abs(bal);
          return (
            <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              ₹ {absBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {isCr ? 'Cr' : 'Dr'}
            </span>
          );
        }
      },
      {
        key: 'act',
        header: 'Action',
        align: 'center',
        width: '150px',
        render: (r) => (
          <div className="flex items-center justify-center gap-1">
            <RowAct
              icon={Upload}
              onClick={(e) => {
                e?.stopPropagation?.();
                setSelectedUploadLedger(r.ledger);
                setIsUploadStatementOpen(true);
              }}
              title={`Upload Statement for ${r.bank || r.ledger}`}
            />
            <RowAct icon={Edit3} title="Edit Bank Details" />
            <RowAct icon={RefreshCw} tone="hover:text-emerald-500" title="Sync / Refresh" />
            <RowAct icon={Trash2} tone="hover:text-rose-500" title="Delete" />
          </div>
        )
      },
    ],

    'Inbox': [
      srCol,
      { key: 'date', header: 'Date', sortable: true, render: (r) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{r.date}</span> },
      { key: 'description', header: 'Description', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{r.description}</span> },
      amtCol,
      { key: 'type', header: 'Type', render: (r) => <Badge tone={typeTone(r.type)}>{r.type}</Badge> },
      { key: 'party', header: 'Party Ledger', sortable: true, render: (r) => <span className="font-semibold">{r.party}</span> },
      { key: 'act', header: '', align: 'center', width: '60px', render: () => <Info size={14} className="mx-auto" style={{ color: 'var(--app-muted)' }} /> },
    ],
    'ReviewArchive': [
      srCol,
      { key: 'date', header: 'Date', sortable: true, render: (r) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{r.date}</span> },
      { key: 'description', header: 'Description', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{r.description}</span> },
      amtCol,
      { key: 'type', header: 'Type', render: (r) => <Badge tone={typeTone(r.type)}>{r.type}</Badge> },
      { key: 'party', header: 'Party Ledger', sortable: true, render: (r) => <span className="font-semibold">{r.party}</span> },
      { key: 'status', header: 'Status', align: 'center', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
      { key: 'act', header: '', align: 'center', width: '60px', render: () => <Info size={14} className="mx-auto" style={{ color: 'var(--app-muted)' }} /> },
    ],
  };
  const DATA = {
    'Manage Bank': dbBankAccounts,
    'Inbox': inboxData,
    'Review': reviewData,
    'Archive': archiveData
  };

  // ── KPI cards per segment (benchmark hallmark) ───────────────────────
  const uniq = (arr, k) => new Set(arr.map((r) => r[k])).size;
  const sumAmt = (arr) => arr.reduce((s, r) => s + (parseFloat(String(r.amount).replace(/,/g, '')) || 0), 0);
  const inr = (n) => `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const tabKpis = () => {
    switch (activeTab) {
      case 'Manage Bank':
        return [
          { label: 'Bank Accounts', value: dbBankAccounts.length, icon: Landmark },
          { label: 'Banks Linked', value: uniq(dbBankAccounts, 'bank'), icon: FileText },
          { label: 'Account Holders', value: uniq(dbBankAccounts, 'accountName'), icon: CheckCircle2 },
        ];

      case 'Inbox':
        return [
          { label: 'Unreconciled', value: inboxData.length, icon: Info },
          { label: 'Receipts', value: inboxData.filter((r) => r.type === 'Receipt').length, icon: Download },
          { label: 'Inbox Value', value: inr(sumAmt(inboxData)), icon: Landmark },
        ];
      case 'Review':
        return [
          { label: 'Pending Review', value: reviewData.length, icon: Info },
          { label: 'Awaiting Value', value: inr(sumAmt(reviewData)), icon: Landmark },
          { label: 'Payments', value: reviewData.filter((r) => r.type === 'Payment').length, icon: Upload },
        ];
      case 'Archive':
        return [
          { label: 'Approved', value: archiveData.length, icon: CheckCircle2 },
          { label: 'Archived Value', value: inr(sumAmt(archiveData)), icon: Landmark },
          { label: 'Receipts', value: archiveData.filter((r) => r.type === 'Receipt').length, icon: Download },
        ];
      default:
        return [];
    }
  };

  const fetchAiBatches = async () => {
    setAiBatchesLoading(true);
    try {
      const res = await bankStatementAiApi.getBatches();
      if (res.success && res.data) {
        setAiBatches(res.data);
      }
    } catch (err) {
      console.error('Failed to load AI statement batches:', err);
    } finally {
      setAiBatchesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'AI Voucher Review' || activeTab === 'Add Bank Rule') {
      fetchAiBatches();
    }
  }, [activeTab]);

  const [deletingBatchId, setDeletingBatchId] = useState(null);

  const handleDeleteBatch = async (batchId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName || 'this statement'}"? All extracted drafts for this document will be removed.`)) {
      return;
    }

    setDeletingBatchId(batchId);
    try {
      const res = await bankStatementAiApi.deleteBatch(batchId);
      if (res && res.success) {
        toast.success(`Deleted statement "${fileName || batchId}" successfully`);
        setAiBatches((prev) => prev.filter((b) => (b.batch_id || b._id) !== batchId));
        if (activeBatchData && (activeBatchData.batch_id || activeBatchData._id) === batchId) {
          setActiveBatchData(null);
        }
      } else {
        toast.error(res?.message || 'Failed to delete bank statement');
      }
    } catch (err) {
      console.error('Error deleting bank statement batch:', err);
      toast.error(err?.response?.data?.detail || 'Failed to delete bank statement');
    } finally {
      setDeletingBatchId(null);
    }
  };

  const [openingBatchId, setOpeningBatchId] = useState(null);
  const [aiStatementSearch, setAiStatementSearch] = useState('');

  const handleOpenBatch = async (batchId) => {
    // 1. Instant 0ms Reopening: If batch already has items in memory, open immediately without loading screen
    const cachedBatch = aiBatches.find(b => (b.batch_id || b._id) === batchId);
    if (cachedBatch && cachedBatch.items && cachedBatch.items.length > 0) {
      setActiveBatchData(cachedBatch);
      return;
    }

    // 2. Localized row spinner only if fresh items need to be fetched from server
    setOpeningBatchId(batchId);
    try {
      const res = await bankStatementAiApi.getBatchReview(batchId);
      if (res && res.success && res.data) {
        setAiBatches(prev => prev.map(b => ((b.batch_id || b._id) === batchId ? res.data : b)));
        setActiveBatchData(res.data);
      } else {
        toast.error('Failed to load document data');
      }
    } catch (err) {
      console.error('Failed to load document data:', err);
      toast.error('Failed to load document data');
    } finally {
      setOpeningBatchId(null);
    }
  };

  const targetBankForRules = selectedBank || dynamicBankLedgers[0] || '';
  const effectiveBatchForRules = activeBatchData || (aiBatches?.find(b => (b.bank_ledger || '').toLowerCase().includes(targetBankForRules.toLowerCase())) || aiBatches?.[0]);

  const memoizedInitialMappings = useMemo(() => {
    if (!effectiveBatchForRules) return null;
    if (effectiveBatchForRules.ledger_mappings && effectiveBatchForRules.ledger_mappings.length > 0) {
      return effectiveBatchForRules.ledger_mappings;
    }
    if (!effectiveBatchForRules.items || effectiveBatchForRules.items.length === 0) return null;
    const bId = effectiveBatchForRules.batch_id || effectiveBatchForRules._id;
    return effectiveBatchForRules.items.map(it => ({
      patternId: it.item_id,
      item_id: it.item_id,
      batch_id: bId,
      date: it.voucherDate || '',
      amount: Number(it.amount || 0),
      voucherType: it.voucherType || 'Payment',
      narration: it.narration || '',
      referenceNumber: it.referenceNumber || it.instNumber || '—',
      extractedParty: it.extractedParty || it.partyLedger || '',
      partyText: it.extractedParty || it.partyLedger || '',
      extractedPattern: it.extractedParty || it.partyLedger || '',
      channel: it.paymentMode || '',
      sampleNarration: it.narration || '',
      suggestedLedger: it.partyLedger || it.againstLedger || '',
      confidence: it.confidence || (it.partyLedger ? 100 : 50),
      mappingMethod: it.mappingMethod || (it.partyLedger ? 'System • Exact Match' : 'Unmapped'),
      transactionCount: 1,
      transactions: [it]
    }));
  }, [
    effectiveBatchForRules?._id,
    effectiveBatchForRules?.batch_id,
    effectiveBatchForRules?.items?.length,
    effectiveBatchForRules?.ledger_mappings
  ]);

  const renderActive = () => {
    if (activeTab === 'Add Bank Rule') {
      return (
        <div className="flex-1 h-[calc(100vh-80px)] w-full overflow-hidden">
          <BankRuleMappingModal
            isOpen={true}
            onClose={() => setActiveTab('AI Voucher Review')}
            currentBankLedger={effectiveBatchForRules?.bank_ledger || targetBankForRules}
            availableBankLedgers={dynamicBankLedgers}
            allLedgersList={allLedgers}
            batchId={effectiveBatchForRules?.batch_id || effectiveBatchForRules?._id}
            initialMappings={memoizedInitialMappings}
            onRulesApplied={(updatedBatch) => {
              if (updatedBatch) {
                setActiveBatchData(updatedBatch);
              }
              fetchAiBatches();
            }}
          />
        </div>
      );
    }

    if (activeTab === 'AI Voucher Review') {
      if (activeBatchData) {
        return (
          <BankAiReviewPanel
            batchData={activeBatchData}
            onClose={() => {
              setActiveBatchData(null);
              fetchAiBatches();
            }}
            onRefreshList={() => {
              fundFlowStore.fetchTransactions();
              fetchAiBatches();
            }}
            onNavigateToAddRule={() => setActiveTab('Add Bank Rule')}
          />
        );
      }

      if (aiBatchesLoading && aiBatches.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-[350px] border rounded-2xl p-8" style={{ borderColor: 'var(--app-border)' }}>
            <div className="w-8 h-8 rounded-full border-2 border-[var(--app-accent)] border-t-transparent animate-spin mb-3" />
            <span className="text-xs font-semibold" style={{ color: 'var(--app-muted)' }}>Loading AI processed bank statements...</span>
          </div>
        );
      }

      if (aiBatches.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-[380px] border-2 border-dashed rounded-2xl p-8 text-center" style={{ borderColor: 'var(--app-border)' }}>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mb-3.5 shadow-lg">
              <Sparkles size={28} />
            </div>
            <h3 className="text-base font-black text-[var(--app-heading)]">AI Bank Statement to Voucher Ingestion</h3>
            <p className="text-xs font-semibold text-[var(--app-muted)] max-w-md mt-1 mb-5">
              Upload your PDF or Excel/CSV bank statement. Our AI automatically extracts transactions, matches counterpart ledgers against active company masters, and generates Payment/Receipt voucher drafts for review.
            </p>
            <button
              onClick={() => setIsAiStatementModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
            >
              <Upload size={15} />
              <span>Upload Bank Statement (PDF / Excel)</span>
            </button>
          </div>
        );
      }

      const filteredBatches = aiBatches.filter(b => {
        if (aiStatementBankFilter && b.bank_ledger !== aiStatementBankFilter) return false;
        if (aiStatementSearch.trim()) {
          const q = aiStatementSearch.toLowerCase().trim();
          const matchName = (b.file_name || '').toLowerCase().includes(q);
          const matchLedger = (b.bank_ledger || '').toLowerCase().includes(q);
          if (!matchName && !matchLedger) return false;
        }
        return true;
      });

      const totalDocs = aiBatches.length;
      const totalTxnsCount = aiBatches.reduce((acc, b) => acc + (b.summary?.total_count || (b.items || []).length || 0), 0);
      const totalReadyCount = aiBatches.reduce((acc, b) => acc + (b.summary?.ready_count || 0), 0);
      const totalReviewCount = aiBatches.reduce((acc, b) => acc + (b.summary?.review_required_count || 0), 0);

      return (
        <div className="flex flex-col gap-3.5 h-full overflow-hidden">
          {/* Header Bar with Search, Bank Filter & Upload Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-[var(--app-panel-bg)] shadow-xs shrink-0" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-[var(--app-heading)] tracking-tight">AI Processed Bank Statements</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                    {totalDocs}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[var(--app-muted)]">Click on any statement to view extracted transactions & approve vouchers.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search Box */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" size={13} />
                <input
                  type="text"
                  value={aiStatementSearch}
                  onChange={(e) => setAiStatementSearch(e.target.value)}
                  placeholder="Search statements..."
                  className="w-full h-8 pl-8 pr-7 border rounded-lg text-[11px] font-semibold outline-none transition-colors"
                  style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
                />
                {aiStatementSearch && (
                  <button onClick={() => setAiStatementSearch('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Bank Filter */}
              <div className="relative min-w-[170px]">
                <select
                  value={aiStatementBankFilter}
                  onChange={(e) => setAiStatementBankFilter(e.target.value)}
                  className="w-full h-8 px-2.5 border rounded-lg text-[11px] font-bold outline-none cursor-pointer"
                  style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
                >
                  <option value="">All Banks ({aiBatches.length})</option>
                  {dynamicBankLedgers.map(bl => {
                    const cnt = aiBatches.filter(b => b.bank_ledger === bl).length;
                    return (
                      <option key={bl} value={bl}>
                        {bl} {cnt > 0 ? `(${cnt})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Upload Button */}
              <button
                onClick={() => {
                  setSelectedUploadLedger(aiStatementBankFilter || '');
                  setIsAiStatementModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-xs hover:opacity-90 transition-all cursor-pointer shrink-0"
              >
                <Upload size={13} />
                <span>Upload Statement</span>
              </button>
            </div>
          </div>

          {/* Micro Overview Stat Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <FileText size={14} />
              </div>
              <div className="truncate">
                <span className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">Total Statements</span>
                <span className="text-[13.5px] font-black text-[var(--app-heading)] leading-tight">{totalDocs}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold shrink-0">
                <Sparkles size={14} />
              </div>
              <div className="truncate">
                <span className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">Total Extracted</span>
                <span className="text-[13.5px] font-black text-[var(--app-heading)] leading-tight">{totalTxnsCount} Items</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 size={14} />
              </div>
              <div className="truncate">
                <span className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">Mapped & Ready</span>
                <span className="text-[13.5px] font-black text-emerald-600 leading-tight">{totalReadyCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Info size={14} />
              </div>
              <div className="truncate">
                <span className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">Review Needed</span>
                <span className="text-[13.5px] font-black text-amber-600 leading-tight">{totalReviewCount}</span>
              </div>
            </div>
          </div>

          {/* Table of Processed Documents */}
          <div className="flex-1 overflow-auto border rounded-xl bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
            <table className="w-full text-left border-collapse text-[12px]">
              <thead className="sticky top-0 bg-[var(--app-control-bg)] z-10 border-b" style={{ borderColor: 'var(--app-border)' }}>
                <tr>
                  <th className="py-2.5 px-4 font-black text-[var(--app-muted)] uppercase tracking-wider w-[30%]">Document Name</th>
                  <th className="py-2.5 px-3 font-black text-[var(--app-muted)] uppercase tracking-wider w-[18%]">Target Bank Ledger</th>
                  <th className="py-2.5 px-3 font-black text-[var(--app-muted)] uppercase tracking-wider w-[18%]">Upload Date & Time</th>
                  <th className="py-2.5 px-3 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-[20%]">Extracted Items</th>
                  <th className="py-2.5 px-4 font-black text-[var(--app-muted)] uppercase tracking-wider text-right w-[14%]">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[var(--app-muted)] font-semibold text-xs">
                      No matching bank statements found.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch) => {
                    const id = batch.batch_id || batch._id;
                    const isOpening = openingBatchId === id;
                    const dateObj = batch.created_at ? new Date(batch.created_at) : null;
                    const dateStr = dateObj ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    const timeStr = dateObj ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                    const summary = batch.summary || {};
                    const total = summary.total_count || (batch.items || []).length || 0;
                    const ready = summary.ready_count || 0;
                    const reviewReq = summary.review_required_count || 0;
                    const saved = summary.saved_count || 0;
                    const isPdf = (batch.file_name || '').toLowerCase().endsWith('.pdf');

                    return (
                      <tr
                        key={id}
                        onClick={() => handleOpenBatch(id)}
                        className="border-b last:border-0 hover:bg-[var(--app-content-bg)]/60 cursor-pointer transition-colors"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[var(--app-accent)]/10 text-[var(--app-accent)] flex items-center justify-center shrink-0">
                              <FileText size={16} />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[12.5px] text-[var(--app-heading)] block truncate max-w-[280px]" title={batch.file_name}>
                                {batch.file_name}
                              </span>
                              <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider">
                                {isPdf ? 'PDF Statement' : 'Excel Statement'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <Landmark size={13} className="text-indigo-500 shrink-0" />
                            <span className="font-bold text-[12px] text-[var(--app-heading)] truncate max-w-[180px]" title={batch.bank_ledger}>
                              {batch.bank_ledger || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <span className="font-bold text-[11.5px] text-[var(--app-heading)] block">{dateStr}</span>
                            {timeStr && <span className="text-[10px] font-semibold text-[var(--app-muted)] block">{timeStr}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="font-black text-[11.5px] text-[var(--app-heading)]">{total} Items</span>
                              {saved > 0 && saved === total ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-purple-500/10 text-purple-600 border border-purple-500/20">Saved</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">Draft</span>
                              )}
                            </div>
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {ready > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{ready} Ready</span>}
                              {reviewReq > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">{reviewReq} Review</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBatch(id);
                              }}
                              disabled={isOpening}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-xs hover:opacity-90 transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {isOpening ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <>
                                  <span>Review Data</span>
                                  <span>→</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBatch(id, batch.file_name);
                              }}
                              disabled={deletingBatchId === id}
                              title="Delete Statement"
                              className="p-1.5 rounded-lg text-xs font-bold border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const colKey = (activeTab === 'Review' || activeTab === 'Archive') ? 'ReviewArchive' : activeTab;
    const columns = COLUMNS[colKey] || COLUMNS['Manage Bank'];
    const all = DATA[activeTab] || [];
    const q = bankSearch.trim().toLowerCase();
    const rows = q ? all.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : all;
    return (
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        loading={fundFlowStore.loading.list || fundFlowStore.masterData.loading}
        emptyText="No bank transactions found."
        minWidth={activeTab === 'Manage Bank' && selectedBankRow ? '700px' : '900px'}
        selectable
        selectedKeys={selectedRows}
        onToggleRow={(id) => setSelectedRows((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
        onToggleAll={(c) => setSelectedRows(c ? rows.map((r) => r.id) : [])}
        search={{ value: bankSearch, onChange: setBankSearch, placeholder: 'Search transactions…' }}
        onRowClick={activeTab === 'Manage Bank' ? (row) => setSelectedBankRow(prev => prev?.id === row.id ? null : row) : undefined}
        rowClassName={activeTab === 'Manage Bank' ? (row) => row.id === selectedBankRow?.id ? 'bg-[var(--app-accent-soft)] border-l-2 border-[var(--app-accent)]' : '' : undefined}
      />
    );
  };


  if (activeTab === 'Manage Bank' && selectedBankRow) {
    const bankTransactions = allTransactions.filter(tx =>
      tx.againstLedger === selectedBankRow.ledger ||
      tx.bankLedger === selectedBankRow.ledger ||
      (tx.ledgerRows || []).some(r => r.ledgerName === selectedBankRow.ledger)
    );

    return (
      <BankDetailsPage
        row={selectedBankRow}
        details={bankDetails}
        loading={bankDetailsLoading}
        balance={bankBalances[selectedBankRow.ledger]}
        transactions={bankTransactions}
        isDark={isDark}
        onClose={() => setSelectedBankRow(null)}
        onUploadStatement={() => {
          setSelectedUploadLedger(selectedBankRow.ledger);
          setIsUploadStatementOpen(true);
        }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 h-full overflow-hidden relative"
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── HORIZONTAL TOP SUB-TABS (Bank Reconciliation | Bank Ledgers | AI Voucher Review) ── */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shrink-0 shadow-xs">
        {BANK_SUB_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'Inbox' && ['Inbox', 'Review', 'Archive'].includes(activeTab));
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive
                  ? 'bg-[var(--app-accent)] text-white shadow-xs'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)]'
                }`}
            >
              <TabIcon size={14} strokeWidth={2.2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Popups for Bank Main */}
      {isAddBankOpen && <AddBankModal onClose={() => setIsAddBankOpen(false)} BANKS={dynamicBanks} BANK_LEDGERS={dynamicBankLedgers} />}
      {isAiStatementModalOpen && (
        <BankStatementUploadModal
          onClose={() => {
            setIsAiStatementModalOpen(false);
            setSelectedUploadLedger('');
          }}
          BANK_LEDGERS={dynamicBankLedgers}
          initialLedger={selectedUploadLedger || (selectedBankRow ? selectedBankRow.ledger : (selectedBank || ''))}
          onBatchCreated={(data) => {
            setActiveBatchData(data);
            setActiveTab('AI Voucher Review');
          }}
        />
      )}
      {isUploadStatementOpen && (
        <BankStatementUploadModal
          onClose={() => {
            setIsUploadStatementOpen(false);
            setSelectedUploadLedger('');
          }}
          BANK_LEDGERS={dynamicBankLedgers}
          initialLedger={selectedUploadLedger || (selectedBankRow ? selectedBankRow.ledger : (selectedBank || ''))}
          onBatchCreated={(data) => {
            setActiveBatchData(data);
            setActiveTab('AI Voucher Review');
          }}
        />
      )}

      {isBankFilterOpen && <FilterDrawer title="Filter" onClose={() => setIsBankFilterOpen(false)}>
        <input type="text" placeholder="Bank Name" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm" style={{ borderColor: 'var(--app-border)' }} />
        <SearchableDropdown placeholder="Bank Ledger" items={dynamicBankLedgers} isSmall />
      </FilterDrawer>}
      {isAddBankLedgerOpen && <AddLedgerModal title="Add Bank Ledger" type="Bank" onClose={() => setIsAddBankLedgerOpen(false)} LEDGER_GROUPS={finalLedgerGroups} />}



      {/* Shared Modals */}
      {isColumnConfigOpen && <ColumnConfigPopup onClose={() => setIsColumnConfigOpen(false)} activeTab={activeTab} />}
      {isInboxFilterOpen && <FilterDrawer title="Inbox Filter" onClose={() => setIsInboxFilterOpen(false)}>
        <input type="text" placeholder="Description" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} />
        <div className="flex gap-2">
          <input type="text" placeholder="From Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: 'var(--app-border)' }} />
          <input type="text" placeholder="To Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: 'var(--app-border)' }} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative"><input type="text" placeholder="From Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: 'var(--app-border)' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} /></div>
          <div className="flex-1 relative"><input type="text" placeholder="To Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: 'var(--app-border)' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} /></div>
        </div>
      </FilterDrawer>}

      {/* Clean Header Bar */}
      {activeTab !== 'AI Voucher Review' && activeTab !== 'Add Bank Rule' && (
        <div className="rounded-xl border p-3 shrink-0" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ background: 'var(--app-accent-gradient)' }}>
                <Landmark size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-[16px] font-extrabold tracking-tight" style={{ color: 'var(--app-heading)' }}>
                  {TAB_META[activeTab]?.title || 'Bank'}
                </h1>
                <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--app-muted)' }}>
                  {TAB_META[activeTab]?.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 ml-auto flex-wrap">
              {activeTab === 'Manage Bank' && (
                <>
                  <button
                    onClick={() => {
                      setSelectedUploadLedger(selectedBankRow ? selectedBankRow.ledger : '');
                      setIsUploadStatementOpen(true);
                    }}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border hover:bg-[var(--app-control-hover)] transition-all cursor-pointer"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  >
                    <Upload size={14} className="text-emerald-500" />
                    <span>Upload Statement</span>
                  </button>
                  <button
                    onClick={() => setIsAddBankOpen(true)}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--app-accent)] text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    <span>Add Bank Account</span>
                  </button>
                </>
              )}



              {(activeTab === 'Inbox' || activeTab === 'Review' || activeTab === 'Archive') && (
                <>
                  <div className="relative min-w-[180px]">
                    <select
                      className="w-full h-8 pl-3 pr-8 rounded-lg border text-[12px] appearance-none outline-none focus-ring cursor-pointer font-semibold"
                      style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      <option value="">All Bank Accounts</option>
                      {dynamicBanks.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-muted)' }} size={14} />
                  </div>

                  <button
                    onClick={() => {
                      setSelectedUploadLedger(selectedBank || '');
                      setIsUploadStatementOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--app-accent)] text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>Upload Bank Statement</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      {tabKpis().length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
          {tabKpis().map((k, i) => (
            <StatCard key={`${activeTab}-${k.label}`} index={i} label={k.label} value={k.value} icon={k.icon} />
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex gap-3">
        <div className={`transition-all duration-300 overflow-hidden ${activeTab === 'Manage Bank' && selectedBankRow ? 'flex-[3]' : 'flex-1'}`}>
          {renderActive()}
        </div>
        {activeTab === 'Manage Bank' && (
          <div className={`transition-all duration-300 overflow-hidden ${selectedBankRow ? 'w-[320px]' : 'w-0'}`}>
            {selectedBankRow && (
              <BankDetailsPanel
                row={selectedBankRow}
                details={bankDetails}
                loading={bankDetailsLoading}
                balance={bankBalances[selectedBankRow.ledger]}
                onClose={() => setSelectedBankRow(null)}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* --- Bank Details Panel --- */

const BankDetailsPanel = ({ row, details, loading, balance, onClose }) => {
  const maskAccount = (num) => {
    if (!num || num === '—') return '—';
    const s = String(num).replace(/\s/g, '');
    if (s.length <= 4) return s;
    return 'XXXX XXXX ' + s.slice(-4);
  };

  const fmtBalance = (bal) => {
    if (bal === undefined || bal === null) return null;
    const isCr = bal < 0;
    const abs = Math.abs(bal);
    return { text: `₹ ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${isCr ? 'Cr' : 'Dr'}`, isCr };
  };

  const balFmt = fmtBalance(balance);
  const detailsBal = details?.outstandingBalance !== undefined ? fmtBalance(details.outstandingBalance) : balFmt;

  const SectionHead = ({ title }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--app-accent)' }}>{title}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--app-border)' }} />
    </div>
  );

  const Field = ({ label, value, mono, valueStyle }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>{label}</span>
      <span className={`text-[12px] font-bold leading-tight ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--app-heading)', ...valueStyle }}>{value || '—'}</span>
    </div>
  );

  const lastTx = details?.lastTransaction || details?.lastVoucherDate;
  const lastVoucher = details?.lastVoucherNumber || details?.voucherNumber;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="h-full flex flex-col rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--app-border)', background: 'var(--app-accent-gradient)' }}>
        <div className="flex items-center gap-2">
          <Landmark size={15} strokeWidth={2.2} className="text-white/90" />
          <span className="text-[13px] font-black text-white tracking-tight">Bank Details</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--app-accent)] border-t-transparent animate-spin" />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--app-muted)' }}>Loading details…</span>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">

          {/* Basic Information */}
          <div>
            <SectionHead title="Basic Information" />
            <div className="space-y-3">
              <Field label="Bank Name" value={row.bank} />
              <Field label="Ledger Name" value={row.ledger} />
              <Field label="Account Holder" value={row.accountName || details?.companyName} />
              <Field label="Account Number" value={maskAccount(row.accountNumber)} mono />
              <Field label="Account Type" value={details?.accountType || 'Current Account'} />
            </div>
          </div>

          {/* Balance */}
          <div>
            <SectionHead title="Balance" />
            <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: 'var(--app-content-bg)' }}>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Current Balance</span>
                {detailsBal ? (
                  <span className="text-[15px] font-black tabular-nums" style={{ color: detailsBal.isCr ? '#ef4444' : '#10b981' }}>
                    {detailsBal.text}
                  </span>
                ) : (
                  <span className="text-[13px] font-bold text-gray-400 italic">Not available</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Status</span>
                <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-heading)' }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Banking Details */}
          {(details?.ifscCode || details?.branch) && (
            <div>
              <SectionHead title="Banking Details" />
              <div className="space-y-3">
                {details.ifscCode && <Field label="IFSC Code" value={details.ifscCode} mono />}
                {details.branch && <Field label="Branch" value={details.branch} />}
              </div>
            </div>
          )}

          {/* Accounting Details */}
          <div>
            <SectionHead title="Accounting Details" />
            <div className="space-y-3">
              <Field label="Ledger Group" value={details?.groupName || 'Bank Accounts'} />
              {details?.openingBalance !== undefined && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Opening Balance</span>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: details.openingBalance < 0 ? '#ef4444' : '#10b981' }}>
                    {fmtBalance(details.openingBalance)?.text || '—'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {(lastTx || lastVoucher) && (
            <div>
              <SectionHead title="Recent Activity" />
              <div className="space-y-3">
                {lastTx && (
                  <Field label="Last Transaction" value={new Date(lastTx).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                )}
                {lastVoucher && <Field label="Last Voucher" value={lastVoucher} mono />}
              </div>
            </div>
          )}

        </div>
      )}
    </motion.div>
  );
};

/* --- Reusable Components --- */

const SearchableDropdown = ({ placeholder, items, value, onChange, label, isSmall }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = items.filter(item =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && <span className={`absolute -top-2 left-3 bg-[var(--app-panel-bg)] px-1 font-bold text-[var(--app-muted)] z-10 ${isSmall ? 'text-[11px]' : 'text-[10px]'}`}>{label}</span>}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border rounded-xl px-4 flex items-center justify-between bg-[var(--app-panel-bg)] cursor-pointer transition-all shadow-sm ${isOpen ? 'border-[var(--app-accent)] ring-4 ring-[var(--app-accent-soft)]/5' : 'border-[#e2e8f0] hover:border-[var(--app-border)]'} ${isSmall ? 'h-8 rounded-lg px-3' : 'h-11'}`}
      >
        <span className={`font-bold truncate ${value ? 'text-[var(--app-heading)]' : 'text-[var(--app-muted)]'} ${isSmall ? 'text-[11px]' : 'text-[13px]'}`}>
          {value || placeholder}
        </span>
        <ChevronDown className={`text-[var(--app-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={isSmall ? 14 : 16} />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[500] overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={14} />
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 border rounded-lg pl-8 pr-3 text-[12px] font-medium outline-none focus:border-[var(--app-accent)] transition-all"
                style={{ borderColor: '#e2e8f0' }}
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto themed-scrollbar no-scrollbar">
            {filtered.length > 0 ? (
              filtered.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (onChange) onChange(item);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-4 py-2.5 text-[12px] font-bold text-[var(--app-heading)] hover:bg-[var(--app-content-bg)] cursor-pointer transition-colors border-b last:border-0 border-slate-50 flex items-center justify-between ${value === item ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]' : ''}`}
                >
                  {item}
                  {value === item && <Check size={14} />}
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-[12px] font-medium text-[var(--app-muted)] italic">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FilterDrawer = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 z-[400] animate-in fade-in duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/10" onClick={onClose} />
      <div className="absolute top-4 right-4 w-[280px] bg-[var(--app-panel-bg)] rounded-2xl shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border border-[var(--app-border)] flex flex-col animate-in slide-in-from-right-10 duration-300 max-h-[calc(100vh-32px)]">
        <div className="p-3.5 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[14px] font-black text-[var(--app-accent)] tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
          {children}
        </div>

        <div className="p-4 border-t bg-[var(--app-content-bg)]/30 flex items-center justify-between gap-3">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-red-200 bg-[var(--app-panel-bg)] text-red-500 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-red-50 shadow-sm">
            Clear
          </button>
          <button className="flex-1 h-9 rounded-lg bg-[var(--app-accent)] text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all hover:opacity-90">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

/* --- Specialized Bank Popups --- */

const AddBankModal = ({ onClose, BANKS: propBanks, BANK_LEDGERS: propLedgers }) => {
  const { masterData, fetchMasterData } = useFundFlowStore();

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const dbBankLedgers = (masterData?.ledgers || []).filter(l => {
    const g = (l.groupName || l.parentGroup || '').toLowerCase().trim();
    const name = (l.ledgerName || l.name || '').toLowerCase().trim();
    const nonBankGroups = ['indirect expenses', 'direct expenses', 'indirect incomes', 'direct incomes', 'sundry debtors', 'sundry creditors'];
    if (nonBankGroups.some(nb => g === nb || g.startsWith(nb))) return false;
    if (['charges', 'interest', 'commission', 'fee', 'tax'].some(kw => name.includes(kw))) return false;
    return g === 'bank accounts' || g === 'bank od a/c' || g === 'bank occ a/c' || g.includes('bank account');
  });

  const bankLedgerNames = propLedgers && propLedgers.length > 0
    ? propLedgers
    : (dbBankLedgers.length > 0
      ? dbBankLedgers.map(l => l.ledgerName || l.name).filter(Boolean)
      : []);

  const modalBanks = propBanks && propBanks.length > 0 ? propBanks : [];

  const [bank, setBank] = useState('');
  const [ledger, setLedger] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const detectBankName = (ledgerName) => {
    if (!ledgerName) return '';
    const lower = ledgerName.toLowerCase();
    if (lower.includes('hdfc')) return 'HDFC Bank';
    if (lower.includes('icici')) return 'ICICI Bank';
    if (lower.includes('axis')) return 'Axis Bank';
    if (lower.includes('kotak')) return 'Kotak Mahindra Bank';
    if (lower.includes('sbi') || lower.includes('state bank')) return 'State Bank of India';
    if (lower.includes('pnb') || lower.includes('punjab national')) return 'Punjab National Bank';
    if (lower.includes('yes')) return 'Yes Bank';
    if (lower.includes('hsbc')) return 'HSBC';
    if (lower.includes('standard chartered')) return 'Standard Chartered';
    if (lower.includes('dbs')) return 'DBS Bank';
    return '';
  };

  const detectAccountNumber = (ledgerName) => {
    if (!ledgerName) return '';
    const match = ledgerName.match(/\d{9,18}/);
    return match ? match[0] : '';
  };

  const handleLedgerChange = (val) => {
    setLedger(val);
    const detectedBank = detectBankName(val);
    if (detectedBank) setBank(detectedBank);
    const detectedAcc = detectAccountNumber(val);
    if (detectedAcc) setAccountNumber(detectedAcc);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[750px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <h2 className="text-[18px] font-black text-[var(--app-accent)] tracking-tight">Add Bank</h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border flex items-center justify-center text-[var(--app-muted)] hover:bg-[var(--app-content-bg)] transition-colors cursor-pointer" style={{ borderColor: 'var(--app-border)' }}>
              <FileText size={16} />
            </div>
            <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-colors"><X size={22} /></button>
          </div>
        </div>

        <div className="px-10 pb-10 space-y-8 mt-4">
          <div className="h-[200px] w-full bg-[var(--app-accent-soft)] rounded-2xl flex items-center justify-center overflow-hidden">
            <ObjectDoodle name="approve" className="w-48 h-40" />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <SearchableDropdown placeholder="Bank" items={modalBanks} value={bank} onChange={setBank} />
            <SearchableDropdown placeholder="Bank Ledger" items={bankLedgerNames} value={ledger} onChange={handleLedgerChange} />
            <input type="text" placeholder="Account Name" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
            <input type="text" placeholder="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
          </div>

          <div className="flex justify-center">
            <button className="m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white px-12 py-2.5 rounded-lg text-[14px] font-black uppercase tracking-widest shadow-xl dark:shadow-none transition-all">
              submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



const AddLedgerModal = ({ title, type, onClose, LEDGER_GROUPS: propGroups }) => {
  const modalGroups = propGroups && propGroups.length > 0 ? propGroups : [];
  const [ledgerGroup, setLedgerGroup] = useState('');

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-24 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-[800px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <h2 className="text-[16px] font-black text-[var(--app-accent)] tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"><X size={20} /></button>
        </div>

        <div className="p-10 space-y-8">
          <div className="flex gap-6 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Ledger Name"
                className="w-full h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </div>
            <div className="flex-1">
              <SearchableDropdown placeholder="Ledger Group" items={modalGroups} value={ledgerGroup} onChange={setLedgerGroup} />
            </div>
          </div>

          {ledgerGroup && (
            <div className="flex gap-6 items-center animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Credit Period"
                  className="w-full h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors"
                  style={{ borderColor: 'var(--app-border)' }}
                />
              </div>
              <div className="flex-1 flex items-center gap-3 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] p-2.5 rounded-xl border border-[var(--app-border)]">
                <input type="checkbox" id="maintainBill" className="w-5 h-5 rounded border-gray-300 accent-[var(--app-accent)] cursor-pointer" />
                <label htmlFor="maintainBill" className="text-[12px] font-black text-[var(--app-heading)] cursor-pointer whitespace-nowrap">Maintain Balance Bill by Bill</label>
              </div>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button className="m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white px-16 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl dark:shadow-none transition-all">
              submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- Bank Details Page --- */

const BankDetailsPage = ({ row, details, loading, balance, transactions: initialTransactions, isDark, onClose, onUploadStatement }) => {
  const [statementData, setStatementData] = useState({ vouchers: [], kpis: { totalReceipts: 0, totalPayments: 0, netAmount: 0, totalCount: 0 } });
  const [statementLoading, setStatementLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!row?.ledger) return;
    setStatementLoading(true);
    fundflowApi.getBankStatement(row.ledger)
      .then((res) => {
        if (res.success && res.data) {
          setStatementData(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load bank statement:', err);
      })
      .finally(() => setStatementLoading(false));
  }, [row?.ledger]);

  const maskAccount = (num) => {
    if (!num || num === '—') return '—';
    const s = String(num).replace(/\s/g, '');
    if (s.length <= 4) return s;
    return 'XXXX XXXX ' + s.slice(-4);
  };

  const fmtBalance = (bal) => {
    if (bal === undefined || bal === null) return '₹ 0.00 Dr';
    const isCr = bal < 0;
    const abs = Math.abs(bal);
    return `₹ ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isCr ? 'Cr' : 'Dr'}`;
  };

  const currentBal = details?.outstandingBalance !== undefined ? details.outstandingBalance : balance;
  const openingBal = details?.openingBalance ?? 0;

  // Filter vouchers locally
  const rawVouchers = statementData.vouchers.length > 0 ? statementData.vouchers : (initialTransactions || []).map(tx => ({
    id: tx._id,
    voucherNumber: tx.voucherNumber || '—',
    voucherDate: tx.voucherDate,
    voucherType: tx.voucherType === 'cash_payment' ? 'Payment' : tx.voucherType === 'bank_payment' ? 'Receipt' : 'Contra',
    partyName: (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || '—',
    amount: parseFloat(tx.amount) || 0,
    source: (tx.createdVia || 'manual_entry').includes('excel') ? 'excel_upload' : 'manual_entry',
    status: tx.status || 'draft',
    narration: tx.narration || ''
  }));

  const filteredVouchers = rawVouchers.filter((v) => {
    if (sourceFilter !== 'all' && (v.source || '').toLowerCase() !== sourceFilter.toLowerCase()) return false;
    if (typeFilter !== 'all' && (v.voucherType || '').toLowerCase() !== typeFilter.toLowerCase()) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      const matchParty = (v.partyName || '').toLowerCase().includes(q);
      const matchNum = String(v.voucherNumber || '').toLowerCase().includes(q);
      const matchNarr = (v.narration || '').toLowerCase().includes(q);
      if (!matchParty && !matchNum && !matchNarr) return false;
    }
    return true;
  });

  const getSourceBadge = (src) => {
    switch (src) {
      case 'tally_sync':
        return <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-200/50">Tally Sync</span>;
      case 'excel_upload':
        return <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-200/50">Excel Upload</span>;
      case 'manual_entry':
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-600 border border-purple-200/50">Manual Entry</span>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 h-full overflow-hidden bg-[var(--app-panel-bg)] rounded-xl border p-4"
      style={{ borderColor: 'var(--app-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-[var(--app-control-hover)] transition-colors cursor-pointer"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)', backgroundColor: 'var(--app-control-bg)' }}
          >
            ← Back to List
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-extrabold text-[var(--app-heading)] tracking-tight">
                {row.bank} ({row.ledger})
              </h1>
              <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Active Bank Ledger
              </span>
            </div>
            <p className="text-[10px] text-[var(--app-muted)] mt-0.5">
              Account Holder: {row.accountName || details?.companyName || 'Primary Account'} | A/C No: {maskAccount(row.accountNumber)}
            </p>
          </div>
        </div>

        {onUploadStatement && (
          <button
            onClick={onUploadStatement}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
          >
            <Upload size={14} />
            <span>Upload Statement</span>
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading || statementLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--app-accent)] border-t-transparent animate-spin" />
            <span className="text-[11px] font-semibold text-[var(--app-muted)]">Loading bank vouchers and statement…</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border p-3 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Current Balance</span>
              <div className="text-[16px] font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {fmtBalance(currentBal)}
              </div>
            </div>
            <div className="rounded-xl border p-3 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Total Receipts (Inflow)</span>
              <div className="text-[16px] font-black mt-1 text-emerald-500">
                ₹ {(statementData.kpis?.totalReceipts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-xl border p-3 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Total Payments (Outflow)</span>
              <div className="text-[16px] font-black mt-1 text-rose-500">
                ₹ {(statementData.kpis?.totalPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-xl border p-3 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Total Connected Vouchers</span>
              <div className="text-[16px] font-black mt-1 text-[var(--app-heading)]">
                {rawVouchers.length}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="rounded-xl border p-3 bg-[var(--app-control-bg)] flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Source Filters */}
              <span className="text-[10px] font-bold uppercase text-[var(--app-muted)] mr-1">Source:</span>
              {[
                { id: 'all', label: 'All Sources' },
                { id: 'tally_sync', label: 'Tally Sync' },
                { id: 'excel_upload', label: 'Excel Bulk' },
                { id: 'manual_entry', label: 'Manual Entry' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSourceFilter(s.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all ${sourceFilter === s.id
                      ? 'bg-[var(--app-accent)] text-white shadow-xs'
                      : 'border text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                    }`}
                  style={sourceFilter !== s.id ? { borderColor: 'var(--app-border)' } : {}}
                >
                  {s.label}
                </button>
              ))}

              <div className="h-4 w-px bg-[var(--app-border)] mx-1" />

              {/* Voucher Type Filters */}
              <span className="text-[10px] font-bold uppercase text-[var(--app-muted)] mr-1">Type:</span>
              {[
                { id: 'all', label: 'All Types' },
                { id: 'payment', label: 'Payment' },
                { id: 'receipt', label: 'Receipt' },
                { id: 'contra', label: 'Contra' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all ${typeFilter === t.id
                      ? 'bg-[var(--app-heading)] text-white shadow-xs'
                      : 'border text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                    }`}
                  style={typeFilter !== t.id ? { borderColor: 'var(--app-border)' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={13} />
              <input
                type="text"
                placeholder="Filter vouchers..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-8 pl-8 pr-3 border rounded-lg text-[11px] font-semibold outline-none focus:border-[var(--app-accent)]"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', color: 'var(--app-heading)' }}
              />
            </div>
          </div>

          {/* Details & Transactions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Left Column: Bank Info Card */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-xl border p-4 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-accent)] border-b pb-2 mb-3" style={{ borderColor: 'var(--app-border)' }}>
                  Bank Ledger Details
                </h3>
                <div className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Bank Name</span>
                    <span className="text-[12px] font-bold text-[var(--app-heading)]">{row.bank}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Ledger Name</span>
                    <span className="text-[12px] font-bold text-[var(--app-heading)]">{row.ledger}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Account Number</span>
                    <span className="text-[12px] font-bold text-[var(--app-heading)] font-mono">{maskAccount(row.accountNumber)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">IFSC Code</span>
                    <span className="text-[12px] font-bold text-[var(--app-heading)] font-mono">{details?.ifscCode || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Branch</span>
                    <span className="text-[12px] font-bold text-[var(--app-heading)]">{details?.branch || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Ledger Group</span>
                    <span className="text-[12px] font-bold text-[var(--app-heading)]">{details?.groupName || 'Bank Accounts'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Transaction History Card */}
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-xl border p-4 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
                <div className="flex items-center justify-between border-b pb-2 mb-3" style={{ borderColor: 'var(--app-border)' }}>
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-accent)]">
                    Voucher List & Bank Statement ({filteredVouchers.length})
                  </h3>
                </div>
                <div className="overflow-x-auto animate-in fade-in duration-300">
                  {filteredVouchers.length > 0 ? (
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--app-border)' }}>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Date</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Voucher No</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Source</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Type</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Party / Ledger</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-right">Amount</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVouchers.map((tx, idx) => {
                          const dateStr = tx.voucherDate ? new Date(tx.voucherDate).toLocaleDateString('en-IN') : '—';
                          const isReceipt = tx.voucherType === 'Receipt';
                          const txAmount = parseFloat(tx.amount) || 0;

                          return (
                            <tr key={tx.id || idx} className="border-b last:border-0 hover:bg-[var(--app-content-bg)]/50 transition-colors" style={{ borderColor: 'var(--app-border)' }}>
                              <td className="py-2.5 font-semibold text-[var(--app-heading)]">{dateStr}</td>
                              <td className="py-2.5 font-bold text-[var(--app-heading)] font-mono">{tx.voucherNumber || '—'}</td>
                              <td className="py-2.5">{getSourceBadge(tx.source)}</td>
                              <td className="py-2.5 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[9.5px] uppercase font-black tracking-wider ${tx.voucherType === 'Receipt' ? 'bg-emerald-500/10 text-emerald-500' :
                                    tx.voucherType === 'Payment' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                                  }`}>
                                  {tx.voucherType}
                                </span>
                              </td>
                              <td className="py-2.5 font-semibold text-[var(--app-heading)] max-w-[160px] truncate" title={tx.partyName}>
                                {tx.partyName}
                              </td>
                              <td className={`py-2.5 font-bold text-right tabular-nums ${isReceipt ? 'text-emerald-500' : 'text-rose-500'}`}>
                                ₹ {txAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 text-center">
                                <span className="px-2 py-0.5 rounded text-[9.5px] uppercase font-black tracking-wider bg-emerald-500/10 text-emerald-500">
                                  {tx.status || 'Active'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-[var(--app-muted)] font-semibold italic">
                      No vouchers match the selected bank ledger & filter criteria.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

/* --- Config Popup --- */

const ColumnConfigPopup = ({ onClose, activeTab }) => {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-[400px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <h2 className="text-[15px] font-black text-[var(--app-heading)] tracking-tight">Configure Columns</h2>
          <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          {['Date', 'Description', 'Amount', 'Type', 'Party Ledger', 'Status'].map(col => (
            <label key={col} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--app-content-bg)] cursor-pointer transition-colors group">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 accent-[var(--app-accent)] shadow-sm" />
              <span className="text-[13px] font-bold text-[var(--app-heading)] group-hover:text-[var(--app-accent)] dark:group-hover:text-[var(--app-accent)] transition-colors">{col}</span>
            </label>
          ))}
        </div>
        <div className="p-4 border-t bg-[var(--app-content-bg)]/30 flex justify-end" style={{ borderColor: 'var(--app-row-border)' }}>
          <button onClick={onClose} className="m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white px-8 py-2 rounded-lg text-[12px] font-black uppercase tracking-widest shadow-sm transition-all">Apply</button>
        </div>
      </div>
    </div>
  );
};

const BankStatementUploadModal = ({ onClose, BANK_LEDGERS, initialLedger, onBatchCreated }) => {
  const effectiveLedgers = Array.from(new Set([
    ...(initialLedger ? [initialLedger] : []),
    ...(BANK_LEDGERS && BANK_LEDGERS.length > 0 ? BANK_LEDGERS : ['Primary Bank Account'])
  ])).filter(Boolean);

  const [file, setFile] = useState(null);
  const [bankLedger, setBankLedger] = useState(initialLedger || effectiveLedgers[0] || 'Primary Bank Account');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialLedger) {
      setBankLedger(initialLedger);
    } else if (!bankLedger && effectiveLedgers.length > 0) {
      setBankLedger(effectiveLedgers[0]);
    }
  }, [initialLedger, BANK_LEDGERS]);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a bank statement file (PDF or Excel/CSV)');
      return;
    }
    const targetLedger = bankLedger || effectiveLedgers[0] || 'Primary Bank Account';

    setLoading(true);
    try {
      const res = await bankStatementAiApi.uploadStatement(file, targetLedger);
      if (res.success && res.data) {
        toast.success(`Statement processed for '${targetLedger}'! Found ${res.data.summary.total_count} transactions.`);
        onBatchCreated(res.data);
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process bank statement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[650px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <div className="flex items-center gap-2">
            <Sparkles className="text-[var(--app-accent)]" size={20} />
            <h2 className="text-[18px] font-black text-[var(--app-heading)] tracking-tight">AI Bank Statement Ingestion</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-extrabold uppercase text-[var(--app-muted)]">Target Bank Ledger</label>
              {bankLedger && (
                <span className="text-[10.5px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Target: {bankLedger}
                </span>
              )}
            </div>
            <SearchableDropdown placeholder="Select Bank Ledger" items={effectiveLedgers} value={bankLedger} onChange={setBankLedger} />
            <p className="text-[10px] text-[var(--app-muted)] mt-1.5 font-medium">
              Only verified bank accounts (Bank Accounts, Bank OD A/c) are listed.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-extrabold uppercase text-[var(--app-muted)] block mb-2">Bank Statement File (.pdf, .xlsx, .xls, .csv)</label>
            <div className="border-2 border-dashed rounded-2xl p-6 text-center bg-[var(--app-control-bg)] hover:border-[var(--app-accent)] transition-all cursor-pointer relative" style={{ borderColor: 'var(--app-border)' }}>
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="mx-auto text-[var(--app-accent)] mb-2" size={28} />
              {file ? (
                <div>
                  <span className="text-xs font-black text-[var(--app-heading)] block">{file.name}</span>
                  <span className="text-[10px] font-semibold text-[var(--app-muted)]">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-bold text-[var(--app-heading)] block">Click or Drag & Drop Bank Statement</span>
                  <span className="text-[10px] font-semibold text-[var(--app-muted)]">Supports PDF statements, Excel (.xlsx, .xls) and CSV files</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border text-xs font-bold hover:bg-[var(--app-control-hover)]" style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}>
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
              <span>{loading ? 'Processing AI Extraction...' : 'Upload & Process AI Statement'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankPanel;

