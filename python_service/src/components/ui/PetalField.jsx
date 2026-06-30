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
    '--psway': `${Math.round(Math.random() * 120 - 60)}px`,// gust drift ±60px
    '--pg': `${(3.5 + Math.random() * 5).toFixed(1)}s`,    // 3.5–8.5s gust sway
    '--pt': `${(2.2 + Math.random() * 3.4).toFixed(1)}s`,  // 2.2–5.6s flutter/tumble
    '--po': (0.2 + Math.random() * 0.35).toFixed(2),       // 0.20–0.55 opacity
  }
})

export default function PetalField() {
  return (
    <div className="petal-field" aria-hidden="true">
      {PETALS.map(({ key, left, ...vars }) => (
        <span key={key} className="petal" style={{ left, ...vars }}>
          <span className="petal-gust">
            <span className="petal-spin">
              <svg viewBox="0 0 24 26">
                {/* Sakura petal — rounded body, narrow base, notched outer tip. */}
                <path
                  d="M12 25 C4 20 1 13 3 8 C4.4 4.4 8 3.6 10.4 6.2 C11 6.9 11.4 7.8 12 9 C12.6 7.8 13 6.9 13.6 6.2 C16 3.6 19.6 4.4 21 8 C23 13 20 20 12 25 Z"
                  fill="var(--app-petal)"
                />
              </svg>
            </span>
          </span>
        </span>
      ))}
    </div>
  )
}
