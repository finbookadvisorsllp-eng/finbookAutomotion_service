import { useSearchParams } from 'react-router-dom';
import { formatINR } from '../../data/mockData';

export default function Level4VoucherDetail({ voucherData }) {
 const [searchParams, setSearchParams] = useSearchParams();

 if (!voucherData) return (
 <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
 Voucher details not found.
 </div>
 );

 const handleBack = () => {
 const newParams = new URLSearchParams(searchParams);
 newParams.delete('voucher');
 setSearchParams(newParams);
 };

 const totalQuantity = voucherData.items?.reduce((sum, item) => sum + item.qty, 0) || 0;

 return (
 <div className="animate-fade-in flex flex-col gap-6">

 {/* Header Bar */}
 <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3 bg-white p-2.5 px-4 rounded-xl border border-slate-200 shadow-sm">

 {/* Left Side: Title & Back Button */}
 <div className="flex items-start gap-3 pt-0.5">
 <button
 onClick={handleBack}
 className="mt-0.5 text-slate-800 hover:text-slate-600 transition-colors"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
 </button>
 <div className="flex flex-col">
 <h1 className="text-[15px] font-bold text-slate-900 leading-tight">{voucherData.partyName}</h1>
 <p className="text-[11px] text-slate-500 mt-0.5">Voucher No: <span className="font-bold text-slate-800 ">{voucherData.voucherNo}</span></p>
 </div>
 </div>

 {/* Right Side: Buttons (2 Rows) */}
 <div className="flex flex-col items-end gap-1.5">
 {/* Top Row */}
 <div className="flex items-center gap-1.5">
 <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50">
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="12" x2="12" y1="7" y2="13" /><line x1="9" x2="15" y1="10" y2="10" /></svg>
 Add Notes
 </button>
 {voucherData.type !== 'Payment' && voucherData.type !== 'Journal' && (
 <>
 <button className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors ">
 Create eWay
 </button>
 <button className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors ">
 Create eInvoice
 </button>
 <button className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors ">
 Create eWay & eInvoice
 </button>
 </>
 )}
 </div>

 {/* Bottom Row */}
 <div className="flex items-center gap-1.5">
 <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20">
 <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
 Edit
 </button>
 <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded hover:bg-emerald-100 transition-colors dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20">
 <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
 Clone
 </button>
 <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100 rounded hover:bg-red-100 transition-colors dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20">
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15v-4" /><path d="M12 15v-4" /><path d="M15 15v-4" /><path d="M9 15h6" /></svg>
 View PDF
 </button>
 <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors ">
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
 Share PDF
 </button>
 </div>
 </div>
 </div>

 {/* Main Voucher Body */}
 <div className="glass-card rounded-xl border border-slate-300/50 shadow-sm overflow-hidden">

 {/* Header Info */}
 <div className="flex justify-between items-center p-2.5 px-4 border-b border-slate-300/50 ">
 <p className="text-[12px] font-bold text-slate-800 ">
 Transaction Date: <span className="font-medium text-slate-600 ">{voucherData.date}</span>
 </p>
 <p className="text-[12px] font-bold text-slate-800 ">
 Type: <span className="font-medium text-slate-600 ">{voucherData.type}</span>
 </p>
 </div>

 {/* Items Section (For Inventory Vouchers) */}
 {voucherData.items && (
 <div className="p-3 px-4 border-b border-slate-300 ">
 <h2 className="text-[14px] font-bold text-slate-900 mb-2">Items</h2>
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-blue-100 dark:border-blue-900/30 text-[11px] font-bold text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 h-10">
 <th className="pb-2">Sr.No</th>
 <th className="pb-2">Items Name</th>
 <th className="pb-2">HSN/SAC</th>
 <th className="pb-2 text-right">Quantity</th>
 <th className="pb-2 text-right">Rate</th>
 <th className="pb-2 text-right">Gr.Rate</th>
 <th className="pb-2 text-right">Dis.(%)</th>
 <th className="pb-2 text-right">Amount</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200 dark:divide-slate-600/50 text-[12px]">
 {voucherData.items.map(item => (
 <tr key={item.srNo}>
 <td className="py-2 text-slate-700 ">{item.srNo}</td>
 <td className="py-2 text-slate-700 ">{item.name}</td>
 <td className="py-2 text-slate-700 font-semibold">{item.hsn}</td>
 <td className="py-2 text-slate-700 font-semibold text-right">
 {typeof item.qty === 'number' ? item.qty.toFixed(3) : item.qty} {item.unit}
 </td>
 <td className="py-2 text-slate-700 font-semibold text-right">
 {typeof item.rate === 'number' ? `₹${item.rate.toFixed(2)}${item.unit ? '/' + item.unit : ''}` : item.rate !== '' ? `₹${item.rate}` : '₹'}
 </td>
 <td className="py-2 text-slate-700 font-semibold text-right">
 {typeof (item.grossRate ?? item.rate) === 'number' ? `₹${(item.grossRate ?? item.rate).toFixed(2)}${item.unit ? '/' + item.unit : ''}` : (item.grossRate ?? item.rate) !== '' ? `₹${item.grossRate ?? item.rate}` : '₹'}
 </td>
 <td className="py-2 text-slate-700 font-semibold text-right">{item.discount || '0'}</td>
 <td className="py-2 text-slate-700 font-semibold text-right">{formatINR(item.amount)}</td>
 </tr>
 ))}
 </tbody>
 <tfoot>
 <tr className="border-t border-orange-100 dark:border-orange-900/30 text-[12px] font-bold text-orange-900 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20">
 <td colSpan="3" className="py-2.5">Total</td>
 <td className="py-2.5 text-right">{totalQuantity.toFixed(3)}</td>
 <td colSpan="3"></td>
 <td className="py-2.5 text-right">{formatINR(voucherData.items.reduce((sum, item) => sum + item.amount, 0))}</td>
 </tr>
 </tfoot>
 </table>
 </div>
 </div>
 )}

 {/* Payment / Receipt Details (For Non-Inventory Vouchers) */}
 {voucherData.bills && (
 <div className="p-3 px-4 border-b border-slate-300 ">
 <h2 className="text-[14px] font-bold text-slate-900 mb-2 mt-2">For Bills</h2>
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-slate-300 text-[11px] font-bold text-slate-900 bg-slate-50 h-8">
 <th className="px-3 pb-1">Sr.No</th>
 <th className="px-3 pb-1">Party Name</th>
 <th className="px-3 pb-1 text-right">Amount</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200 dark:divide-slate-600/50 text-[12px] font-bold">
 {voucherData.bills.map(bill => (
 <tr key={bill.srNo}>
 <td className="py-2.5 px-3 text-slate-700 ">{bill.srNo}</td>
 <td className="py-2.5 px-3 text-slate-700 ">{bill.partyName}</td>
 <td className="py-2.5 px-3 text-slate-900 text-right">{formatINR(bill.amount)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 
 {voucherData.paymentDetails && (
 <div className="mt-4 mb-2">
 <h2 className="text-[14px] font-bold text-slate-900 mb-2">Payment Details</h2>
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <tbody className="divide-y divide-slate-200 dark:divide-slate-600/50 text-[12px] font-bold">
 {voucherData.paymentDetails.map((detail, i) => (
 <tr key={i}>
 <td className="py-2.5 px-3 text-slate-700 ">{detail.ledgerName}</td>
 <td className="py-2.5 px-3 text-slate-900 text-right">{formatINR(detail.amount)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Journal Entries (For Journal Vouchers) */}
 {voucherData.entries && (
 <div className="p-3 px-4 border-b border-slate-300 ">
 <h2 className="text-[14px] font-bold text-slate-900 mb-2 mt-2">Entries</h2>
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-slate-300 text-[11px] font-bold text-slate-900 bg-slate-50 h-8">
 <th className="px-3 pb-1">Sr.No</th>
 <th className="px-3 pb-1">Party Name</th>
 <th className="px-3 pb-1 text-right">Amount</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200 dark:divide-slate-600/50 text-[12px] font-bold">
 {voucherData.entries.map(entry => (
 <tr key={entry.srNo}>
 <td className="py-2.5 px-3 text-slate-700 ">{entry.srNo}</td>
 <td className="py-2.5 px-3 text-slate-700 uppercase">{entry.partyName}</td>
 <td className="py-2.5 px-3 text-slate-900 text-right">
 {formatINR(entry.amount)}{entry.isDr ? 'Dr.' : 'Cr.'}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Narration Section */}
 {voucherData.narration && (
 <div className="p-3 px-4 border-b border-slate-300 ">
 <h2 className="text-[14px] font-bold text-slate-900 mb-1">Narration</h2>
 <p className="text-[12px] font-bold text-slate-700 ">{voucherData.narration}</p>
 </div>
 )}

 {/* Summary Section */}
 {voucherData.items && voucherData.taxes && Object.keys(voucherData.taxes).length > 0 && (
 <div className="p-3 px-4 border-b border-slate-300 bg-white ">
 <h2 className="text-[14px] font-bold text-slate-900 mb-2">Summary</h2>
 <div className="space-y-2 max-w-full">
 {voucherData.taxes?.sgst > 0 && (
 <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-200 pb-1.5">
 <span className="text-slate-700 ">SGST {voucherData.type === 'Purchase' ? 'Input' : 'Output'}</span>
 <span className="text-slate-900 ">{formatINR(voucherData.taxes.sgst)}</span>
 </div>
 )}
 {voucherData.taxes?.cgst > 0 && (
 <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-200 pb-1.5">
 <span className="text-slate-700 ">CGST {voucherData.type === 'Purchase' ? 'Input' : 'Output'}</span>
 <span className="text-slate-900 ">{formatINR(voucherData.taxes.cgst)}</span>
 </div>
 )}
 {voucherData.taxes?.igst > 0 && (
 <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-200 pb-1.5">
 <span className="text-slate-700 ">IGST {voucherData.type === 'Purchase' ? 'Input' : 'Output'}</span>
 <span className="text-slate-900 ">{formatINR(voucherData.taxes.igst)}</span>
 </div>
 )}
 {voucherData.taxes?.roundedOff !== undefined && (
 <div className="flex justify-between items-center text-[12px] font-bold border-b border-slate-200 pb-1.5">
 <span className="text-slate-700 ">ROUND OFF</span>
 <span className="text-slate-900 ">₹{voucherData.taxes.roundedOff.toFixed(2)}</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Gross Total Section */}
 {voucherData.totals?.grandTotal || voucherData.grossTotal || voucherData.bills ? (
 <div className="p-3 px-4 flex justify-between items-center">
 <h2 className="text-[18px] font-black text-slate-900 ">
 {voucherData.type === 'Payment' || voucherData.type === 'Receipt' ? 'Total' : 'Gross Total'}
 </h2>
 <span className="text-[18px] font-black text-slate-900 ">
 {formatINR(voucherData.grossTotal || voucherData.totals?.grandTotal || voucherData.bills?.[0]?.amount)}
 </span>
 </div>
 ) : null}

 </div>
 </div>
 );
}

