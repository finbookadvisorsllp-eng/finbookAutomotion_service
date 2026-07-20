// Business Health — the grounded EXPLANATION layer.
//
// This turns the numbers the backend engines already returned into a plain-language
// "what this means → why it's here → what to do" story. It NEVER invents a figure:
// every value shown comes from the engines (pillars.py / kpi.py / risk.py). What
// lives here is only *definitions* (formulas), plain-language framing, and fixes —
// none of which is company data, so nothing can drift from the reports.

// ─────────────────────────── Jargon glossary ───────────────────────────
// Hover a term anywhere in Business Health to get a one-line plain meaning.
export const GLOSSARY = {
  'net margin': 'Out of every ₹100 you sell, how many ₹ are left as profit after all costs.',
  'gross margin': 'Out of every ₹100 you sell, how much is left after only the direct cost of goods.',
  'expense-to-revenue': 'How much you spend for every ₹100 of sales. Above ₹100 means a loss.',
  'runway': 'How many months your cash lasts at the current rate of spending.',
  'net cash flow': 'Cash that came in minus cash that went out over the period.',
  'collections horizon': 'On average, how many months it takes to collect the money customers owe you. Lower is better.',
  'receivables': 'Money your customers still owe you.',
  'payables': 'Money you still owe your vendors.',
  'receivables ÷ payables': 'What customers owe you vs what you owe vendors. Near 1 is balanced.',
  'customer concentration': 'How much of your total sales depends on a single customer. High = risky.',
  'sales yoy': 'How this year’s sales compare with last year’s, as a percentage.',
  'cancelled-voucher rate': 'The share of entries that were cancelled — a data-entry / process signal.',
  'reconciled': 'This figure comes straight from your verified reports — it is not an estimate.',
  'coverage': 'How much of this score is backed by fully verified data vs a clearly-labelled estimate.',
}

// Case-insensitive lookup used by the <Term> tooltip.
export function glossaryOf(text) {
  if (!text) return null
  return GLOSSARY[String(text).trim().toLowerCase()] || null
}

// ─────────────────────────── Pillar knowledge ───────────────────────────
// key ∈ profitability | liquidity | collections | growth | hygiene
// `meaning`  — what the pillar answers, in one plain sentence
// `formula`  — how the headline number is computed (a definition, always true)
// `fix`      — the concrete move when this pillar is weak
export const PILLAR_INFO = {
  profitability: {
    meaning: 'Are you actually making money after all your costs?',
    formula: 'Net margin = Net Profit ÷ Sales × 100',
    fix: 'Raise prices or cut your biggest cost lines until sales comfortably cover costs.',
  },
  liquidity: {
    meaning: 'Do you have enough cash to run the business day to day?',
    formula: 'Runway = Cash & bank ÷ average monthly burn',
    fix: 'Speed up collections and pause non-essential spend to rebuild a cash buffer.',
  },
  collections: {
    meaning: 'How quickly does the money customers owe you actually come back?',
    formula: 'Collections horizon = Receivables ÷ average monthly sales',
    fix: 'Chase the largest overdue balances first and tighten credit terms for slow payers.',
  },
  growth: {
    meaning: 'Are your sales growing or shrinking over time?',
    formula: 'Sales YoY = (this year − last year) ÷ last year × 100',
    fix: 'Protect your top accounts, re-activate quiet months, and push your best-margin lines.',
  },
  hygiene: {
    meaning: 'Are your books clean, complete and trustworthy?',
    formula: 'Cancelled rate = cancelled vouchers ÷ total vouchers × 100',
    fix: 'Spot-check cancelled entries and keep monthly bookkeeping current.',
  },
}

// band (from the backend) → what it means for the owner, in one word + tone.
export const BAND_VERDICT = {
  good: { label: 'A strength', tone: 'good' },
  watch: { label: 'Needs attention', tone: 'watch' },
  critical: { label: 'Dragging your score down', tone: 'critical' },
  unknown: { label: 'Not enough data yet', tone: 'unknown' },
}

// A driver value is "missing" when the engine could not compute it. The engines
// emit "—", "n/a", or "N/A …" in that case (never a fabricated number).
export function isMissingValue(v) {
  if (v == null) return true
  const s = String(v).trim().toLowerCase()
  return s === '' || s === '—' || s === '-' || s === 'n/a' || s.startsWith('n/a')
}

// Why a specific driver has no number yet — expressed in terms of OUR real data
// gaps (documented in the module brief), never a generic "no data".
export const DRIVER_GAP = {
  'Net margin': 'The Profit & Loss for this year hasn’t been computed yet — once it syncs, margin fills in.',
  'Gross margin': 'Needs the Profit & Loss (opening/closing stock + purchases) for this year.',
  'Expense-to-revenue': 'Needs the Profit & Loss for this year.',
  'Runway': 'Cash flow is net positive right now, so there’s no burn to measure a runway against — that’s a good thing.',
  'Collections horizon': 'Needs both sales and receivables. Bill-wise due dates give the most exact reading.',
  'Sales YoY': 'No prior-year data to compare against yet — we score the within-year trend instead.',
  'GST capture': 'No GST output ledgers found — expected for composition / exempt / unregistered dealers.',
}

// "What you need to do" — the score-level recommendations.
//
// Built from the pillars the backend actually scored as weak, each carrying its
// fixed plain-language move. Deliberately DIFFERENT from the rupee-ranked
// "Do this week" decisions: those are tactical (chase this ₹74L), these are the
// structural moves that lift the score itself. Worst pillar first.
export function buildRecommendations(score, limit = 4) {
  const rank = { critical: 0, watch: 1 }
  return (score?.pillars || [])
    .filter((p) => p.score != null && (p.band === 'critical' || p.band === 'watch') && PILLAR_INFO[p.key]?.fix)
    .sort((a, b) => (rank[a.band] - rank[b.band]) || (a.score - b.score))
    .slice(0, limit)
    .map((p) => ({
      key: p.key, pillar: p.label, band: p.band, score: p.score,
      text: PILLAR_INFO[p.key].fix, meaning: PILLAR_INFO[p.key].meaning,
    }))
}

// One grounded sentence explaining WHY the overall score is where it is, built
// only from the pillar scores/bands the backend returned (no new numbers).
export function explainOverall(score) {
  const pillars = (score?.pillars || []).filter((p) => p.score != null)
  if (!pillars.length) return 'Not enough synced data to explain the score yet.'
  const weak = pillars
    .filter((p) => p.band === 'critical' || p.band === 'watch')
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
  const strong = pillars.filter((p) => p.band === 'good').sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  if (!weak.length) {
    return `The fundamentals are steady — ${strong.slice(0, 2).map((p) => p.label.toLowerCase()).join(' and ') || 'all pillars'} are holding up.`
  }
  const names = weak.slice(0, 2).map((p) => p.label).join(' and ')
  const lift = strong.length ? ` ${strong[0].label} is what’s keeping it up.` : ''
  return `Your score is mainly held back by ${names}.${lift} Fix those first and the number moves the most.`
}
