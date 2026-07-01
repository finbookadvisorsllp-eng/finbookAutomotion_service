import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Level3VoucherDetail from '../components/DrillDown/Level3VoucherDetail'
import DateRangePicker from '../components/common/DateRangePicker'
import { useDateRange } from '../context/DateContext'
import { useApi } from '../hooks/useApi'
import { getDayBook, getVoucher } from '../api'

import { ArrowLeft, Search, Download, RefreshCw, X, Inbox, ChevronLeft, ChevronRight, Layers, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'

const getFyBounds = (fyStr) => {
  if (!fyStr || !fyStr.includes('-')) return { from: '', to: '' }
  const parts = fyStr.split('-')
  return {
    from: `${parts[0]}-04-01`,
    to: `${parseInt(parts[0]) + 1}-03-31`
  }
}

const formatBackendDate = (dateStr) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-') // yyyy-mm-dd
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return dateStr
}

const formatTallyAmount = (val, showZero = false) => {
  if (val === undefined || val === null || (val === 0 && !showZero)) return ''
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

export default function DayBook() {
  const { fy } = useDateRange()
  const [searchParams, setSearchParams] = useSearchParams()

  // Extract voucher from URL search parameters for full-page drill down
  const voucherId = searchParams.get('voucher')

  // Page and limit states
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Date period states — initialised from the URL so the view is refresh-safe
  // and deep-linkable.
  const [preset, setPreset] = useState(searchParams.get('preset') || 'custom')

  // Active filter states (trigger api request)
  const [activeFromDate, setActiveFromDate] = useState(searchParams.get('from') || '')
  const [activeToDate, setActiveToDate] = useState(searchParams.get('to') || '')
  const [activeSearch, setActiveSearch] = useState('')

  // Temporary input state for the quick search box
  const [tempSearch, setTempSearch] = useState('')

  // Default to the FY range on first load (unless a range was deep-linked).
  useEffect(() => {
    if (fy && !activeFromDate && !activeToDate) {
      const bounds = getFyBounds(fy)
      setActiveFromDate(bounds.from)
      setActiveToDate(bounds.to)
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy])

  // Single handler the shared DateRangePicker calls on Apply / prev / next.
  const handleRangeChange = ({ fromDate: f, toDate: t, preset: p }) => {
    setPreset(p)
    setActiveFromDate(f); setActiveToDate(t)
    setPage(1)
    const np = new URLSearchParams(searchParams)
    np.set('from', f); np.set('to', t); np.set('preset', p)
    setSearchParams(np, { replace: true })
  }

  // Debounce search text input to provide smooth real-time filter response
  useEffect(() => {
    const handler = setTimeout(() => {
      setActiveSearch(tempSearch)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [tempSearch])

  // Build the backend date range parameter
  const backendDateRange = activeFromDate && activeToDate
    ? `${formatBackendDate(activeFromDate)} - ${formatBackendDate(activeToDate)}`
    : ''

  // Fetch Day Book rows
  const { data: resp, loading, error } = useApi(
    () => getDayBook(fy, backendDateRange, page, limit, { search: activeSearch }),
    [fy, backendDateRange, page, limit, activeSearch],
    { skip: !fy || !!voucherId }
  )

  // Fetch single voucher detail for drill-down page view
  const { data: voucherDetail, loading: detailLoading, error: detailError } = useApi(
    () => getVoucher(voucherId),
    [voucherId],
    { skip: !voucherId }
  )

  const daybookData = resp?.data || []
  const pagination = resp?.pagination || {}
  const totalRecords = pagination.totalRecords || 0
  const totalPages = pagination.totalPages || 1
  const hasNext = pagination.hasNext || false
  const hasPrevious = pagination.hasPrevious || false

  // Reset date range + search to the full FY.
  const handleReset = () => {
    setTempSearch('')
    setActiveSearch('')
    setPreset('custom')
    if (fy) {
      const bounds = getFyBounds(fy)
      setActiveFromDate(bounds.from)
      setActiveToDate(bounds.to)
    }
    const np = new URLSearchParams(searchParams)
    np.delete('from'); np.delete('to'); np.delete('preset')
    setSearchParams(np, { replace: true })
    setPage(1)
  }

  // Period-wide summary cards (computed server-side; reconciles with the table).
  const summary = resp?.meta?.summary || { totalVouchers: 0, totalDebit: 0, totalCredit: 0, netFlow: 0 }

  // Page total calculations
  const totalDebits = daybookData.reduce((acc, v) => acc + (v.debitAmount || 0), 0)
  const totalCredits = daybookData.reduce((acc, v) => acc + (v.creditAmount || 0), 0)
  const totalInwardQty = daybookData.reduce((acc, v) => acc + (v.inwardQty || 0), 0)
  const totalOutwardQty = daybookData.reduce((acc, v) => acc + (v.outwardQty || 0), 0)

  // Navigate to full-page voucher detail view via search parameters
  const handleRowClick = (row) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('voucher', row.voucherId)
    setSearchParams(newParams)
  }

  // Back from voucher detail view to lists
  const handleBackToDayBook = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('voucher')
    setSearchParams(newParams)
  }

  // Generate page number array for pagination
  const pageNums = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= totalPages - 2) return totalPages - 4 + i
    return page - 2 + i
  })

  const displayPeriod = activeFromDate && activeToDate
    ? `${activeFromDate.split('-').reverse().join('/')} - ${activeToDate.split('-').reverse().join('/')}`
    : ''

  // ── Render Voucher Details Page (Drill-Down L4) ──
  if (voucherId) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        {/* Header Bar */}
        <div className="flex items-center gap-3 bg-white dark:bg-[#121218] p-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <button
            onClick={handleBackToDayBook}
            className="text-slate-800 dark:text-slate-200 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight">
              Voucher Detail: <span className="font-mono">{voucherDetail?.voucherNo || voucherId}</span>
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Drill-Down Mode</p>
          </div>
        </div>

        {/* Main Content Area */}
        {detailLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2.5">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading details from Tally...</p>
          </div>
        ) : detailError ? (
          <div className="text-center py-20 text-red-500 font-bold">
            Failed to retrieve voucher details.
          </div>
        ) : (
          <Level3VoucherDetail voucherData={voucherDetail} />
        )}
      </div>
    )
  }

  // ── Render Main Day Book Page ──
  return (
    <div className="animate-fade-in">
      {/* Upper Title / Control Header — sticks to the top while scrolling */}
      <div className="sticky top-0 z-30 flex items-center justify-between glass-card px-5 py-4 mb-5 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Day Book</h1>
          <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            {displayPeriod || fy} {loading ? '· Fetching...' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            value={{ fromDate: activeFromDate, toDate: activeToDate, preset }}
            onChange={handleRangeChange}
          />
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1a24] rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
            title="Reset all search filters"
          >
            <RefreshCw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Period summary cards — derived server-side from the same row logic,
          so they always reconcile with the Day Book table below. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Vouchers', value: (summary.totalVouchers || 0).toLocaleString('en-IN'), icon: <Layers size={16} className="text-slate-500" />, ring: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-900 dark:text-white' },
          { label: 'Total Debit', value: `₹${formatTallyAmount(summary.totalDebit, true)}`, icon: <ArrowDownLeft size={16} className="text-blue-600" />, ring: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400' },
          { label: 'Total Credit', value: `₹${formatTallyAmount(summary.totalCredit, true)}`, icon: <ArrowUpRight size={16} className="text-amber-600" />, ring: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400' },
          { label: 'Net Flow (Dr − Cr)', value: `₹${formatTallyAmount(summary.netFlow, true)}`, icon: <Wallet size={16} className={summary.netFlow >= 0 ? 'text-emerald-600' : 'text-red-600'} />, ring: summary.netFlow >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10', text: summary.netFlow >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400' },
        ].map((c) => (
          <div key={c.label} className="glass-card p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{c.label}</p>
              <p className={`text-xl font-black truncate ${c.text}`}>{c.value}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${c.ring} flex items-center justify-center shrink-0`}>{c.icon}</div>
          </div>
        ))}
      </div>

      {/* Main Day Book Table Container */}
      <div className="bg-white dark:bg-[#121218] rounded-2xl border border-slate-200/80 dark:border-[#B6FF00]/25 shadow-sm dark:shadow-[0_0_25px_rgba(182,255,0,0.05)] overflow-hidden flex flex-col">
        {/* Table Search bar */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex-wrap bg-white/50 dark:bg-transparent">
          <div className="flex items-center gap-2.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-[#1a1a24]/50 flex-1 max-w-sm focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-[#121218] focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
            <Search size={14} className="text-slate-400" />
            <input
              className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-medium placeholder:text-slate-400 outline-none flex-1 min-w-0"
              placeholder="Search voucher #, particulars, or narration..."
              value={tempSearch}
              onChange={e => setTempSearch(e.target.value)}
            />
            {tempSearch && (
              <button type="button" onClick={() => { setTempSearch(''); setActiveSearch(''); setPage(1) }} className="text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex-1" />

          <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#1a1a24] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95">
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Scrollable Table View */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#1a1a24]/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Particulars</th>
                <th className="px-4 py-3">Voucher Type</th>
                <th className="px-4 py-3">Voucher No.</th>
                <th className="px-4 py-3 text-right">
                  <div className="flex flex-col">
                    <span>Debit Amount</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal normal-case tracking-normal">Inwards Qty</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex flex-col">
                    <span>Credit Amount</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal normal-case tracking-normal">Outwards Qty</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {error ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-red-500 font-bold">
                    Failed to fetch Day Book records from server.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-slate-400 font-semibold animate-pulse">
                    Fetching records from Tally database...
                  </td>
                </tr>
              ) : daybookData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="flex justify-center mb-4 text-slate-300 dark:text-slate-700">
                      <Inbox size={48} strokeWidth={1.5} />
                    </div>
                    <p className="text-[15px] font-bold text-slate-600 dark:text-slate-400">No transactions found</p>
                    <p className="text-[13px] font-medium text-slate-400 dark:text-slate-600 mt-1">Try modifying your filters or selected financial year</p>
                  </td>
                </tr>
              ) : (
                daybookData.map((row, idx) => (
                  <tr
                    key={row.voucherId ?? idx}
                    onClick={() => handleRowClick(row)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer text-[13px] text-slate-700 dark:text-slate-300"
                  >
                    <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">{row.date}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-200 max-w-xs truncate" title={row.particulars}>
                      {row.particulars}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(row.voucherType || '').includes('Sales') ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                        (row.voucherType || '').includes('Purchase') ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' :
                          (row.voucherType || '').includes('Receipt') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                            (row.voucherType || '').includes('Payment') ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                              'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
                        }`}>{row.voucherType}</span>
                    </td>
                    <td className="px-4 py-2.5 text-blue-600 dark:text-blue-400 font-mono text-[12px] font-bold whitespace-nowrap">{row.voucherNumber}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <div className="font-semibold text-slate-900 dark:text-slate-200">
                        {formatTallyAmount(row.debitAmount)}
                      </div>
                      {row.inwardQty > 0 && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          {row.inwardQty.toFixed(3)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <div className="font-semibold text-slate-900 dark:text-slate-200">
                        {formatTallyAmount(row.creditAmount)}
                      </div>
                      {row.outwardQty > 0 && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-450 mt-0.5 font-medium">
                          {row.outwardQty.toFixed(3)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer - Page Totals */}
            {!loading && !error && daybookData.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#1a1a24]/30 text-[13px] font-black text-slate-900 dark:text-white">
                <tr>
                  <td colSpan="4" className="px-4 py-2.5">Total / page</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="font-bold text-slate-900 dark:text-white">{formatTallyAmount(totalDebits, true)}</div>
                    {totalInwardQty > 0 && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                        {totalInwardQty.toFixed(3)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="font-bold text-slate-900 dark:text-white">{formatTallyAmount(totalCredits, true)}</div>
                    {totalOutwardQty > 0 && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                        {totalOutwardQty.toFixed(3)}
                      </div>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Server-side Pagination footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-transparent flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Show</span>
            <select
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
              className="p-1 px-1.5 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-[#121218] text-slate-700 dark:text-slate-300 font-bold outline-none"
            >
              {[10, 25, 50, 100].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <span>entries</span>
            <span className="mx-2 text-slate-200 dark:text-slate-800">|</span>
            <span>
              Showing <span className="font-black text-slate-800 dark:text-slate-200">{Math.min((page - 1) * limit + 1, totalRecords)}</span> to <span className="font-black text-slate-800 dark:text-slate-200">{Math.min(page * limit, totalRecords)}</span> of <span className="font-black text-slate-800 dark:text-slate-200">{totalRecords}</span> records
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!hasPrevious || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-8 h-8 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1a24] rounded-xl disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-all shadow-sm active:scale-95"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNums.map(n => (
              <button
                type="button"
                key={n}
                onClick={() => setPage(n)}
                className={`min-w-[32px] h-8 flex items-center justify-center px-2 text-[13px] font-bold border rounded-xl transition-all shadow-sm ${page === n
                  ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                  : 'bg-white dark:bg-[#1a1a24] border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >{n}</button>
            ))}
            <button
              type="button"
              disabled={!hasNext || loading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="w-8 h-8 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1a24] rounded-xl disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-all shadow-sm active:scale-95"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
