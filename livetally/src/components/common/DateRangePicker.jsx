import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

import {
  MONTHS, WEEKDAYS, toISO, fromISO, fmtDisplay, addMonths, startOfMonth,
  buildCalendarDays, presetRange, shiftRange, clampISO, DEFAULT_PRESETS,
} from './dateRange';

/**
 * Reusable, theme-aware date-range (and single-date) picker.
 *
 *   <DateRangePicker value={{ fromDate, toDate, preset }} onChange={fn} />
 *
 * Props
 *   value          {fromDate:'YYYY-MM-DD', toDate, preset}  (single mode: fromDate==toDate)
 *   onChange(value)  called on Apply, on a single-date pick, and on prev/next nav
 *   mode           'range' | 'single'           (default 'range')
 *   presets        [{key,label}] | false         (default DEFAULT_PRESETS; false hides rail)
 *   numberOfMonths 1 | 2                          (default 2)
 *   minDate/maxDate 'YYYY-MM-DD'  clamp selectable days
 *   dataBounds     {min,max}  used by the 'All Time' preset
 *   align          'left' | 'right'              (default 'right')
 *   showNav        show the trigger's prev/next arrows (default true)
 *
 * All visuals are driven by --dp-* CSS variables (see index.css) so the control
 * matches both the light and dark application themes with zero per-use styling.
 */
