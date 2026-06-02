import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trialBalanceData } from '../data/trialBalanceData'
import { formatINR } from '../data/mockData'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

export default function TrialBalance() {
  const navigate = useNavigate()
  const [currentYearIndex, setCurrentYearIndex] = useState(0) // Default to 23-24
  const [expandedRows, setExpandedRows] = useState(new Set())

  const currentYear = trialBalanceData.years[currentYearIndex]
  const data = trialBalanceData.data[currentYear.id]

  const handlePrevYear = () => {
    if (currentYearIndex > 0) {
      setCurrentYearIndex(prev => prev - 1)
      setExpandedRows(new Set()) // Close all on year change
    }
  }

  const handleNextYear = () => {
    if (currentYearIndex < trialBalanceData.years.length - 1) {
      setCurrentYearIndex(prev => prev + 1)
      setExpandedRows(new Set()) // Close all on year change
    }
  }

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="animate-fade-in flex flex-col min-h-screen pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 bg-white dark:bg-slate-800 py-2 px-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button className="text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">Trial Balance</h1>
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
              disabled={currentYearIndex === trialBalanceData.years.length - 1}
              className="px-2 h-full text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors border-l border-slate-200 dark:border-slate-700 flex items-center justify-center"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* View PDF Button */}
          <button className="flex items-center gap-1.5 px-3 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M10 13v4" /><path d="M14 13v4" /><path d="M10 13h4" /></svg>
            View PDF
          </button>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#f4f7fb] dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[13px] font-bold text-slate-600 dark:text-slate-300 h-9">
                <th className="px-4 font-bold">Particulars</th>
                <th className="px-4 text-right w-[180px] font-bold">Debit</th>
                <th className="px-4 text-right w-[180px] font-bold">Credit</th>
                <th className="w-8"></th> {/* Space for chevron */}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {data.particulars.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[13px] text-slate-500 font-medium">
                    No records found for this period.
                  </td>
                </tr>
              ) : (
                data.particulars.map((row) => (
                  <React.Fragment key={row.id}>
                    {/* Parent Row */}
                    <tr
                      className={`transition-colors group ${row.isExpandable ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                      onClick={() => row.isExpandable && toggleRow(row.id)}
                    >
                      <td className="px-4 py-2">
                        <button
                          className={`text-[13px] font-semibold text-left transition-colors ${row.isDrillable ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300' : 'text-slate-700 dark:text-slate-300 pointer-events-none'}`}
                          disabled={!row.isDrillable}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (row.id === 'pl-ac') {
                              navigate(`/reports/pl?year=${currentYear.id}`);
                            } else {
                              navigate(`/reports/pl?ledger=${row.id}&year=${currentYear.id}`);
                            }
                          }}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right pointer-events-none">
                        {formatINR(row.debit)}
                      </td>
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right tabular-nums pointer-events-none">
                        {formatINR(row.credit)}
                      </td>
                      <td className="pr-3 py-2 w-8 pointer-events-none">
                        {row.isExpandable && (
                          <button className={`text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-transform ${expandedRows.has(row.id) ? 'rotate-180' : 'opacity-0 group-hover:opacity-100'}`}>
                            <ChevronDown size={14} strokeWidth={3} />
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Child Header */}
                    {expandedRows.has(row.id) && row.children && (
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-y border-slate-100 dark:border-slate-700">
                        <th className="px-4 py-2 text-[13px] font-bold text-slate-800 dark:text-slate-200">Particulars</th>
                        <th className="px-4 py-2 text-right w-[180px] text-[13px] font-bold text-slate-800 dark:text-slate-200">Debit</th>
                        <th className="px-4 py-2 text-right w-[180px] text-[13px] font-bold text-slate-800 dark:text-slate-200">Credit</th>
                        <th className="w-8 pr-3"></th>
                      </tr>
                    )}

                    {/* Child Rows */}
                    {expandedRows.has(row.id) && row.children && row.children.map(child => (
                      <tr key={child.id} className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors border-b border-slate-50 dark:border-slate-700/30">
                        <td className="px-4 py-2">
                          <button
                            className={`text-[13px] font-semibold text-left cursor-pointer transition-colors ${child.isDrillable ? 'text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}
                            disabled={!child.isDrillable}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (child.isDrillable) {
                                navigate(`/reports/pl?ledger=${child.id}&year=${currentYear.id}&from=trial-balance`);
                              }
                            }}
                          >
                            {child.name}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right">
                          {formatINR(child.debit)}
                        </td>
                        <td className="px-4 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right tabular-nums">
                          {formatINR(child.credit)}
                        </td>
                        <td className="w-8 pr-3"></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}

              {/* Total Row */}
              <tr className="bg-white dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700 h-10">
                <td className="px-4 font-black text-[13px] text-slate-900 dark:text-white">
                  Total
                </td>
                <td className="px-4 text-right font-black text-[13px] text-slate-900 dark:text-white">
                  {formatINR(data.totalDebit)}
                </td>
                <td className="px-4 text-right font-black text-[13px] text-slate-900 dark:text-white">
                  {formatINR(data.totalCredit)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
