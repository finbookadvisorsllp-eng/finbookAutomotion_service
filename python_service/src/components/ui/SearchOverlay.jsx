import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Receipt, BookOpen, Users, RefreshCw, Sparkles, CornerDownLeft } from 'lucide-react'

// ⌘K / Ctrl+K intelligent search. Self-contained: owns its open state + global
// shortcut. Mock result set; wire to a real index later.
const RESULTS = [
  { group: 'Vouchers', icon: Receipt, items: ['Sales Invoice INV-1042 — ABC Industries', 'Purchase Invoice PI-908 — New Horizon Ltd', 'Draft vouchers (12)'] },
  { group: 'Masters', icon: BookOpen, items: ['Ledger: ABC Industries', 'Stock Item: Steel Rod 12mm', 'Unmapped ledgers (4)'] },
  { group: 'Parties', icon: Users, items: ['ABC Industries', 'New Horizon Ltd', 'Greenline Ventures'] },
  { group: 'Tally Sync', icon: RefreshCw, items: ['Last export — 40 vouchers', 'Connector status', 'Pending exports (40)'] },
  { group: 'AI Insights', icon: Sparkles, items: ['Duplicate vouchers', 'Unmapped masters', 'Recommended actions'] },
]

export default function SearchOverlay() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) }
      else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (!open) setQ('') }, [open])

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return RESULTS
    return RESULTS.map((g) => ({ ...g, items: g.items.filter((it) => it.toLowerCase().includes(term)) })).filter((g) => g.items.length)
  }, [q])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[150] flex items-start justify-center pt-[12vh] px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow-lg)' }}
          >
            <div className="flex items-center gap-2.5 px-4 h-14 border-b" style={{ borderColor: 'var(--app-border)' }}>
              <Search size={18} style={{ color: 'var(--app-accent)' }} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoices, GST, clients, insights…" className="flex-1 bg-transparent outline-none text-[14px] font-medium" style={{ color: 'var(--app-heading)' }} />
              <kbd className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}>ESC</kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto themed-scrollbar p-2">
              {groups.length === 0 && <p className="text-center text-[12px] py-10" style={{ color: 'var(--app-muted)' }}>No matches for “{q}”.</p>}
              {groups.map((g) => {
                const Icon = g.icon
                return (
                  <div key={g.group} className="mb-1.5">
                    <div className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>{g.group}</div>
                    {g.items.map((it) => (
                      <button key={it} onClick={() => setOpen(false)} className="group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--app-accent-soft)]">
                        <span className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-control-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-border)' }}>
                          <Icon size={12} />
                        </span>
                        <span className="flex-1 text-[12.5px] font-medium truncate" style={{ color: 'var(--app-heading)' }}>{it}</span>
                        <CornerDownLeft size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--app-muted)' }} />
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
