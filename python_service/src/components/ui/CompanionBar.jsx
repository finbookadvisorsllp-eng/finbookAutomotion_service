import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, ChevronRight } from 'lucide-react'

// Ambient AI companion — a slim floating dock that rotates proactive insights.
// Mock data; swap INSIGHTS for a real feed later.
const INSIGHTS = [
  '128 vouchers imported today — 12 are still in draft. Want me to push them to review?',
  'Supplier ledger “XYZ” is unmapped in Tally. Exports may fail until it’s linked.',
  '3 invoices look like duplicates. Shall I flag them before export?',
  '40 approved vouchers are ready to export to Tally. Run the sync now?',
  '2 stock items are missing units — fixing them will speed up the next export.',
]

function Face() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--app-accent)" strokeWidth="2.4" />
      <motion.g animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 3.5 }} style={{ transformBox: 'view-box', transformOrigin: '20px 17px' }}>
        <circle cx="15" cy="17" r="1.8" fill="var(--app-accent)" />
        <circle cx="25" cy="17" r="1.8" fill="var(--app-accent)" />
      </motion.g>
      <path d="M14 24 q6 5 12 0" fill="none" stroke="var(--app-accent)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default function CompanionBar() {
  const [open, setOpen] = useState(true)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setI((p) => (p + 1) % INSIGHTS.length), 6500)
    return () => clearInterval(id)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="absolute bottom-4 right-4 z-30 w-[330px] max-w-[calc(100%-2rem)] rounded-2xl border p-3 pr-2 hidden md:flex items-start gap-2.5"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow-lg)', backdropFilter: 'blur(8px)' }}
        >
          <Face />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold" style={{ color: 'var(--app-heading)' }}>Sage</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>watching</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
                className="text-[11.5px] font-medium mt-1 leading-snug" style={{ color: 'var(--app-text)' }}
              >
                {INSIGHTS[i]}
              </motion.p>
            </AnimatePresence>
            <button className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold hover:gap-1.5 transition-all" style={{ color: 'var(--app-accent)' }}>
              Investigate <ChevronRight size={12} />
            </button>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-md transition-colors hover:bg-[var(--app-control-hover)] shrink-0" style={{ color: 'var(--app-muted)' }} aria-label="Dismiss">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
