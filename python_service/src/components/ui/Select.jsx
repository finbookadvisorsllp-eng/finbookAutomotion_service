import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Search } from 'lucide-react'

// Themed dropdown — consolidates the near-identical dropdowns in Navbar and
// DashboardTable. options: string[] OR { value, label }[]. Controlled via value.
export default function Select({
  label,
  value,
  options = [],
  onChange,
  icon: Icon,
  placeholder = 'Select',
  align = 'left',
  minWidth = 120,
  className = '',
  searchable = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const norm = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = norm.find((o) => o.value === value)
  const visible = searchable && query.trim()
    ? norm.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : norm

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && (
        <span className="block text-[9px] font-extrabold uppercase tracking-widest leading-none mb-1 opacity-80" style={{ color: 'var(--app-muted)' }}>
          {label}
        </span>
      )}
      <motion.button
        whileTap={{ scale: 0.99 }}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="h-9 px-2.5 rounded-lg border inline-flex items-center justify-between gap-1.5 text-[12px] font-semibold transition-colors hover:border-[var(--app-accent)]"
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)', minWidth }}
      >
        <span className="inline-flex items-center gap-1.5 truncate">
          {Icon && (
            <span className="flex h-5 w-5 items-center justify-center rounded-md shrink-0" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
              <Icon size={11} strokeWidth={2.5} />
            </span>
          )}
          <span className="truncate">{current?.label ?? placeholder}</span>
        </span>
        <ChevronDown size={13} className="shrink-0" style={{ color: 'var(--app-muted)' }} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 mt-1 min-w-full rounded-xl border p-1 shadow-2xl glass-surface ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{ borderColor: 'var(--app-border)' }}
          >
            {searchable && (
              <div className="mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}>
                <Search size={12} style={{ color: 'var(--app-muted)' }} />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-full bg-transparent text-[11px] outline-none" style={{ color: 'var(--app-heading)' }} />
              </div>
            )}
            <div className="max-h-56 overflow-y-auto themed-scrollbar space-y-0.5">
            {visible.length === 0 && <p className="px-2 py-3 text-center text-[11px]" style={{ color: 'var(--app-muted)' }}>No match</p>}
            {visible.map((opt) => {
              const active = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange?.(opt.value); setOpen(false); setQuery('') }}
                  className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-[var(--app-control-hover)]"
                  style={{ color: active ? 'var(--app-accent)' : 'var(--app-heading)', backgroundColor: active ? 'var(--app-accent-soft)' : 'transparent', fontWeight: active ? 600 : 500 }}
                >
                  {opt.label}
                </button>
              )
            })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
