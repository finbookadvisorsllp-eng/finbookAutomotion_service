import { motion } from 'motion/react'

// Non-human "object" doodles for upload / OCR / approval flows. Monoline,
// currentColor + accent, animated. tint via wrapper color (default accent).
//   name: upload | scan | approve | processing
export default function ObjectDoodle({ name = 'upload', className = '', tint = 'var(--app-accent)', style }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const a = { ...s, stroke: tint }
  const svg = (children) => (
    <svg viewBox="0 0 200 150" className={className} style={{ color: 'var(--app-muted)', ...style }} aria-hidden="true">{children}</svg>
  )

  switch (name) {
    case 'scan': // document + moving scan line (OCR)
      return svg(<>
        <rect {...s} x="62" y="34" width="76" height="92" rx="8" />
        <path {...s} d="M78 58 h44 M78 74 h44 M78 90 h30" opacity="0.5" />
        <motion.line x1="56" y1="60" x2="144" y2="60" stroke={tint} strokeWidth="3" strokeLinecap="round"
          animate={{ y: [0, 56, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.circle cx="150" cy="40" r="3" fill={tint} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.8, repeat: Infinity }} />
      </>)

    case 'approve': // clipboard + drawing check
      return svg(<>
        <rect {...s} x="58" y="36" width="84" height="92" rx="9" />
        <rect {...s} x="82" y="28" width="36" height="16" rx="5" fill="var(--app-panel-bg)" />
        <path {...s} d="M74 96 h26" opacity="0.5" />
        <motion.path d="M74 74 l14 14 l26 -30" {...a} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.6 }} />
      </>)

    case 'processing': // gear + orbiting spark
      return svg(<>
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} style={{ transformBox: 'view-box', transformOrigin: '100px 80px' }}>
          <circle {...a} cx="100" cy="80" r="22" />
          <circle {...s} cx="100" cy="80" r="9" />
          {[0, 60, 120, 180, 240, 300].map((d) => {
            const r = d * Math.PI / 180
            return <line key={d} {...a} x1={100 + Math.cos(r) * 22} y1={80 + Math.sin(r) * 22} x2={100 + Math.cos(r) * 30} y2={80 + Math.sin(r) * 30} />
          })}
        </motion.g>
        <motion.circle cx="148" cy="44" r="3.5" fill={tint} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 2.2, repeat: Infinity }} />
      </>)

    default: // upload — cloud + bobbing arrow + tray
      return svg(<>
        <path {...s} d="M68 92 a22 22 0 0 1 3 -43 a26 26 0 0 1 49 -5 a19 19 0 0 1 20 18 a17 17 0 0 1 -14 30 Z" />
        <motion.path {...a} d="M100 104 v-30 M88 84 l12 -12 l12 12"
          animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
        <path {...s} d="M58 116 h84" strokeDasharray="2 10" opacity="0.5" />
      </>)
  }
}
