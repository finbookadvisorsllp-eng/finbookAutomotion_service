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

/* --- Dummy Data --- */
const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank', 'HSBC', 'Standard Chartered', 'DBS Bank', 'Yes Bank'];
const BANK_LEDGERS = ['HDFC Current Account', 'ICICI Business Savings', 'SBI OD Account', 'Axis Corporate Account', 'Kotak Mahindra Term Loan', 'PNB Overdraft', 'HSBC Global Wallet'];
const LEDGER_GROUPS = ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand', 'Current Assets', 'Loans (Liability)', 'Indirect Expenses', 'Indirect Incomes', 'Suspense Account'];
const ACCOUNT_NUMBERS = ['50200040438661', '50100020219902', '332211004455', '9988776655', '445566778899', '112233445566'];
const PAYMENT_MODES = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Credit Card', 'Debit Card'];
const TRANSACTION_TYPES = ['Payment', 'Receipt', 'Contra', 'Transfer'];
const REPLACED_TYPES = ['Sales', 'Purchase', 'Expense', 'Salary', 'Rent', 'Tax Payment', 'Insurance'];
const PARTY_LEDGERS = ['Aman', 'Rahul', 'Friends Grafix', 'Office Rent A/c', 'Electricity Bill', 'Zomato Ltd', 'Amazon Web Services', 'Google Cloud'];

const MANAGE_BANK_DATA = [
  { id: 1, bank: 'HDFC Bank', accountName: 'Aman', accountNumber: '50200040438661', ledger: 'HDFC BANK 50200040438661' },
  { id: 2, bank: 'ICICI Bank', accountName: 'Rahul', accountNumber: '50100020219902', ledger: 'ICICI BANK 50100020219902' },
  { id: 3, bank: 'Axis Bank', accountName: 'Friends Grafix', accountNumber: '332211004455', ledger: 'AXIS BANK 332211004455' },
  { id: 4, bank: 'Kotak Mahindra Bank', accountName: 'Acme Traders', accountNumber: '9988776655', ledger: 'KOTAK 9988776655' },
  { id: 5, bank: 'State Bank of India', accountName: 'Sunrise Exports', accountNumber: '445566778899', ledger: 'SBI 445566778899' },
  { id: 6, bank: 'Yes Bank', accountName: 'Patel & Co', accountNumber: '112233445566', ledger: 'YES BANK 112233445566' },
];

const BANK_RULE_DATA = [
  { id: 1, account: 'Aman', dateRange: '01-Apr-2024 to 30-Apr-2024', description: 'Monthly Rent', mode: 'NEFT', type: 'Payment', amount: '25,000', party: 'Office Rent A/c', replaced: 'Rent' },
  { id: 2, account: 'Rahul', dateRange: '15-Apr-2024 to 15-Apr-2024', description: 'Interest Credit', mode: 'RTGS', type: 'Receipt', amount: '1,200', party: 'Bank Interest', replaced: 'Income' },
  { id: 3, account: 'Acme Traders', dateRange: '01-Apr-2024 to 31-Mar-2025', description: 'AWS Cloud Bill', mode: 'UPI', type: 'Payment', amount: '12,400', party: 'Amazon Web Services', replaced: 'Expense' },
  { id: 4, account: 'Sunrise Exports', dateRange: '05-Apr-2024 to 05-Apr-2024', description: 'Salary Disbursal', mode: 'IMPS', type: 'Payment', amount: '85,000', party: 'Salary A/c', replaced: 'Salary' },
  { id: 5, account: 'Patel & Co', dateRange: '10-Apr-2024 to 10-Apr-2024', description: 'GST Payment', mode: 'NEFT', type: 'Payment', amount: '48,200', party: 'GST Payable', replaced: 'Tax Payment' },
];

const INBOX_DATA = [
  { id: 1, date: '04-May-2026', description: 'UPI/7331/Payment to Zomato', amount: '450.00', type: 'Payment', party: 'Zomato Ltd' },
  { id: 2, date: '03-May-2026', description: 'NEFT/HDFC/Salary Credit', amount: '85,000.00', type: 'Receipt', party: 'Salary A/c' },
  { id: 3, date: '02-May-2026', description: 'ATM/Cash Withdrawal', amount: '5,000.00', type: 'Contra', party: 'Cash' },
  { id: 4, date: '02-May-2026', description: 'IMPS/AWS/April Invoice', amount: '12,400.00', type: 'Payment', party: 'Amazon Web Services' },
  { id: 5, date: '01-May-2026', description: 'NEFT/Client/Invoice 1042', amount: '1,18,000.00', type: 'Receipt', party: 'New Horizon Ltd' },
  { id: 6, date: '30-Apr-2026', description: 'UPI/Electricity Bill', amount: '4,500.00', type: 'Payment', party: 'Electricity Bill' },
  { id: 7, date: '29-Apr-2026', description: 'RTGS/Inter-account Transfer', amount: '2,00,000.00', type: 'Contra', party: 'ICICI → HDFC' },
];

