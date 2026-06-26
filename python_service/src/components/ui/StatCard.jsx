import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

// Animate a value string (e.g. "25,648", "12.39%", "₹18.2L") from 0 → target
// on mount, preserving its prefix/suffix and decimals. Non-numeric → shown raw.
function useCountUp(value, duration = 900) {
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    const m = String(value).match(/^(\D*)([\d,]*\.?\d+)(\D*)$/)
    if (!m) { setDisplay(value); return }
    const [, prefix, num, suffix] = m
    const target = parseFloat(num.replace(/,/g, ''))
    const decimals = (num.split('.')[1] || '').length
    const grouped = num.includes(',')
    const fmt = (n) => {
      let str = decimals ? n.toFixed(decimals) : String(Math.round(n))
      if (grouped) str = Number(str).toLocaleString('en-IN')
      return prefix + str + suffix
    }
    let raf, start
    const step = (t) => {
      if (!start) start = t
      const p = Math.min((t - start) / duration, 1)
      setDisplay(fmt(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return display
}

// Minimalist KPI card: neutral surface, accent icon, semantic delta, animated
// value + a gentle cursor tilt ("invisible delight"). Calm, not flashy.
export default function StatCard({ label, value, icon: Icon, delta, right, index = 0 }) {
  const up = delta?.dir !== 'down'
  const display = useCountUp(value)
  const ref = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: py * -3, y: px * 3 })
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ opacity: { duration: 0.32, delay: index * 0.04 }, y: { duration: 0.32, delay: index * 0.04 }, rotateX: { duration: 0.3 }, rotateY: { duration: 0.3 }, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      whileHover={{ y: -2 }}
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow)', transformPerspective: 800 }}
      className="rounded-xl border p-3 flex items-start justify-between gap-2 transition-shadow hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {Icon && (
            <span className="h-5 w-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}>
              <Icon size={12} strokeWidth={2.2} />
            </span>
          )}
          <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--app-muted)' }}>{label}</span>
        </div>
        <h3 className="text-[20px] font-extrabold mt-1.5 leading-none tracking-tight tabular-nums" style={{ color: 'var(--app-heading)' }}>
          {display}
        </h3>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold mt-1.5 ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {delta.value}
            <span className="font-medium" style={{ color: 'var(--app-muted)' }}>vs last month</span>
          </span>
        )}
      </div>
      {right && <div className="shrink-0 flex items-center">{right}</div>}
    </motion.div>
  )
}
