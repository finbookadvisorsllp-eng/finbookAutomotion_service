import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashBankData } from '../data/cashBankData';
import { formatINR } from '../data/mockData';
import { ChevronLeft, ChevronRight, Download, Landmark, CircleDollarSign } from 'lucide-react';

export default function CashBank({ type }) {
  const navigate = useNavigate();
  const [currentYearIndex, setCurrentYearIndex] = useState(1); // Default to 2024-2025

  const currentYear = cashBankData.years[currentYearIndex];
  const yearData = cashBankData.data[currentYear.id][type];

  const handlePrevYear = () => {
    if (currentYearIndex > 0) setCurrentYearIndex(prev => prev - 1);
  };

  const handleNextYear = () => {
    if (currentYearIndex < cashBankData.years.length - 1) setCurrentYearIndex(prev => prev + 1);
  };

  const isBank = type === 'bank';
  const title = isBank ? 'Bank Accounts' : 'Cash Accounts';
  const Icon = isBank ? Landmark : CircleDollarSign;

  return (
    <div className="animate-fade-in flex flex-col min-h-screen pb-10">
      
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 py-3 px-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
            <Icon size={22} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg h-9 overflow-hidden">
            <button 
              onClick={handlePrevYear}
              disabled={currentYearIndex === 0}
              className="px-2 h-full text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors border-r border-slate-200 dark:border-slate-700 flex items-center justify-center"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <div className="px-3 text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center h-full min-w-[180px] justify-center">
              {currentYear.label}
            </div>
            <button 
              onClick={handleNextYear}
              disabled={currentYearIndex === cashBankData.years.length - 1}
              className="px-2 h-full text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors border-l border-slate-200 dark:border-slate-700 flex items-center justify-center"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          <button className="flex items-center gap-2 px-3 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Download size={14} className="text-red-600" />
            PDF
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Opening</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">{formatINR(yearData.totalOpening)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Inflow (Dr)</p>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatINR(yearData.totalDebit)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Outflow (Cr)</p>
          <p className="text-lg font-black text-red-600 dark:text-red-400">{formatINR(yearData.totalCredit)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Closing</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{formatINR(yearData.totalClosing)}</p>
        </div>
      </div>

      {/* ── Ledger Table ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#f4f7fb] dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[12px] font-bold text-slate-600 dark:text-slate-300 h-10">
                <th className="px-5">Account Name</th>
                <th className="px-5 text-right w-[160px]">Opening Bal.</th>
                <th className="px-5 text-right w-[160px]">Debit (In)</th>
                <th className="px-5 text-right w-[160px]">Credit (Out)</th>
                <th className="px-5 text-right w-[160px]">Closing Bal.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {yearData.accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <button 
                      className={`text-[13px] font-semibold text-left transition-colors cursor-pointer text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300`}
                      onClick={(e) => {
                        e.stopPropagation();
                        // This uses the existing P&L drilldown flow for consistency, 
                        // you can update this later if you create a specific cash/bank drilldown page.
                        navigate(`/reports/pl?ledger=${acc.id}&year=${currentYear.id}&from=${isBank ? 'bank' : 'cash'}`);
                      }}
                    >
                      {acc.name}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right tabular-nums">
                    {formatINR(acc.opening)}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right tabular-nums">
                    {formatINR(acc.debit)}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right tabular-nums">
                    {formatINR(acc.credit)}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                    {formatINR(acc.closing)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700 h-11">
                <td className="px-5 font-black text-[13px] text-slate-900 dark:text-white">
                  Grand Total
                </td>
                <td className="px-5 text-right font-black text-[13px] text-slate-900 dark:text-white tabular-nums">
                  {formatINR(yearData.totalOpening)}
                </td>
                <td className="px-5 text-right font-black text-[13px] text-slate-900 dark:text-white tabular-nums">
                  {formatINR(yearData.totalDebit)}
                </td>
                <td className="px-5 text-right font-black text-[13px] text-slate-900 dark:text-white tabular-nums">
                  {formatINR(yearData.totalCredit)}
                </td>
                <td className="px-5 text-right font-black text-[13px] text-slate-900 dark:text-white tabular-nums">
                  {formatINR(yearData.totalClosing)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
    </div>
  );
}
