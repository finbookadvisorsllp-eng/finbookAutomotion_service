// Calming ambient: a dense drift of falling cherry-blossom petals behind the
// workspace. Pure CSS (see .petal in index.css), hidden on reduced-motion.
// Randomized once at module load so they don't reshuffle on every render.
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

export default function PetalField() {
  return (
    <div className="petal-field" aria-hidden="true">
      {PETALS.map(({ key, left, ...vars }) => (
        <span key={key} className="petal" style={{ left, ...vars }} />
      ))}
    </div>
  )
}
