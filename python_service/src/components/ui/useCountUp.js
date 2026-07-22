import { useEffect, useState } from 'react'

// Animate a value (number or string like "25,648" / "12.39%" / "₹18.2L") from
// 0 → target on mount, preserving prefix/suffix/decimals. Non-numeric → raw.
export default function useCountUp(value, duration = 900) {
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
