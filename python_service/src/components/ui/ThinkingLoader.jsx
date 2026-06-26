import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Loader2, Sparkles } from 'lucide-react'

const DEFAULT_STEPS = [
  'Reading invoices…',
  'Comparing GST returns…',
  'Checking supplier compliance…',
  'Finding anomalies…',
  'Generating recommendations…',
]

// Mock "AI at work" loader — advances through steps so waiting feels productive.
// ponytail: timer-driven, not tied to real progress; wire to real stages later.
export default function ThinkingLoader({ steps = DEFAULT_STEPS, interval = 850, className = '' }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((p) => Math.min(p + 1, steps.length - 1)), interval)
    return () => clearInterval(id)
  }, [steps.length, interval])

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
          <Sparkles size={17} strokeWidth={2.2} />
        </span>
        <span className="text-[13px] font-bold" style={{ color: 'var(--app-heading)' }}>AI is working…</span>
      </div>
      <div className="space-y-1.5 w-56">
        {steps.map((step, idx) => {
          const done = idx < i
          const active = idx === i
          if (idx > i) return null
          return (
            <AnimatePresence key={step} mode="popLayout">
              <motion.div
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: done ? 0.55 : 1, x: 0 }}
                className="flex items-center gap-2 text-[11.5px] font-medium"
                style={{ color: done ? 'var(--app-muted)' : 'var(--app-heading)' }}
              >
                {done ? <Check size={13} className="text-emerald-500 shrink-0" />
                  : active ? <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--app-accent)' }} />
                  : <span className="h-3 w-3 shrink-0" />}
                {step}
              </motion.div>
            </AnimatePresence>
          )
        })}
      </div>
    </div>
  )
}
