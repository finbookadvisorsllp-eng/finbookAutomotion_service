// Business Health — shared UI helpers (colors, formatting, evidence routing).
// Semantic health colors are explicit hex (work on both themes, matching the
// existing HealthScore card); surfaces/text use the app theme vars.
import { formatINR } from '../../../data/mockData'

// good / watch / critical / unknown → color
export const BAND_COLOR = {
  good: '#16a34a', watch: '#d97706', critical: '#dc2626', unknown: '#94a3b8',
}
// insight / risk severity → color
export const SEV_COLOR = {
  danger: '#dc2626', warning: '#d97706', info: '#1e7bff', success: '#16a34a',
}
export const SEV_BG = {
  danger: 'rgba(220,38,38,0.10)', warning: 'rgba(217,119,6,0.10)',
  info: 'rgba(30,123,255,0.10)', success: 'rgba(22,163,74,0.10)',
}

export const CONFIDENCE_LABEL = { high: 'High confidence', med: 'Medium confidence', low: 'Low confidence' }
export const EFFORT_LABEL = { low: 'Low effort', med: 'Medium effort', high: 'High effort' }

// score 0-100 → color band (matches pillar/score rings)
export function scoreColor(score) {
  if (score == null) return BAND_COLOR.unknown
  if (score >= 70) return BAND_COLOR.good
  if (score >= 40) return BAND_COLOR.watch
  return BAND_COLOR.critical
}

export const GRADE_COLOR = {
  A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', E: '#dc2626', '—': '#94a3b8',
}

// Format a vital-sign value by unit. null → "—" (not computable, never 0).
export function fmtVital(value, unit) {
  if (value == null) return '—'
  if (unit === '₹') return formatINR(value, true)
  if (unit === '%') return `${value}%`
  if (unit === 'months') return `${value} mo`
  if (unit === 'ratio') return `${value}×`
  return String(value)
}

export function fmtMoney(value, compact = true) {
  if (value == null) return '—'
  return formatINR(value, compact)
}

// evidence.report (a stable key) → app route. The backend stays routing-agnostic;
// the key→route map lives here (per the approved API contract).
const REPORT_ROUTE = {
  receivables: '/reports/outstanding',
  payables: '/reports/outstanding',
  cashflow: '/reports/cf',
  pl: '/reports/pl',
  sales: '/sales',
  inventory: '/inventory',
  gst: '/reports/gst',
}
export function evidenceRoute(evidence) {
  if (!evidence || !evidence.report) return null
  return REPORT_ROUTE[evidence.report] || null
}
