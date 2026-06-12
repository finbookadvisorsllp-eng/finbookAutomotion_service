import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatINR } from '../../data/mockData';

export default function Level1Summary({ data, isComparing, comparePeriod, setComparePeriod }) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [expandedRows, setExpandedRows] = useState({});
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [tempFromDate, setTempFromDate] = useState('2023-04-01');
  const [tempToDate, setTempToDate] = useState('2024-03-31');

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="glass-card animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 px-4 border-b border-slate-200 ">
        <h2 className="text-[13px] font-bold text-slate-800 ">Detailed Breakdown</h2>
        <div className="flex items-center gap-3">
          {/* Compare Date Picker */}
          <div className="relative">
            <div className="flex items-center gap-2 p-1 rounded-md border border-slate-200 bg-white shadow-sm px-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
              {isComparing ? (
                <>
                  <span className="text-[11px] font-bold text-slate-700">
                    {comparePeriod?.from} to {comparePeriod?.to}
                  </span>
                  <button
                    onClick={() => setComparePeriod(null)}
                    className="ml-1 text-[10px] text-slate-400 hover:text-red-500 font-bold"
                    title="Remove comparison"
                  >×</button>
                </>
              ) : (
                <button
                  onClick={() => setShowCompareModal(!showCompareModal)}
                  className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded font-bold transition-colors border border-blue-200"
                >
                  + Compare
                </button>
              )}
            </div>

            {/* Modal/Popover */}
            {showCompareModal && !isComparing && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-50">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Compare Period</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
                    <input
                      type="date"
                      value={tempFromDate}
                      onChange={e => setTempFromDate(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
                    <input
                      type="date"
                      value={tempToDate}
                      onChange={e => setTempToDate(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setShowCompareModal(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (tempFromDate && tempToDate) {
                        setComparePeriod({ from: tempFromDate, to: tempToDate });
                        setShowCompareModal(false);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            📄 View PDF
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-800 font-bold text-[12px] border-b border-slate-200 ">
              <th className="py-2 px-4 font-bold">Particulars</th>
              <th className="py-2 px-4 font-bold text-right">
                Balance<br /><span className="text-[9px] font-normal text-slate-500">as at {data.label.split(' - ')[1] || 'Current'}</span>
              </th>
              {isComparing && (
                <th className="py-2 px-4 font-bold text-right">
                  Balance<br /><span className="text-[9px] font-normal text-slate-500">for {comparePeriod?.from} to {comparePeriod?.to}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.particulars.map(row => (
              <React.Fragment key={row.id}>
                {/* Main Row */}
                <tr className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 ">
                  <td className="py-1.5 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (row.id === 'closing-stock') setSearchParams({ ledger: 'stock-hand-closing' });
                          else if (row.id === 'opening-stock') navigate('/reports/pl/opening-stock');
                          else toggleRow(row.id);
                        }}
                        className={`font-medium flex items-center gap-1.5 text-[12px] ${row.id === 'closing-stock' || row.id === 'opening-stock'
                            ? 'text-blue-600 dark:text-blue-400 hover:underline'
                            : 'text-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
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
                        else if (row.id === 'opening-stock') navigate('/reports/pl/opening-stock');
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
                  {isComparing && (
                    <td className="py-1.5 px-4 text-right text-[12px] font-bold text-slate-500">
                      {formatINR(row.amount * 0.85)}
                    </td>
                  )}
                </tr>

                {/* Sub-table (Inline Expansion) */}
                {expandedRows[row.id] && row.ledgers.length > 0 && (
                  <tr>
                    <td colSpan={isComparing ? "3" : "2"} className="p-0 border-b border-slate-100 ">
                      <div className="bg-slate-50/80 w-full overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="text-slate-700 font-bold border-b border-slate-200 ">
                              <th className={`py-1 px-4 ${isComparing ? 'w-2/5' : 'w-1/2'}`}>Particulars</th>
                              <th className={`py-1 px-4 text-right ${isComparing ? 'w-1/5' : 'w-1/4'}`}>Debit</th>
                              <th className={`py-1 px-4 text-right ${isComparing ? 'w-1/5' : 'w-1/4'}`}>Credit</th>
                              {isComparing && <th className="py-1 px-4 text-right w-1/5">Compare Balance</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {row.ledgers.map(ledger => (
                              <tr
                                key={ledger.id}
                                onClick={() => setSearchParams({ ledger: ledger.id })}
                                className="cursor-pointer hover:bg-slate-50 transition-colors group"
                              >
                                <td className="py-1 px-4 font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                                  {ledger.name}
                                </td>
                                <td className="py-1 px-4 text-right text-slate-600 ">
                                  {ledger.debit > 0 ? formatINR(ledger.debit) : '₹ 0.00'}
                                </td>
                                <td className="py-1 px-4 text-right text-slate-600 ">
                                  {ledger.credit > 0 ? formatINR(ledger.credit) : '₹ 0.00'}
                                </td>
                                {isComparing && (
                                  <td className="py-1 px-4 text-right text-slate-400">
                                    {ledger.debit > 0 ? formatINR(ledger.debit * 0.85) : ledger.credit > 0 ? formatINR(ledger.credit * 0.85) : '₹ 0.00'}
                                  </td>
                                )}
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
            <tr className={`border-t border-slate-200 ${data.isProfit ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <td className={`py-1.5 px-4 text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {data.isProfit ? 'Nett Profit' : 'Nett Loss'}
              </td>
              <td className={`py-1.5 px-4 text-right text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {formatINR(data.summary.net)}
              </td>
              {isComparing && (
                <td className="py-1.5 px-4 text-right text-[12px] font-bold text-slate-500">
                  {formatINR(data.summary.net * 0.85)}
                </td>
              )}
            </tr>
            <tr className={`${data.isProfit ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-red-50/50 dark:bg-red-900/10'}`}>
              <td className={`py-1.5 px-4 text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {data.isProfit ? 'Gross Profit' : 'Gross Loss'}
              </td>
              <td className={`py-1.5 px-4 text-right text-[12px] font-bold ${data.isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {formatINR(data.summary.gross)}
              </td>
              {isComparing && (
                <td className="py-1.5 px-4 text-right text-[12px] font-bold text-slate-500">
                  {formatINR(data.summary.gross * 0.85)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

