import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { SearchInput } from './Input'
import EmptyState from './EmptyState'
import ObjectDoodle from './ObjectDoodle'

/**
 * Shared table shell. Replaces the hand-rolled <table> markup duplicated across
 * ~24 panels and wires the previously-decorative sort arrows to real sorting.
 *
 * columns: [{
 *   key, header, sortable?, align? 'left'|'right'|'center', width?,
 *   render?(row, idx) -> node,            // defaults to row[key]
 *   sortValue?(row) -> string|number,     // defaults to row[key]
 * }]
 * Sorting is client-side over the rows you pass (current page). Server-paginated
 * panels simply omit `sortable`. Selection + search + pagination are controlled.
 */
export default function DataTable({
  columns = [],
  data = [],
  rowKey = (row, i) => row?._id ?? row?.id ?? i,
  loading = false,
  emptyText = 'No data found',
  // header
  title, description, icon: Icon, actions, filters, live = false,
  // search (controlled, optional)
  search,
  // selection (controlled, optional)
  selectable = false, selectedKeys = [], onToggleRow, onToggleAll,
  // row interaction
  onRowClick,
  rowClassName,
  // pagination (controlled, optional)
  pagination,
  minWidth = '900px',
}) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const searchRef = useRef(null)

  // "/" focuses search; Esc clears it. Skips when already typing elsewhere.
  useEffect(() => {
    if (!search) return
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current && search.value) {
        search.onChange('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [search])

  const sorted = useMemo(() => {
    if (!sort.key) return data
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return data
    const get = col.sortValue || ((r) => r?.[col.key])
    const arr = [...data].sort((a, b) => {
      const av = get(a), bv = get(b)
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return av - bv
      return String(av).localeCompare(String(bv), undefined, { numeric: true })
    })
    return sort.dir === 'desc' ? arr.reverse() : arr
  }, [data, sort, columns])

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const allChecked = selectable && data.length > 0 && selectedKeys.length === data.length
  const showHeader = title || search || actions || filters

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 h-full overflow-hidden relative"
    >
      {showHeader && (
        <div
          className="rounded-xl border p-3 px-4 shrink-0"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {(title || Icon) && (
              <div className="flex items-center gap-3 min-w-0">
                {Icon && (
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
                    <Icon size={16} strokeWidth={2.2} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[16px] font-bold tracking-tight leading-none truncate" style={{ color: 'var(--app-heading)' }}>{title}</h1>
                    {live && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/15">
                        <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                      </span>
                    )}
                  </div>
                  {description && <p className="text-[10.5px] font-medium mt-1 leading-snug" style={{ color: 'var(--app-muted)' }}>{description}</p>}
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {filters}
              {search && (
                <SearchInput
                  ref={searchRef}
                  className="min-w-[220px] sm:max-w-xs"
                  value={search.value || ''}
                  onChange={(e) => search.onChange(e.target.value)}
                  placeholder={search.placeholder || 'Search…  ( / )'}
                />
              )}
              {actions && <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>}
            </div>
          </div>
        </div>
      )}

      <div
        className="flex-1 overflow-hidden rounded-xl border flex flex-col"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
      >
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--app-accent-soft)' }}>
            <div className="flex flex-col items-center gap-1 px-5 py-4 rounded-xl border" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
              <ObjectDoodle name="processing" className="w-16 h-12" />
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--app-heading)' }}>Loading…</span>
            </div>
          </div>
        )}

        <div className="overflow-auto h-full themed-scrollbar">
          <table className="w-full text-left border-collapse" style={{ minWidth }}>
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                {selectable && (
                  <th className="p-2.5 border-b w-10 text-center" style={{ borderColor: 'var(--app-border)' }}>
                    <input type="checkbox" className="w-3.5 h-3.5 rounded cursor-pointer accent-[var(--app-accent)]" checked={allChecked} onChange={(e) => onToggleAll?.(e.target.checked)} />
                  </th>
                )}
                {columns.map((col) => {
                  const active = sort.key === col.key
                  const alignCls = col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''
                  return (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      className={`px-3 py-2.5 border-b text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--app-accent)]' : ''}`}
                      style={{ borderColor: 'var(--app-border)', color: active ? 'var(--app-accent)' : 'var(--app-muted)', backgroundColor: 'var(--app-table-head-bg)', width: col.width }}
                    >
                      <div className={`flex items-center gap-1.5 ${alignCls}`}>
                        {col.header}
                        {col.sortable && (active
                          ? (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
                          : <ArrowUpDown size={9.5} className="opacity-40" />)}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.length > 0 ? (
                sorted.map((row, idx) => {
                  const key = rowKey(row, idx)
                  const selected = selectable && selectedKeys.includes(key)
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={`transition-colors text-[11.5px] border-b ${selected ? '' : 'even:bg-[var(--app-table-head-bg)]'} hover:bg-[var(--app-row-hover)] ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                      style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)', backgroundColor: selected ? 'var(--app-accent-soft)' : undefined }}
                    >
                      {selectable && (
                        <td className="px-3 py-2.5 text-center" style={{ borderColor: 'var(--app-row-border)' }}>
                          <input type="checkbox" className="w-3.5 h-3.5 rounded cursor-pointer accent-[var(--app-accent)]" checked={selected} onChange={() => onToggleRow?.(key)} />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className={`px-3 py-2.5 align-middle ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.cellClassName || ''}`} style={{ borderColor: 'var(--app-row-border)' }}>
                          {col.render ? col.render(row, idx) : (row?.[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                    <EmptyState compact message={emptyText} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="py-1.5 px-3 shrink-0 flex items-center justify-between border-t" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-table-head-bg)' }}>
            <span className="text-[10px] font-semibold flex items-center gap-2" style={{ color: 'var(--app-muted)' }}>
              {selectable && selectedKeys.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md font-bold" style={{ color: 'var(--app-accent)', backgroundColor: 'var(--app-accent-soft)' }}>
                  {selectedKeys.length} selected
                </span>
              )}
              {pagination.label ?? `${pagination.total ?? data.length} entries`}
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={pagination.onPrev} disabled={pagination.page <= 1} className="h-6.5 w-6.5 rounded-md border flex items-center justify-center transition-colors hover:bg-[var(--app-control-hover)] disabled:opacity-40" style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}>
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md border" style={{ color: 'var(--app-accent)', backgroundColor: 'var(--app-accent-soft)', borderColor: 'var(--app-border)' }}>{pagination.page}</span>
              <button onClick={pagination.onNext} disabled={pagination.disableNext} className="h-6.5 w-6.5 rounded-md border flex items-center justify-center transition-colors hover:bg-[var(--app-control-hover)] disabled:opacity-40" style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
