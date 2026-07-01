import { bal, moneyOrDash } from './helpers';

/** Level 3 — date-wise voucher statement with running balance (drill to voucher). */
export default function TransactionsView({ data, onDrill }) {
  const rows = data?.rows || [];
  const totals = data?.totals || {};

  return (
    <div className="report-card overflow-x-auto">
      <table className="report-table min-w-[1000px]">
        <thead>
          <tr>
            <th className="w-[110px]">Date</th>
            <th>Particulars / Party</th>
            <th className="w-[120px]">Vch Type</th>
            <th className="w-[100px]">Vch No.</th>
            <th className="w-[110px]">Ref</th>
            <th className="report-num w-[130px]">Receipts</th>
            <th className="report-num w-[130px]">Payments</th>
            <th className="report-num w-[150px]">Balance</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening brought forward */}
          <tr>
            <td className="report-muted"></td>
            <td className="report-strong" colSpan="4">Opening Balance</td>
            <td className="report-num report-muted">-</td>
            <td className="report-num report-muted">-</td>
            <td className="report-num report-strong">{bal(data?.opening)}</td>
          </tr>

          {rows.map((t) => (
            <tr key={t.id}>
              <td className="report-muted whitespace-nowrap">{t.date}</td>
              <td className="report-strong">{t.party || t.narration || '—'}</td>
              <td className="report-muted">{t.type}</td>
              <td>
                <button onClick={() => onDrill({ level: 4, voucherId: t.voucherId, voucherNo: t.voucherNo, label: `Vch ${t.voucherNo}` })}
                  className="report-link text-[12px]">
                  {t.voucherNo}
                </button>
              </td>
              <td className="report-muted">{t.ref || '-'}</td>
              <td className="report-num report-pos">{moneyOrDash(t.receipts)}</td>
              <td className="report-num report-neg">{moneyOrDash(t.payments)}</td>
              <td className="report-num report-strong">{bal(t.running)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="5">Closing Balance</td>
            <td className="report-num report-pos">{moneyOrDash(totals.receipts)}</td>
            <td className="report-num report-neg">{moneyOrDash(totals.payments)}</td>
            <td className="report-num">{bal(totals.closing)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
