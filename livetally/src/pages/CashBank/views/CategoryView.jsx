import { useState, useEffect, useMemo } from 'react';
import { Search, CircleDollarSign, Landmark, Wallet, Activity } from 'lucide-react';

import Pagination from '../../../components/Pagination';
import { EmptyState } from '../../../components/common/ReportStates';
import { fmt, bal } from './helpers';

const PAGE_SIZE = 10;

/**
 * Level 0 — top-level category view. Two tabs (Cash / Bank) over the same
 * reusable ledger-list layout; only the data category changes. KPI cards sit
 * above. Drilling a ledger goes to its month-wise summary.
 */
export default function CategoryView({ data, category, onCategoryChange, onDrill }) {
  const summary = data?.summary || {};
  const block = category === 'bank' ? data?.bank : data?.cash;
  const allRows = block?.rows || [];

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [category, search]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allRows.filter((r) => (r.name || '').toLowerCase().includes(q)) : allRows;
  }, [allRows, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagination = {
    page, pageSize: PAGE_SIZE, totalRecords: rows.length, totalPages,
    hasPrevious: page > 1, hasNext: page < totalPages,
  };

  const cards = [
    { label: 'Total Cash Balance', value: summary.cashInHand, icon: CircleDollarSign,
      cls: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' },
    { label: 'Total Bank Balance', value: summary.bankBalance, icon: Landmark,
      cls: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
    { label: 'Total Balance', value: summary.totalBalance, icon: Wallet,
      cls: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400' },
    { label: 'Net Activity', value: summary.netActivity, icon: Activity, money: true,
      cls: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' },
  ];

  const tabs = [
    { key: 'cash', label: 'Cash Accounts', count: summary.cashAccounts },
    { key: 'bank', label: 'Bank Accounts', count: summary.bankAccounts },
  ];
  const totals = block?.totals || {};

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`p-4 rounded-xl border flex items-center justify-between ${c.cls}`}>
              <div>
                <p className="text-[12px] font-bold mb-1">{c.label}</p>
                <p className="text-[22px] font-black tracking-tight leading-none" style={{ color: 'var(--report-text)' }}>
                  {c.money ? fmt(c.value) : bal(c.value)}
                </p>
              </div>
              <Icon size={24} strokeWidth={2.2} />
            </div>
          );
        })}
      </div>

      {/* Tabs + search */}
      <div className="report-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2" style={{ borderBottom: '1px solid var(--report-border)' }}>
          <div className="flex items-center gap-1">
            {tabs.map((t) => {
              const active = category === t.key;
              return (
                <button key={t.key} onClick={() => onCategoryChange(t.key)}
                  className="px-4 py-2.5 text-[13px] font-bold transition-colors relative"
                  style={{ color: active ? 'var(--dp-accent)' : 'var(--report-text-muted)' }}>
                  {t.label}
                  <span className="ml-1.5 text-[11px] font-semibold" style={{ color: 'var(--report-text-muted)' }}>({t.count ?? 0})</span>
                  {active && <span className="absolute left-0 right-0 -bottom-px h-0.5" style={{ background: 'var(--dp-accent)' }} />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded px-2.5 h-9 w-60 mb-2" style={{ border: '1px solid var(--report-border)' }}>
            <Search size={14} style={{ color: 'var(--report-text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…"
              className="bg-transparent border-none outline-none text-[12px] font-medium w-full"
              style={{ color: 'var(--report-text)' }} />
          </div>
        </div>

        {pageRows.length === 0 ? (
          <EmptyState title={`No ${category} accounts`} hint="No accounts with activity in this period." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="report-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Account Name</th>
                    <th className="w-[160px]">Group</th>
                    <th className="report-num">Opening</th>
                    <th className="report-num">Receipts</th>
                    <th className="report-num">Payments</th>
                    <th className="report-num">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="is-clickable"
                      onClick={() => onDrill({ level: 2, ledgerId: r.ledgerId, ledgerName: r.name, label: r.name })}>
                      <td><span className="report-link text-[13px]">{r.name}</span></td>
                      <td className="report-muted">{r.group}</td>
                      <td className="report-num">{bal(r.opening)}</td>
                      <td className="report-num report-pos">{fmt(r.receipts)}</td>
                      <td className="report-num report-neg">{fmt(r.payments)}</td>
                      <td className="report-num report-strong">{bal(r.closing)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2">{category === 'bank' ? 'Total Bank Balance' : 'Total Cash Balance'}</td>
                    <td className="report-num">{bal(totals.opening)}</td>
                    <td className="report-num report-pos">{fmt(totals.receipts)}</td>
                    <td className="report-num report-neg">{fmt(totals.payments)}</td>
                    <td className="report-num">{bal(totals.closing)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
