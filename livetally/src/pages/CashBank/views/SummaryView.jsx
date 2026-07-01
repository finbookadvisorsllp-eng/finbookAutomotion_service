import { Landmark, CircleDollarSign, ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { fmt, bal } from './helpers';

/** Level 0 — Cash & Bank summary: KPI cards + drillable group rows. */
export default function SummaryView({ data, onDrill }) {
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  const totals = data?.totals || {};

  const cards = [
    { label: 'Cash in Hand', value: summary.cashInHand, icon: CircleDollarSign,
      cls: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' },
    { label: 'Bank Balance', value: summary.bankBalance, icon: Landmark,
      cls: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
    { label: 'Total Cash & Bank', value: summary.totalBalance, icon: Wallet,
      cls: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`p-5 rounded-xl border flex justify-between items-center ${c.cls}`}>
              <div>
                <p className="text-[12px] font-bold mb-1.5">{c.label}</p>
                <p className="text-[24px] font-black tracking-tight leading-none" style={{ color: 'var(--report-text)' }}>{bal(c.value)}</p>
              </div>
              <Icon size={26} strokeWidth={2.2} />
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="report-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">Total Receipts</p>
            <p className="text-xl font-black" style={{ color: 'var(--report-text)' }}>{fmt(summary.receipts)}</p>
          </div>
          <ArrowDownRight size={22} className="text-emerald-500" />
        </div>
        <div className="report-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-red-600 dark:text-red-400 mb-1">Total Payments</p>
            <p className="text-xl font-black" style={{ color: 'var(--report-text)' }}>{fmt(summary.payments)}</p>
          </div>
          <ArrowUpRight size={22} className="text-red-500" />
        </div>
      </div>

      {/* Group rows */}
      <div className="report-card overflow-x-auto">
        <table className="report-table min-w-[760px]">
          <thead>
            <tr>
              <th>Account Group</th>
              <th className="w-[90px]">Type</th>
              <th className="report-num">Opening</th>
              <th className="report-num">Receipts</th>
              <th className="report-num">Payments</th>
              <th className="report-num">Closing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="is-clickable" onClick={() => onDrill({ level: 1, group: r.id, label: r.name })}>
                <td>
                  <span className="report-link text-[13px]">{r.name}</span>
                  <span className="report-muted ml-2 text-[11px]">({r.ledgerCount})</span>
                </td>
                <td className="report-muted">{r.type}</td>
                <td className="report-num">{bal(r.opening)}</td>
                <td className="report-num report-pos">{fmt(r.receipts)}</td>
                <td className="report-num report-neg">{fmt(r.payments)}</td>
                <td className="report-num report-strong">{bal(r.closing)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2">Grand Total</td>
              <td className="report-num">{bal(totals.opening)}</td>
              <td className="report-num report-pos">{fmt(totals.receipts)}</td>
              <td className="report-num report-neg">{fmt(totals.payments)}</td>
              <td className="report-num">{bal(totals.closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
