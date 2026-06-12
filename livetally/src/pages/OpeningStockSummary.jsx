import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatINR } from '../data/mockData';
import { useDateRange } from '../context/DateContext';
import { useApi } from '../hooks/useApi';
import {
    getOpeningStock,
    getOpeningStockItems,
    getPlStockItemLedger,
    getVoucher,
} from '../api';
import Level4VoucherDetail from './ProfitLoss/Level4VoucherDetail';

const SORTABLE = [
    { key: 'name', label: 'Item Name', align: 'left' },
    { key: 'group', label: 'Stock Group', align: 'left' },
    { key: 'quantity', label: 'Quantity', align: 'right' },
    { key: 'rate', label: 'Rate', align: 'right' },
    { key: 'value', label: 'Value', align: 'right' },
];

const Icon = ({ d, ...p }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d={d} />
    </svg>
);

export default function OpeningStockSummary() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { fy, years, selectFy, selectedDateRange } = useDateRange();

    const stockItemId = searchParams.get('stockItem');
    const voucherId = searchParams.get('voucher');

    // L1/L2 controls
    const [group, setGroup] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sort, setSort] = useState('value');
    const [order, setOrder] = useState('desc');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // Debounce the search box (avoid a request per keystroke).
    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const currentIndex = years.findIndex((y) => y.id === fy);
    const currentYearData = { id: fy, label: selectedDateRange || '' };

    // ── L1: group summary + overall totals ──
    const { data: summaryData, loading: summaryLoading } = useApi(
        () => getOpeningStock(fy),
        [fy],
        { skip: !fy || !!stockItemId || !!voucherId }
    );

    // ── L2: paginated item list ──
    const { data: itemsRes, loading: itemsLoading } = useApi(
        () => getOpeningStockItems(fy, { group, search: debouncedSearch, sort, order, page, limit }),
        [fy, group, debouncedSearch, sort, order, page, limit],
        { skip: !fy || !!stockItemId || !!voucherId }
    );

    // ── L3: item transaction ledger ──
    const { data: itemLedger, loading: itemLedgerLoading } = useApi(
        () => getPlStockItemLedger(stockItemId, fy),
        [stockItemId, fy],
        { skip: !stockItemId || !!voucherId }
    );

    // ── L4: voucher detail ──
    const { data: voucherDetail, loading: voucherLoading } = useApi(
        () => getVoucher(voucherId),
        [voucherId],
        { skip: !voucherId }
    );

    const groups = summaryData?.groups || [];
    const summary = summaryData?.summary || { totalValue: 0, totalItems: 0, groupCount: 0, asOfLabel: '' };
    const items = itemsRes?.data || [];
    const pagination = itemsRes?.pagination || { total: 0, page: 1, limit, pages: 0 };
    const filteredValue = itemsRes?.meta?.filteredValue;

    const toggleSort = (key) => {
        if (sort === key) {
            setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
        } else {
            setSort(key);
            setOrder(key === 'name' || key === 'group' ? 'asc' : 'desc');
        }
        setPage(1);
    };

    const handlePrevYear = () => { if (currentIndex > 0) selectFy(years[currentIndex - 1].id); };
    const handleNextYear = () => { if (currentIndex < years.length - 1) selectFy(years[currentIndex + 1].id); };

    const goToItem = (name) => setSearchParams({ stockItem: name });

    // ───────────────────────── L4: Voucher detail ─────────────────────────
    if (voucherId) {
        if (voucherLoading) return <Loading />;
        return <Level4VoucherDetail voucherData={voucherDetail} />;
    }

    // ───────────────────────── L3: Item ledger ─────────────────────────
    if (stockItemId) {
        return (
            <ItemLedger
                name={stockItemId}
                loading={itemLedgerLoading}
                ledger={itemLedger}
                label={currentYearData.label}
                onBack={() => setSearchParams({})}
                onVoucher={(vch) => setSearchParams({ stockItem: stockItemId, voucher: vch })}
            />
        );
    }

    // ───────────────────────── L1 + L2: Summary + items ─────────────────────────
    const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="animate-fade-in flex flex-col gap-3">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/reports/pl')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                        <Icon d="m15 18-6-6 6-6" width="20" height="20" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Opening Stock Summary</h1>
                        <p className="text-[11px] font-medium text-slate-500">As at {summary.asOfLabel || '—'} · {summary.totalItems} items in {summary.groupCount} groups</p>
                    </div>
                </div>
                {/* Year selector */}
                <div className="flex items-center glass-card">
                    <button onClick={handlePrevYear} disabled={currentIndex <= 0}
                        className="p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors border-r border-slate-200">
                        <Icon d="m15 18-6-6 6-6" />
                    </button>
                    <span className="px-4 text-sm font-semibold text-slate-700 min-w-[180px] text-center">{currentYearData.label}</span>
                    <button onClick={handleNextYear} disabled={currentIndex >= years.length - 1}
                        className="p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors border-l border-slate-200">
                        <Icon d="m9 18 6-6-6-6" />
                    </button>
                </div>
            </div>

            {/* Group summary cards (also act as filters) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                    onClick={() => { setGroup(''); setPage(1); }}
                    className={`glass-card p-3 px-4 text-left transition-all ${group === '' ? 'ring-2 ring-blue-500' : 'hover:bg-slate-50'}`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Opening Stock</p>
                    <p className="text-[16px] font-black text-slate-900">{formatINR(summary.totalValue)}</p>
                </button>
                {groups.map((g) => (
                    <button key={g.id}
                        onClick={() => { setGroup(group === g.name ? '' : g.name); setPage(1); }}
                        className={`glass-card p-3 px-4 text-left transition-all ${group === g.name ? 'ring-2 ring-blue-500' : 'hover:bg-slate-50'}`}>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">{g.name} · {g.itemCount}</p>
                        <p className="text-[16px] font-black text-slate-900">{formatINR(g.value)}</p>
                    </button>
                ))}
            </div>

            {/* Items table */}
            <div className="glass-card overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon d="m21 21-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" width="14" height="14" /></span>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search item…"
                                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-[12px] w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        {group && (
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full flex items-center gap-1">
                                {group}
                                <button onClick={() => { setGroup(''); setPage(1); }} className="hover:text-red-500">×</button>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-slate-700">Rows per page:</span>
                        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                            className="text-[12px] font-medium text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-1 focus:outline-none cursor-pointer">
                            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[760px]">
                        <thead>
                            <tr className="bg-slate-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                                {SORTABLE.map((c) => (
                                    <th key={c.key}
                                        onClick={() => toggleSort(c.key)}
                                        className={`py-2 px-4 cursor-pointer select-none whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                                        <span className="inline-flex items-center gap-1">
                                            {c.label}
                                            {sort === c.key && <span className="text-blue-600">{order === 'desc' ? '↓' : '↑'}</span>}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {itemsLoading || summaryLoading ? (
                                <tr><td colSpan={5} className="py-10 text-center text-[12px] text-slate-500 animate-pulse">Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={5} className="py-10 text-center text-[12px] text-slate-500">No stock items found.</td></tr>
                            ) : items.map((it) => (
                                <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td onClick={() => goToItem(it.name)}
                                        className="py-2 px-4 text-[12px] font-medium text-blue-600 hover:underline cursor-pointer">
                                        {it.name}
                                    </td>
                                    <td className="py-2 px-4 text-[12px] text-slate-600">{it.group}</td>
                                    <td className="py-2 px-4 text-[12px] text-slate-700 text-right tabular-nums">
                                        {Number(it.quantity).toLocaleString('en-IN')} {it.unit || ''}
                                    </td>
                                    <td className="py-2 px-4 text-[12px] text-slate-700 text-right tabular-nums">
                                        {it.rate ? formatINR(it.rate) : '—'}
                                    </td>
                                    <td className="py-2 px-4 text-[12px] font-bold text-slate-800 text-right tabular-nums">
                                        {formatINR(it.value)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {items.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-50 border-t border-slate-200 font-bold text-[12px] text-slate-800">
                                    <td className="py-2 px-4" colSpan={4}>
                                        {group ? `${group} total` : 'Grand total'} {filteredValue !== undefined && `(${pagination.total} items)`}
                                    </td>
                                    <td className="py-2 px-4 text-right tabular-nums">{formatINR(filteredValue ?? summary.totalValue)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Pagination */}
                <div className="py-2.5 px-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="text-[11px] font-medium text-slate-500">
                        {start}-{end} of {pagination.total}
                    </div>
                    <Pager page={pagination.page} pages={pagination.pages} onChange={setPage} />
                </div>
            </div>
        </div>
    );
}

// ───────────────────────── Loading ─────────────────────────
function Loading() {
    return <div className="py-12 text-center text-[13px] text-slate-500 font-medium animate-pulse">Loading…</div>;
}

// ───────────────────────── Pager ─────────────────────────
function Pager({ page, pages, onChange }) {
    if (!pages || pages <= 1) return <div />;
    const nums = [];
    const push = (n) => nums.push(n);
    push(1);
    for (let n = page - 1; n <= page + 1; n++) if (n > 1 && n < pages) push(n);
    if (pages > 1) push(pages);
    const uniq = [...new Set(nums)].sort((a, b) => a - b);
    const withGaps = [];
    uniq.forEach((n, i) => {
        if (i > 0 && n - uniq[i - 1] > 1) withGaps.push('…');
        withGaps.push(n);
    });
    const btn = "w-7 h-7 flex items-center justify-center rounded text-[12px] font-medium transition-colors";
    return (
        <div className="flex items-center gap-1">
            <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
                className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            {withGaps.map((n, i) => n === '…' ? (
                <span key={`g${i}`} className="w-7 h-7 flex items-center justify-center text-slate-400 text-[12px]">…</span>
            ) : (
                <button key={n} onClick={() => onChange(n)}
                    className={`${btn} ${n === page ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-200'}`}>
                    {n}
                </button>
            ))}
            <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page >= pages}
                className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
        </div>
    );
}

