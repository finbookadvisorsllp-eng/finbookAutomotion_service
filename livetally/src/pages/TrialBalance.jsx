import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
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
  const unmapped = tb?.meta?.unmappedLedgers || []

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

  // Recursively flatten the group tree into rows for rendering, respecting the
  // expanded state at every level — this mirrors Tally's Group Summary drill.
  const renderNodes = (nodes, depth = 0, keyPrefix = '') => {
    const rows = []
    nodes.forEach((node) => {
      const rowKey = `${keyPrefix}/${node.id}`
      const isExpanded = expandedRows.has(rowKey)
      const isGroup = node.type === 'group'
      const pad = 16 + depth * 22

      rows.push(
        <tr
          key={rowKey}
          className={`transition-colors group ${isGroup ? 'cursor-pointer hover:bg-slate-100' : 'hover:bg-slate-50'} ${depth === 0 ? 'font-semibold' : ''}`}
          onClick={() => isGroup && toggleRow(rowKey)}
        >
          <td className="py-2" style={{ paddingLeft: pad, paddingRight: 16 }}>
            <span className="inline-flex items-center gap-1.5">
              {isGroup ? (
                <ChevronDown
                  size={13}
                  strokeWidth={3}
                  className={`text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                />
              ) : (
                <span className="inline-block w-[13px]" />
              )}
              <button
                className={`text-[13px] text-left transition-colors ${node.isDrillable
                  ? 'text-blue-600 hover:text-blue-800 hover:underline font-medium'
                  : depth === 0 ? 'text-slate-900 font-bold' : 'text-slate-700 font-semibold'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (node.isDrillable) navigate(`/reports/pl?ledger=${encodeURIComponent(node.id)}&year=${currentYear.id}&from=trial-balance`)
                  else if (isGroup) toggleRow(rowKey)
                }}
              >
                {node.name}
              </button>
              {node.unmapped && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide">unmapped</span>
              )}
            </span>
          </td>
          <td className="px-4 py-2 text-[13px] font-medium text-slate-700 text-right tabular-nums">
            {node.debit ? formatINR(node.debit) : ''}
          </td>
          <td className="px-4 py-2 text-[13px] font-medium text-slate-700 text-right tabular-nums">
            {node.credit ? formatINR(node.credit) : ''}
          </td>
          <td className="w-8 pr-3" />
        </tr>
      )

      if (isGroup && isExpanded && node.children?.length) {
        rows.push(...renderNodes(node.children, depth + 1, rowKey))
      }
    })
    return rows
  }

  return (
    <div className="animate-fade-in flex flex-col min-h-screen pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 glass-card py-2 px-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black text-slate-900">Trial Balance</h1>
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

      {/* ── Data-completeness note (unmapped ledgers) ── */}
      {unmapped.length > 0 && (
        <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{tb?.meta?.note} ({unmapped.join(', ')})</span>
        </div>
      )}

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
                renderNodes(data.particulars)
              )}

              <tr className="border-t-2 border-slate-200 h-10">
                <td className="px-4 font-black text-[13px] text-slate-900">Grand Total</td>
                <td className="px-4 text-right font-black text-[13px] text-slate-900 tabular-nums">{formatINR(data.totalDebit)}</td>
                <td className="px-4 text-right font-black text-[13px] text-slate-900 tabular-nums">{formatINR(data.totalCredit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
