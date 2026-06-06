import { useSearchParams } from 'react-router-dom';
import { plDrillDownData } from '../../data/plDrillDownData';
import { formatINR } from '../../data/mockData';

export default function Level5StockItemCustomer({ customerId, currentYearData }) {
 const [searchParams, setSearchParams] = useSearchParams();
 const customerData = plDrillDownData.stockItemCustomerLedger?.[customerId];

 if (!customerData) return null;

 const handleBack = () => {
 const newParams = new URLSearchParams(searchParams);
 newParams.delete('stockItemCustomer');
 setSearchParams(newParams);
 };

 return (
 <div className="animate-fade-in flex flex-col gap-2">
 {/* Custom White Header for Stock Item Customer */}
 <div className="flex items-center justify-between mb-4 glass-card p-2 px-3">
 <div className="flex items-center gap-3">
 <button 
 onClick={handleBack}
 className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-800 "
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
 </button>
 <h1 className="text-lg font-bold text-slate-900 flex items-center gap-3">
 {customerData.name}
 </h1>
 </div>

 {/* Date Selector */}
 <div className="flex items-center bg-transparent border border-slate-200 rounded-lg h-8">
 <button className="px-2 text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-200 h-full flex items-center">
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
 </button>
 <div className="px-3 text-[12px] font-semibold text-slate-700 flex items-center gap-2 h-full">
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
 {currentYearData.label}
 </div>
 <button className="px-2 text-slate-600 hover:bg-slate-50 transition-colors border-l border-slate-200 h-full flex items-center">
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
 </button>
 </div>
 </div>

 {/* Main Table Card */}
 <div className="glass-card overflow-hidden">
 {/* Table Toolbar */}
 <div className="flex items-center justify-between p-3 px-4 border-b border-slate-300 bg-slate-50 ">
 <div className="flex items-center gap-2">
 <span className="text-[12px] font-medium text-slate-700 ">Rows per page:</span>
 <select className="text-[12px] font-medium text-slate-700 bg-transparent focus:outline-none border-none cursor-pointer">
 <option>10</option>
 <option>25</option>
 <option>50</option>
 </select>
 </div>
 </div>

 {/* Vouchers Table */}
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse min-w-[800px]">
 <thead>
 <tr className="bg-slate-50/50 border-b border-slate-300 text-[11px] font-bold text-slate-700 ">
 <th className="py-2 px-4 whitespace-nowrap">Voucher No</th>
 <th className="py-2 px-4 whitespace-nowrap">Date</th>
 <th className="py-2 px-4 whitespace-nowrap">Vch Type</th>
 <th className="py-2 px-4 whitespace-nowrap text-right">Amount</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
 {customerData.vouchers.map((v, i) => (
 <tr key={i} className="hover:bg-slate-50/80 transition-colors">
 <td 
 onClick={() => setSearchParams(prev => { prev.set('voucher', v.vchNo); return prev; })}
 className="py-2.5 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
 >
 {v.vchNo}
 </td>
 <td className="py-2.5 px-4 text-[12px] font-medium text-slate-700 ">
 {v.date}
 </td>
 <td className="py-2.5 px-4 text-[12px] font-medium text-slate-700 ">
 {v.type}
 </td>
 <td className="py-2.5 px-4 text-[12px] font-medium text-slate-800 text-right">
 {formatINR(v.amount)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Pagination Footer */}
 <div className="py-2.5 px-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 ">
 <div className="text-[11px] font-medium text-slate-500 ">
 1-8 of 8
 </div>

 <div className="flex items-center gap-1">
 <button className="p-1 rounded text-slate-400 hover:bg-slate-200 transition-colors">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
 </button>
 <button className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white text-[12px] font-bold shadow-sm">
 1
 </button>
 <button className="p-1 rounded text-slate-400 hover:bg-slate-200 transition-colors">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}

