import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Landmark } from 'lucide-react';

import { useDateRange } from '../../context/DateContext';
import { getCashBankDrilldown, exportCashBank } from '../../api';

import Breadcrumb from '../../components/common/Breadcrumb';
import FilterBar from '../../components/common/FilterBar';
import ExportMenu from '../../components/common/ExportMenu';
import DateRangePicker from '../../components/common/DateRangePicker';
import { DEFAULT_PRESETS } from '../../components/common/dateRange';
import Pagination from '../../components/Pagination';
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates';

import CategoryView from './views/CategoryView';
import MonthlyView from './views/MonthlyView';
import TransactionsView from './views/TransactionsView';
import VoucherView from './views/VoucherView';
import { bal } from './views/helpers';

// FY id "2025-2026" -> ISO bounds (for the picker default + FY presets).
function fyBoundsISO(fy) {
  if (!fy) return { fromDate: undefined, toDate: undefined };
  const y = parseInt(fy.split('-')[0], 10);
  return { fromDate: `${y}-04-01`, toDate: `${y + 1}-03-31` };
}

// The financial-year id that a date falls into (Apr–Mar year).
function fyForISO(iso) {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  const startY = m >= 4 ? y : y - 1;
  return `${startY}-${startY + 1}`;
}

// Which level the current URL state represents. The top level (0) is the
// Cash/Bank category view; drilling a ledger jumps straight to its monthly
// summary (2) — the group level (1) is not part of this entry flow.
function deriveLevel(p) {
  if (p.voucherId) return 4;
  if (p.month) return 3;
  if (p.ledgerId || p.ledgerName) return 2;
  return 0;
}

const LEVEL_TITLES = ['', 'Ledgers', 'Monthly Summary', 'Statement', 'Voucher'];

