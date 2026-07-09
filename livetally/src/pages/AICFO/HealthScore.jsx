// Financial Health Score card (Phase 9) — a 0–100 composite with a grade ring
// and per-component bars. Deterministic + reconciled (computed server-side from
// the same report figures), so it never contradicts the reports.

const GRADE_COLOR = {
  A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', E: '#dc2626', '—': '#94a3b8',
}

function barColor(score) {
  if (score == null) return '#94a3b8'
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
}

export default function HealthScore({ data }) {
  if (!data) return null
  const { overall, grade, label, components = [] } = data
  const color = GRADE_COLOR[grade] || '#94a3b8'
  const pct = overall == null ? 0 : overall
  // Conic ring for the overall score.
  const ring = `conic-gradient(${color} ${pct * 3.6}deg, var(--theme-kpi-border) 0deg)`

  return (
    <div className="rounded-xl p-3 mb-1"
         style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)' }}>
      <div className="flex items-center gap-3">
        {/* Score ring */}
        <div className="relative shrink-0" style={{ width: 58, height: 58 }}>
          <div className="w-full h-full rounded-full" style={{ background: ring }} />
          <div className="absolute inset-[5px] rounded-full flex flex-col items-center justify-center"
               style={{ background: 'var(--theme-kpi-bg)' }}>
            <span className="text-[16px] font-black leading-none" style={{ color: 'var(--theme-text-main)' }}>
              {overall ?? '—'}
            </span>
            <span className="text-[8px] font-bold leading-none mt-0.5" style={{ color }}>{grade}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Financial Health
          </p>
          <p className="text-[15px] font-black" style={{ color }}>{label}</p>
        </div>
      </div>

      {/* Component bars */}
      <div className="mt-3 space-y-1.5">
        {components.map((c) => (
          <div key={c.key}>
            <div className="flex items-center justify-between text-[10px] font-bold mb-0.5">
              <span style={{ color: 'var(--theme-text-muted)' }}>{c.label}</span>
              <span style={{ color: 'var(--theme-text-main)' }}>{c.score ?? '—'}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-kpi-border)' }}>
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${c.score ?? 0}%`, background: barColor(c.score) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
