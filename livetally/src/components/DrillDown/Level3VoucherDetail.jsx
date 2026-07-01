import React from 'react';
import { formatINR } from '../../data/mockData';

export default function Level3VoucherDetail({ voucherData }) {
  if (!voucherData) return null;

  const hasItems = voucherData.items && voucherData.items.length > 0;
  const hasSummary = voucherData.summary && voucherData.summary.length > 0;
  const hasPaymentDetails = voucherData.paymentDetails && voucherData.paymentDetails.length > 0;
  const hasEntries = voucherData.entries && voucherData.entries.length > 0;
  const hasBills = voucherData.bills && voucherData.bills.length > 0;
  const hasNarration = !!voucherData.narration;

  return (
    <div className="flex flex-col gap-4 animate-fade-in text-slate-800 dark:text-slate-200">
      <div className="glass-card rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-[#121218]">
        {/* Transaction Header Info */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1a1a24]/30">
          <div className="text-[12px] font-bold text-slate-800 dark:text-slate-300">
            Transaction Date: <span className="font-semibold text-slate-600 dark:text-slate-400">{voucherData.date}</span>
          </div>
          <div className="text-[12px] font-bold text-slate-800 dark:text-slate-300">
            Type: <span className="font-semibold text-slate-600 dark:text-slate-400">{voucherData.type}</span>
          </div>
        </div>

        {/* Items Section (Only render if there are items) */}
        {hasItems && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Items</h3>
            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-[#1a1a24] border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">
                    <th className="px-3 py-2">Sr.No</th>
                    <th className="px-3 py-2">Items Name</th>
                    <th className="px-3 py-2">HSN/SAC</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Gr.Rate</th>
                    <th className="px-3 py-2 text-center">Dis.(%)</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12px]">
                  {voucherData.items.map((item) => (
                    <tr key={item.srNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">{item.srNo}</td>
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                      <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">{item.hsn || '-'}</td>
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 text-right whitespace-nowrap">
                        {typeof item.qty === 'number' ? item.qty.toFixed(3) : item.qty} {item.unit}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400 text-right tabular-nums">
                        {item.rate !== undefined ? `${formatINR(item.rate)}${item.unit ? '/' + item.unit : ''}` : '-'}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400 text-right tabular-nums">
                        {item.grossRate !== undefined ? `${formatINR(item.grossRate)}${item.unit ? '/' + item.unit : ''}` : '-'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400 text-center">{item.discount || '0'}</td>
                      <td className="px-3 py-2 font-black text-slate-900 dark:text-white text-right tabular-nums">{formatINR(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-[#1a1a24] border-t border-slate-200 dark:border-slate-800 text-[12px] font-bold">
                  <tr>
                    <td colSpan="3" className="px-3 py-2.5 text-slate-900 dark:text-white font-black">Total</td>
                    <td className="px-3 py-2.5 text-right text-slate-900 dark:text-white font-black tabular-nums">
                      {voucherData.items.reduce((sum, item) => sum + (typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0), 0).toFixed(3)}
                    </td>
                    <td colSpan="3"></td>
                    <td className="px-3 py-2.5 text-right text-slate-900 dark:text-white font-black tabular-nums">
                      {formatINR(voucherData.items.reduce((sum, item) => sum + (item.amount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Bills references (Only render if there are bills) */}
        {hasBills && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">For Bills</h3>
            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-[#1a1a24] border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">
                    <th className="px-3 py-2">Sr.No</th>
                    <th className="px-3 py-2">Bill Ref/Party</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12px] font-bold">
                  {voucherData.bills.map((bill, i) => (
                    <tr key={bill.srNo ?? i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{bill.srNo ?? (i + 1)}</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{bill.partyName || bill.name}</td>
                      <td className="px-3 py-2.5 text-slate-900 dark:text-white text-right tabular-nums">{formatINR(bill.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Details (Only render if there are paymentDetails) */}
        {hasPaymentDetails && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Payment Details</h3>
            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1a1a24]/30 p-2">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[12px] font-bold">
                  {voucherData.paymentDetails.map((detail, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{detail.ledgerName}</td>
                      <td className="py-2 px-3 text-slate-900 dark:text-white text-right tabular-nums">{formatINR(detail.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ledger Entries (Dr/Cr) (Only render if there are entries) */}
        {hasEntries && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Accounting Entries</h3>
            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-[#1a1a24] border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">
                    <th className="px-3 py-2">Sr.No</th>
                    <th className="px-3 py-2">Account Name</th>
                    <th className="px-3 py-2 text-right">Debit / Credit Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12px] font-bold">
                  {voucherData.entries.map((entry) => (
                    <tr key={entry.srNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{entry.srNo}</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 uppercase">{entry.ledgerName || entry.partyName}</td>
                      <td className="px-3 py-2.5 text-slate-900 dark:text-white text-right tabular-nums">
                        {formatINR(entry.amount)} <span className="text-slate-400 dark:text-slate-650 font-bold">{entry.isDr ? 'Dr.' : 'Cr.'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Narration Section */}
        {hasNarration && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-[#1a1a24]/10">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Narration</h3>
            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 leading-relaxed italic">{voucherData.narration}</p>
          </div>
        )}

        {/* Summary (Taxes breakup - only if there are items and taxes) */}
        {hasItems && voucherData.taxes && Object.values(voucherData.taxes).some(val => val > 0) && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-transparent">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">GST Summary</h3>
            <div className="space-y-1.5 max-w-md">
              {voucherData.taxes.cgst > 0 && (
                <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-600 dark:text-slate-400">CGST</span>
                  <span className="text-slate-900 dark:text-white">{formatINR(voucherData.taxes.cgst)}</span>
                </div>
              )}
              {voucherData.taxes.sgst > 0 && (
                <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-600 dark:text-slate-400">SGST</span>
                  <span className="text-slate-900 dark:text-white">{formatINR(voucherData.taxes.sgst)}</span>
                </div>
              )}
              {voucherData.taxes.igst > 0 && (
                <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-600 dark:text-slate-400">IGST</span>
                  <span className="text-slate-900 dark:text-white">{formatINR(voucherData.taxes.igst)}</span>
                </div>
              )}
              {voucherData.taxes.cess > 0 && (
                <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-600 dark:text-slate-400">Cess</span>
                  <span className="text-slate-900 dark:text-white">{formatINR(voucherData.taxes.cess)}</span>
                </div>
              )}
              {voucherData.taxes.roundOff !== 0 && (
                <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-600 dark:text-slate-400">Round Off</span>
                  <span className="text-slate-900 dark:text-white">{formatINR(voucherData.taxes.roundOff)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gross Total Section */}
        {(voucherData.grossTotal || (voucherData.totals && voucherData.totals.grandTotal)) ? (
          <div className="p-4 bg-slate-50 dark:bg-[#1a1a24]/50 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-black text-slate-900 dark:text-white">{hasItems ? 'Gross Total' : 'Total'}</h2>
            <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
              {formatINR(voucherData.grossTotal || voucherData.totals.grandTotal)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
