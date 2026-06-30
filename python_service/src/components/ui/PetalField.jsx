// Calming ambient: two sakura tree silhouettes at the bottom corners + a dense
// drift of falling cherry-blossom petals behind the workspace. Pure CSS/SVG, no
// deps; petals are CSS-animated (see .petal in index.css) and hidden on
// reduced-motion. Randomized once at module load so they don't reshuffle.
const PETAL_COUNT = 70

const PETALS = Array.from({ length: PETAL_COUNT }, (_, i) => {
  const size = 7 + Math.round(Math.random() * 10) // 7–17px
  return {
    key: i,
    left: `${(Math.random() * 100).toFixed(1)}%`,
    '--ps': `${size}px`,
    '--pd': `${(9 + Math.random() * 13).toFixed(1)}s`,    // 9–22s fall
    '--pdelay': `${(-Math.random() * 22).toFixed(1)}s`,    // negative → already mid-fall, staggered
    '--psway': `${Math.round(Math.random() * 120 - 60)}px`,// drift ±60px
    '--po': (0.2 + Math.random() * 0.35).toFixed(2),       // 0.20–0.55 opacity
  }
})

// Sakura tree silhouette — forked trunk + soft blossom canopy.
function SakuraTree({ className, flip = false }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d="M100 200 L100 118 M100 150 L68 116 M100 140 L134 104 M100 128 L82 100 M100 132 L120 96"
        stroke="#8A5A44" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="var(--app-petal)">
        <circle cx="100" cy="78" r="36" />
        <circle cx="66" cy="94" r="27" />
        <circle cx="134" cy="92" r="27" />
        <circle cx="84" cy="58" r="23" />
        <circle cx="118" cy="60" r="23" />
        <circle cx="100" cy="104" r="25" />
        <circle cx="50" cy="74" r="17" />
        <circle cx="150" cy="74" r="17" />
      </g>
    </svg>
  )
}

export default function PetalField() {
  return (
    <div className="petal-field" aria-hidden="true">
      <SakuraTree className="absolute bottom-0 left-0 w-40 sm:w-52 opacity-40" />
      <SakuraTree className="absolute bottom-0 right-0 w-36 sm:w-48 opacity-35" flip />
      {PETALS.map(({ key, left, ...vars }) => (
        <span key={key} className="petal" style={{ left, ...vars }} />
      ))}
    </div>
  )
}
