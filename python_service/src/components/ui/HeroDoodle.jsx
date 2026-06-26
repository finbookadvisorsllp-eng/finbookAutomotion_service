import { motion } from 'motion/react'

// Refined hero graphic: a glassy analytics card with a line chart that draws
// itself, a tracing pulse dot, and a slowly-rotating import/export sync badge.
// Abstract + premium (no character). currentColor tints the neutral strokes;
// the accent carries the data. `tod` kept for call-site compat (unused).
export default function HeroDoodle({ className = '', style }) {
  const line = 'M40 108 L64 92 L88 98 L112 72 L136 82 L160 54'
  const pts = [[40, 108], [64, 92], [88, 98], [112, 72], [136, 82], [160, 54]]

  return (
    <svg viewBox="0 0 240 160" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="hdFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--app-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--app-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* glass card */}
      <rect x="22" y="26" width="156" height="110" rx="16" fill="var(--app-panel-bg)" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
      {/* card header */}
      <circle cx="38" cy="42" r="3" fill="var(--app-accent)" />
      <rect x="48" y="39" width="42" height="5" rx="2.5" fill="currentColor" opacity="0.18" />
      <rect x="48" y="48" width="26" height="4" rx="2" fill="currentColor" opacity="0.12" />
      {/* gridlines */}
      {[72, 92, 112].map((y) => <line key={y} x1="36" y1={y} x2="164" y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1.5" />)}

      {/* area + animated line */}
      <motion.path
        d={`${line} L160 122 L40 122 Z`} fill="url(#hdFill)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }}
      />
      <motion.path
        d={line} fill="none" stroke="var(--app-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />
      {pts.map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r="2.6" fill="var(--app-panel-bg)" stroke="var(--app-accent)" strokeWidth="2"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 + i * 0.14 }} style={{ transformBox: 'view-box', transformOrigin: `${x}px ${y}px` }} />
      ))}
      {/* tracing pulse at the latest point */}
      <motion.circle cx="160" cy="54" r="5" fill="var(--app-accent)" animate={{ opacity: [0.5, 0, 0.5], scale: [1, 2.4, 1] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }} style={{ transformBox: 'view-box', transformOrigin: '160px 54px' }} />
      <circle cx="160" cy="54" r="3.2" fill="var(--app-accent)" />

      {/* import / export sync badge */}
      <g transform="translate(198 44)">
        <circle r="15" fill="var(--app-accent)" fillOpacity="0.1" stroke="var(--app-accent)" strokeOpacity="0.25" strokeWidth="1.5" />
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '0px 0px' }}>
          <path d="M-7 -2 A7 7 0 0 1 6 -3" fill="none" stroke="var(--app-accent)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M6 -3 l-3 -2.5 M6 -3 l1 3.5" fill="none" stroke="var(--app-accent)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M7 2 A7 7 0 0 1 -6 3" fill="none" stroke="var(--app-accent)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M-6 3 l3 2.5 M-6 3 l-1 -3.5" fill="none" stroke="var(--app-accent)" strokeWidth="2.2" strokeLinecap="round" />
        </motion.g>
      </g>

      {/* floating accents */}
      <motion.circle cx="206" cy="110" r="3.5" fill="var(--app-accent)" animate={{ y: [0, -7, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.circle cx="30" cy="74" r="2.5" fill="currentColor" opacity="0.3" animate={{ y: [0, 6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} />
    </svg>
  )
}
