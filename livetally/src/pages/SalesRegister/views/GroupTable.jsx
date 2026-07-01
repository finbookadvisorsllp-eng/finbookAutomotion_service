import { fmt } from '../../CashBank/views/helpers';

// Grouped Sales Register table (Month / Ledger / Voucher Type / Ledger Group /
// Stock Item / Stock Group / Stock Category). Columns are driven entirely by the
// `columns` descriptor returned by the backend so one component renders every
// grouping view. The first column is the drill link into the level below.
const qtyFmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function GroupTable({ data, onDrill, totalLabel = 'Total Sales' }) {
  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const labelKey = columns[0]?.key || 'name';

  const cell = (col, row) => {
    const v = row[col.key];
    if (col.money) return fmt(v);
    if (col.key === 'qty') return qtyFmt(v);
    return v;
  };

  return (
    <div className="report-card overflow-x-auto">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'report-num' : ''}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id ?? row.key} className="cursor-pointer" onClick={() => onDrill?.(row)}>
              {columns.map((c, i) => (
                <td key={c.key} className={c.align === 'right' ? 'report-num report-strong' : ''}>
                  {i === 0
                    ? <span className="report-link">{cell(c, row)}</span>
                    : cell(c, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="report-num">{totalLabel}</td>
            {columns.slice(1).map((c) => (
              <td key={c.key} className="report-num">
                {c.money ? fmt(data?.total) : ''}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
