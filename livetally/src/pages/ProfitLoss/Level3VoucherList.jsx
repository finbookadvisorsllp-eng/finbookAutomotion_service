import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '../../data/mockData';

export default function Level3VoucherList({ ledgerData, vouchers = [] }) {
  const [, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('Ledger Summary');

  if (!ledgerData) return null;

  const totalAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-300 dark:border-slate-600 animate-fade-in overflow-hidden">
      
      {/* Tabs */}
      <div className="flex items-center gap-4 px-4 pt-2.5 border-b border-slate-300 dark:border-slate-600">
        <button 
          onClick={() => setActiveTab('Ledger Summary')}
          className={`pb-2 text-[13px] transition-colors ${activeTab === 'Ledger Summary' ? 'font-bold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Ledger Summary
        </button>
        <button 
          onClick={() => setActiveTab('Items Sold')}
          className={`pb-2 text-[13px] transition-colors ${activeTab === 'Items Sold' ? 'font-bold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Items Sold
        </button>
        <button 
          onClick={() => setActiveTab('Items Purchased')}
          className={`pb-2 text-[13px] transition-colors ${activeTab === 'Items Purchased' ? 'font-bold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Items Purchased
        </button>
      </div>

      {activeTab === 'Ledger Summary' && (
        <>
          {/* Filters Bar */}
          <div className="flex justify-end items-center gap-2 p-2.5 px-4 border-b border-slate-300 dark:border-slate-600">
            <select className="px-2 py-1 text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option>All Vouchers</option>
              <option>Sales</option>
              <option>Credit Note</option>
            </select>
            
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md">
              <button className="px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border-r border-slate-300 dark:border-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="px-3 text-xs font-medium flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                01/04/2024 - 31/03/2025
              </div>
              <button className="px-1.5 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border-l border-slate-300 dark:border-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>

            <button className="p-1 border border-slate-300 dark:border-slate-600 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-4"/><path d="M12 15v-4"/><path d="M15 15v-4"/><path d="M9 15h6"/></svg>
            </button>
          </div>

          {/* Vouchers Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#f0f8ff] dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <th className="py-2.5 px-4">Voucher No</th>
                  <th className="py-2.5 px-4">Voucher Type</th>
                  <th className="py-2.5 px-4">Ref.No</th>
                  <th className="py-2.5 px-4 flex items-center gap-1">Date <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg></th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-4 text-center text-[12px] text-slate-500 dark:text-slate-400">
                      No vouchers found for this ledger.
                    </td>
                  </tr>
                ) : (
                  vouchers.map(voucher => (
                    <tr 
                      key={voucher.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-1.5 px-4">
                        <button 
                          onClick={() => setSearchParams(prev => {
                            const newParams = new URLSearchParams(prev);
                            newParams.set('voucher', voucher.id);
                            return newParams;
                          })}
                          className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left"
                        >
                          {voucher.id}
                        </button>
                      </td>
                      <td className="py-1.5 px-4 text-[12px] text-slate-600 dark:text-slate-300">{voucher.type}</td>
                      <td className="py-1.5 px-4 text-[12px] text-slate-600 dark:text-slate-300">{voucher.refNo || ''}</td>
                      <td 
                        className="py-1.5 px-4 text-[12px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        onClick={() => setSearchParams(prev => {
                          const newParams = new URLSearchParams(prev);
                          newParams.set('voucher', voucher.id);
                          return newParams;
                        })}
                      >
                        {voucher.date}
                      </td>
                      <td className="py-1.5 px-4 text-[12px] font-medium text-slate-800 dark:text-slate-200 text-right">
                        {formatINR(voucher.amount)}
                      </td>
                      <td className="py-1.5 px-4 text-center">
                        <button className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors inline-flex justify-center w-full">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13v4"/><path d="M14 13v4"/><path d="M10 13h4"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="py-2.5 px-4 border-t border-slate-300 dark:border-slate-600 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              1-{vouchers.length} of {vouchers.length}
            </div>
            
            <div className="px-3 py-1 bg-slate-100/80 dark:bg-slate-800 rounded-full text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-300 dark:border-slate-600">
              <span className="opacity-75 font-medium mr-1">Opening:</span> 
              ₹0.00 <span className="text-emerald-600 dark:text-emerald-400 ml-0.5 mr-3">Cr</span>
              <span className="opacity-75 font-medium mr-1">Closing:</span> 
              {formatINR(totalAmount)} 
              <span className={`ml-0.5 ${ledgerData.debit > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {ledgerData.debit > 0 ? 'Dr' : 'Cr'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white text-xs font-bold shadow-sm">
                1
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors">
                2
              </button>
              <button className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </>
      )}

      {(activeTab === 'Items Sold' || activeTab === 'Items Purchased') && (
        <>
          {/* Filters Bar for Items */}
          <div className="flex justify-between items-center gap-2 p-2.5 px-4 border-b border-slate-300 dark:border-slate-600">
            <input 
              type="text" 
              placeholder="Search" 
              className="px-3 py-1.5 text-[12px] w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md">
                <button className="px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border-r border-slate-300 dark:border-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="px-3 text-xs font-medium flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  01/04/2024 - 31/03/2025
                </div>
                <button className="px-1.5 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border-l border-slate-300 dark:border-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>

              <button className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-4"/><path d="M12 15v-4"/><path d="M15 15v-4"/><path d="M9 15h6"/></svg>
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#f0f8ff] dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  <th className="py-2.5 px-4 w-[40%] flex items-center gap-1">Item Name <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg></th>
                  <th className="py-2.5 px-4">{activeTab === 'Items Sold' ? 'Last Sold' : 'Last Purchased'}</th>
                  <th className="py-2.5 px-4">Total Quantity</th>
                  <th className="py-2.5 px-4 text-right">Avg.Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="4" className="py-8 text-center text-[12px] text-slate-500 dark:text-slate-400">
                    No data available
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="py-3 px-4 flex items-center justify-between">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              1-0 of 0
            </div>
            
            <div className="flex items-center gap-2">
              <button className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </>
      )}
      
    </div>
  );
}