const REVIEW_DATA = [
  { id: 1, date: '01-May-2026', description: 'Amazon Web Services / April Bill', amount: '12,400.00', type: 'Payment', party: 'Amazon Web Services', status: 'Pending' },
  { id: 2, date: '30-Apr-2026', description: 'Google Cloud Platform / Storage', amount: '2,100.00', type: 'Payment', party: 'Google Cloud', status: 'Pending' },
  { id: 3, date: '29-Apr-2026', description: 'Client Receipt / Invoice 1041', amount: '64,500.00', type: 'Receipt', party: 'Greenline Ventures', status: 'Pending' },
  { id: 4, date: '28-Apr-2026', description: 'Office Supplies / Staples', amount: '3,250.00', type: 'Payment', party: 'Staples India', status: 'Pending' },
  { id: 5, date: '27-Apr-2026', description: 'Bank Charges / Q1', amount: '590.00', type: 'Payment', party: 'Bank Charges', status: 'Pending' },
];

const ARCHIVE_DATA = [
  { id: 1, date: '15-Mar-2026', description: 'Electricity Bill / March', amount: '4,500.00', type: 'Payment', party: 'Electricity Bill', status: 'Approved' },
  { id: 2, date: '10-Mar-2026', description: 'Office Rent / March', amount: '25,000.00', type: 'Payment', party: 'Office Rent A/c', status: 'Approved' },
  { id: 3, date: '08-Mar-2026', description: 'Client Receipt / Invoice 1039', amount: '92,000.00', type: 'Receipt', party: 'Apex Holdings', status: 'Approved' },
  { id: 4, date: '05-Mar-2026', description: 'GST Payment / Feb', amount: '48,200.00', type: 'Payment', party: 'GST Payable', status: 'Approved' },
  { id: 5, date: '02-Mar-2026', description: 'Salary Disbursal / Feb', amount: '3,40,000.00', type: 'Payment', party: 'Salary A/c', status: 'Approved' },
  { id: 6, date: '01-Mar-2026', description: 'Interest Credit / Q4', amount: '1,180.00', type: 'Receipt', party: 'Bank Interest', status: 'Approved' },
];

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
  const DATA = { 'Manage Bank': MANAGE_BANK_DATA, 'Manage Rule': BANK_RULE_DATA, 'Inbox': INBOX_DATA, 'Review': REVIEW_DATA, 'Archive': ARCHIVE_DATA };

  // ── KPI cards per segment (benchmark hallmark) ───────────────────────
  const uniq = (arr, k) => new Set(arr.map((r) => r[k])).size;
  const sumAmt = (arr) => arr.reduce((s, r) => s + (parseFloat(String(r.amount).replace(/,/g, '')) || 0), 0);
  const inr = (n) => `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const tabKpis = () => {
    switch (activeTab) {
      case 'Manage Bank':
        return [
          { label: 'Bank Accounts', value: MANAGE_BANK_DATA.length, icon: Landmark },
          { label: 'Banks Linked', value: uniq(MANAGE_BANK_DATA, 'bank'), icon: FileText },
          { label: 'Account Holders', value: uniq(MANAGE_BANK_DATA, 'accountName'), icon: CheckCircle2 },
        ];
      case 'Manage Rule':
        return [
          { label: 'Active Rules', value: BANK_RULE_DATA.length, icon: ClipboardList },
          { label: 'Mapped Parties', value: uniq(BANK_RULE_DATA, 'party'), icon: FileText },
          { label: 'Auto-Replace Types', value: uniq(BANK_RULE_DATA, 'replaced'), icon: RefreshCw },
        ];
      case 'Inbox':
        return [
          { label: 'Unreconciled', value: INBOX_DATA.length, icon: Info },
          { label: 'Receipts', value: INBOX_DATA.filter((r) => r.type === 'Receipt').length, icon: Download },
          { label: 'Inbox Value', value: inr(sumAmt(INBOX_DATA)), icon: Landmark },
        ];
      case 'Review':
        return [
          { label: 'Pending Review', value: REVIEW_DATA.length, icon: Info },
          { label: 'Awaiting Value', value: inr(sumAmt(REVIEW_DATA)), icon: Landmark },
          { label: 'Payments', value: REVIEW_DATA.filter((r) => r.type === 'Payment').length, icon: Upload },
        ];
      case 'Archive':
        return [
          { label: 'Approved', value: ARCHIVE_DATA.length, icon: CheckCircle2 },
          { label: 'Archived Value', value: inr(sumAmt(ARCHIVE_DATA)), icon: Landmark },
          { label: 'Receipts', value: ARCHIVE_DATA.filter((r) => r.type === 'Receipt').length, icon: Download },
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
        emptyText="No bank transactions found."
        minWidth={activeTab === 'Manage Rule' ? '1200px' : '900px'}
        selectable
        selectedKeys={selectedRows}
        onToggleRow={(id) => setSelectedRows((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
        onToggleAll={(c) => setSelectedRows(c ? rows.map((r) => r.id) : [])}
        search={{ value: bankSearch, onChange: setBankSearch, placeholder: 'Search transactions…' }}
      />
    );
  };

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
      {isAddBankOpen && <AddBankModal onClose={() => setIsAddBankOpen(false)} />}
      {isUploadStatementOpen && <UploadStatementModal onClose={() => setIsUploadStatementOpen(false)} />}
      {isBankFilterOpen && <FilterDrawer title="Filter" onClose={() => setIsBankFilterOpen(false)}>
        <input type="text" placeholder="Bank Name" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm" style={{ borderColor: 'var(--app-border)' }} />
        <SearchableDropdown placeholder="Bank Ledger" items={BANK_LEDGERS} isSmall />
      </FilterDrawer>}
      {isAddBankLedgerOpen && <AddLedgerModal title="Add Bank Ledger" type="Bank" onClose={() => setIsAddBankLedgerOpen(false)} />}

      {/* Popups for Bank Rule */}
      {isAddRuleOpen && <AddRuleModal onClose={() => setIsAddRuleOpen(false)} />}
      {isBulkUploadRulesOpen && <BulkUploadRulesModal onClose={() => setIsBulkUploadRulesOpen(false)} />}
      {isRuleFilterOpen && <FilterDrawer title="Filter" onClose={() => setIsRuleFilterOpen(false)}>
        <SearchableDropdown placeholder="Account Number" items={ACCOUNT_NUMBERS} isSmall />
        <div className="flex gap-2">
          <div className="flex-1 relative"><input type="text" placeholder="From Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} /></div>
          <div className="flex-1 relative"><input type="text" placeholder="To Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} /></div>
        </div>
        <input type="text" placeholder="Description" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} />
        <SearchableDropdown placeholder="Payment Mode" items={PAYMENT_MODES} isSmall />
        <SearchableDropdown placeholder="Type" items={TRANSACTION_TYPES} isSmall />
        <div className="flex gap-2">
          <input type="text" placeholder="From Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} />
          <input type="text" placeholder="To Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-[var(--app-accent)]" style={{ borderColor: 'var(--app-border)' }} />
        </div>
        <SearchableDropdown placeholder="Party Ledger" items={PARTY_LEDGERS} isSmall />
      </FilterDrawer>}
      {isAddPartyLedgerOpen && <AddLedgerModal title="Add Party Ledger" type="Party" onClose={() => setIsAddPartyLedgerOpen(false)} />}

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
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-muted)' }} size={14} />
                </div>
                <div className="relative min-w-[180px]">
                  <select
                    className="w-full h-8 pl-3 pr-8 rounded-lg border text-[12px] appearance-none outline-none focus-ring cursor-pointer"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}
                  >
                    <option value="">Select Bank Statement</option>
                    {BANK_LEDGERS.map(l => <option key={l} value={l}>{l}</option>)}
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

      <div className="flex-1 overflow-hidden">
        {renderActive()}
      </div>
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

const AddBankModal = ({ onClose }) => {
  const [bank, setBank] = useState('');
  const [ledger, setLedger] = useState('');

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
            <SearchableDropdown placeholder="Bank" items={BANKS} value={bank} onChange={setBank} />
            <SearchableDropdown placeholder="Bank Ledger" items={BANK_LEDGERS} value={ledger} onChange={setLedger} />
            <input type="text" placeholder="Account Name" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
            <input type="text" placeholder="Account Number" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
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

const UploadStatementModal = ({ onClose }) => {
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
            <SearchableDropdown label="Bank *" items={BANKS} value={bank} onChange={setBank} />

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
const AddRuleModal = ({ onClose }) => {
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
                <SearchableDropdown placeholder="Account Number" items={ACCOUNT_NUMBERS} value={account} onChange={setAccount} />
                <div className="relative">
                  <input type="text" placeholder="Voucher Date" className="w-full h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={16} />
                </div>
                <input type="text" placeholder="Description" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
                <SearchableDropdown placeholder="Payment Mode" items={PAYMENT_MODES} value={payMode} onChange={setPayMode} />
                <SearchableDropdown placeholder="Type" items={TRANSACTION_TYPES} value={type} onChange={setType} />
                <input type="text" placeholder="Amount(Min)" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
                <input type="text" placeholder="Amount(Max)" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[var(--app-accent)] shadow-sm bg-[var(--app-content-bg)]/40 text-[var(--app-heading)] hover:border-[var(--app-border)] transition-colors" style={{ borderColor: 'var(--app-border)' }} />
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-black text-[var(--app-accent)] uppercase tracking-widest mb-4 border-t pt-4" style={{ borderColor: 'var(--app-row-border)' }}>Action Field</h3>
              <div className="grid grid-cols-2 gap-4">
                <SearchableDropdown placeholder="Replaced Type" items={REPLACED_TYPES} value={replacedType} onChange={setReplacedType} />
                <SearchableDropdown placeholder="Party Ledger" items={PARTY_LEDGERS} value={partyLedger} onChange={setPartyLedger} />
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

const AddLedgerModal = ({ title, type, onClose }) => {
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
              <SearchableDropdown placeholder="Ledger Group" items={LEDGER_GROUPS} value={ledgerGroup} onChange={setLedgerGroup} />
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
