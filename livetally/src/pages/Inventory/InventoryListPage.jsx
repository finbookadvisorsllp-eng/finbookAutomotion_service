import { useState, useEffect, useMemo, useCallback } from 'react';

import useReportDate from '../../components/common/useReportDate';
import DateRangePicker from '../../components/common/DateRangePicker';
import FilterBar from '../../components/common/FilterBar';
import Pagination from '../../components/Pagination';
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates';
import { fmt } from '../CashBank/views/helpers';

export const qtyFmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

// Small segmented toggle reused for module filters (aging window / Top-N).
export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg p-0.5" style={{ border: '1px solid var(--report-border)' }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 h-8 text-[12px] font-bold rounded-md transition-colors ${
            value === o.value ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Reusable, server-driven inventory list page. Date/FY control, KPI cards,
 * search, optional extra filters, a column-driven table and server-side
 * pagination — shared by Slow / Fast / Valuation / Alerts / Performance.
 *
 *   fetcher(params)  -> Promise<{ data, pagination, meta }>
 *   columns          -> [{ key, label, align, money, render? }]
 *   kpis(meta, rows) -> [{ label, value, tone }]
 *   extra            -> { key: defaultValue } module-specific params (days/top…)
 *   renderControls({extra,setExtra}) -> node (segmented filters etc.)
 *   renderBanner(meta) -> node (e.g. data-gap notice)
 */
export default function InventoryListPage({
  title, subtitle, icon: Icon, fetcher, columns, kpis, searchPlaceholder = 'Search item…',
  extra = {}, renderControls, renderBanner, defaultLimit = 25, onRowClick,
}) {
  const { fy, value: dateValue, presets, onChange: onDateChange, fromDate, toDate } = useReportDate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [sortState, setSortState] = useState({ sort: '', order: 'desc' });
  const [extraState, setExtraState] = useState(extra);
  const [state, setState] = useState({ loading: true, error: null, rows: [], pagination: null, meta: null });

  const setExtra = useCallback((patch) => { setExtraState((e) => ({ ...e, ...patch })); setPage(1); }, []);

  const params = useMemo(() => ({
    fy, fromDate, toDate, search: search || undefined,
    page, limit, sort: sortState.sort || undefined, order: sortState.order, ...extraState,
  }), [fy, fromDate, toDate, search, page, limit, sortState.sort, sortState.order, extraState]);

  useEffect(() => {
    if (!fy) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(params)
      .then((res) => { if (alive) setState({ loading: false, error: null, rows: res?.data ?? [], pagination: res?.pagination ?? null, meta: res?.meta ?? null }); })
      .catch((e) => { if (alive) setState({ loading: false, error: e?.message || 'Failed to load report', rows: [], pagination: null, meta: null }); });
    return () => { alive = false; };
  }, [fetcher, params, fy]);

  const toggleSort = (key) => setSortState((s) => ({ sort: key, order: s.sort === key && s.order === 'desc' ? 'asc' : 'desc' }));
  const kpiCards = kpis ? kpis(state.meta, state.rows) : [];

  const cell = (col, row) => {
    if (col.render) return col.render(row[col.key], row);
    if (col.money) return fmt(row[col.key]);
    if (col.qty) return qtyFmt(row[col.key]);
    return row[col.key];
  };

  return (
    <div className="animate-fade-in flex flex-col pb-10 space-y-3">
      {/* Header */}
      <div className="report-card px-4 py-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                <Icon size={22} strokeWidth={2.5} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-black" style={{ color: 'var(--report-text)' }}>{title}</h1>
              {subtitle && <p className="text-[12px] font-semibold report-muted">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {renderControls?.({ extra: extraState, setExtra })}
            <DateRangePicker value={dateValue} onChange={onDateChange} presets={presets} align="right" />
          </div>
        </div>

        {kpiCards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2" style={{ borderTop: '1px solid var(--report-divider)' }}>
            {kpiCards.map((k) => (
              <div key={k.label}>
                <p className="text-[10px] font-bold uppercase tracking-wide report-muted">{k.label}</p>
                <p className={`text-[16px] font-black ${k.tone || ''}`} style={k.tone ? undefined : { color: 'var(--report-text)' }}>{k.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderBanner?.(state.meta)}

      <FilterBar
        showSearch search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={searchPlaceholder}
      />

      {state.loading ? (
        <Loading label={`Loading ${title}…`} />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={() => setState((s) => ({ ...s }))} />
      ) : !state.rows?.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="report-card overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={c.align === 'right' ? 'report-num cursor-pointer select-none' : 'cursor-pointer select-none'}
                      onClick={() => c.sortable !== false && toggleSort(c.sortKey || c.key)}>
                      {c.label}{sortState.sort === (c.sortKey || c.key) ? (sortState.order === 'desc' ? ' ↓' : ' ↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row, i) => (
                  <tr key={row.id ?? row.name ?? i} className={onRowClick ? 'cursor-pointer' : ''} onClick={() => onRowClick?.(row)}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.align === 'right' ? 'report-num' : ''}>{cell(c, row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.pagination && (state.pagination.totalPages > 1 || state.pagination.totalRecords > limit) && (
            <div className="report-card">
              <Pagination
                pagination={state.pagination}
                onPageChange={setPage}
                onPageSizeChange={(n) => { setLimit(n); setPage(1); }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
