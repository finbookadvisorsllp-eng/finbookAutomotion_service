import { useMemo, useState } from 'react';
import { useDateRange } from '../../context/DateContext';
import { DEFAULT_PRESETS } from './dateRange';

// FY id "2025-2026" -> ISO bounds; and the inverse (which FY an ISO date is in).
function fyBoundsISO(fy) {
  if (!fy) return { fromDate: undefined, toDate: undefined };
  const y = parseInt(fy.split('-')[0], 10);
  return { fromDate: `${y}-04-01`, toDate: `${y + 1}-03-31` };
}
function fyForISO(iso) {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  const startY = m >= 4 ? y : y - 1;
  return `${startY}-${startY + 1}`;
}

/**
 * Shared financial-year date control for reports. The single date picker doubles
 * as the FY switcher (FY presets first, then standard quick ranges). Returns the
 * picker value/onChange plus the resolved {fromDate,toDate} to pass to the API
 * (undefined when the plain FY is selected — the backend then uses FY bounds).
 */
export default function useReportDate() {
  const { fy, years, selectFy } = useDateRange();
  const [custom, setCustom] = useState({ from: '', to: '', preset: '' });

  const presets = useMemo(() => {
    const fyPresets = years.slice().reverse().map((y) => {
      const b = fyBoundsISO(y.id);
      const [a, z] = y.id.split('-');
      return { key: y.id, label: `FY ${a.slice(2)}-${z.slice(2)}`, range: [b.fromDate, b.toDate] };
    });
    return [...fyPresets, ...DEFAULT_PRESETS];
  }, [years]);

  const value = custom.from
    ? { fromDate: custom.from, toDate: custom.to, preset: custom.preset || 'custom' }
    : { ...fyBoundsISO(fy), preset: fy };

  const onChange = (v) => {
    if (years.some((y) => y.id === v.preset)) {
      selectFy(v.preset);
      setCustom({ from: '', to: '', preset: '' });
      return;
    }
    const derived = fyForISO(v.fromDate);
    if (derived && years.some((y) => y.id === derived) && derived !== fy) selectFy(derived);
    setCustom({ from: v.fromDate, to: v.toDate, preset: v.preset || 'custom' });
  };

  return { fy, value, presets, onChange, fromDate: custom.from || undefined, toDate: custom.to || undefined };
}
