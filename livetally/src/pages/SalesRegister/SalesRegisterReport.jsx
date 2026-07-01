import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt, ChevronDown, ClipboardList, FileMinus, Truck } from 'lucide-react';

import { useDateRange } from '../../context/DateContext';
import { getSalesRegisterDrilldown, exportSalesRegister } from '../../api';

import Breadcrumb from '../../components/common/Breadcrumb';
import FilterBar from '../../components/common/FilterBar';
import ExportMenu from '../../components/common/ExportMenu';
import DateRangePicker from '../../components/common/DateRangePicker';
import { DEFAULT_PRESETS } from '../../components/common/dateRange';
import Pagination from '../../components/Pagination';
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates';
import { fmt } from '../CashBank/views/helpers';

import GroupTable from './views/GroupTable';
import InvoiceTable from './views/InvoiceTable';
import VoucherView from '../CashBank/views/VoucherView';

// FY id "2025-2026" -> ISO bounds (picker default + FY presets).
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

// groupBy options — three primary tabs + a "More" dropdown (mirrors the Tally
// Sales Register column chooser). Every option is served by one engine.
const PRIMARY = [
  { value: 'month', label: 'Month' },
  { value: 'bill', label: 'Bill' },
  { value: 'ledger', label: 'Ledger' },
];
const MORE = [
  { value: 'stockItem', label: 'Stock Item' },
  { value: 'voucherType', label: 'Voucher Type' },
  { value: 'ledgerGroup', label: 'Ledger Group' },
  { value: 'stockGroup', label: 'Stock Group' },
  { value: 'stockCategory', label: 'Stock Category' },
];
const GROUP_LABEL = Object.fromEntries([...PRIMARY, ...MORE].map((o) => [o.value, o.label]));

// One engine, four sales-side document registers. `accounting` documents (Sales,
// Credit Note) post to ledgers and expose the Gross/Net toggle; order/delivery
// documents are non-accounting (value lives in inventory) so they show a single
// value measure and lead with the invoice/quantity list.
const REPORT_CONFIGS = {
  sales: { title: 'Sales Register', icon: Receipt, accounting: true, totalLabel: 'Total Sales', defaultGroupBy: 'month' },
  sales_order: { title: 'Sales Order', icon: ClipboardList, accounting: false, totalLabel: 'Total Order Value', defaultGroupBy: 'bill' },
  credit_note: { title: 'Credit Note', icon: FileMinus, accounting: true, totalLabel: 'Total Credit Notes', defaultGroupBy: 'month' },
  delivery_note: { title: 'Delivery Note', icon: Truck, accounting: false, totalLabel: 'Total Value', defaultGroupBy: 'bill' },
};

function deriveLevel(p) {
  if (p.voucherId) return 2;
  if (p.groupValue && p.groupBy !== 'bill') return 1;
  return 0;
}

