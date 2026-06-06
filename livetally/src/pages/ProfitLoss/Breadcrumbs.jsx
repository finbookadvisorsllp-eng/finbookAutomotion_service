import { useSearchParams, useNavigate } from 'react-router-dom';

export default function Breadcrumbs({ ledgerName, currentYearData }) {
 const [searchParams, setSearchParams] = useSearchParams();
 const navigate = useNavigate();
 
 const ledger = searchParams.get('ledger');
 const voucher = searchParams.get('voucher');
 const from = searchParams.get('from');

 if (!ledger && !voucher) return null; // Only show if we are drilled down

 const navigateTo = (level) => {
 if (level === 'root') {
 if (from === 'trial-balance') {
 navigate('/reports/tb');
 return;
 }
 if (from === 'cash') {
 navigate('/cash-bank/cash');
 return;
 }
 if (from === 'bank') {
 navigate('/cash-bank/bank');
 return;
 }
 const newParams = new URLSearchParams(searchParams);
 newParams.delete('ledger');
 newParams.delete('voucher');
 newParams.delete('from');
 setSearchParams(newParams);
 } else if (level === 'ledger') {
 const newParams = new URLSearchParams(searchParams);
 newParams.delete('voucher');
 setSearchParams(newParams);
 }
 };

 return (
 <div className="flex items-center gap-3 mb-4 glass-card p-2 px-3 w-fit md:w-auto md:justify-between">
 <div className="flex items-center gap-3">
 <button 
 onClick={() => navigateTo(voucher ? 'ledger' : 'root')}
 className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-800 "
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
 </button>
 
 <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
 {voucher ? voucher : ledgerName}
 <button className="text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
 </button>
 </h1>
 
 </div>
 </div>
 );
}