export default function DateRangePicker({
  value,
  onChange,
  mode = 'range',
  presets = DEFAULT_PRESETS,
  numberOfMonths = 2,
  minDate,
  maxDate,
  dataBounds = {},
  align = 'right',
  showNav = true,
}) {
  const single = mode === 'single';
  const from = value?.fromDate || toISO(new Date());
  const to = value?.toDate || from;
  const preset = value?.preset || 'custom';

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: null, right: null });

  // staged selection while open
  const [draft, setDraft] = useState({ from, to, preset });
  const [anchor, setAnchor] = useState(() => startOfMonth(fromISO(from) || new Date()));
  const [picking, setPicking] = useState('start');
  const [picker, setPicker] = useState({ kind: 'days', cal: 0 }); // kind: days|months|years

  const months = numberOfMonths === 1 ? 1 : 2;

  // ── positioning (portaled to body to escape stacking contexts) ──
  const updateCoords = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setCoords(align === 'left'
      ? { top: r.bottom + 8, left: r.left, right: null }
      : { top: r.bottom + 8, left: null, right: Math.max(8, window.innerWidth - r.right) });
  }, [align]);

  // Reset the staged selection from the current value and open the panel.
  const openPanel = () => {
    setDraft({ from, to, preset });
    setAnchor(startOfMonth(fromISO(from) || new Date()));
    setPicking('start');
    setPicker({ kind: 'days', cal: 0 });
    updateCoords();
    setOpen(true);
  };

  // While open, keep the panel pinned to the trigger on scroll/resize.
  useEffect(() => {
    if (!open) return undefined;
    const onMove = () => updateCoords();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
  }, [open, updateCoords]);

  // close on outside click / Escape
  useEffect(() => {
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  // ── interactions ──
  const applyValue = (next) => { onChange?.(next); setOpen(false); };

  const handleDayClick = (date) => {
    const iso = clampISO(toISO(date), minDate, maxDate);
    if ((minDate && iso < minDate) || (maxDate && iso > maxDate)) return;

    if (single) { applyValue({ fromDate: iso, toDate: iso, preset: 'custom' }); return; }

    if (picking === 'start' || iso < draft.from) {
      setDraft({ from: iso, to: iso, preset: 'custom' });
      setPicking('end');
    } else {
      setDraft((d) => ({ ...d, to: iso, preset: 'custom' }));
      setPicking('start');
    }
  };

  // A preset may carry an explicit `range:[from,to]` (e.g. financial years);
  // otherwise it is resolved from its built-in key.
  const applyPreset = (p) => {
    const r = p.range || presetRange(p.key, new Date(), dataBounds);
    if (!r) return;
    setDraft({ from: r[0], to: r[1], preset: p.key });
    setAnchor(startOfMonth(fromISO(r[0])));
    setPicking('start');
    setPicker({ kind: 'days', cal: 0 });
  };

  const navMonths = (dir) => setAnchor((a) => addMonths(a, dir));
  const togglePicker = (cal, kind) =>
    setPicker((p) => (p.kind === kind && p.cal === cal ? { kind: 'days', cal: 0 } : { kind, cal }));

  const pickMonth = (cal, monthIdx) => {
    const dispYear = addMonths(anchor, cal).getFullYear();
    setAnchor(addMonths(new Date(dispYear, monthIdx, 1), -cal));
    setPicker({ kind: 'days', cal: 0 });
  };
  const pickYear = (cal, year) => {
    const dispMonth = addMonths(anchor, cal).getMonth();
    setAnchor(addMonths(new Date(year, dispMonth, 1), -cal));
    setPicker({ kind: 'days', cal: 0 });
  };

  const apply = () => applyValue({ fromDate: draft.from, toDate: draft.to, preset: draft.preset });
  const navTrigger = (dir) => onChange?.(shiftRange(from, to, preset, dir));

  const triggerLabel = single ? fmtDisplay(from) : `${fmtDisplay(from)} - ${fmtDisplay(to)}`;
  const presetList = Array.isArray(presets) ? presets : [];

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div className="dp-trigger shadow-sm">
        {showNav && !single && (
          <button type="button" onClick={() => navTrigger(-1)} title="Previous period"
            className="dp-trigger-btn dp-trigger-edge-l"><ChevronLeft size={16} /></button>
        )}
        <button type="button" onClick={() => (open ? setOpen(false) : openPanel())} className="dp-trigger-main">
          <CalendarIcon size={14} style={{ color: 'var(--dp-text-muted)' }} />
          {triggerLabel}
        </button>
        {showNav && !single && (
          <button type="button" onClick={() => navTrigger(1)} title="Next period"
            className="dp-trigger-btn dp-trigger-edge"><ChevronRight size={16} /></button>
        )}
      </div>

      {open && createPortal(
        <div ref={panelRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left ?? undefined, right: coords.right ?? undefined, zIndex: 9999 }}
          className="dp-panel animate-fade-in">

          {presetList.length > 0 && (
            <div className="dp-presets">
              {presetList.map((p) => (
                <button key={p.key} type="button" onClick={() => applyPreset(p)}
                  className={`dp-preset ${draft.preset === p.key ? 'active' : ''}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="dp-body">
            {/* nav row + per-calendar month/year labels */}
            <div className="flex items-center justify-between mb-2 gap-2">
              <button type="button" className="dp-nav-btn" onClick={() => navMonths(-1)}><ChevronLeft size={16} /></button>
              <div className="flex flex-1 gap-5">
                {Array.from({ length: months }).map((_, i) => {
                  const d = addMonths(anchor, i);
                  return (
                    <div key={i} className="flex-1 flex items-center justify-center gap-1">
                      <button type="button" className="dp-label-btn" onClick={() => togglePicker(i, 'months')}>{MONTHS[d.getMonth()]}</button>
                      <button type="button" className="dp-label-btn" onClick={() => togglePicker(i, 'years')}>{d.getFullYear()}</button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="dp-nav-btn" onClick={() => navMonths(1)}><ChevronRight size={16} /></button>
            </div>

            {/* calendars */}
            <div className="flex gap-5">
              {Array.from({ length: months }).map((_, i) => {
                const d = addMonths(anchor, i);
                if (picker.kind === 'months' && picker.cal === i)
                  return <MonthGrid key={i} active={d.getMonth()} onPick={(m) => pickMonth(i, m)} />;
                if (picker.kind === 'years' && picker.cal === i)
                  return <YearGrid key={i} active={d.getFullYear()} onPick={(y) => pickYear(i, y)} />;
                return (
                  <DaysGrid key={i} year={d.getFullYear()} month={d.getMonth()}
                    from={draft.from} to={draft.to} minDate={minDate} maxDate={maxDate}
                    onPick={handleDayClick} />
                );
              })}
            </div>

            {/* footer */}
            <div className="dp-footer">
              <span className="dp-range-label">{triggerLabel}</span>
              <div className="flex gap-2">
                <button type="button" className="dp-btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="dp-btn-apply" onClick={apply}>Apply</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── day grid (one calendar month) ──
function DaysGrid({ year, month, from, to, minDate, maxDate, onPick }) {
  const cells = useMemo(() => buildCalendarDays(year, month), [year, month]);
  return (
    <div className="w-[230px]">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => <div key={w} className="dp-weekday">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ date, currentMonth }, i) => {
          const iso = toISO(date);
          const inRange = from && to && from !== to && iso > from && iso < to;
          const selected = iso === from || iso === to;
          const disabled = (minDate && iso < minDate) || (maxDate && iso > maxDate);
          const cls = ['dp-day'];
          if (selected) cls.push('is-selected');
          else if (inRange) cls.push('in-range');
          if (!currentMonth && !selected) cls.push('is-muted');
          if (disabled) cls.push('is-disabled');
          return (
            <button key={i} type="button" className={cls.join(' ')} onClick={() => onPick(date)}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── month grid (Jan…Dec) ──
function MonthGrid({ active, onPick }) {
  return (
    <div className="w-[230px] grid grid-cols-3 gap-2 content-start">
      {MONTHS.map((m, idx) => (
        <button key={m} type="button" onClick={() => onPick(idx)}
          className={`dp-grid-btn ${idx === active ? 'active' : ''}`}>{m}</button>
      ))}
    </div>
  );
}

// ── year grid (paginated across the full [minYear, maxYear] range) ──
function YearGrid({ active, onPick, minYear = 1900, maxYear = 2100 }) {
  const PAGE = 12; // 4 rows × 3 cols
  const clampStart = useCallback(
    (s) => Math.min(Math.max(s, minYear), Math.max(minYear, maxYear - PAGE + 1)),
    [minYear, maxYear],
  );
  // Open on the page that contains the active year.
  const [start, setStart] = useState(() => clampStart(active - 5));
  const years = Array.from({ length: PAGE }, (_, i) => start + i).filter((y) => y <= maxYear);

  return (
    <div className="w-[230px]">
      <div className="flex items-center justify-between mb-2">
        <button type="button" className="dp-nav-btn" disabled={start <= minYear}
          onClick={() => setStart((s) => clampStart(s - PAGE))}><ChevronLeft size={15} /></button>
        <span className="dp-range-heading">{years[0]} – {years[years.length - 1]}</span>
        <button type="button" className="dp-nav-btn" disabled={start + PAGE - 1 >= maxYear}
          onClick={() => setStart((s) => clampStart(s + PAGE))}><ChevronRight size={15} /></button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {years.map((y) => (
          <button key={y} type="button" onClick={() => onPick(y)}
            className={`dp-grid-btn ${y === active ? 'active' : ''}`}>{y}</button>
        ))}
      </div>
    </div>
  );
}
