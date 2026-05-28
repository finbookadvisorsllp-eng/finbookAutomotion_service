import { useState } from 'react'
import { Download, Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'

export default function DataTable({
  columns, data, pageSize = 10,
  searchable = true, title, actions,
  onRowClick, rowClassName,
}) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')

  const handleSort = (col) => {
    if (!col.sortable) return
    if (sortCol === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col.key); setSortDir('asc') }
  }

  let filtered = data.filter(row =>
    !search || columns.some(col => {
      const val = String(row[col.key] ?? '')
      return val.toLowerCase().includes(search.toLowerCase())
    })
  ).filter(row => !filter || String(row.status ?? row.type ?? '') === filter)

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
      const r = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? r : -r
    })
  }

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = filtered.slice((page - 1) * pageSize, page * pageSize)

  const pageNums = Array.from({ length: Math.min(5, pages) }, (_, i) => {
    if (pages <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= pages - 2) return pages - 4 + i
    return page - 2 + i
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Table Controls */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-100 flex-wrap bg-white/50">
        {title && <h3 className="text-sm font-black text-slate-800 mr-2">{title}</h3>}

        {searchable && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 flex-1 max-w-sm focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
            <Search size={14} className="text-slate-400" />
            <input
              className="bg-transparent text-xs text-slate-700 font-medium placeholder:text-slate-400 outline-none flex-1 min-w-0"
              placeholder="Search records..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        )}

        <div className="flex-1" />

        {actions && <div className="flex items-center gap-3">{actions}</div>}

        <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200/80 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/80">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap select-none ${col.sortable ? 'cursor-pointer hover:text-slate-800 hover:bg-slate-100/50 transition-colors' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                  onClick={() => handleSort(col)}
                >
                  <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                    {col.label}
                    {col.sortable && sortCol === col.key && (
                      <span className="text-blue-600 font-black">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {current.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-20 text-center">
                  <div className="flex justify-center mb-4 text-slate-300">
                    <Inbox size={48} strokeWidth={1.5} />
                  </div>
                  <p className="text-[15px] font-bold text-slate-600">No records found</p>
                  <p className="text-[13px] font-medium text-slate-400 mt-1">Try adjusting your search filters</p>
                </td>
              </tr>
            ) : (
              current.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : 'hover:bg-slate-50/80'}`}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 text-[13px] text-slate-700 ${col.align === 'right' ? 'text-right' : ''} ${col.className ?? ''}`}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/30">
        <span className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-800">{Math.min((page - 1) * pageSize + 1, total)}</span> to <span className="font-bold text-slate-800">{Math.min(page * pageSize, total)}</span> of <span className="font-bold text-slate-800">{total}</span> entries
        </span>
        <div className="flex items-center gap-1.5">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="w-8 h-8 flex items-center justify-center text-slate-500 border border-slate-200 bg-white rounded-lg disabled:opacity-40 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>
          {pageNums.map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`min-w-[32px] h-8 flex items-center justify-center px-2 text-[13px] font-bold border rounded-lg transition-all shadow-sm ${
                page === n
                  ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >{n}</button>
          ))}
          <button
            disabled={page === pages}
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            className="w-8 h-8 flex items-center justify-center text-slate-500 border border-slate-200 bg-white rounded-lg disabled:opacity-40 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
