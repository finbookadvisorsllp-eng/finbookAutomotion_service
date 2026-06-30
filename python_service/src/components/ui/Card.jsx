import { motion } from 'motion/react'

// Neutral panel surface. One source for the rounded/bordered card look so we
// stop repeating border + bg + shadow inline everywhere.
export default function Card({ children, className = '', hover = false, animate = false, style, ...props }) {
  const Comp = animate ? motion.div : 'div'
  const motionProps = animate
    ? { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
    : {}
  return (
    <Comp
      {...motionProps}
      className={`rounded-xl border transition-shadow ${hover ? 'hover:shadow-sm' : ''} ${className}`}
      style={{
        borderColor: 'var(--app-border)',
        backgroundColor: 'var(--app-panel-bg)',
        ...style,
      }}
      {...props}
    >
      {children}
    </Comp>
  )
}
