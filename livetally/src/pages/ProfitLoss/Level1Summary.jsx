import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '../../data/mockData';

export default function Level1Summary({ data }) {
  const [, setSearchParams] = useSearchParams();
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 px-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-[13px] font-bold text-slate-800 dark:text-white">Detailed Breakdown</h2>
        <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          📄 View PDF
        </button>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 font-bold text-[12px] dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 px-4 font-bold">Particulars</th>
              <th className="py-2 px-4 font-bold text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.particulars.map(row => (
              <React.Fragment key={row.id}>
                {/* Main Row */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-700/50">
                  <td className="py-1.5 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (row.id === 'closing-stock') setSearchParams({ ledger: 'stock-hand-closing' });
                          else if (row.id === 'opening-stock') setSearchParams({ ledger: 'stock-hand' });
                          else toggleRow(row.id);
                        }}
                        className={`font-medium flex items-center gap-1.5 text-[12px] ${
                          row.id === 'closing-stock' || row.id === 'opening-stock'
                            ? 'text-blue-600 dark:text-blue-400 hover:underline'
                            : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}
                      >
                        {row.name}
                        <span className="text-slate-400 font-normal text-[10px]">({row.sign})</span>
                      </button>
                    </div>
                  </td>
                  <td className="py-1.5 px-4 text-right">
                    <button
                      onClick={() => {
                        if (row.id === 'closing-stock') setSearchParams({ ledger: 'stock-hand-closing' });
                        else if (row.id === 'opening-stock') setSearchParams({ ledger: 'stock-hand' });
                        else toggleRow(row.id);
                      }}
                      className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 w-full"
                    >
                      {formatINR(row.amount)}
                      {row.id !== 'closing-stock' && row.id !== 'opening-stock' && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${expandedRows[row.id] ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
                      )}
                    </button>
                  </td>
                </tr>

                {/* Sub-table (Inline Expansion) */}
                {expandedRows[row.id] && row.ledgers.length > 0 && (
                  <tr>
                    <td colSpan="2" className="p-0 border-b border-slate-100 dark:border-slate-700/50">
                      <div className="bg-slate-50/80 dark:bg-slate-900/30 w-full overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                              <th className="py-1 px-4 w-1/2">Particulars</th>
                              <th className="py-1 px-4 text-right w-1/4">Debit</th>
                              <th className="py-1 px-4 text-right w-1/4">Credit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {row.ledgers.map(ledger => (
                              <tr
                                key={ledger.id}
                                onClick={() => setSearchParams({ ledger: ledger.id })}
                                className="cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group"
                              >
                                <td className="py-1 px-4 font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                                  {ledger.name}
                                </td>
                                <td className="py-1 px-4 text-right text-slate-600 dark:text-slate-400">
                                  {ledger.debit > 0 ? formatINR(ledger.debit) : '₹ 0.00'}
                                </td>
                                <td className="py-1 px-4 text-right text-slate-600 dark:text-slate-400">
                                  {ledger.credit > 0 ? formatINR(ledger.credit) : '₹ 0.00'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {/* Totals Rows */}
            <tr className={`border-t border-slate-200 dark:border-slate-700 ${data.isProfit ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <td className={`py-1.5 px-4 text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {data.isProfit ? 'Nett Profit' : 'Nett Loss'}
              </td>
              <td className={`py-1.5 px-4 text-right text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {formatINR(data.summary.net)}
              </td>
            </tr>
            <tr className={`${data.isProfit ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-red-50/50 dark:bg-red-900/10'}`}>
              <td className={`py-1.5 px-4 text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {data.isProfit ? 'Gross Profit' : 'Gross Loss'}
              </td>
              <td className={`py-1.5 px-4 text-right text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {formatINR(data.summary.gross)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
