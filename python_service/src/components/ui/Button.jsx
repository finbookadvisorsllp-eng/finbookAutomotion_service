import { motion } from 'motion/react'

// Material 3 button. Every <Button> across the app is M3 — filled / tonal /
// outlined / text / elevated / fab — each with a state layer (.m3-state span).
//   variant: primary(filled) | tonal | subtle(=tonal) | outlined | ghost(text)
//            | elevated | danger | cta | fab
//   size:    sm | md   ·   iconOnly: square/circular icon button   ·   fab: rounded
const SIZES = {
  sm: { h: 'h-7.5', px: 'px-3.5', text: 'text-[10.5px]', sq: 'h-7.5 w-7.5', gap: 'gap-1.5' },
  md: { h: 'h-9', px: 'px-5', text: 'text-[12px]', sq: 'h-9 w-9', gap: 'gap-2' },
}

const VARIANTS = {
  primary:  { color: 'var(--app-on-accent)', backgroundColor: 'var(--app-accent)', border: '1px solid transparent' },
  tonal:    { color: 'var(--app-on-secondary-container)', backgroundColor: 'var(--app-secondary-container)', border: '1px solid transparent' },
  subtle:   { color: 'var(--app-on-secondary-container)', backgroundColor: 'var(--app-secondary-container)', border: '1px solid transparent' },
  outlined: { color: 'var(--app-accent)', backgroundColor: 'transparent', border: '1px solid var(--app-border)' },
  ghost:    { color: 'var(--app-accent)', backgroundColor: 'transparent', border: '1px solid transparent' },
  elevated: { color: 'var(--app-accent)', backgroundColor: 'var(--app-panel-bg)', border: '1px solid transparent', boxShadow: 'var(--app-shadow)' },
  danger:   { color: 'var(--app-danger-text)', backgroundColor: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)' },
  cta:      { color: '#fff', backgroundColor: 'var(--app-cta)', border: '1px solid transparent' },
  fab:      { color: 'var(--app-on-secondary-container)', backgroundColor: 'var(--app-secondary-container)', border: '1px solid transparent', boxShadow: 'var(--app-shadow-lg)' },
}

export default function Button({
  children,
  icon: Icon,
  variant = 'subtle',
  size = 'sm',
  iconOnly = false,
  className = '',
  iconSize,
  ...props
}) {
  const s = SIZES[size] || SIZES.sm
  const isFab = variant === 'fab'
  const isq = iconSize ?? (isFab ? 20 : size === 'md' ? 16 : 14)
  const style = VARIANTS[variant] || VARIANTS.subtle

  // Filled/tonal buttons are M3 pills; FAB uses the M3 rounded-2xl (16px) shape.
  const radius = isFab ? 'rounded-2xl' : 'rounded-full'
  const base =
    `m3-interactive inline-flex items-center justify-center ${radius} font-semibold transition-shadow focus-ring disabled:opacity-50 disabled:pointer-events-none select-none`
  const shape = isFab
    ? (iconOnly ? 'h-12 w-12' : 'h-12 px-5 gap-2')
    : (iconOnly ? s.sq : `${s.h} ${s.px} ${s.gap}`)

  // Icon-only buttons have no text node → give screen readers a name.
  const a11yLabel = iconOnly ? (props['aria-label'] ?? props.title ?? Icon?.displayName) : props['aria-label']

  // M3 ripple: place the origin at the click point, restart the keyframe.
  const ripple = (e) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--m3-rx', `${e.clientX - r.left}px`)
    el.style.setProperty('--m3-ry', `${e.clientY - r.top}px`)
    el.classList.remove('m3-rippling')
    void el.offsetWidth // reflow → restart animation on rapid clicks
    el.classList.add('m3-rippling')
    props.onPointerDown?.(e)
  }

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: isFab ? -1 : 0 }}
      className={`${base} ${shape} ${s.text} ${className}`}
      style={style}
      {...props}
      onPointerDown={ripple}
      aria-label={a11yLabel}
    >
      {Icon && <Icon size={isFab ? 22 : isq} strokeWidth={2.2} />}
      {!iconOnly && children}
    </motion.button>
  )
}
