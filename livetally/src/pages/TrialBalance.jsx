import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { formatINR } from '../data/mockData'
import { useDateRange } from '../context/DateContext'
import { useApi } from '../hooks/useApi'
import { getTrialBalance } from '../api'

export default function TrialBalance() {
  const navigate = useNavigate()
  const { fy, years, selectFy } = useDateRange()
  const [expandedRows, setExpandedRows] = useState(new Set())

  const { data: tb, loading, error } = useApi(() => getTrialBalance(fy), [fy], { skip: !fy })

  const currentIndex = years.findIndex((y) => y.id === fy)
  const currentYear = years[currentIndex] || { id: fy, label: '' }
  const data = tb?.data?.[fy] || { particulars: [], totalDebit: 0, totalCredit: 0 }

  const handlePrevYear = () => {
    if (currentIndex > 0) { selectFy(years[currentIndex - 1].id); setExpandedRows(new Set()) }
  }
  const handleNextYear = () => {
    if (currentIndex < years.length - 1) { selectFy(years[currentIndex + 1].id); setExpandedRows(new Set()) }
  }
  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="animate-fade-in flex flex-col min-h-screen pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 glass-card py-2 px-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black text-slate-900 ">Trial Balance</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center glass-card h-9 overflow-hidden">
            <button onClick={handlePrevYear} disabled={currentIndex <= 0}
              className="px-2 h-full text-slate-700 hover:bg-slate-200 disabled:opacity-30 transition-colors border-r border-slate-200 flex items-center justify-center">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <div className="px-3 text-[13px] font-bold text-slate-800 flex items-center h-full min-w-[180px] justify-center">
              {currentYear.label || '—'}
            </div>
            <button onClick={handleNextYear} disabled={currentIndex >= years.length - 1}
              className="px-2 h-full text-slate-700 hover:bg-slate-200 disabled:opacity-30 transition-colors border-l border-slate-200 flex items-center justify-center">
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-bold text-slate-600 h-9">
                <th className="px-4 font-bold">Particulars</th>
                <th className="px-4 text-right w-[180px] font-bold">Debit</th>
                <th className="px-4 text-right w-[180px] font-bold">Credit</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="4" className="py-12 text-center text-[13px] text-slate-500 font-medium">Loading…</td></tr>
              ) : error ? (
                <tr><td colSpan="4" className="py-12 text-center text-[13px] text-red-500 font-medium">{error.message}</td></tr>
              ) : data.particulars.length === 0 ? (
                <tr><td colSpan="4" className="py-12 text-center text-[13px] text-slate-500 font-medium">No records found for this period.</td></tr>
              ) : (
                data.particulars.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr className={`transition-colors group ${row.isExpandable ? 'cursor-pointer hover:bg-slate-200 ' : 'hover:bg-slate-50 '}`}
                      onClick={() => row.isExpandable && toggleRow(row.id)}>
                      <td className="px-4 py-2">
                        <button
                          className={`text-[13px] font-semibold text-left transition-colors ${row.isDrillable ? 'text-blue-600 hover:text-blue-800 ' : 'text-slate-700 pointer-events-none'}`}
                          disabled={!row.isDrillable}
                          onClick={(e) => { e.stopPropagation(); navigate(`/reports/pl?ledger=${encodeURIComponent(row.id)}&year=${currentYear.id}`) }}>
                          {row.name}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-700 text-right pointer-events-none">{formatINR(row.debit)}</td>
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-700 text-right tabular-nums pointer-events-none">{formatINR(row.credit)}</td>
                      <td className="pr-3 py-2 w-8 pointer-events-none">
                        {row.isExpandable && (
                          <button className={`text-slate-400 hover:text-slate-600 transition-transform ${expandedRows.has(row.id) ? 'rotate-180' : 'opacity-0 group-hover:opacity-100'}`}>
                            <ChevronDown size={14} strokeWidth={3} />
                          </button>
                        )}
                      </td>
                    </tr>

                    {expandedRows.has(row.id) && row.children && (
                      <tr className="bg-slate-50/50 border-y border-slate-100 ">
                        <th className="px-4 py-2 text-[13px] font-bold text-slate-800 ">Particulars</th>
                        <th className="px-4 py-2 text-right w-[180px] text-[13px] font-bold text-slate-800 ">Debit</th>
                        <th className="px-4 py-2 text-right w-[180px] text-[13px] font-bold text-slate-800 ">Credit</th>
                        <th className="w-8 pr-3"></th>
                      </tr>
                    )}

                    {expandedRows.has(row.id) && row.children && row.children.map((child) => (
                      <tr key={child.id} className="hover:bg-slate-100 transition-colors border-b border-slate-50/50 ">
                        <td className="px-4 py-2">
                          <button
                            className={`text-[13px] font-semibold text-left cursor-pointer transition-colors ${child.isDrillable ? 'text-blue-600 hover:text-blue-800 hover:underline ' : 'text-slate-700 '}`}
                            disabled={!child.isDrillable}
                            onClick={(e) => { e.stopPropagation(); if (child.isDrillable) navigate(`/reports/pl?ledger=${encodeURIComponent(child.id)}&year=${currentYear.id}&from=trial-balance`) }}>
                            {child.name}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-[13px] font-medium text-slate-700 text-right">{formatINR(child.debit)}</td>
                        <td className="px-4 py-2 text-[13px] font-medium text-slate-700 text-right tabular-nums">{formatINR(child.credit)}</td>
                        <td className="w-8 pr-3"></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}

              <tr className="border-t-2 border-slate-200 h-10">
                <td className="px-4 font-black text-[13px] text-slate-900 ">Total</td>
                <td className="px-4 text-right font-black text-[13px] text-slate-900 ">{formatINR(data.totalDebit)}</td>
                <td className="px-4 text-right font-black text-[13px] text-slate-900 ">{formatINR(data.totalCredit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
