import { motion } from 'motion/react'

// Professional single-accent flat illustration (undraw style): a person working
// at a desk, with a window whose sky changes by time of day. Subtle life:
// breathing, coffee steam, screen glow, sun rays / twinkling stars.
//   tod: 'morning' | 'afternoon' | 'evening' | 'night'
export default function HeroDoodle({ tod = 'afternoon', className = '', style }) {
  const A = 'var(--app-accent)'

  const sky = () => {
    if (tod === 'night') {
      return (
        <>
          <path d="M186 36 a11 11 0 1 0 8 18 a14 14 0 0 1 -8 -18 Z" fill={A} />
          {[[164, 34], [200, 56], [172, 60]].map(([x, y], i) => (
            <motion.path key={i} d={`M${x} ${y - 3} v6 M${x - 3} ${y} h6`} stroke={A} strokeWidth="1.6" strokeLinecap="round"
              animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 2.4 + i, repeat: Infinity, ease: 'easeInOut' }} />
          ))}
        </>
      )
    }
    const cy = tod === 'afternoon' ? 38 : 54 // morning/evening sit low
    const
      n = tod === 'evening' ? 5 : 8
    return (
      <>
        <circle cx="182" cy={cy} r="10" fill={A} fillOpacity="0.85" />
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} style={{ transformBox: 'view-box', transformOrigin: `182px ${cy}px` }}>
          {Array.from({ length: n }).map((_, i) => {
            const r = (i * (360 / n)) * Math.PI / 180
            return <line key={i} x1={182 + Math.cos(r) * 14} y1={cy + Math.sin(r) * 14} x2={182 + Math.cos(r) * 18} y2={cy + Math.sin(r) * 18} stroke={A} strokeWidth="1.8" strokeLinecap="round" />
          })}
        </motion.g>
      </>
    )
  }

  return (
    <svg viewBox="0 0 240 160" className={className} style={style} aria-hidden="true">
      {/* soft backdrop */}
      <circle cx="118" cy="78" r="68" fill={A} fillOpacity="0.06" />

      {/* window with time-of-day sky */}
      <rect x="150" y="18" width="64" height="56" rx="9" fill={A} fillOpacity="0.07" stroke={A} strokeOpacity="0.35" strokeWidth="2" />
      <line x1="182" y1="18" x2="182" y2="74" stroke={A} strokeOpacity="0.18" strokeWidth="1.5" />
      <line x1="150" y1="46" x2="214" y2="46" stroke={A} strokeOpacity="0.18" strokeWidth="1.5" />
      <g clipPath="none">{sky()}</g>

      {/* plant */}
      <g>
        <path d="M40 112 q-6 -18 2 -28 M40 112 q6 -16 -1 -30 M40 112 q12 -10 14 -22" fill="none" stroke={A} strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.7" />
        <path d="M32 112 h16 l-2 14 h-12 Z" fill={A} fillOpacity="0.85" />
      </g>

      {/* person — gentle breathing */}
      <motion.g animate={{ y: [0, -1.6, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
        <ellipse cx="98" cy="116" rx="34" ry="26" fill={A} />
        <circle cx="98" cy="74" r="17" fill={A} />
        <path d="M81 70 a17 17 0 0 1 34 0 q-17 -12 -34 0 Z" fill={A} fillOpacity="0.55" />
      </motion.g>

      {/* desk */}
      <rect x="22" y="118" width="196" height="9" rx="4.5" fill={A} fillOpacity="0.85" />
      <rect x="40" y="127" width="6" height="20" rx="3" fill={A} fillOpacity="0.3" />
      <rect x="194" y="127" width="6" height="20" rx="3" fill={A} fillOpacity="0.3" />

      {/* laptop in front */}
      <rect x="78" y="98" width="40" height="22" rx="3" fill="var(--app-panel-bg)" stroke={A} strokeWidth="2.5" />
      <motion.rect x="82" y="102" width="32" height="14" rx="1.5" fill={A} animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
      <rect x="72" y="118" width="52" height="4" rx="2" fill={A} fillOpacity="0.5" />

      {/* coffee + steam */}
      <path d="M132 110 h12 v7 a4 4 0 0 1 -4 4 h-4 a4 4 0 0 1 -4 -4 Z" fill="none" stroke={A} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M144 112 h4 a3 3 0 0 1 0 6 h-4" fill="none" stroke={A} strokeWidth="2.4" />
      {[136, 141].map((x, i) => (
        <motion.path key={x} d={`M${x} 104 q3 -4 0 -8`} fill="none" stroke={A} strokeWidth="1.8" strokeLinecap="round"
          animate={{ opacity: [0, 0.7, 0], y: [2, -6, -10] }} transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }} />
      ))}

      {/* floating accents */}
      <motion.circle cx="210" cy="100" r="3.2" fill={A} animate={{ y: [0, -7, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
    </svg>
  )
}
