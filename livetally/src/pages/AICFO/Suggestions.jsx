import { Sparkles, ArrowRight } from 'lucide-react'

const CATEGORY_ICON = {
  profitability: '📉', sales: '📈', expenses: '💸', liquidity: '🏦',
  collections: '🧾', overview: '🎯', general: '💡',
}

// Suggested question cards (Phase 6.3). Shown on an empty conversation and as a
// quick-prompt rail. Clicking one sends it straight to the CFO.
export default function Suggestions({ items, onPick, disabled }) {
  if (!items?.length) return null
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} style={{ color: 'var(--theme-accent)' }} />
        <span className="text-[12px] font-extrabold uppercase tracking-wider"
              style={{ color: 'var(--theme-text-muted)' }}>
          Suggested questions
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map((s) => (
          <button
            key={s.id}
            disabled={disabled}
            onClick={() => onPick(s.prompt)}
            className="group text-left rounded-xl px-3.5 py-3 transition-all duration-150 disabled:opacity-50"
            style={{
              background: 'var(--theme-kpi-bg)',
              border: '1px solid var(--aicfo-border)',
              boxShadow: 'var(--theme-kpi-shadow)',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--theme-kpi-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--theme-kpi-shadow)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{CATEGORY_ICON[s.category] || '💡'}</span>
                <span className="text-[13px] font-bold truncate" style={{ color: 'var(--theme-text-main)' }}>
                  {s.label}
                </span>
              </div>
              <ArrowRight size={14} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--theme-accent)' }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
