import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashBankDataV2 } from '../../data/cashBankDataV2';
import { formatINR } from '../../data/mockData';
import { ChevronLeft, ChevronRight, Download, Landmark, CircleDollarSign, ArrowUpRight, ArrowDownRight, Eye, CreditCard, ChevronRight as ChevronRightIcon, X } from 'lucide-react';

const AccountSpecsModal = ({ account, onClose, onViewLedger }) => {
  if (!account) return null;

  const isBank = (account.type || account._assumedType || '').toLowerCase().includes('bank');

  const specs = isBank ? [
    { label: 'Account Number', value: `XXXX-XXXX-${(account.id || '').replace(/[^0-9]/g, '').substring(0, 4) || '4021'}` },
    { label: 'Branch / IFSC', value: 'Main Branch / HDFC0001234' },
    { label: 'Account Status', value: 'Active', isBadge: true },
    { label: 'Last Reconciled', value: '01 Jun 2026' },
    { label: 'Relationship Manager', value: 'Jane Smith' },
  ] : [
    { label: 'Custodian', value: 'Finance Department' },
    { label: 'Location', value: 'Head Office' },
    { label: 'Account Status', value: 'Active', isBadge: true },
    { label: 'Cash Limit', value: '₹ 5,00,000' },
    { label: 'Last Audit Date', value: '15 May 2026' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {isBank ? <Landmark size={18} className="text-blue-500" /> : <CircleDollarSign size={18} className="text-emerald-500" />}
            {account.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Account Specifications</p>
          <div className="grid grid-cols-1 gap-3">
            {specs.map((spec, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700">
                <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{spec.label}</span>
                {spec.isBadge ? (
                  <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md">
                    {spec.value}
                  </span>
                ) : (
                  <span className="text-[13px] font-bold text-slate-900 dark:text-white">{spec.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-[13px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Close
          </button>
          <button onClick={() => { onClose(); onViewLedger(account.id); }} className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
            View Ledger <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CashBankDashboard() {
  const navigate = useNavigate();
  const [currentYearIndex, setCurrentYearIndex] = useState(1); // Default to 2024-2025
  const [selectedAccountForModal, setSelectedAccountForModal] = useState(null);

  const currentYear = cashBankDataV2.years[currentYearIndex];
  const dashboardData = cashBankDataV2.dashboard[currentYear.id];

  const handlePrevYear = () => {
    if (currentYearIndex > 0) setCurrentYearIndex(prev => prev - 1);
  };

  const handleNextYear = () => {
    if (currentYearIndex < cashBankDataV2.years.length - 1) setCurrentYearIndex(prev => prev + 1);
  };

  if (!dashboardData) return <div className="p-8 text-center text-slate-500">No data available for this financial year.</div>;

  const { summary, cashAccounts, bankAccounts, recentTransactions, allAccounts } = dashboardData;

  const navigateToLedger = (id) => {
    navigate(`/cash-bank?ledgerId=${id}&year=${currentYear.id}`);
  };

  const navigateToVoucher = (id) => {
    navigate(`/cash-bank?voucherId=${id}&year=${currentYear.id}`);
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-screen pb-10 space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between glass-card py-3 px-4 gap-3 border-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
            <Landmark size={22} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-[#ffffff]">Cash & Bank</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Year Selector */}
          <div className="flex items-center glass-card h-9 overflow-hidden">
            <button onClick={handlePrevYear} disabled={currentYearIndex === 0} className="px-2 h-full text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors border-r border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <div className="px-3 text-[12px] font-bold text-slate-800 dark:text-slate-200 flex items-center h-full min-w-[170px] justify-center">
              {currentYear.label}
            </div>
            <button onClick={handleNextYear} disabled={currentYearIndex === cashBankDataV2.years.length - 1} className="px-2 h-full text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors border-l border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 h-9 glass-card text-[12px] font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 transition-colors">
            <Download size={14} className="text-slate-600 dark:text-slate-400" />
            Export
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Cash in Hand */}
        <div className="bg-blue-50 dark:bg-blue-500/10 p-5 rounded-xl border border-blue-100 dark:border-blue-500/20 flex justify-between items-end">
          <div className="flex flex-col">
            <p className="text-[13px] font-bold text-blue-600 dark:text-blue-400 mb-2">Cash in Hand</p>
            <p className="text-[26px] font-black text-slate-900 dark:text-[#ffffff] tracking-tight leading-none mb-2">{formatINR(summary.cashInHand)}</p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-700">vs Previous Year <span className="text-slate-700 dark:text-slate-700 font-bold tracking-tight">₹ 1,95,420.00</span></p>
          </div>
          <div className="w-[22px] h-[22px] rounded-full border border-emerald-500 flex-shrink-0 flex items-center justify-center text-emerald-500 bg-white dark:bg-slate-800 shadow-sm mb-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
          </div>
        </div>

        {/* Card 2: Bank Accounts Balance */}
        <div className="bg-emerald-50 dark:bg-[#B6FF00]/10 p-5 rounded-xl border border-emerald-100 dark:border-[#B6FF00]/20 flex justify-between items-end">
          <div className="flex flex-col">
            <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 mb-2">Bank Accounts Balance</p>
            <p className="text-[26px] font-black text-slate-900 dark:text-[#ffffff] tracking-tight leading-none mb-2">{formatINR(summary.bankBalance)}</p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-700">vs Previous Year <span className="text-slate-700 dark:text-slate-700 font-bold tracking-tight">₹ 15,60,290.00</span></p>
          </div>
          <div className="w-[22px] h-[22px] rounded-full border border-emerald-500 flex-shrink-0 flex items-center justify-center text-emerald-500 bg-white dark:bg-slate-800 shadow-sm mb-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
          </div>
        </div>

        {/* Card 3: Total Cash & Bank Balance */}
        <div className="bg-purple-50 dark:bg-purple-500/10 p-5 rounded-xl border border-purple-100 dark:border-purple-500/20 flex justify-between items-end">
          <div className="flex flex-col">
            <p className="text-[13px] font-bold text-purple-600 dark:text-purple-400 mb-2">Total Cash & Bank Balance</p>
            <p className="text-[26px] font-black text-slate-900 dark:text-[#ffffff] tracking-tight leading-none mb-2">{formatINR(summary.totalBalance)}</p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-700">vs Previous Year <span className="text-slate-700 dark:text-slate-700 font-bold tracking-tight">₹ 17,55,710.00</span></p>
          </div>
          <div className="w-[22px] h-[22px] rounded-full border border-emerald-500 flex-shrink-0 flex items-center justify-center text-emerald-500 bg-white dark:bg-slate-800 shadow-sm mb-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
          </div>
        </div>

        {/* Card 4: Today's Receipts */}
        <div className="glass-card p-4 flex justify-between items-center">
          <div className="flex flex-col">
            <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">Total Receipts</p>
            <p className="text-xl font-black text-black dark:text-[#ffffff] tracking-tight">{formatINR(summary.todaysReceipts)}</p>
          </div>
          <ArrowDownRight size={20} className="text-slate-400" />
        </div>

        {/* Card 5: Today's Payments */}
        <div className="glass-card p-4 flex justify-between items-center">
          <div className="flex flex-col">
            <p className="text-[12px] font-bold text-red-600 dark:text-red-400 mb-1">Total Payments</p>
            <p className="text-xl font-black text-black dark:text-[#ffffff] tracking-tight">{formatINR(summary.todaysPayments)}</p>
          </div>
          <ArrowUpRight size={20} className="text-slate-400" />
        </div>

        {/* Card 6: Pending Cheques */}
        <div className="glass-card p-4 flex justify-between items-center">
          <div className="flex flex-col">
            <p className="text-[12px] font-bold text-amber-600 dark:text-amber-400 mb-1"> Net Amount</p>
            <p className="text-xl font-black text-black dark:text-[#ffffff] tracking-tight">{formatINR(summary.pendingCheques)}</p>
          </div>
          <CreditCard size={20} className="text-slate-400" />
        </div>
      </div>

      {/* ── Mid Section: Cash, Bank, Transactions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Cash Accounts */}
        <div className="glass-card flex flex-col">
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <CircleDollarSign size={16} className="text-slate-400" />
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-[#ffffff]">Cash Accounts</h2>
          </div>
          <div className="flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] text-slate-500 dark:text-slate-700 border-b border-slate-100">
                  <th className="font-semibold py-2 px-3">Account Name</th>
                  <th className="font-semibold py-2 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashAccounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <button onClick={() => setSelectedAccountForModal({ ...acc, _assumedType: 'Cash' })} className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left">
                        {acc.name}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] font-bold text-slate-700 dark:text-slate-700 text-right tabular-nums">
                      {formatINR(acc.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-xl">
            <span className="text-[12px] font-bold text-slate-800 dark:text-[#ffffff]">Total</span>
            <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">{formatINR(summary.cashInHand)}</span>
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="glass-card flex flex-col">
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <Landmark size={16} className="text-slate-400" />
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-[#ffffff]">Bank Accounts</h2>
          </div>
          <div className="flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] text-slate-500 dark:text-slate-700 border-b border-slate-100">
                  <th className="font-semibold py-2 px-3">Account Name</th>
                  <th className="font-semibold py-2 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bankAccounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <button onClick={() => setSelectedAccountForModal({ ...acc, _assumedType: 'Bank' })} className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left">
                        {acc.name}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] font-bold text-slate-700 dark:text-slate-700 text-right tabular-nums">
                      {formatINR(acc.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-xl">
            <span className="text-[12px] font-bold text-slate-800 dark:text-[#ffffff]">Total</span>
            <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">{formatINR(summary.bankBalance)}</span>
          </div>
        </div>

        {/* Top 5 Transactions */}
        <div className="glass-card flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-[#ffffff]">Recent Transactions</h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[350px]">
              <thead>
                <tr className="bg-slate-50 text-[11px] text-slate-500 dark:text-slate-700 border-b border-slate-100">
                  <th className="font-semibold py-2 px-3">Date</th>
                  <th className="font-semibold py-2 px-3">Particulars</th>
                  <th className="font-semibold py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-[11px] font-medium text-slate-500 dark:text-slate-700 whitespace-nowrap">{tx.date}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => navigateToVoucher(tx.id)} className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left line-clamp-1">
                        {tx.party}
                      </button>
                    </td>
                    <td className={`py-2 px-3 text-[12px] font-bold text-right tabular-nums ${tx.type === 'Receipt' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatINR(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── All Accounts Summary Table ── */}
      <div className="glass-card overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-slate-900 dark:text-[#ffffff]">All Cash & Bank Accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] text-slate-500 dark:text-slate-700 border-b border-slate-100 h-9">
                <th className="font-semibold px-4 w-[250px]">Account Name</th>
                <th className="font-semibold px-4 w-[100px]">Type</th>
                <th className="font-semibold px-4 text-right">Opening Balance</th>
                <th className="font-semibold px-4 text-right">Receipts</th>
                <th className="font-semibold px-4 text-right">Payments</th>
                <th className="font-semibold px-4 text-right">Closing Balance</th>
                <th className="font-semibold px-4 w-[60px] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allAccounts.map(acc => (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-2.5">
                    <button onClick={() => setSelectedAccountForModal(acc)} className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left">
                      {acc.name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-700">{acc.type}</td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-slate-700 dark:text-slate-700 text-right tabular-nums">{formatINR(acc.opening)}</td>
                  <td className="px-4 py-2.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">{formatINR(acc.receipts)}</td>
                  <td className="px-4 py-2.5 text-[12px] font-semibold text-red-600 dark:text-red-400 text-right tabular-nums">{formatINR(acc.payments)}</td>
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-900 dark:text-[#ffffff] text-right tabular-nums">{formatINR(acc.closing)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => navigateToLedger(acc.id)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Specifications Modal */}
      <AccountSpecsModal
        account={selectedAccountForModal}
        onClose={() => setSelectedAccountForModal(null)}
        onViewLedger={navigateToLedger}
      />

    </div>
  );
}
