/**
 * Pure, dependency-free date helpers + preset logic for the date-range picker.
 *
 * Kept separate from the React component so the logic is reusable and unit-
 * testable, and so other pages/components can share the same calendar maths.
 * All dates are handled in *local* time and serialised as 'YYYY-MM-DD'.
 */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
export const fromISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const fmtDisplay = (s) => {
  const d = fromISO(s);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
};

export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const sameDay = (a, b) => !!a && !!b && toISO(a) === toISO(b);
export const isBefore = (a, b) => a.getTime() < b.getTime();
// Monday-first weekday index (0..6)
export const dow = (d) => (d.getDay() + 6) % 7;

/** Clamp an ISO date into [min, max] (either bound optional). */
export const clampISO = (isoStr, minISO, maxISO) => {
  if (!isoStr) return isoStr;
  if (minISO && isoStr < minISO) return minISO;
  if (maxISO && isoStr > maxISO) return maxISO;
  return isoStr;
};

/**
 * Build the day cells for a calendar month, including the leading/trailing days
 * of adjacent months (greyed). Returns exactly the number of weeks needed.
 */
export function buildCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const lead = dow(first);
  const totalDays = endOfMonth(first).getDate();
  const weeks = Math.ceil((lead + totalDays) / 7);
  const start = addDays(first, -lead);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, currentMonth: date.getMonth() === month };
  });
}

/** Default presets (keys + labels). Order matches the reference design. */
export const DEFAULT_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'all_time', label: 'All Time' },
];

/** The coarse unit a preset navigates by (for the trigger's prev/next arrows).
 *  Includes the generic unit tokens so repeated prev/next stays on the same
 *  cadence (shiftRange returns one of these tokens as the new preset). */
const PRESET_UNIT = {
  today: 'day', yesterday: 'day', this_week: 'week',
  this_month: 'month', last_month: 'month',
  this_year: 'year', last_year: 'year', all_time: 'none',
  day: 'day', week: 'week', month: 'month', year: 'year', none: 'none', custom: 'custom',
};

/**
 * Resolve a preset key to [fromISO, toISO].
 *   bounds.min / bounds.max — optional data extents used by 'all_time'.
 */
export function presetRange(key, today = new Date(), bounds = {}) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (key) {
    case 'today': return [toISO(t), toISO(t)];
    case 'yesterday': { const y = addDays(t, -1); return [toISO(y), toISO(y)]; }
    case 'this_week': { const mon = addDays(t, -dow(t)); return [toISO(mon), toISO(addDays(mon, 6))]; }
    case 'this_month': return [toISO(startOfMonth(t)), toISO(endOfMonth(t))];
    case 'last_month': { const lm = addMonths(t, -1); return [toISO(startOfMonth(lm)), toISO(endOfMonth(lm))]; }
    case 'this_year': return [toISO(new Date(t.getFullYear(), 0, 1)), toISO(new Date(t.getFullYear(), 11, 31))];
    case 'last_year': return [toISO(new Date(t.getFullYear() - 1, 0, 1)), toISO(new Date(t.getFullYear() - 1, 11, 31))];
    case 'all_time': return [bounds.min || '2000-01-01', bounds.max || toISO(t)];
    default: return null;
  }
}

/** Given an applied range + preset, shift it one period back (-1) or forward (+1). */
export function shiftRange(fromISO_, toISO_, preset, dir) {
  const f = fromISO(fromISO_);
  const tt = fromISO(toISO_);
  const unit = PRESET_UNIT[preset] || 'custom';
  if (unit === 'none') return { fromDate: fromISO_, toDate: toISO_, preset };
  if (unit === 'month') {
    const nf = new Date(f.getFullYear(), f.getMonth() + dir, 1);
    return { fromDate: toISO(startOfMonth(nf)), toDate: toISO(endOfMonth(nf)), preset: 'month' };
  }
  if (unit === 'year') {
    const y = f.getFullYear() + dir;
    return { fromDate: toISO(new Date(y, 0, 1)), toDate: toISO(new Date(y, 11, 31)), preset: 'year' };
  }
  const span = Math.round((tt - f) / 86400000) + 1;
  const step = unit === 'week' ? 7 : span;
  return {
    fromDate: toISO(addDays(f, dir * step)),
    toDate: toISO(addDays(tt, dir * step)),
    preset: unit === 'week' ? 'week' : 'custom',
  };
}

/** Match an applied range back to a preset key (so the right item highlights). */
export function detectPreset(fromISO_, toISO_, presets = DEFAULT_PRESETS, bounds = {}) {
  for (const p of presets) {
    const r = presetRange(p.key, new Date(), bounds);
    if (r && r[0] === fromISO_ && r[1] === toISO_) return p.key;
  }
  return 'custom';
}
