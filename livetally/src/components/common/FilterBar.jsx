import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import DateRangePicker from './DateRangePicker';

/**
 * Reusable filter toolbar for report drill-downs. Every control is optional, so
 * each level shows only the filters that apply to it.
 *
 *   search / onSearchChange         — debounced free-text search (controlled)
 *   showDate / dateValue / onDateChange
 *   showVoucherType / voucherType / voucherTypes[] / onVoucherTypeChange
 *   right                           — node rendered on the right (e.g. <ExportMenu/>)
 */
export default function FilterBar({
  showSearch = true, search = '', onSearchChange, searchPlaceholder = 'Search…',
  showDate = false, dateValue, onDateChange,
  showVoucherType = false, voucherType = '', voucherTypes = [], onVoucherTypeChange,
  right = null, children = null,
}) {
  const [term, setTerm] = useState(search);
  const timer = useRef(null);

  // keep local input in sync when the parent resets it (e.g. on level change)
  useEffect(() => { setTerm(search); }, [search]);

  const handleTerm = (val) => {
    setTerm(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearchChange?.(val), 350);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 report-card px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        {showSearch && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded px-2.5 h-9 w-64" style={{ border: '1px solid var(--report-border)' }}>
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input
              value={term}
              onChange={(e) => handleTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-transparent border-none outline-none text-[12px] font-medium w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
            {term && (
              <button onClick={() => handleTerm('')} className="text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {showVoucherType && (
          <select
            value={voucherType}
            onChange={(e) => onVoucherTypeChange?.(e.target.value)}
            className="h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="">All Voucher Types</option>
            {voucherTypes.map((vt) => <option key={vt} value={vt}>{vt}</option>)}
          </select>
        )}

        {children}
      </div>

      <div className="flex items-center gap-3">
        {showDate && <DateRangePicker value={dateValue} onChange={onDateChange} />}
        {right}
      </div>
    </div>
  );
}