// ───────────────────────── L3: Item transaction ledger ─────────────────────────
function ItemLedger({ name, loading, ledger, label, onBack, onVoucher }) {
    const vouchers = ledger?.vouchers || [];
    return (
        <div className="animate-fade-in flex flex-col gap-3">
            <div className="glass-card p-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-800">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">{name}</h1>
                        <p className="text-[11px] font-medium text-slate-500">Opening-stock item ledger · {label}</p>
                    </div>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="p-3 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <h2 className="text-[13px] font-bold text-slate-800">Transactions</h2>
                    <span className="text-[11px] font-medium text-slate-500">{vouchers.length} entries</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[760px]">
                        <thead>
                            <tr className="bg-slate-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                                <th className="py-2 px-4">Date</th>
                                <th className="py-2 px-4">Ledger / Party</th>
                                <th className="py-2 px-4">Voucher Type</th>
                                <th className="py-2 px-4">Voucher No.</th>
                                <th className="py-2 px-4 text-right">Quantity</th>
                                <th className="py-2 px-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="py-10 text-center text-[12px] text-slate-500 animate-pulse">Loading…</td></tr>
                            ) : vouchers.length === 0 ? (
                                <tr><td colSpan={6} className="py-10 text-center text-[12px] text-slate-500">No transactions for this item in the selected period.</td></tr>
                            ) : vouchers.map((v, i) => (
                                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                    <td onClick={() => onVoucher(v.vchNo)} className="py-2.5 px-4 text-[12px] font-medium text-blue-600 hover:underline cursor-pointer">{v.date}</td>
                                    <td className="py-2.5 px-4 text-[12px] text-slate-700">{v.ledgerName || '—'}</td>
                                    <td className="py-2.5 px-4 text-[12px] text-slate-700">{v.type}</td>
                                    <td onClick={() => onVoucher(v.vchNo)} className="py-2.5 px-4 text-[12px] font-medium text-blue-600 hover:underline cursor-pointer">{v.vchNo}</td>
                                    <td className="py-2.5 px-4 text-[12px] text-slate-700 text-right tabular-nums">{Number(v.qty || 0).toLocaleString('en-IN')}</td>
                                    <td className="py-2.5 px-4 text-[12px] font-bold text-slate-800 text-right tabular-nums">{formatINR(v.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
