import { motion } from 'motion/react'

// Animated greeting doodle: a friendly character that bobs + waves, with a
// time-of-day badge (sun spins by day, moon by night) and twinkling sparkles.
// transform-box:view-box maps px transform-origins to viewBox units so the
// wave rotates around the shoulder cleanly.
export default function HeroDoodle({ tod = 'day', className = '', style }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 3.4, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const a = { ...s, stroke: 'var(--app-accent)' }
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]

  return (
    <svg viewBox="0 0 200 160" className={className} style={style} aria-hidden="true">
      {/* time-of-day badge */}
      {tod === 'night' ? (
        <path {...a} d="M158 30 a16 16 0 1 0 12 25 a20 20 0 0 1 -12 -25 Z" />
      ) : (
        <motion.g style={{ transformBox: 'view-box', transformOrigin: '152px 38px' }} animate={{ rotate: 360 }} transition={{ duration: 44, repeat: Infinity, ease: 'linear' }}>
          <circle {...a} cx="152" cy="38" r="11" />
          {rays.map((d) => {
            const r = d * Math.PI / 180
            return <line key={d} {...a} x1={152 + Math.cos(r) * 17} y1={38 + Math.sin(r) * 17} x2={152 + Math.cos(r) * 23} y2={38 + Math.sin(r) * 23} />
          })}
        </motion.g>
      )}

      {/* character — gentle bob */}
      <motion.g animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <circle {...s} cx="70" cy="58" r="22" />
        <circle cx="63" cy="56" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="78" cy="56" r="2.4" fill="currentColor" stroke="none" />
        <path {...s} d="M62 65 q8 8 16 0" />
        <path {...s} d="M70 80 v34 M70 114 l-14 22 M70 114 l14 22" />
        <path {...s} d="M70 90 l-20 16" />
        {/* waving arm */}
        <motion.g style={{ transformBox: 'view-box', transformOrigin: '70px 90px' }} animate={{ rotate: [0, 20, 4, 18, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <path {...a} d="M70 90 l22 -12 M92 78 l-1 -8 M92 78 l7 -3" />
        </motion.g>
      </motion.g>

      {/* sparkles */}
      <motion.path {...a} d="M36 28 l0 9 M31.5 32.5 l9 0" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.circle {...a} cx="118" cy="120" r="3" animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.circle {...s} cx="34" cy="96" r="2.5" animate={{ opacity: [0.15, 0.7, 0.15] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }} />
    </svg>
  )
}
