import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle, X } from 'lucide-react'
import Button from './Button'

// Promise-based confirm to replace window.confirm without changing call sites'
// control flow:  const confirm = useConfirm();  if (await confirm({...})) {...}
const ConfirmContext = createContext(() => Promise.resolve(true))
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // { opts, resolve }

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setState({ opts: opts || {}, resolve })),
    [],
  )

  const close = (result) => {
    state?.resolve(result)
    setState(null)
  }

  // Esc cancels, Enter confirms while the dialog is open.
  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false) }
      else if (e.key === 'Enter') { e.preventDefault(); close(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  const o = state?.opts || {}
  const danger = o.tone !== 'default'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => close(false)} />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm rounded-2xl border p-5 glass-surface"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow-lg)' }}
            >
              <button onClick={() => close(false)} className="absolute right-3 top-3 p-1 rounded-md transition-colors hover:bg-[var(--app-control-hover)]" style={{ color: 'var(--app-muted)' }}>
                <X size={15} />
              </button>
              <div className="flex items-start gap-3">
                <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-rose-500/12 text-rose-500' : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'}`}>
                  <AlertTriangle size={17} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--app-heading)' }}>{o.title || 'Are you sure?'}</h3>
                  {o.message && <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--app-muted)' }}>{o.message}</p>}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <Button variant="subtle" size="md" onClick={() => close(false)}>{o.cancelText || 'Cancel'}</Button>
                <Button variant={danger ? 'danger' : 'primary'} size="md" onClick={() => close(true)}>{o.confirmText || 'Confirm'}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}
