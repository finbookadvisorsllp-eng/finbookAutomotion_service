import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashBankDataV2 } from '../../data/cashBankDataV2';
import { formatINR } from '../../data/mockData';
import { ArrowLeft, Download, Printer, Filter, Eye } from 'lucide-react';

export default function LedgerDetail({ ledgerId, yearId }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('party'); // 'party', 'voucher', 'summary'

  const ledgerData = cashBankDataV2.ledgers[ledgerId];

  if (!ledgerData) return <div className="p-8 text-center text-slate-500">Ledger details not found.</div>;

  const navigateBack = () => {
    navigate('/cash-bank');
  };

  const navigateToVoucher = (voucherId) => {
    navigate(`/cash-bank?voucherId=${voucherId}&year=${yearId}`);
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-screen pb-10 space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between bg-white dark:bg-slate-800 py-4 px-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-4">
        <div className="flex items-start gap-4">
          <button onClick={navigateBack} className="mt-0.5 p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 rounded transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">{ledgerData.name}</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded">
                {ledgerData.type}
              </span>
            </div>
            <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
              Opening Balance: <span className="text-slate-700 dark:text-slate-300">{formatINR(ledgerData.openingBalance)} {ledgerData.openingBalance > 0 ? 'Dr' : ''}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex items-center gap-1.5 px-3 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Filter size={14} /> Filters
          </button>
          <button className="flex items-center gap-1.5 px-3 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-1.5 px-3 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Printer size={14} /> Print
          </button>
          <button className="flex items-center gap-1.5 px-4 h-8 bg-blue-600 border border-blue-600 rounded text-[11px] font-bold text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/30">
            View Statement
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-6 px-2 border-b border-slate-200 dark:border-slate-700">
        <button 
          onClick={() => setActiveTab('party')}
          className={`pb-2 text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'party' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Party Wise
        </button>
        <button 
          onClick={() => setActiveTab('voucher')}
          className={`pb-2 text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'voucher' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Voucher Wise
        </button>
        <button 
          onClick={() => setActiveTab('summary')}
          className={`pb-2 text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'summary' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Monthly Summary
        </button>
      </div>

      {/* ── Content ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          
          {activeTab === 'party' && (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 h-10">
                  <th className="font-semibold px-4 w-[100px]">Date</th>
                  <th className="font-semibold px-4">Particulars / Party Name</th>
                  <th className="font-semibold px-4 w-[120px]">Voucher Type</th>
                  <th className="font-semibold px-4 w-[120px]">Voucher No.</th>
                  <th className="font-semibold px-4 w-[120px]">Cheq/Ref No.</th>
                  <th className="font-semibold px-4 text-right w-[140px]">Receipts (₹)</th>
                  <th className="font-semibold px-4 text-right w-[140px]">Payments (₹)</th>
                  <th className="font-semibold px-4 text-right w-[150px]">Balance (₹)</th>
                  <th className="font-semibold px-4 w-[60px] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                <tr className="bg-blue-50/30 dark:bg-slate-800/80">
                   <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">01/04/2024</td>
                   <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">Opening Balance</td>
                   <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">Journal</td>
                   <td className="px-4 py-2.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400">JV-1</td>
                   <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">-</td>
                   <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 text-right">-</td>
                   <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 text-right">-</td>
                   <td className="px-4 py-2.5 text-[12px] font-bold text-blue-600 dark:text-blue-400 text-right tabular-nums">{formatINR(ledgerData.openingBalance)} Dr</td>
                   <td className="px-4 py-2.5 text-center text-slate-400">-</td>
                </tr>
                {ledgerData.transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 group">
                    <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{tx.date}</td>
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">{tx.party}</td>
                    <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{tx.type}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => navigateToVoucher(tx.id)} className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        {tx.no}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{tx.ref}</td>
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                      {tx.receipts > 0 ? formatINR(tx.receipts) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-red-600 dark:text-red-400 text-right tabular-nums">
                      {tx.payments > 0 ? formatINR(tx.payments) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-bold text-blue-600 dark:text-blue-400 text-right tabular-nums">
                      {formatINR(tx.running)} Dr
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => navigateToVoucher(tx.id)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700 h-11">
                  <td colSpan="5" className="px-4 font-black text-[13px] text-slate-900 dark:text-white">Total</td>
                  <td className="px-4 text-right font-black text-[12px] text-slate-900 dark:text-white tabular-nums">
                    {formatINR(ledgerData.transactions.reduce((sum, tx) => sum + tx.receipts, 0))}
                  </td>
                  <td className="px-4 text-right font-black text-[12px] text-slate-900 dark:text-white tabular-nums">
                    {formatINR(ledgerData.transactions.reduce((sum, tx) => sum + tx.payments, 0))}
                  </td>
                  <td className="px-4 text-right font-black text-[13px] text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatINR(ledgerData.currentBalance)} Dr
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}

          {activeTab === 'voucher' && (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 h-10">
                  <th className="font-semibold px-5">Date</th>
                  <th className="font-semibold px-5">Voucher Type</th>
                  <th className="font-semibold px-5">Voucher Number</th>
                  <th className="font-semibold px-5 text-right">Amount (₹)</th>
                  <th className="font-semibold px-5 w-[80px] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {ledgerData.transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 group">
                    <td className="px-5 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-300">{tx.date}</td>
                    <td className="px-5 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-300">{tx.type}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => navigateToVoucher(tx.id)} className="text-[12px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                        {tx.no}
                      </button>
                    </td>
                    <td className={`px-5 py-3 text-[12px] font-bold text-right tabular-nums ${tx.receipts > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatINR(tx.receipts || tx.payments)} {tx.receipts > 0 ? '(Dr)' : '(Cr)'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => navigateToVoucher(tx.id)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'summary' && (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 h-10">
                  <th className="font-semibold px-5">Month</th>
                  <th className="font-semibold px-5 text-right">Opening Balance</th>
                  <th className="font-semibold px-5 text-right">Receipts</th>
                  <th className="font-semibold px-5 text-right">Payments</th>
                  <th className="font-semibold px-5 text-right">Closing Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {ledgerData.monthly.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 text-[12px] font-bold text-slate-700 dark:text-slate-300">{m.month}</td>
                    <td className="px-5 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-400 text-right tabular-nums">{formatINR(m.opening)}</td>
                    <td className="px-5 py-3 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">{formatINR(m.receipts)}</td>
                    <td className="px-5 py-3 text-[12px] font-semibold text-red-600 dark:text-red-400 text-right tabular-nums">{formatINR(m.payments)}</td>
                    <td className="px-5 py-3 text-[12px] font-bold text-blue-600 dark:text-blue-400 text-right tabular-nums">{formatINR(m.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      </div>
      
    </div>
  );
}
