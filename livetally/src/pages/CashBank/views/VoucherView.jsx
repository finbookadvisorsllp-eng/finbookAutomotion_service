import { FileText, User, PencilLine, Package } from 'lucide-react';
import { fmt } from './helpers';

/** Level 4 — complete voucher detail (universal map_voucher_detail shape). */
export default function VoucherView({ data }) {
  if (!data) return null;
  const entries = data.entries || [];
  const items = data.items || [];
  const drTotal = entries.filter((e) => e.isDr).reduce((s, e) => s + Number(e.amount || 0), 0);
  const crTotal = entries.filter((e) => !e.isDr).reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-3">
      {/* Voucher header */}
      <div className="report-card px-5 py-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-black" style={{ color: 'var(--report-text)' }}>{data.voucherNo}</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 rounded">{data.type}</span>
          </div>
          <p className="text-[12px] font-bold report-muted">Date: <span style={{ color: 'var(--report-text-soft)' }}>{data.date}</span></p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide report-muted">Amount</p>
          <p className="text-[18px] font-black" style={{ color: 'var(--report-text)' }}>{fmt(data.totals?.grandTotal ?? data.grossTotal)}</p>
        </div>
      </div>

      {data.partyName && (
        <div className="report-card">
          <SectionHead icon={User} title="Party" />
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Party Name" value={data.partyName} />
            {data.partyGstin && <Field label="GSTIN" value={data.partyGstin} />}
            {data.placeOfSupply && <Field label="Place of Supply" value={data.placeOfSupply} />}
          </div>
        </div>
      )}

      {/* Accounting entries */}
      <div className="report-card overflow-x-auto">
        <SectionHead icon={FileText} title="Accounting Entries" />
        <table className="report-table">
          <thead>
            <tr>
              <th className="w-[70px]">Dr/Cr</th>
              <th>Account</th>
              <th className="report-num w-[160px]">Debit</th>
              <th className="report-num w-[160px]">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td className="report-strong">{e.isDr ? 'Dr' : 'Cr'}</td>
                <td><span className="report-link">{e.ledgerName}</span></td>
                <td className="report-num report-strong">{e.isDr ? fmt(e.amount) : ''}</td>
                <td className="report-num report-strong">{!e.isDr ? fmt(e.amount) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2" className="report-num">Total</td>
              <td className="report-num">{fmt(drTotal)}</td>
              <td className="report-num">{fmt(crTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Inventory items (sales/purchase-style vouchers only) */}
      {data.hasItems && items.length > 0 && (
        <div className="report-card overflow-x-auto">
          <SectionHead icon={Package} title="Items" />
          <table className="report-table min-w-[600px]">
            <thead>
              <tr>
                <th className="w-[50px]">#</th>
                <th>Item</th>
                <th className="report-num">Qty</th>
                <th className="report-num">Rate</th>
                <th className="report-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.srNo}>
                  <td className="report-muted">{it.srNo}</td>
                  <td className="report-strong">{it.name}</td>
                  <td className="report-num">{it.qty} {it.unit}</td>
                  <td className="report-num">{fmt(it.rate)}</td>
                  <td className="report-num report-strong">{fmt(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.narration && (
        <div className="report-card">
          <SectionHead icon={PencilLine} title="Narration" />
          <div className="p-4">
            <p className="text-[12px] font-medium italic" style={{ color: 'var(--report-text-soft)' }}>"{data.narration}"</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ icon: Icon, title }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--report-border)' }}>
      <Icon size={15} style={{ color: 'var(--report-text-muted)' }} />
      <h3 className="text-[13px] font-bold" style={{ color: 'var(--report-text)' }}>{title}</h3>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold report-muted">{label}</p>
      <p className="text-[13px] font-bold" style={{ color: 'var(--report-text)' }}>{value}</p>
    </div>
  );
}