export default function CashBankReport() {
  const { fy, years, selectFy } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL state (single source of truth; React state stack derives from it) ──
  const category = searchParams.get('category') === 'bank' ? 'bank' : 'cash';
  const node = {
    ledgerId: searchParams.get('ledgerId') || '',
    ledgerName: searchParams.get('ledgerName') || '',
    month: searchParams.get('month') || '',
    voucherId: searchParams.get('voucherId') || '',
    voucherNo: searchParams.get('voucherNo') || '',
  };
  const filters = {
    q: searchParams.get('q') || '',
    vt: searchParams.get('vt') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    preset: searchParams.get('preset') || '',
    sort: searchParams.get('sort') || '',
    order: searchParams.get('order') || 'asc',
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '50', 10),
  };
  const level = deriveLevel(node);

  const [state, setState] = useState({ loading: true, error: null, data: null, pagination: null });

  // ── URL mutation helpers ──
  const patch = useCallback((updates, { replace = false } = {}) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      });
      return next;
    }, { replace });
  }, [setSearchParams]);

  // Drill deeper: set the target level's identity, clear everything below it.
  const drillTo = useCallback((target) => {
    const lvl = target.level;
    const updates = { page: null };
    if (lvl === 2) Object.assign(updates, { ledgerId: target.ledgerId, ledgerName: target.ledgerName, month: null, voucherId: null, voucherNo: null });
    if (lvl === 3) Object.assign(updates, { month: target.month, voucherId: null, voucherNo: null });
    if (lvl === 4) Object.assign(updates, { voucherId: target.voucherId, voucherNo: target.voucherNo });
    patch(updates);
  }, [patch]);

  // Jump to a level via breadcrumb: clear everything deeper than it (category kept).
  const goToLevel = useCallback((lvl) => {
    const updates = { page: null };
    if (lvl <= 0) Object.assign(updates, { ledgerId: null, ledgerName: null, month: null, voucherId: null, voucherNo: null });
    if (lvl === 2) Object.assign(updates, { month: null, voucherId: null, voucherNo: null });
    if (lvl === 3) Object.assign(updates, { voucherId: null, voucherNo: null });
    patch(updates);
  }, [patch]);

  // Switch the top-level Cash/Bank tab (resets any drill).
  const setCategory = useCallback((cat) => {
    patch({ category: cat === 'bank' ? 'bank' : null, ledgerId: null, ledgerName: null, month: null, voucherId: null, voucherNo: null, page: null });
  }, [patch]);

  // ── Breadcrumb trail (root = the active Cash/Bank tab) ──
  const crumbs = useMemo(() => {
    const items = [{ label: category === 'bank' ? 'Bank' : 'Cash', level: 0, key: 'l0' }];
    if (node.ledgerName) items.push({ label: node.ledgerName, level: 2, key: 'l2' });
    if (node.month) items.push({ label: node.month, level: 3, key: 'l3' });
    if (node.voucherId) items.push({ label: node.voucherNo ? `Vch ${node.voucherNo}` : 'Voucher', level: 4, key: 'l4' });
    return items;
  }, [category, node.ledgerName, node.month, node.voucherId, node.voucherNo]);

  // ── Fetch the current level ──
  const apiParams = useMemo(() => ({
    level, fy, category,
    ledgerId: node.ledgerId || undefined,
    ledgerName: node.ledgerName || undefined,
    month: node.month || undefined,
    voucherId: node.voucherId || undefined,
    page: filters.page, limit: filters.limit,
    search: filters.q || undefined,
    voucherType: filters.vt || undefined,
    sort: filters.sort || undefined,
    order: filters.order,
    fromDate: filters.from || undefined,
    toDate: filters.to || undefined,
  }), [level, fy, category, node.ledgerId, node.ledgerName, node.month, node.voucherId,
       filters.page, filters.limit, filters.q, filters.vt, filters.sort, filters.order, filters.from, filters.to]);

  const refetch = useCallback(() => {
    if (!fy) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getCashBankDrilldown(apiParams)
      .then((res) => { if (alive) setState({ loading: false, error: null, data: res?.data ?? null, pagination: res?.pagination ?? null }); })
      .catch((e) => { if (alive) setState({ loading: false, error: e?.message || 'Failed to load report', data: null, pagination: null }); });
    return () => { alive = false; };
  }, [apiParams, fy]);

  useEffect(() => {
    const cancel = refetch();
    return cancel;
  }, [refetch]);

  // ── Export current level (respects category + filters + date + company) ──
  const handleExport = (format) => exportCashBank({
    level, category,
    ledgerId: node.ledgerId || undefined,
    ledgerName: node.ledgerName || undefined,
    month: node.month || undefined,
    voucherId: node.voucherId || undefined,
    search: filters.q || undefined,
    voucherType: filters.vt || undefined,
    sort: filters.sort || undefined,
    order: filters.order,
    fromDate: filters.from || undefined,
    toDate: filters.to || undefined,
    fy,
  }, format);

  // ── Per-level filter visibility (the date control lives in the header;
  // the top-level Cash/Bank list has its own search inside CategoryView) ──
  const showVoucherType = level === 3;
  const showFilterBar = level === 3;
  const showPagination = level === 3 && state.pagination;

  // The single date control on top doubles as the FY switcher. The preset rail
  // lists the company's financial years first (primary for this report) and the
  // standard quick ranges below, so it is always populated even when only one FY
  // of data exists. The calendar still handles any fully-custom range.
  const presets = useMemo(() => {
    const fyPresets = years.slice().reverse().map((y) => {
      const b = fyBoundsISO(y.id);
      const [a, z] = y.id.split('-');
      return { key: y.id, label: `FY ${a.slice(2)}-${z.slice(2)}`, range: [b.fromDate, b.toDate] };
    });
    return [...fyPresets, ...DEFAULT_PRESETS];
  }, [years]);

  // Picker value: a custom/preset range when one is set, otherwise the current FY
  // (so the matching FY preset highlights in the rail).
  const dateValue = filters.from
    ? { fromDate: filters.from, toDate: filters.to, preset: filters.preset || 'custom' }
    : { ...fyBoundsISO(fy), preset: fy };

  // A pick either selects a financial year (switch FY, clear the custom range) or
  // any other range (keep it, and align the FY to the range's start so opening
  // balances stay correct). The chosen preset key is preserved for highlighting.
  const handleDateChange = (v) => {
    if (years.some((y) => y.id === v.preset)) {
      selectFy(v.preset);
      patch({ from: null, to: null, preset: null, page: null }, { replace: true });
      return;
    }
    const derived = fyForISO(v.fromDate);
    if (derived && years.some((y) => y.id === derived) && derived !== fy) selectFy(derived);
    patch({ from: v.fromDate, to: v.toDate, preset: v.preset || 'custom', page: null }, { replace: true });
  };

  // Voucher types present in this ledger's statement (for the L3 filter dropdown).
  const voucherTypes = useMemo(() => {
    if (level !== 3 || !state.data?.rows) return [];
    return [...new Set(state.data.rows.map((r) => r.type).filter(Boolean))].sort();
  }, [level, state.data]);

  // Key balance(s) shown inline in the header (replaces the per-view header cards).
  const headerStats = useMemo(() => {
    if (!state.data) return [];
    if (level === 2 && state.data.ledger)
      return [
        { label: 'Opening', value: bal(state.data.ledger.opening) },
        { label: 'Closing', value: bal(state.data.ledger.closing), strong: true },
      ];
    if (level === 3 && state.data.totals)
      return [{ label: 'Closing Balance', value: bal(state.data.totals.closing), strong: true }];
    return [];
  }, [level, state.data]);

  return (
    <div className="animate-fade-in flex flex-col pb-10 space-y-3">
      {/* Consolidated header: title · FY · export, then breadcrumb · balance */}
      <div className="report-card px-4 py-3 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <Landmark size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black" style={{ color: 'var(--report-text)' }}>Cash &amp; Bank</h1>
              {LEVEL_TITLES[level] && (
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--report-text-muted)' }}>{LEVEL_TITLES[level]}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker value={dateValue} onChange={handleDateChange} presets={presets} align="right" />
            <ExportMenu onExport={handleExport} disabled={state.loading || !!state.error} />
          </div>
        </div>

        {(crumbs.length > 1 || headerStats.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2" style={{ borderTop: '1px solid var(--report-divider)' }}>
            <Breadcrumb
              bare
              items={crumbs}
              onNavigate={(idx) => goToLevel(crumbs[idx].level)}
              onBack={() => goToLevel(crumbs[crumbs.length - 2]?.level ?? 0)}
            />
            {headerStats.length > 0 && (
              <div className="flex items-center gap-5">
                {headerStats.map((s) => (
                  <div key={s.label} className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--report-text-muted)' }}>{s.label}</p>
                    <p className={s.strong ? 'text-[14px] font-black' : 'text-[13px] font-bold'} style={{ color: 'var(--report-text)' }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters (only when the level actually has filters) */}
      {showFilterBar && (
        <FilterBar
          showSearch
          search={filters.q}
          onSearchChange={(v) => patch({ q: v || null, page: null }, { replace: true })}
          searchPlaceholder="Search party / voucher…"
          showVoucherType={showVoucherType}
          voucherType={filters.vt}
          voucherTypes={voucherTypes}
          onVoucherTypeChange={(v) => patch({ vt: v || null, page: null }, { replace: true })}
        />
      )}

      {/* Body */}
      {state.loading ? (
        <Loading label="Loading Cash & Bank…" />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={refetch} />
      ) : !state.data || (Array.isArray(state.data?.rows) && state.data.rows.length === 0 && level !== 4) ? (
        <EmptyState />
      ) : (
        <>
          {level === 0 && <CategoryView data={state.data} category={category} onCategoryChange={setCategory} onDrill={drillTo} />}
          {level === 2 && <MonthlyView data={state.data} onDrill={drillTo} />}
          {level === 3 && <TransactionsView data={state.data} onDrill={drillTo} />}
          {level === 4 && <VoucherView data={state.data} />}

          {showPagination && (
            <div className="report-card">
              <Pagination
                pagination={state.pagination}
                onPageChange={(p) => patch({ page: p }, { replace: true })}
                onPageSizeChange={(n) => patch({ limit: n, page: null }, { replace: true })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
