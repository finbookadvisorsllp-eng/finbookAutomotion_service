import { useSearchParams } from 'react-router-dom';
import { formatINR } from '../../data/mockData';

export default function Level2LedgerBreakdown({ groupData }) {
 const [, setSearchParams] = useSearchParams();

 if (!groupData) return null;

 return (
 <div className="glass-card overflow-hidden animate-fade-in">
 <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
 <div>
 <h2 className="text-lg font-bold text-slate-800 ">{groupData.name}</h2>
 <p className="text-sm text-slate-500 mt-1">Ledger Breakdown</p>
 </div>
 <div className="text-right">
 <p className="text-sm text-slate-500 ">Total Balance</p>
 <p className={`text-xl font-bold ${groupData.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
 {formatINR(groupData.amount)}
 </p>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 ">
 <th className="p-4 font-semibold">Ledger Name</th>
 <th className="p-4 font-semibold text-right">Debit</th>
 <th className="p-4 font-semibold text-right">Credit</th>
 <th className="p-4 font-semibold text-right">Net Balance</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
 {groupData.ledgers.map(ledger => (
 <tr 
 key={ledger.id} 
 onClick={() => setSearchParams(prev => {
 const newParams = new URLSearchParams(prev);
 newParams.set('ledger', ledger.id);
 return newParams;
 })}
 className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors group"
 >
 <td className="p-4">
 <span className="font-semibold text-slate-700 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
 {ledger.name}
 </span>
 </td>
 <td className="p-4 text-right text-sm text-slate-600 ">
 {ledger.debit > 0 ? formatINR(ledger.debit) : '-'}
 </td>
 <td className="p-4 text-right text-sm text-slate-600 ">
 {ledger.credit > 0 ? formatINR(ledger.credit) : '-'}
 </td>
 <td className={`p-4 text-right font-bold ${groupData.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
 {formatINR(ledger.amount)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
}

