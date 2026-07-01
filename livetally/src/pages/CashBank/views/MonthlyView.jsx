import { fmt, bal } from './helpers';

/** Level 2 — month-wise opening/receipts/payments/closing (drill to date-wise). */
export default function MonthlyView({ data, onDrill }) {
  const rows = data?.rows || [];
  const totals = data?.totals || {};

  return (
    <div className="report-card overflow-x-auto">
      <table className="report-table min-w-[680px]">
        <thead>
          <tr>
            <th>Month</th>
            <th className="report-num">Opening</th>
            <th className="report-num">Receipts</th>
            <th className="report-num">Payments</th>
            <th className="report-num">Closing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="is-clickable" onClick={() => onDrill({ level: 3, month: m.id, label: m.month })}>
              <td><span className="report-link text-[13px]">{m.month}</span></td>
              <td className="report-num">{bal(m.opening)}</td>
              <td className="report-num report-pos">{fmt(m.receipts)}</td>
              <td className="report-num report-neg">{fmt(m.payments)}</td>
              <td className="report-num report-strong">{bal(m.closing)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
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
