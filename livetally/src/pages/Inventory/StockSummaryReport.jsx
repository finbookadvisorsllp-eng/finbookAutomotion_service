import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes } from 'lucide-react';

import { getInventoryDrilldown } from '../../api';
import useReportDate from '../../components/common/useReportDate';
import DateRangePicker from '../../components/common/DateRangePicker';
import FilterBar from '../../components/common/FilterBar';
import Breadcrumb from '../../components/common/Breadcrumb';
import Pagination from '../../components/Pagination';
import { Loading, EmptyState, ErrorState } from '../../components/common/ReportStates';
import VoucherView from '../CashBank/views/VoucherView';
import { fmt } from '../CashBank/views/helpers';
import { qtyFmt } from './InventoryListPage';

function deriveLevel(p) {
  if (p.voucherId) return 3;
  if (p.item) return 2;
  if (p.group) return 1;
  return 0;
}
const LEVEL_TITLES = ['Stock Groups', 'Items', 'Item Ledger', 'Voucher'];

export default function StockSummaryReport() {
  const { fy, value: dateValue, presets, onChange: onDateChange, fromDate, toDate } = useReportDate();
  const [searchParams, setSearchParams] = useSearchParams();

  const node = {
    group: searchParams.get('group') || '',
    item: searchParams.get('item') || '',
    voucherId: searchParams.get('vid') || '',
    voucherNo: searchParams.get('vno') || '',
  };
  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const level = deriveLevel(node);
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

  const drillGroup = (row) => patch({ group: row.key ?? row.name, page: null });
  const drillItem = (row) => patch({ item: row.name, page: null });
  const drillVoucher = (row) => row.voucherId && patch({ vid: row.voucherId, vno: row.vchNo, page: null });
  const goToLevel = (lvl) => {
    if (lvl <= 0) patch({ group: null, item: null, vid: null, vno: null, page: null });
    else if (lvl === 1) patch({ item: null, vid: null, vno: null, page: null });
    else if (lvl === 2) patch({ vid: null, vno: null, page: null });
  };

  const crumbs = useMemo(() => {
    const items = [{ label: 'Stock Summary', level: 0, key: 'l0' }];
    if (node.group) items.push({ label: node.group, level: 1, key: 'l1' });
    if (node.item) items.push({ label: node.item, level: 2, key: 'l2' });
    if (node.voucherId) items.push({ label: node.voucherNo ? `Vch ${node.voucherNo}` : 'Voucher', level: 3, key: 'l3' });
    return items;
  }, [node.group, node.item, node.voucherId, node.voucherNo]);

  const params = useMemo(() => ({
    level, fy, fromDate, toDate,
    group: node.group || undefined, item: node.item || undefined, voucherId: node.voucherId || undefined,
    page, limit, search: q || undefined,
  }), [level, fy, fromDate, toDate, node.group, node.item, node.voucherId, page, limit, q]);

  useEffect(() => {
    if (!fy) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getInventoryDrilldown(params)
      .then((res) => { if (alive) setState({ loading: false, error: null, data: res?.data ?? null, pagination: res?.pagination ?? null }); })
      .catch((e) => { if (alive) setState({ loading: false, error: e?.message || 'Failed to load Stock Summary', data: null, pagination: null }); });
    return () => { alive = false; };
  }, [params, fy]);

  const d = state.data;
  const headerTotal = level < 3 ? d?.total : null;

  return (
    <div className="animate-fade-in flex flex-col pb-10 space-y-3">
      <div className="report-card px-4 py-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <Boxes size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black" style={{ color: 'var(--report-text)' }}>Stock Summary</h1>
              <p className="text-[11px] font-bold uppercase tracking-wide report-muted">{LEVEL_TITLES[level]}</p>
            </div>
          </div>
          <DateRangePicker value={dateValue} onChange={onDateChange} presets={presets} align="right" />
        </div>

        {/* KPIs at the top level */}
        {level === 0 && d && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2" style={{ borderTop: '1px solid var(--report-divider)' }}>
            <Kpi label="Closing Stock Value" value={fmt(d.total)} tone="text-blue-600 dark:text-blue-400" />
            <Kpi label="Stock Items" value={d.itemCount ?? 0} />
            <Kpi label="Out of Stock" value={d.zeroCount ?? 0} tone="text-amber-600 dark:text-amber-400" />
            <Kpi label="Negative Stock" value={d.negativeCount ?? 0} tone="text-red-600 dark:text-red-400" />
          </div>
        )}

        {crumbs.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2" style={{ borderTop: '1px solid var(--report-divider)' }}>
            <Breadcrumb bare items={crumbs} onNavigate={(i) => goToLevel(crumbs[i].level)} onBack={() => goToLevel(crumbs[crumbs.length - 2]?.level ?? 0)} />
            {headerTotal != null && level > 0 && (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide report-muted">Closing Value</p>
                <p className="text-[14px] font-black" style={{ color: 'var(--report-text)' }}>{fmt(headerTotal)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {level !== 3 && (
        <FilterBar showSearch search={q}
          onSearchChange={(v) => patch({ q: v || null, page: null }, { replace: true })}
          searchPlaceholder={level === 0 ? 'Search group…' : level === 1 ? 'Search item…' : 'Search voucher / party…'} />
      )}

      {state.loading ? (
        <Loading label="Loading Stock Summary…" />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={() => setState((s) => ({ ...s }))} />
      ) : !d || (Array.isArray(d.rows) && d.rows.length === 0 && level !== 3) ? (
        <EmptyState />
      ) : (
        <>
          {level === 0 && <GroupTable rows={d.rows} onDrill={drillGroup} total={d.total} />}
          {level === 1 && <ItemTable rows={d.rows} onDrill={drillItem} total={d.total} />}
          {level === 2 && <LedgerTable rows={d.rows} summary={d.summary} onDrill={drillVoucher} />}
          {level === 3 && <VoucherView data={d} />}

          {level !== 3 && state.pagination && (state.pagination.totalPages > 1 || state.pagination.totalRecords > limit) && (
            <div className="report-card">
              <Pagination pagination={state.pagination}
                onPageChange={(p) => patch({ page: p }, { replace: true })}
                onPageSizeChange={(n) => patch({ limit: n, page: null }, { replace: true })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide report-muted">{label}</p>
      <p className={`text-[16px] font-black ${tone || ''}`} style={tone ? undefined : { color: 'var(--report-text)' }}>{value}</p>
    </div>
  );
}

function GroupTable({ rows, onDrill, total }) {
  return (
    <div className="report-card overflow-x-auto">
      <table className="report-table">
        <thead><tr>
          <th>Stock Group</th><th className="report-num">Items</th>
          <th className="report-num">Opening</th><th className="report-num">Inward</th>
          <th className="report-num">Outward</th><th className="report-num">Closing Value</th>
        </tr></thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key ?? g.name} className="cursor-pointer" onClick={() => onDrill(g)}>
              <td><span className="report-link">{g.name}</span></td>
              <td className="report-num">{g.itemCount}</td>
              <td className="report-num">{fmt(g.openingValue)}</td>
              <td className="report-num text-emerald-600 dark:text-emerald-400">{fmt(g.inValue)}</td>
              <td className="report-num text-red-500">{fmt(g.outValue)}</td>
              <td className="report-num report-strong">{fmt(g.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td className="report-num" colSpan="5">Total</td><td className="report-num">{fmt(total)}</td></tr></tfoot>
      </table>
    </div>
  );
}

function ItemTable({ rows, onDrill, total }) {
  return (
    <div className="report-card overflow-x-auto">
      <table className="report-table">
        <thead><tr>
          <th>Item</th><th className="report-num">Closing Qty</th>
          <th className="report-num">Rate</th><th className="report-num">Closing Value</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="cursor-pointer" onClick={() => onDrill(r)}>
              <td><span className="report-link">{r.name}</span></td>
              <td className={`report-num ${r.closing < 0 ? 'text-red-500 font-bold' : ''}`}>{qtyFmt(r.closing)} {r.unit || ''}</td>
              <td className="report-num">{fmt(r.rate)}</td>
              <td className="report-num report-strong">{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td className="report-num" colSpan="3">Total</td><td className="report-num">{fmt(total)}</td></tr></tfoot>
      </table>
    </div>
  );
}

function LedgerTable({ rows, summary, onDrill }) {
  return (
    <div className="space-y-3">
      {summary && (
        <div className="report-card px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Closing Qty" value={`${qtyFmt(summary.closingQty)} ${summary.unit || ''}`} />
          <Kpi label="Closing Value" value={fmt(summary.closingValue)} />
          <Kpi label="Sold (Qty / Value)" value={`${qtyFmt(summary.salesQty)} · ${fmt(summary.salesValue)}`} />
          <Kpi label="Gross Profit" value={fmt(summary.grossProfit)} tone="text-emerald-600 dark:text-emerald-400" />
        </div>
      )}
      <div className="report-card overflow-x-auto">
        <table className="report-table min-w-[640px]">
          <thead><tr>
            <th>Date</th><th>Voucher No</th><th>Type</th><th>Party</th>
            <th className="report-num">Qty</th><th className="report-num">Amount</th>
          </tr></thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={v.voucherId ?? i} className="cursor-pointer" onClick={() => onDrill(v)}>
                <td className="report-muted">{v.date}</td>
                <td><span className="report-link font-mono">{v.vchNo}</span></td>
                <td className="report-muted">{v.type}</td>
                <td className="report-strong">{v.ledgerName}</td>
                <td className={`report-num ${v.direction === 'out' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {v.direction === 'out' ? '-' : '+'}{qtyFmt(v.qty)}
                </td>
                <td className="report-num report-strong">{fmt(v.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
