import React, { useState, useEffect, useRef } from 'react';
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
  ClipboardList,
  Check,
  Landmark
} from 'lucide-react';
import { motion } from 'motion/react';
import DataTable from '../ui/DataTable';
import Badge, { statusTone } from '../ui/Badge';
import StatCard from '../ui/StatCard';
import ObjectDoodle from '../ui/ObjectDoodle';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import fundflowApi from '../../services/fundflowApi';

// All dropdown data is fetched dynamically from the database via useFundFlowStore.
// No hardcoded arrays — see BankPanel component body for dynamic derivations.

const TAB_META = {
  'Manage Bank': { title: 'Bank Main', subtitle: 'Manage linked bank accounts and their Tally ledgers.' },
  'Manage Rule': { title: 'Bank Rule', subtitle: 'Auto-classify statement lines into vouchers with rules.' },
  'Inbox': { title: 'Bank Inbox', subtitle: 'Unreconciled statement lines awaiting a ledger match.' },
  'Review': { title: 'Bank Review', subtitle: 'Verify and approve matched transactions before posting.' },
  'Archive': { title: 'Bank Archive', subtitle: 'Approved transactions posted to Tally.' },
};

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

  // Modals for Bank Rule
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isBulkUploadRulesOpen, setIsBulkUploadRulesOpen] = useState(false);
  const [isRuleFilterOpen, setIsRuleFilterOpen] = useState(false);
  const [isAddPartyLedgerOpen, setIsAddPartyLedgerOpen] = useState(false);

  // Modals for Inbox/Review/Archive
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isInboxFilterOpen, setIsInboxFilterOpen] = useState(false);

  const fundFlowStore = useFundFlowStore();

  useEffect(() => {
    fundFlowStore.fetchMasterData();
    fundFlowStore.setFilter('voucherType', '');
    fundFlowStore.setFilter('search', '');
    fundFlowStore.fetchTransactions();
  }, []);

  const dbBankLedgers = (fundFlowStore.masterData?.ledgers || []).filter(l => {
    const g = l.groupName ? l.groupName.toLowerCase().trim() : '';
    const name = (l.ledgerName || l.name || '').toLowerCase();
    return g.includes('bank') || name.includes('bank') || g === 'bank accounts' || g === 'bank od a/c';
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

  const inboxData = allTransactions.length > 0
    ? allTransactions
        .filter(tx => tx.status === 'draft' || tx.status === 'failed_tally')
        .map(tx => {
          const partyNames = (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || '—';
          return {
            id: tx._id,
            date: tx.voucherDate ? new Date(tx.voucherDate).toLocaleDateString('en-IN') : '—',
            description: tx.narration || `Manual Entry Voucher ${tx.voucherNumber}`,
            amount: (parseFloat(tx.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            type: tx.voucherType === 'cash_payment' ? 'Payment' : 'Receipt',
            party: partyNames
          };
        })
    : [];

  const reviewData = allTransactions.length > 0
    ? allTransactions
        .filter(tx => tx.status === 'pending_approval')
        .map(tx => {
          const partyNames = (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || '—';
          return {
            id: tx._id,
            date: tx.voucherDate ? new Date(tx.voucherDate).toLocaleDateString('en-IN') : '—',
            description: tx.narration || `Voucher ${tx.voucherNumber}`,
            amount: (parseFloat(tx.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            type: tx.voucherType === 'cash_payment' ? 'Payment' : 'Receipt',
            party: partyNames,
            status: 'Pending'
          };
        })
    : [];

  const archiveData = allTransactions.length > 0
    ? allTransactions
        .filter(tx => tx.status === 'approved' || tx.status === 'posted_to_tally')
        .map(tx => {
          const partyNames = (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || '—';
          return {
            id: tx._id,
            date: tx.voucherDate ? new Date(tx.voucherDate).toLocaleDateString('en-IN') : '—',
            description: tx.narration || `Posted Voucher ${tx.voucherNumber}`,
            amount: (parseFloat(tx.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            type: tx.voucherType === 'cash_payment' ? 'Payment' : 'Receipt',
            party: partyNames,
            status: 'Approved'
          };
        })
    : [];

  const fallbackBanks = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank', 'HSBC', 'Standard Chartered', 'DBS Bank', 'Yes Bank'];
  const dynamicBanks = Array.from(new Set([...dbBankAccounts.map(a => a.bank), ...fallbackBanks])).filter(Boolean);
  const dynamicBankLedgers = dbBankAccounts.map(a => a.ledger).filter(Boolean);

  const fallbackLedgerGroups = ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand', 'Current Assets', 'Loans (Liability)', 'Indirect Expenses', 'Indirect Incomes', 'Suspense Account'];
  const dynamicLedgerGroups = Array.from(new Set((fundFlowStore.masterData?.ledgers || []).map(l => l.groupName).filter(Boolean)));
  const finalLedgerGroups = dynamicLedgerGroups.length > 0 ? dynamicLedgerGroups : fallbackLedgerGroups;

  const dynamicAccountNumbers = dbBankAccounts.map(a => a.accountNumber).filter(num => num && num !== '—');

  const fallbackPaymentModes = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Credit Card', 'Debit Card'];
  const dynamicPaymentModes = Array.from(new Set(
    allTransactions.map(tx => tx.instType || tx.paymentMode).filter(Boolean)
  ));
  const finalPaymentModes = dynamicPaymentModes.length > 0 ? dynamicPaymentModes : fallbackPaymentModes;

  const fallbackTransactionTypes = ['Payment', 'Receipt', 'Contra', 'Transfer'];
  const dynamicTransactionTypes = Array.from(new Set(
    (fundFlowStore.masterData?.voucherTypesFull || []).map(vt => vt.parent || vt.name).filter(Boolean)
  ));
  const finalTransactionTypes = dynamicTransactionTypes.length > 0 ? dynamicTransactionTypes : fallbackTransactionTypes;

  const fallbackReplacedTypes = ['Sales', 'Purchase', 'Expense', 'Salary', 'Rent', 'Tax Payment', 'Insurance'];
  const dynamicReplacedTypesObj = Array.from(new Set(
    (fundFlowStore.masterData?.ledgers || []).map(l => l.groupName).filter(Boolean)
  ));
  const dynamicReplacedTypes = dynamicReplacedTypesObj.length > 0 ? dynamicReplacedTypesObj : fallbackReplacedTypes;

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
      case 'Manage Rule':
        return (
          <>
            <IconButton icon={Plus} color="emerald" onClick={() => setIsAddRuleOpen(true)} />
            <IconButton icon={Upload} color="emerald" onClick={() => setIsBulkUploadRulesOpen(true)} />
            <IconButton icon={Download} color="purple" />
            <IconButton icon={Trash2} color="red" />
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
      { key: 'act', header: 'Action', align: 'center', width: '150px', render: () => <div className="flex items-center justify-center gap-1"><RowAct icon={Upload} /><RowAct icon={Edit3} /><RowAct icon={RefreshCw} tone="hover:text-emerald-500" /><RowAct icon={Trash2} tone="hover:text-rose-500" /></div> },
    ],
    'Manage Rule': [
      srCol,
      { key: 'account', header: 'Account', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{r.account}</span> },
      { key: 'dateRange', header: 'Date Range', sortable: true, render: (r) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{r.dateRange}</span> },
      { key: 'description', header: 'Description', sortable: true, render: (r) => <span className="font-semibold">{r.description}</span> },
      { key: 'mode', header: 'Mode', render: (r) => <Badge tone="neutral">{r.mode}</Badge> },
      { key: 'type', header: 'Type', render: (r) => <Badge tone={typeTone(r.type)}>{r.type}</Badge> },
      amtCol,
      { key: 'party', header: 'Party Ledger', sortable: true, render: (r) => <span className="font-semibold">{r.party}</span> },
      { key: 'replaced', header: 'Replaced', render: (r) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{r.replaced}</span> },
      { key: 'act', header: 'Action', align: 'center', width: '70px', render: () => <RowAct icon={Trash2} tone="hover:text-rose-500" /> },
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
  const bankRuleData = [];
  const DATA = {
    'Manage Bank': dbBankAccounts,
    'Manage Rule': bankRuleData,
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
      case 'Manage Rule':
        return [
          { label: 'Active Rules', value: bankRuleData.length, icon: ClipboardList },
          { label: 'Mapped Parties', value: uniq(bankRuleData, 'party'), icon: FileText },
          { label: 'Auto-Replace Types', value: uniq(bankRuleData, 'replaced'), icon: RefreshCw },
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

  const renderActive = () => {
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
        minWidth={activeTab === 'Manage Rule' ? '1200px' : (activeTab === 'Manage Bank' && selectedBankRow ? '700px' : '900px')}
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
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 h-full overflow-hidden relative"
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Popups for Bank Main */}
      {isAddBankOpen && <AddBankModal onClose={() => setIsAddBankOpen(false)} BANKS={dynamicBanks} BANK_LEDGERS={dynamicBankLedgers} />}
      {isUploadStatementOpen && <UploadStatementModal onClose={() => setIsUploadStatementOpen(false)} BANKS={dynamicBanks} />}
      {isBankFilterOpen && <FilterDrawer title="Filter" onClose={() => setIsBankFilterOpen(false)}>
        <input type="text" placeholder="Bank Name" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm" style={{ borderColor: 'var(--app-border)' }} />
        <SearchableDropdown placeholder="Bank Ledger" items={dynamicBankLedgers} isSmall />
      </FilterDrawer>}
      {isAddBankLedgerOpen && <AddLedgerModal title="Add Bank Ledger" type="Bank" onClose={() => setIsAddBankLedgerOpen(false)} LEDGER_GROUPS={finalLedgerGroups} />}

      {/* Popups for Bank Rule */}
      {isAddRuleOpen && <AddRuleModal
        onClose={() => setIsAddRuleOpen(false)}
        ACCOUNT_NUMBERS={dynamicAccountNumbers}
        PARTY_LEDGERS={dynamicPartyLedgers}
        PAYMENT_MODES={finalPaymentModes}
        TRANSACTION_TYPES={finalTransactionTypes}
        REPLACED_TYPES={dynamicReplacedTypes}
      />}
      {isBulkUploadRulesOpen && <BulkUploadRulesModal onClose={() => setIsBulkUploadRulesOpen(false)} />}
      {isRuleFilterOpen && <FilterDrawer title="Filter" onClose={() => setIsRuleFilterOpen(false)}>
        <SearchableDropdown placeholder="Account Number" items={dynamicAccountNumbers} isSmall />
        <div className="flex gap-2">
          <div className="flex-1 relative"><input type="text" placeholder="From Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} /></div>
          <div className="flex-1 relative"><input type="text" placeholder="To Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} /></div>
        </div>
        <input type="text" placeholder="Description" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} />
        <SearchableDropdown placeholder="Payment Mode" items={finalPaymentModes} isSmall />
        <SearchableDropdown placeholder="Type" items={finalTransactionTypes} isSmall />
        <div className="flex gap-2">
          <input type="text" placeholder="From Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} />
          <input type="text" placeholder="To Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} />
        </div>
        <SearchableDropdown placeholder="Party Ledger" items={dynamicPartyLedgers} isSmall />
      </FilterDrawer>}
      {isAddPartyLedgerOpen && <AddLedgerModal title="Add Party Ledger" type="Party" onClose={() => setIsAddPartyLedgerOpen(false)} LEDGER_GROUPS={finalLedgerGroups} />}

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

      {/* Header */}
      <div className="rounded-xl border p-3.5 shrink-0" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ background: 'var(--app-accent-gradient)' }}>
            <Landmark size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-extrabold tracking-tight" style={{ color: 'var(--app-heading)' }}>
                {TAB_META[activeTab]?.title || 'Bank'}
              </h1>
              <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase tracking-wider shrink-0" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)', border: '1px solid var(--app-border)' }}>
                {activeTab}
              </span>
            </div>
            <p className="text-[10px] font-medium mt-0.5 truncate" style={{ color: 'var(--app-muted)' }}>
              {TAB_META[activeTab]?.subtitle}
            </p>
          </div>

          <div className="flex gap-2 items-center ml-2">
            {getHeaderIcons()}

            {(activeTab === 'Inbox' || activeTab === 'Review' || activeTab === 'Archive') && (
              <div className="flex items-center gap-2 ml-2 flex-wrap">
                <div className="relative min-w-[140px]">
                  <select
                    className="w-full h-8 pl-3 pr-8 rounded-lg border text-[12px] appearance-none outline-none focus-ring cursor-pointer"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                  >
                    <option value="">Select Bank</option>
                    {dynamicBanks.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-muted)' }} size={14} />
                </div>
                <div className="relative min-w-[180px]">
                  <select
                    className="w-full h-8 pl-3 pr-8 rounded-lg border text-[12px] appearance-none outline-none focus-ring cursor-pointer"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}
                  >
                    <option value="">Select Bank Statement</option>
                    {dynamicBankLedgers.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-muted)' }} size={14} />
                </div>
              </div>
            )}
          </div>

          {activeTab === 'Inbox' && (
            <div className="flex items-center gap-4 ml-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-[var(--app-accent)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--app-muted)' }}>Not Selected Ledger</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-[var(--app-accent)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--app-muted)' }}>Selected Ledger</span>
              </label>
            </div>
          )}
        </div>

        {(activeTab === 'Manage Bank' || activeTab === 'Manage Rule') && (
          <div className="flex-1 min-w-[200px] max-w-[300px] px-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted)' }} size={13} />
              <input
                type="text"
                placeholder="Search…"
                className="w-full h-9 rounded-lg border pl-9 pr-3 text-[12.5px] outline-none transition-all focus-ring"
                style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {activeTab === 'Manage Bank' && <IconButton icon={FileText} color="blue" onClick={() => setIsAddBankLedgerOpen(true)} />}
          {activeTab === 'Manage Rule' && <IconButton icon={FileText} color="blue" onClick={() => setIsAddPartyLedgerOpen(true)} />}

          {(activeTab === 'Inbox' || activeTab === 'Review' || activeTab === 'Archive') && (
            <>
              <IconButton icon={Layout} color="blue" onClick={() => setIsColumnConfigOpen(true)} />
              <IconButton icon={Settings} color="blue" onClick={() => setIsColumnConfigOpen(true)} />
            </>
          )}

          <IconButton icon={HelpCircle} color="purple" />
          <IconButton icon={Filter} color="blue" onClick={() => {
            if (activeTab === 'Manage Bank') setIsBankFilterOpen(true);
            else if (activeTab === 'Manage Rule') setIsRuleFilterOpen(true);
            else setIsInboxFilterOpen(true);
          }} />
        </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
        {tabKpis().map((k, i) => (
          <StatCard key={`${activeTab}-${k.label}`} index={i} label={k.label} value={k.value} icon={k.icon} />
        ))}
      </div>

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
    const g = l.groupName ? l.groupName.toLowerCase().trim() : '';
    const name = (l.ledgerName || l.name || '').toLowerCase();
    return g.includes('bank') || name.includes('bank') || g === 'bank accounts' || g === 'bank od a/c';
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

const UploadStatementModal = ({ onClose, BANKS: propBanks }) => {
  const modalBanks = propBanks && propBanks.length > 0 ? propBanks : [];
  const [bank, setBank] = useState('');

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[800px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <h2 className="text-[16px] font-black text-[var(--app-accent)] tracking-tight">Upload Statement</h2>
          <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <SearchableDropdown label="Bank *" items={modalBanks} value={bank} onChange={setBank} />

            <div className="relative">
              <input type="text" placeholder="Date Range" className="w-full h-12 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={18} />
            </div>
          </div>

          <div className="text-center space-y-1.5 py-2">
            <p className="text-[12px] font-black text-red-500 tracking-tight">Header in file must be Present*</p>
            <p className="text-[12px] font-black text-red-500 tracking-tight">File processing may take upto 30 mins*</p>
            <p className="text-[12px] font-black text-red-500 tracking-tight">Document should be no more than 40 pages and 30 MB in size*</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 py-8 bg-[var(--app-content-bg)]/30 rounded-2xl border border-[var(--app-border)]">
            <ObjectDoodle name="upload" className="w-28 h-24" />
            <button className="text-[13px] font-bold hover:text-[var(--app-accent)] transition-colors" style={{ color: 'var(--app-text)' }}>Click here to Choose Files</button>
            <div className="w-4/5 mt-4">
              <div className="h-28 border-2 border-dashed border-[var(--app-border)] rounded-2xl flex items-center justify-center bg-[var(--app-panel-bg)] shadow-inner">
                <span className="text-[13px] font-bold text-[var(--app-muted)] italic">Drag and drop files here</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button className="m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white px-12 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl dark:shadow-none transition-all hover:opacity-90">
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- Rule Related Popups --- */
const AddRuleModal = ({ onClose, ACCOUNT_NUMBERS: propAccNumbers, PARTY_LEDGERS: propPartyLedgers, PAYMENT_MODES: propPayModes, TRANSACTION_TYPES: propTxTypes, REPLACED_TYPES: propReplacedTypes }) => {
  const modalAccNumbers = propAccNumbers || [];
  const modalPartyLedgers = propPartyLedgers || [];
  const modalPayModes = propPayModes || [];
  const modalTxTypes = propTxTypes || [];
  const modalReplacedTypes = propReplacedTypes || [];

  const [account, setAccount] = useState('');
  const [payMode, setPayMode] = useState('');
  const [type, setType] = useState('');
  const [replacedType, setReplacedType] = useState('');
  const [partyLedger, setPartyLedger] = useState('');

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[800px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <h2 className="text-[18px] font-black text-[var(--app-accent)] tracking-tight">Add Rule</h2>
          <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"><X size={22} /></button>
        </div>

        <div className="px-10 pb-10 space-y-6 mt-4">
          <div className="h-[180px] w-full bg-[var(--app-accent-soft)] rounded-2xl flex items-center justify-center overflow-hidden">
            <ObjectDoodle name="scan" className="w-44 h-36" />
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-[13px] font-black text-[var(--app-accent)] uppercase tracking-widest mb-4">Conditional Field</h3>
              <div className="grid grid-cols-3 gap-4">
                <SearchableDropdown placeholder="Account Number" items={modalAccNumbers} value={account} onChange={setAccount} />
                <div className="relative">
                  <input type="text" placeholder="Voucher Date" className="w-full h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={16} />
                </div>
                <input type="text" placeholder="Description" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
                <SearchableDropdown placeholder="Payment Mode" items={modalPayModes} value={payMode} onChange={setPayMode} />
                <SearchableDropdown placeholder="Type" items={modalTxTypes} value={type} onChange={setType} />
                <input type="text" placeholder="Amount(Min)" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
                <input type="text" placeholder="Amount(Max)" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-black text-[var(--app-accent)] uppercase tracking-widest mb-4 border-t pt-4" style={{ borderColor: 'var(--app-row-border)' }}>Action Field</h3>
              <div className="grid grid-cols-2 gap-4">
                <SearchableDropdown placeholder="Replaced Type" items={modalReplacedTypes} value={replacedType} onChange={setReplacedType} />
                <SearchableDropdown placeholder="Party Ledger" items={modalPartyLedgers} value={partyLedger} onChange={setPartyLedger} />
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button className="m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white px-14 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl dark:shadow-none transition-all">
              submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const BulkUploadRulesModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[800px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <h2 className="text-[16px] font-black text-[var(--app-accent)] tracking-tight">Bulk Upload Bank Rules</h2>
          <button onClick={onClose} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"><X size={20} /></button>
        </div>

        <div className="p-10 space-y-8">
          <div className="text-center space-y-1.5">
            <p className="text-[13px] font-bold text-[var(--app-accent)]">Supported formats: .xlsx, .xls</p>
            <p className="text-[13px] font-bold text-[var(--app-accent)]">Maximum file size: 10 MB</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 py-10 bg-[var(--app-content-bg)]/30 rounded-2xl border border-[var(--app-border)]">
            <ObjectDoodle name="upload" className="w-28 h-24" />
            <button className="text-[13px] font-bold hover:text-[var(--app-accent)] transition-colors" style={{ color: 'var(--app-text)' }}>Click here to Choose File</button>
            <div className="w-[90%] mt-4">
              <div className="h-28 border-2 border-dashed border-[var(--app-border)] rounded-2xl flex items-center justify-center bg-[var(--app-panel-bg)] shadow-inner">
                <span className="text-[13px] font-bold text-[var(--app-muted)]">Drag and drop file here</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button className="m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white px-12 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl dark:shadow-none transition-all hover:opacity-90">
              Validate
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

const BankDetailsPage = ({ row, details, loading, balance, transactions, isDark, onClose }) => {
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
  const totalTxCount = transactions.length;
  const pendingTxCount = transactions.filter(t => t.status === 'pending_approval').length;

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
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-[var(--app-control-hover)] transition-colors"
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
                Active
              </span>
            </div>
            <p className="text-[10px] text-[var(--app-muted)] mt-0.5">
              Account Holder: {row.accountName || details?.companyName || 'Primary Account'}
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--app-accent)] border-t-transparent animate-spin" />
            <span className="text-[11px] font-semibold text-[var(--app-muted)]">Loading bank information…</span>
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
              <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Opening Balance</span>
              <div className="text-[16px] font-black mt-1 text-[var(--app-heading)]">
                {fmtBalance(openingBal)}
              </div>
            </div>
            <div className="rounded-xl border p-3 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Total Vouchers</span>
              <div className="text-[16px] font-black mt-1 text-[var(--app-heading)]">
                {totalTxCount}
              </div>
            </div>
            <div className="rounded-xl border p-3 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Pending Review</span>
              <div className="text-[16px] font-black mt-1 text-amber-500">
                {pendingTxCount}
              </div>
            </div>
          </div>

          {/* Details & Transactions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Left Column: Bank Info Card */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-xl border p-4 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-accent)] border-b pb-2 mb-3" style={{ borderColor: 'var(--app-border)' }}>
                  Bank Information
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
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Status</span>
                    <span className="text-[12px] font-bold text-emerald-500 flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Transaction History Card */}
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-xl border p-4 bg-[var(--app-control-bg)] shadow-sm" style={{ borderColor: 'var(--app-border)' }}>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--app-accent)] border-b pb-2 mb-3" style={{ borderColor: 'var(--app-border)' }}>
                  Transaction History
                </h3>
                <div className="overflow-x-auto animate-in fade-in duration-300">
                  {transactions.length > 0 ? (
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--app-border)' }}>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Date</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Voucher No</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Type</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider">Party/Ledger</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-right">Amount</th>
                          <th className="py-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, idx) => {
                          const dateStr = tx.voucherDate ? new Date(tx.voucherDate).toLocaleDateString('en-IN') : '—';
                          const partyNames = (tx.ledgerRows || []).map(r => r.ledgerName).filter(Boolean).join(', ') || tx.partyLedger || '—';
                          const type = tx.voucherType === 'cash_payment' ? 'Payment' : tx.voucherType === 'bank_payment' ? 'Receipt' : 'Contra';
                          const isReceipt = tx.voucherType === 'bank_payment';
                          const txAmount = parseFloat(tx.amount) || 0;
                          
                          // Format status labels/tones
                          let statusLabel = 'Draft';
                          let statusTone = 'neutral';
                          if (tx.status === 'pending_approval') {
                            statusLabel = 'Pending';
                            statusTone = 'warning';
                          } else if (tx.status === 'approved' || tx.status === 'posted_to_tally') {
                            statusLabel = 'Approved';
                            statusTone = 'success';
                          } else if (tx.status === 'failed_tally') {
                            statusLabel = 'Failed';
                            statusTone = 'danger';
                          }

                          return (
                            <tr key={tx._id || idx} className="border-b last:border-0 hover:bg-[var(--app-content-bg)]/50 transition-colors" style={{ borderColor: 'var(--app-border)' }}>
                              <td className="py-2 font-semibold text-[var(--app-heading)]">{dateStr}</td>
                              <td className="py-2 font-bold text-[var(--app-heading)]">{tx.voucherNumber || '—'}</td>
                              <td className="py-2 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[9.5px] uppercase font-black tracking-wider ${
                                  type === 'Receipt' ? 'bg-emerald-500/10 text-emerald-500' :
                                  type === 'Payment' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                  {type}
                                </span>
                              </td>
                              <td className="py-2 font-semibold text-[var(--app-heading)] max-w-[150px] truncate" title={partyNames}>{partyNames}</td>
                              <td className={`py-2 font-bold text-right ${isReceipt ? 'text-emerald-500' : 'text-rose-500'}`}>
                                ₹ {txAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9.5px] uppercase font-black tracking-wider ${
                                  statusTone === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                                  statusTone === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                  statusTone === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-500/10 text-slate-500'
                                }`}>
                                  {statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-8 text-center text-[var(--app-muted)] font-semibold">
                      No transactions recorded for this bank account.
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

export default BankPanel;
