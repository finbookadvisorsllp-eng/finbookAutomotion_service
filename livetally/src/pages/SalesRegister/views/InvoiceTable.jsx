import { fmt } from '../../CashBank/views/helpers';

const qtyFmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

// Voucher list — used for the Bill-wise register (level 0) and for the voucher
// list behind any group row (level 1). Each row drills into the full voucher.
// `showQty` surfaces the quantity column for non-accounting documents (Sales
// Order / Delivery Note), whose value lives in inventory rather than ledgers.
export default function InvoiceTable({ data, measure = 'gross', showQty = false, onDrill, partyLabel = 'Customer' }) {
  const rows = data?.rows || [];
  const totals = data?.totals;
  const measureLabel = measure === 'net' ? 'Net' : 'Gross';
  const amountHeader = showQty ? 'Value' : `${measureLabel} Amount`;

  return (
    <div className="report-card overflow-x-auto">
      <table className="report-table min-w-[640px]">
        <thead>
          <tr>
            <th>Voucher No</th>
            <th>Date</th>
            <th>{partyLabel}</th>
            <th>Voucher Type</th>
            <th className="report-num">{showQty ? 'Quantity' : 'Items'}</th>
            <th className="report-num">{amountHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id ?? row.voucherId} className="cursor-pointer" onClick={() => onDrill?.(row)}>
              <td><span className="report-link font-mono">{row.number}</span></td>
              <td className="report-muted">{row.date}</td>
              <td className="report-strong">{row.party}</td>
              <td className="report-muted">{row.type}</td>
              <td className="report-num">{showQty ? qtyFmt(row.qty) : row.items}</td>
              <td className="report-num report-strong">{fmt(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr>
              <td colSpan="5" className="report-num">Total</td>
              <td className="report-num">{fmt(totals.total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
