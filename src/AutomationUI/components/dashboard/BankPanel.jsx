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
  ArrowUpDown,
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
  CloudUpload,
  FileText,
  ClipboardList,
  Check,
  Landmark
} from 'lucide-react';
import { motion } from 'motion/react';

/* --- Dummy Data --- */
const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank', 'HSBC', 'Standard Chartered', 'DBS Bank', 'Yes Bank'];
const BANK_LEDGERS = ['HDFC Current Account', 'ICICI Business Savings', 'SBI OD Account', 'Axis Corporate Account', 'Kotak Mahindra Term Loan', 'PNB Overdraft', 'HSBC Global Wallet'];
const LEDGER_GROUPS = ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand', 'Current Assets', 'Loans (Liability)', 'Indirect Expenses', 'Indirect Incomes', 'Suspense Account'];
const ACCOUNT_NUMBERS = ['50200040438661', '50100020219902', '332211004455', '9988776655', '445566778899', '112233445566'];
const PAYMENT_MODES = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Credit Card', 'Debit Card'];
const TRANSACTION_TYPES = ['Payment', 'Receipt', 'Contra', 'Journal', 'Transfer'];
const REPLACED_TYPES = ['Sales', 'Purchase', 'Expense', 'Salary', 'Rent', 'Tax Payment', 'Insurance'];
const PARTY_LEDGERS = ['Aman', 'Rahul', 'Friends Grafix', 'Office Rent A/c', 'Electricity Bill', 'Zomato Ltd', 'Amazon Web Services', 'Google Cloud'];

const MANAGE_BANK_DATA = [
  { id: 1, bank: 'HDFC Bank', accountName: 'Aman', accountNumber: '50200040438661', ledger: 'HDFC BANK 50200040438661' },
  { id: 2, bank: 'ICICI Bank', accountName: 'Rahul', accountNumber: '50100020219902', ledger: 'ICICI BANK 50100020219902' },
  { id: 3, bank: 'Axis Bank', accountName: 'Friends Grafix', accountNumber: '332211004455', ledger: 'AXIS BANK 332211004455' },
];

const BANK_RULE_DATA = [
  { id: 1, account: 'Aman', dateRange: '01-Apr-2024 to 30-Apr-2024', description: 'Monthly Rent', mode: 'NEFT', type: 'Payment', amount: '25,000', party: 'Office Rent A/c', replaced: 'Rent' },
  { id: 2, account: 'Rahul', dateRange: '15-Apr-2024 to 15-Apr-2024', description: 'Interest Credit', mode: 'RTGS', type: 'Receipt', amount: '1,200', party: 'Bank Interest', replaced: 'Income' },
];

const INBOX_DATA = [
  { id: 1, date: '04-May-2026', description: 'UPI/7331/Payment to Zomato', amount: '450.00', type: 'Payment', party: 'Zomato Ltd' },
  { id: 2, date: '03-May-2026', description: 'NEFT/HDFC/Salary Credit', amount: '85,000.00', type: 'Receipt', party: 'Salary A/c' },
  { id: 3, date: '02-May-2026', description: 'ATM/Cash Withdrawal', amount: '5,000.00', type: 'Contra', party: 'Cash' },
];

const REVIEW_DATA = [
  { id: 1, date: '01-May-2026', description: 'Amazon Web Services / April Bill', amount: '12,400.00', type: 'Payment', party: 'Amazon Web Services', status: 'Pending' },
  { id: 2, date: '30-Apr-2026', description: 'Google Cloud Platform / Storage', amount: '2,100.00', type: 'Payment', party: 'Google Cloud', status: 'Pending' },
];

const ARCHIVE_DATA = [
  { id: 1, date: '15-Mar-2026', description: 'Electricity Bill / March', amount: '4,500.00', type: 'Payment', party: 'Electricity Bill', status: 'Approved' },
  { id: 2, date: '10-Mar-2026', description: 'Office Rent / March', amount: '25,000.00', type: 'Payment', party: 'Office Rent A/c', status: 'Approved' },
];

const BankPanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Manage Bank');
  const [selectedBank, setSelectedBank] = useState('');

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

  const IconButton = ({ icon: Icon, color, onClick }) => {
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
        className="h-8 w-8 rounded-lg border flex items-center justify-center transition-colors focus-ring hover:bg-[var(--app-control-hover)]"
        style={{ borderColor: 'var(--app-border)', color: tone, backgroundColor: 'var(--app-control-bg)' }}
      >
        <Icon size={13} strokeWidth={2.2} />
      </motion.button>
    );
  };

  const TableHead = ({ label, sortable, center, width, borderRight, input }) => (
    <th className={`px-3 py-2.5 border-b text-[10.5px] font-semibold uppercase tracking-wider ${center ? 'text-center' : 'text-left'} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)', backgroundColor: 'var(--app-table-head-bg)', width: width }}>
      <div className={`flex flex-col gap-1.5 ${center ? 'items-center' : ''}`}>
        <div className={`flex items-center gap-1.5 ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
          {label} {sortable && <ArrowUpDown size={11} className="opacity-50" />}
        </div>
        {input && (
          <div className="w-full px-1">
            <input
              type="text"
              className="w-full h-7 border rounded-md px-2 text-[10.5px] outline-none transition-all focus-ring"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
          </div>
        )}
      </div>
    </th>
  );

  const renderManageBank = () => (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300">
      <div className="overflow-x-auto h-full custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#fcfdfe' }}>
              <th className="p-3 border-b border-r w-10 text-center" style={{ borderColor: '#e2e8f0' }}><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 shadow-sm" /></th>
              <TableHead label="Sr No." borderRight width="80px" />
              <TableHead label="Bank Name" borderRight />
              <TableHead label="Account Name" borderRight sortable />
              <TableHead label="Account Number" borderRight sortable />
              <TableHead label="Bank Ledger" borderRight />
              <TableHead label="Action" center width="150px" />
            </tr>
          </thead>
          <tbody>
            {MANAGE_BANK_DATA.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors border-b" style={{ borderColor: '#f1f5f9' }}>
                <td className="p-3 border-r text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600" /></td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600 text-center">{idx + 1}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.bank}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.accountName}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.accountNumber}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.ledger}</td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <IconButton icon={Upload} color="emerald" />
                    <IconButton icon={Edit3} color="emerald" />
                    <IconButton icon={RefreshCw} color="emerald" />
                    <IconButton icon={Trash2} color="red" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderManageRule = () => (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300">
      <div className="overflow-x-auto h-full custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr style={{ backgroundColor: '#fcfdfe' }}>
              <th className="p-3 border-b border-r w-10 text-center" style={{ borderColor: '#e2e8f0' }}><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 shadow-sm" /></th>
              <TableHead label="Sr No." borderRight width="80px" />
              <TableHead label="Account Name" borderRight sortable />
              <TableHead label="Date Range" borderRight sortable />
              <TableHead label="Description" borderRight sortable />
              <TableHead label="Payment Mode" borderRight sortable />
              <TableHead label="Type" borderRight sortable />
              <TableHead label="Amount" borderRight sortable />
              <TableHead label="Party Ledger" borderRight sortable />
              <TableHead label="Replaced Type" borderRight />
              <TableHead label="Action" center width="100px" />
            </tr>
          </thead>
          <tbody>
            {BANK_RULE_DATA.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors border-b" style={{ borderColor: '#f1f5f9' }}>
                <td className="p-3 border-r text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600" /></td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600 text-center">{idx + 1}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.account}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.dateRange}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.description}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.mode}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.type}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.amount}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.party}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.replaced}</td>
                <td className="p-3 text-center">
                  <IconButton icon={Trash2} color="red" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInbox = () => (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300">
      <div className="overflow-x-auto h-full custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#fcfdfe' }}>
              <th className="p-3 border-b border-r w-10 text-center" style={{ borderColor: '#e2e8f0' }}><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 shadow-sm" /></th>
              <TableHead label="Sr No." borderRight width="70px" />
              <TableHead label="Date" borderRight />
              <TableHead label="Description" borderRight input />
              <TableHead label="Amount" borderRight />
              <TableHead label="Type" borderRight />
              <TableHead label="Party Ledger" borderRight input />
              <TableHead label="Info Icon" center width="100px" />
            </tr>
          </thead>
          <tbody>
            {INBOX_DATA.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors border-b" style={{ borderColor: '#f1f5f9' }}>
                <td className="p-3 border-r text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600" /></td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600 text-center">{idx + 1}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.date}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.description}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600 text-right">{row.amount}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.type}</td>
                <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.party}</td>
                <td className="p-3 text-center"><Info size={14} className="text-slate-300 mx-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReviewArchive = () => {
    const data = activeTab === 'Review' ? REVIEW_DATA : ARCHIVE_DATA;
    return (
      <div className="flex-1 flex flex-col animate-in fade-in duration-300">
        <div className="overflow-x-auto h-full custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#fcfdfe' }}>
                <th className="p-3 border-b border-r w-10 text-center" style={{ borderColor: '#e2e8f0' }}><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 shadow-sm" /></th>
                <TableHead label="Sr No." borderRight width="70px" />
                <TableHead label="Date" borderRight />
                <TableHead label="Description" borderRight input />
                <TableHead label="Amount" borderRight />
                <TableHead label="Type" borderRight />
                <TableHead label="Party Ledger" borderRight input />
                <TableHead label="Status" borderRight width="100px" />
                <TableHead label="Info Icon" center width="100px" />
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors border-b" style={{ borderColor: '#f1f5f9' }}>
                  <td className="p-3 border-r text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600" /></td>
                  <td className="p-3 border-r text-[11px] font-bold text-slate-600 text-center">{idx + 1}</td>
                  <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.date}</td>
                  <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.description}</td>
                  <td className="p-3 border-r text-[11px] font-bold text-slate-600 text-right">{row.amount}</td>
                  <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.type}</td>
                  <td className="p-3 border-r text-[11px] font-bold text-slate-600">{row.party}</td>
                  <td className="p-3 border-r text-[11px] font-bold text-slate-600 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${row.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-center"><Info size={14} className="text-slate-300 mx-auto" /></td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-32 text-center bg-white">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">No Bank Transaction Found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
        <input type="text" placeholder="Bank Name" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-blue-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
        <SearchableDropdown placeholder="Bank Ledger" items={BANK_LEDGERS} isSmall />
      </FilterDrawer>}
      {isAddBankLedgerOpen && <AddLedgerModal title="Add Bank Ledger" type="Bank" onClose={() => setIsAddBankLedgerOpen(false)} />}

      {/* Popups for Bank Rule */}
      {isAddRuleOpen && <AddRuleModal onClose={() => setIsAddRuleOpen(false)} />}
      {isBulkUploadRulesOpen && <BulkUploadRulesModal onClose={() => setIsBulkUploadRulesOpen(false)} />}
      {isRuleFilterOpen && <FilterDrawer title="Filter" onClose={() => setIsRuleFilterOpen(false)}>
        <SearchableDropdown placeholder="Account Number" items={ACCOUNT_NUMBERS} isSmall />
        <div className="flex gap-2">
          <div className="flex-1 relative"><input type="text" placeholder="From Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} /></div>
          <div className="flex-1 relative"><input type="text" placeholder="To Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} /></div>
        </div>
        <input type="text" placeholder="Description" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} />
        <SearchableDropdown placeholder="Payment Mode" items={PAYMENT_MODES} isSmall />
        <SearchableDropdown placeholder="Type" items={TRANSACTION_TYPES} isSmall />
        <div className="flex gap-2">
          <input type="text" placeholder="From Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} />
          <input type="text" placeholder="To Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} />
        </div>
        <SearchableDropdown placeholder="Party Ledger" items={PARTY_LEDGERS} isSmall />
      </FilterDrawer>}
      {isAddPartyLedgerOpen && <AddLedgerModal title="Add Party Ledger" type="Party" onClose={() => setIsAddPartyLedgerOpen(false)} />}

      {/* Shared Modals */}
      {isColumnConfigOpen && <ColumnConfigPopup onClose={() => setIsColumnConfigOpen(false)} activeTab={activeTab} />}
      {isInboxFilterOpen && <FilterDrawer title="Inbox Filter" onClose={() => setIsInboxFilterOpen(false)}>
        <input type="text" placeholder="Description" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none focus:border-blue-400" style={{ borderColor: '#e2e8f0' }} />
        <div className="flex gap-2">
          <input type="text" placeholder="From Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: '#e2e8f0' }} />
          <input type="text" placeholder="To Amount" className="flex-1 h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: '#e2e8f0' }} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative"><input type="text" placeholder="From Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: '#e2e8f0' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} /></div>
          <div className="flex-1 relative"><input type="text" placeholder="To Date" className="w-full h-8 border rounded-lg px-3 text-[11px] font-bold outline-none" style={{ borderColor: '#e2e8f0' }} /><Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} /></div>
        </div>
      </FilterDrawer>}

      {/* Header */}
      <div className="rounded-xl border p-3.5 shrink-0" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ background: 'var(--app-accent-gradient)' }}>
            <Landmark size={18} strokeWidth={2.2} />
          </div>
          <h1 className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--app-heading)' }}>
            {activeTab === 'Manage Bank' ? 'Bank Main' :
              activeTab === 'Manage Rule' ? 'Bank Rule' :
                activeTab === 'Inbox' ? 'Bank Inbox' :
                  activeTab === 'Review' ? 'Bank Review' :
                    activeTab === 'Archive' ? 'Bank Archive' : 'Bank'}
          </h1>

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

      <div className="flex-1 overflow-hidden rounded-xl border flex flex-col"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
        {activeTab === 'Manage Bank' && renderManageBank()}
        {activeTab === 'Manage Rule' && renderManageRule()}
        {activeTab === 'Inbox' && renderInbox()}
        {activeTab === 'Review' && renderReviewArchive()}
        {activeTab === 'Archive' && renderReviewArchive()}
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
      {label && <span className={`absolute -top-2 left-3 bg-white px-1 font-bold text-slate-400 z-10 ${isSmall ? 'text-[9px]' : 'text-[10px]'}`}>{label}</span>}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border rounded-xl px-4 flex items-center justify-between bg-white cursor-pointer transition-all shadow-sm ${isOpen ? 'border-blue-400 ring-4 ring-blue-500/5' : 'border-[#e2e8f0] hover:border-slate-300'} ${isSmall ? 'h-8 rounded-lg px-3' : 'h-11'}`}
      >
        <span className={`font-bold truncate ${value ? 'text-slate-700' : 'text-slate-400'} ${isSmall ? 'text-[11px]' : 'text-[13px]'}`}>
          {value || placeholder}
        </span>
        <ChevronDown className={`text-slate-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={isSmall ? 14 : 16} />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[500] overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 border rounded-lg pl-8 pr-3 text-[12px] font-medium outline-none focus:border-blue-300 transition-all"
                style={{ borderColor: '#e2e8f0' }}
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar no-scrollbar">
            {filtered.length > 0 ? (
              filtered.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (onChange) onChange(item);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-4 py-2.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors border-b last:border-0 border-slate-50 flex items-center justify-between ${value === item ? 'bg-blue-50/50 text-blue-600' : ''}`}
                >
                  {item}
                  {value === item && <Check size={14} />}
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-[12px] font-medium text-slate-400 italic">No results found</div>
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
      <div className="absolute top-4 right-4 w-[280px] bg-white rounded-2xl shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col animate-in slide-in-from-right-10 duration-300 max-h-[calc(100vh-32px)]">
        <div className="p-3.5 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[14px] font-black text-blue-600 tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
          {children}
        </div>

        <div className="p-4 border-t bg-slate-50/30 flex items-center justify-between gap-3">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-red-200 bg-white text-red-500 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-red-50 shadow-sm">
            Clear
          </button>
          <button className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95">
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
      <div className="relative w-[750px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-[18px] font-black text-blue-600 tracking-tight">Add Bank</h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
              <FileText size={16} />
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={22} /></button>
          </div>
        </div>

        <div className="px-10 pb-10 space-y-8">
          <div className="h-[200px] w-full bg-blue-50/30 rounded-2xl flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <ClipboardList size={200} className="text-blue-500" />
            </div>
            <div className="relative z-10 bg-white p-6 rounded-xl shadow-xl border border-blue-50 flex flex-col items-center gap-3 w-40">
              <ClipboardList size={40} className="text-slate-600" />
              <div className="space-y-2 w-full">
                <div className="h-1.5 w-full bg-slate-100 rounded" />
                <div className="h-1.5 w-4/5 bg-slate-100 rounded" />
                <div className="h-1.5 w-full bg-slate-100 rounded" />
              </div>
              <div className="absolute -right-4 top-4 flex flex-col gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-4 h-4 rounded bg-orange-100 flex items-center justify-center"><Check size={10} className="text-orange-500" /></div>
                ))}
              </div>
            </div>
            <div className="absolute left-10 bottom-0 w-16 h-32 bg-blue-200/40 rounded-t-full" />
            <div className="absolute right-10 bottom-0 w-12 h-24 bg-blue-200/40 rounded-t-full" />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <SearchableDropdown placeholder="Bank" items={BANKS} value={bank} onChange={setBank} />
            <SearchableDropdown placeholder="Bank Ledger" items={BANK_LEDGERS} value={ledger} onChange={setLedger} />
            <input type="text" placeholder="Account Name" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm hover:border-slate-300 transition-colors" style={{ borderColor: '#e2e8f0' }} />
            <input type="text" placeholder="Account Number" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm hover:border-slate-300 transition-colors" style={{ borderColor: '#e2e8f0' }} />
          </div>

          <div className="flex justify-center">
            <button className="bg-blue-600 text-white px-12 py-2.5 rounded-lg text-[14px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 hover:scale-105 active:scale-95">
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
      <div className="relative w-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-blue-600 tracking-tight">Upload Statement</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <SearchableDropdown label="Bank *" items={BANKS} value={bank} onChange={setBank} />

            <div className="relative">
              <input type="text" placeholder="Date Range" className="w-full h-12 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm hover:border-slate-300 transition-colors" style={{ borderColor: '#e2e8f0' }} />
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            </div>
          </div>

          <div className="text-center space-y-1.5 py-2">
            <p className="text-[12px] font-black text-red-500 tracking-tight">Header in file must be Present*</p>
            <p className="text-[12px] font-black text-red-500 tracking-tight">File processing may take upto 30 mins*</p>
            <p className="text-[12px] font-black text-red-500 tracking-tight">Document should be no more than 40 pages and 30 MB in size*</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 py-8 bg-slate-50/30 rounded-2xl border border-slate-100">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm group cursor-pointer hover:scale-110 transition-transform">
              <CloudUpload size={32} className="text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <button className="text-[13px] font-bold text-slate-600 hover:text-blue-600 transition-colors">Click here to Choose Files</button>
            <div className="w-4/5 mt-4">
              <div className="h-28 border-2 border-dashed border-blue-200 rounded-2xl flex items-center justify-center bg-white shadow-inner">
                <span className="text-[13px] font-bold text-slate-300 italic">Drag and drop files here</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button className="bg-blue-600 text-white px-12 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95">
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
      <div className="relative w-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-[18px] font-black text-blue-600 tracking-tight">Add Rule</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={22} /></button>
        </div>

        <div className="px-10 pb-10 space-y-6">
          <div className="h-[180px] w-full bg-blue-50/30 rounded-2xl flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-5">
              <ClipboardList size={180} className="text-blue-500" />
            </div>
            <div className="relative z-10 bg-white p-5 rounded-xl shadow-xl border border-blue-50 flex flex-col items-center gap-2 w-36">
              <ClipboardList size={32} className="text-slate-600" />
              <div className="space-y-1.5 w-full">
                <div className="h-1 w-full bg-slate-100 rounded" />
                <div className="h-1 w-4/5 bg-slate-100 rounded" />
              </div>
              <div className="absolute -right-3 top-3 flex flex-col gap-1.5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-3 h-3 rounded bg-orange-100 flex items-center justify-center"><Check size={8} className="text-orange-500" /></div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-[13px] font-black text-blue-600 uppercase tracking-widest mb-4">Conditional Field</h3>
              <div className="grid grid-cols-3 gap-4">
                <SearchableDropdown placeholder="Account Number" items={ACCOUNT_NUMBERS} value={account} onChange={setAccount} />
                <div className="relative">
                  <input type="text" placeholder="Voucher Date" className="w-full h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                </div>
                <input type="text" placeholder="Description" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
                <SearchableDropdown placeholder="Payment Mode" items={PAYMENT_MODES} value={payMode} onChange={setPayMode} />
                <SearchableDropdown placeholder="Type" items={TRANSACTION_TYPES} value={type} onChange={setType} />
                <input type="text" placeholder="Amount(Min)" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
                <input type="text" placeholder="Amount(Max)" className="h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-black text-blue-600 uppercase tracking-widest mb-4 border-t pt-4" style={{ borderColor: '#f1f5f9' }}>Action Field</h3>
              <div className="grid grid-cols-2 gap-4">
                <SearchableDropdown placeholder="Replaced Type" items={REPLACED_TYPES} value={replacedType} onChange={setReplacedType} />
                <SearchableDropdown placeholder="Party Ledger" items={PARTY_LEDGERS} value={partyLedger} onChange={setPartyLedger} />
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button className="bg-blue-600 text-white px-14 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95">
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
      <div className="relative w-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-blue-600 tracking-tight">Bulk Upload Bank Rules</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-10 space-y-8">
          <div className="text-center space-y-1.5">
            <p className="text-[13px] font-bold text-blue-400">Supported formats: .xlsx, .xls</p>
            <p className="text-[13px] font-bold text-blue-400">Maximum file size: 10 MB</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 py-10 bg-slate-50/30 rounded-2xl border border-slate-100">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm group cursor-pointer hover:scale-110 transition-transform">
              <CloudUpload size={32} className="text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <button className="text-[13px] font-bold text-slate-600 hover:text-blue-600 transition-colors">Click here to Choose File</button>
            <div className="w-[90%] mt-4">
              <div className="h-28 border-2 border-dashed border-blue-200 rounded-2xl flex items-center justify-center bg-white">
                <span className="text-[13px] font-bold text-slate-300">Drag and drop file here</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button className="bg-blue-400 text-white px-12 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl shadow-blue-50 transition-all hover:bg-blue-500 active:scale-95">
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
      <div className="relative w-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b border-slate-50">
          <h2 className="text-[16px] font-black text-blue-600 tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-10 space-y-8">
          <div className="flex gap-6 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Ledger Name"
                className="w-full h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm hover:border-slate-300 transition-colors"
                style={{ borderColor: '#e2e8f0' }}
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
                  className="w-full h-11 border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-blue-400 shadow-sm"
                  style={{ borderColor: '#e2e8f0' }}
                />
              </div>
              <div className="flex-1 flex items-center gap-3 bg-blue-50/30 p-2.5 rounded-xl border border-blue-100/50">
                <input type="checkbox" id="maintainBill" className="w-5 h-5 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                <label htmlFor="maintainBill" className="text-[12px] font-black text-slate-600 cursor-pointer whitespace-nowrap">Maintain Balance Bill by Bill</label>
              </div>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button className="bg-blue-600 text-white px-16 py-2.5 rounded-lg text-[13px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95">
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
      <div className="relative w-[400px] bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[15px] font-black text-slate-700 tracking-tight">Configure Columns</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          {['Date', 'Description', 'Amount', 'Type', 'Party Ledger', 'Status'].map(col => (
            <label key={col} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 accent-blue-600 shadow-sm" />
              <span className="text-[13px] font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{col}</span>
            </label>
          ))}
        </div>
        <div className="p-4 border-t bg-slate-50/30 flex justify-end">
          <button onClick={onClose} className="bg-blue-600 text-white px-8 py-2 rounded-lg text-[12px] font-black uppercase tracking-widest">Apply</button>
        </div>
      </div>
    </div>
  );
};

export default BankPanel;
