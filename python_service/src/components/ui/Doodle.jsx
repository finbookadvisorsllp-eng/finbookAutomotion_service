// Lightweight inline "doodle"-style line illustrations (Open Doodles vibe,
// drawn locally so there's zero external asset/dep and it works offline).
// Main strokes use currentColor — set the wrapper's text color to tint;
// highlight strokes use the accent. To use the *real* Open Doodles art, drop
// their SVG at /public and swap a branch's <svg> body — call sites stay the same.
export default function Doodle({ name = 'empty', className = '', style }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const a = { ...s, stroke: 'var(--app-accent)' }
  const svg = (children) => (
    <svg viewBox="0 0 240 180" className={className} style={style} aria-hidden="true">{children}</svg>
  )

  switch (name) {
    case 'welcome': // paper plane + trail — onboarding / send
      return svg(<>
        <path {...a} d="M34 132 L206 58 L150 158 L126 116 Z" />
        <path {...s} d="M206 58 L126 116" />
        <path {...s} d="M126 116 L150 158" opacity="0.5" />
        <path {...s} strokeDasharray="2 12" d="M30 96 C70 92 96 104 126 116" opacity="0.55" />
        <circle {...s} cx="52" cy="64" r="3" opacity="0.5" />
        <circle {...a} cx="210" cy="146" r="3" opacity="0.7" />
      </>)

    case 'error': // unplugged cord — something broke
      return svg(<>
        <path {...s} d="M70 70 v18 a26 26 0 0 0 26 26 h8" />
        <rect {...a} x="48" y="52" width="20" height="14" rx="3" />
        <rect {...a} x="48" y="74" width="20" height="14" rx="3" />
        <path {...s} d="M170 110 v-18 a26 26 0 0 0-26-26 h-8" opacity="0.9" />
        <rect {...a} x="172" y="92" width="20" height="14" rx="3" />
        <rect {...a} x="172" y="114" width="20" height="14" rx="3" />
        <path {...s} d="M118 92 l8 8 M126 92 l-8 8" opacity="0.7" />
        <path {...s} strokeDasharray="2 11" d="M104 104 q10 14 22 0" opacity="0.5" />
      </>)

    case 'lost': // compass — 404 / not found
      return svg(<>
        <circle {...s} cx="120" cy="92" r="52" />
        <circle {...s} cx="120" cy="92" r="4" />
        <path {...a} d="M120 92 L150 62 L130 100 Z" />
        <path {...s} d="M120 92 L90 122 L110 84 Z" opacity="0.6" />
        <path {...s} d="M120 32 v8 M120 144 v8 M60 92 h8 M172 92 h8" opacity="0.55" />
      </>)

    case 'done': // checkmark badge — all caught up
      return svg(<>
        <circle {...s} cx="120" cy="92" r="48" />
        <path {...a} d="M98 94 l16 16 l30 -34" />
        <path {...s} d="M70 50 l6 0 M73 47 l0 6" opacity="0.6" />
        <path {...a} d="M178 120 l6 0 M181 117 l0 6" opacity="0.7" />
        <circle {...s} cx="58" cy="120" r="3" opacity="0.5" />
      </>)

    case 'upload': // cloud + up arrow
      return svg(<>
        <path {...s} d="M76 116 a26 26 0 0 1 4 -51 a30 30 0 0 1 57 -6 a22 22 0 0 1 23 21 a20 20 0 0 1 -16 36 Z" />
        <path {...a} d="M120 132 v-34 M106 110 l14 -14 l14 14" />
      </>)

    default: // 'empty' / no-results — document + magnifier
      return svg(<>
        <g transform="rotate(-7 110 96)">
          <path {...s} d="M74 44 h56 l26 26 v66 a4 4 0 0 1-4 4 H74 a4 4 0 0 1-4-4 V48 a4 4 0 0 1 4-4 Z" />
          <path {...s} d="M130 44 v26 h26" />
          <path {...s} d="M86 96 h58 M86 112 h58 M86 128 h36" opacity="0.55" />
        </g>
        <circle {...a} cx="150" cy="128" r="26" />
        <path {...a} d="M169 147 l18 18" />
        <circle {...s} cx="40" cy="60" r="3" opacity="0.5" />
      </>)
  }
}
