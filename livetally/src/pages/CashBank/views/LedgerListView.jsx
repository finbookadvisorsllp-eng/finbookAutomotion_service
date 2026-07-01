import { fmt, bal } from './helpers';

/** Level 1 — individual cash/bank ledgers with balances (drill to monthly). */
export default function LedgerListView({ data, onDrill }) {
  const rows = data?.rows || [];
  const totals = data?.totals || {};

  return (
    <div className="report-card overflow-x-auto">
      <table className="report-table min-w-[820px]">
        <thead>
          <tr>
            <th>Account Name</th>
            <th className="w-[150px]">Group</th>
            <th className="report-num">Opening</th>
            <th className="report-num">Receipts</th>
            <th className="report-num">Payments</th>
            <th className="report-num">Closing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
            <td colSpan="2">Total</td>
            <td className="report-num">{bal(totals.opening)}</td>
            <td className="report-num report-pos">{fmt(totals.receipts)}</td>
            <td className="report-num report-neg">{fmt(totals.payments)}</td>
            <td className="report-num">{bal(totals.closing)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