export default function SalesRegisterReport({ report = 'sales' }) {
  const cfg = REPORT_CONFIGS[report] || REPORT_CONFIGS.sales;
  const { fy, years, selectFy } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL state (single source of truth) ──
  const groupBy = searchParams.get('groupBy') || cfg.defaultGroupBy;
  // Non-accounting documents (orders / delivery notes) have no tax split, so the
  // Gross/Net toggle is hidden and a single value measure is used.
  const measure = cfg.accounting ? (searchParams.get('measure') === 'net' ? 'net' : 'gross') : 'gross';
  const node = {
    groupValue: searchParams.get('gv') || '',
    groupLabel: searchParams.get('gvl') || '',
    voucherId: searchParams.get('vid') || '',
    voucherNo: searchParams.get('vno') || '',
  };
  const filters = {
    q: searchParams.get('q') || '',
    sort: searchParams.get('sort') || '',
    order: searchParams.get('order') || 'desc',
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '10', 10),
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    preset: searchParams.get('preset') || '',
  };
  const level = deriveLevel({ ...node, groupBy });
  const [state, setState] = useState({ loading: true, error: null, data: null, pagination: null });

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

  // ── Drill / navigation ──
  const drillGroup = useCallback((row) => patch({ gv: row.key, gvl: row.label ?? row.name, page: null }), [patch]);
  const drillVoucher = useCallback((row) => patch({ vid: row.voucherId, vno: row.number, page: null }), [patch]);
  const goToLevel = useCallback((lvl) => {
    if (lvl <= 0) patch({ gv: null, gvl: null, vid: null, vno: null, page: null });
    else if (lvl === 1) patch({ vid: null, vno: null, page: null });
  }, [patch]);

  const changeGroupBy = useCallback((g) => patch({ groupBy: g, gv: null, gvl: null, vid: null, vno: null, page: null }), [patch]);
  const changeMeasure = useCallback((m) => patch({ measure: m === 'net' ? 'net' : null }), [patch]);

  // ── Breadcrumb ──
  const crumbs = useMemo(() => {
    const items = [{ label: cfg.title, level: 0, key: 'l0' }];
    if (node.groupValue && groupBy !== 'bill') items.push({ label: node.groupLabel || node.groupValue, level: 1, key: 'l1' });
    if (node.voucherId) items.push({ label: node.voucherNo ? `Vch ${node.voucherNo}` : 'Voucher', level: 2, key: 'l2' });
    return items;
  }, [cfg.title, node.groupValue, node.groupLabel, node.voucherId, node.voucherNo, groupBy]);

  // ── Fetch the current level ──
  const apiParams = useMemo(() => ({
    report, level, fy, groupBy, measure,
    groupValue: node.groupValue || undefined,
    voucherId: node.voucherId || undefined,
    page: filters.page, limit: filters.limit,
    search: filters.q || undefined,
    sort: filters.sort || undefined, order: filters.order,
    fromDate: filters.from || undefined, toDate: filters.to || undefined,
  }), [report, level, fy, groupBy, measure, node.groupValue, node.voucherId,
    filters.page, filters.limit, filters.q, filters.sort, filters.order, filters.from, filters.to]);

  const refetch = useCallback(() => {
    if (!fy) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getSalesRegisterDrilldown(apiParams)
      .then((res) => { if (alive) setState({ loading: false, error: null, data: res?.data ?? null, pagination: res?.pagination ?? null }); })
      .catch((e) => { if (alive) setState({ loading: false, error: e?.message || 'Failed to load Sales Register', data: null, pagination: null }); });
    return () => { alive = false; };
  }, [apiParams, fy]);

  useEffect(() => { const cancel = refetch(); return cancel; }, [refetch]);

  // ── Export current level (respects groupBy + measure + filters + date + company) ──
  const handleExport = (format) => exportSalesRegister({
    report, level, groupBy, measure,
    groupValue: node.groupValue || undefined,
    voucherId: node.voucherId || undefined,
    search: filters.q || undefined,
    sort: filters.sort || undefined, order: filters.order,
    fromDate: filters.from || undefined, toDate: filters.to || undefined,
    fy,
  }, format);

  // ── Date picker (doubles as FY switcher), copied from the Cash & Bank report ──
  const presets = useMemo(() => {
    const fyPresets = years.slice().reverse().map((y) => {
      const b = fyBoundsISO(y.id);
      const [a, z] = y.id.split('-');
      return { key: y.id, label: `FY ${a.slice(2)}-${z.slice(2)}`, range: [b.fromDate, b.toDate] };
    });
    return [...fyPresets, ...DEFAULT_PRESETS];
  }, [years]);
  const dateValue = filters.from
    ? { fromDate: filters.from, toDate: filters.to, preset: filters.preset || 'custom' }
    : { ...fyBoundsISO(fy), preset: fy };
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

  // ── The "Total Sales" figure shown on the header (reconciles with the table) ──
  const headerTotal = level === 0 ? state.data?.total
    : level === 1 ? state.data?.totals?.total
      : null;

  const showToggles = level === 0;
  const showFilterBar = level !== 2;
  const showPagination = level !== 2 && state.pagination && (state.pagination.totalPages > 1 || state.pagination.totalRecords > state.pagination.pageSize);

  return (
    <div className="animate-fade-in flex flex-col pb-10 space-y-3">
      {/* Header: title + Total Sales · toggles · date · export */}
      <div className="report-card px-4 py-3 space-y-3 relative z-10 overflow-visible">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <cfg.icon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black" style={{ color: 'var(--report-text)' }}>{cfg.title}</h1>
              {headerTotal != null && (
                <p className="text-[13px] font-bold" style={{ color: 'var(--report-text-soft)' }}>
                  {cfg.totalLabel}: <span className="font-black" style={{ color: 'var(--report-text)' }}>{fmt(headerTotal)}</span>
                  {cfg.accounting && <span className="report-muted font-semibold"> · {measure === 'net' ? 'Net' : 'Gross'}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangePicker value={dateValue} onChange={handleDateChange} presets={presets} align="right" />
            <ExportMenu onExport={handleExport} disabled={state.loading || !!state.error} />
          </div>
        </div>

        {showToggles && (
          <div className="flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--report-divider)' }}>
            {cfg.accounting && (
              <>
                <Segmented
                  options={[{ value: 'gross', label: 'Gross' }, { value: 'net', label: 'Net' }]}
                  value={measure} onChange={changeMeasure}
                />
                <span className="w-px h-6 mx-1" style={{ background: 'var(--report-divider)' }} />
              </>
            )}
            <GroupByControl value={groupBy} onChange={changeGroupBy} />
          </div>
        )}

        {crumbs.length > 1 && (
          <div className="pt-2" style={{ borderTop: '1px solid var(--report-divider)' }}>
            <Breadcrumb
              bare
              items={crumbs}
              onNavigate={(idx) => goToLevel(crumbs[idx].level)}
              onBack={() => goToLevel(crumbs[crumbs.length - 2]?.level ?? 0)}
            />
          </div>
        )}
      </div>

      {/* Search */}
      {showFilterBar && (
        <FilterBar
          showSearch
          search={filters.q}
          onSearchChange={(v) => patch({ q: v || null, page: null }, { replace: true })}
          searchPlaceholder={
            groupBy === 'bill' || level === 1 ? 'Search invoice / customer…' :
              `Search ${GROUP_LABEL[groupBy]?.toLowerCase() || 'rows'}…`
          }
        />
      )}

      {/* Body */}
      {state.loading ? (
        <Loading label={`Loading ${cfg.title}…`} />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={refetch} />
      ) : !state.data || (Array.isArray(state.data?.rows) && state.data.rows.length === 0 && level !== 2) ? (
        <EmptyState />
      ) : (
        <>
          {level === 0 && (groupBy === 'bill'
            ? <InvoiceTable data={{ rows: state.data.rows, totals: { total: state.data.total } }} measure={measure} showQty={!cfg.accounting} onDrill={drillVoucher} />
            : <GroupTable data={state.data} onDrill={drillGroup} />)}
          {level === 1 && <InvoiceTable data={state.data} measure={measure} showQty={!cfg.accounting} onDrill={drillVoucher} />}
          {level === 2 && <VoucherView data={state.data} />}

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

// ── Small segmented toggle (Gross/Net) ──
function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg p-0.5" style={{ border: '1px solid var(--report-border)' }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3.5 h-8 text-[12px] font-bold rounded-md transition-colors ${value === o.value ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── groupBy control: Month | Bill | Ledger + More ▾ ──
function GroupByControl({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const moreActive = MORE.some((o) => o.value === value);

  return (
    <div className="inline-flex items-center gap-2">
      <Segmented options={PRIMARY} value={value} onChange={onChange} />
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-[12px] font-bold transition-colors ${moreActive ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          style={{ border: '1px solid var(--report-border)' }}>
          {moreActive ? GROUP_LABEL[value] : 'More'}
          <ChevronDown size={13} />
        </button>
        {open && (
          <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
            {MORE.map((o) => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[12px] font-semibold transition-colors ${value === o.value ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
