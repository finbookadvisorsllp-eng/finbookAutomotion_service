import { motion } from 'motion/react'

// Shared button. Blue accent = action elements; red --app-cta = primary CTA (ERP).
// Filled variants (primary/cta) are pill-shaped; the rest use the small ERP radius.
//   variant: cta | primary | ghost | danger | subtle
//   size:    sm | md
//   iconOnly: square icon button (pass `icon`, no children)
const SIZES = {
  sm: { h: 'h-7.5', px: 'px-2.5', text: 'text-[10.5px]', sq: 'h-7.5 w-7.5', gap: 'gap-1' },
  md: { h: 'h-9', px: 'px-3', text: 'text-[12px]', sq: 'h-9 w-9', gap: 'gap-1.5' },
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
  const isq = iconSize ?? (size === 'md' ? 14 : 12)

  const pill = variant === 'primary' || variant === 'cta'
  const base =
    `inline-flex items-center justify-center ${pill ? 'rounded-full' : 'rounded-md'} font-semibold transition-all focus-ring disabled:opacity-50 disabled:pointer-events-none select-none`

  const variants = {
    cta: { color: '#fff', backgroundColor: 'var(--app-cta)', border: '1px solid transparent', boxShadow: 'var(--app-shadow)' },
    primary: { color: '#fff', background: 'var(--app-accent-gradient)', border: '1px solid transparent', boxShadow: 'var(--app-shadow)' },
    subtle: { color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)', border: '1px solid var(--app-border)' },
    ghost: { color: 'var(--app-text)', backgroundColor: 'transparent', border: '1px solid transparent' },
    danger: { color: 'var(--app-danger-text)', backgroundColor: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)' },
  }

  const shape = iconOnly ? s.sq : `${s.h} ${s.px} ${s.gap}`
  // Icon-only buttons have no text node → give screen readers a name.
  const a11yLabel = iconOnly ? (props['aria-label'] ?? props.title ?? Icon?.displayName) : props['aria-label']

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: pill ? -1 : 0 }}
      className={`${base} ${shape} ${s.text} ${className}`}
      style={variants[variant] || variants.subtle}
      {...props}
      aria-label={a11yLabel}
    >
      {Icon && <Icon size={isq} strokeWidth={2.2} />}
      {!iconOnly && children}
    </motion.button>
  )
}
