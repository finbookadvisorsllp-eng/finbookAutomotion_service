import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { plDrillDownData } from '../../data/plDrillDownData';
import { formatINR } from '../../data/mockData';

export default function Level4StockItemLedger({ itemId, currentYearData }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('Summary');
  const itemData = plDrillDownData.stockItemLedger?.[itemId];

  if (!itemData) return null;

  const handleBack = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('stockItem');
    setSearchParams(newParams);
  };

  return (
    <div className="animate-fade-in flex flex-col gap-2">
      {/* Custom White Header for Stock Item */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-300 dark:border-slate-600 p-4">
        <div className="flex justify-between items-center">
          
          {/* Left Side: Title & Info */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleBack}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-800 dark:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              </button>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                {itemData.name}
                <button className="text-[12px] font-medium text-blue-600 hover:underline">
                  Show Description
                </button>
              </h1>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 max-w-lg gap-y-1 ml-10 text-[12px]">
              <div className="font-medium">
                <span className="text-slate-600">Amount : </span>
                <span className="text-slate-900 font-bold dark:text-white">₹{itemData.amount}</span>
              </div>
              <div className="font-medium">
                <span className="text-slate-600">HSN code : </span>
                <span className="text-slate-900 font-bold dark:text-white">{itemData.hsn}</span>
              </div>
              <div className="font-medium">
                <span className="text-slate-600">Closing stock : </span>
                <span className="text-slate-900 font-bold dark:text-white">{itemData.closingStock}</span>
              </div>
              <div className="font-medium">
                <span className="text-slate-600">Avg Pur Rate : </span>
                <span className="text-slate-900 font-bold dark:text-white">₹{itemData.avgPurRate}</span>
              </div>
              <div className="font-medium">
                <span className="text-slate-600">GST Rate : </span>
                <span className="text-slate-900 font-bold dark:text-white">{itemData.gstRate}</span>
              </div>
            </div>
          </div>

          {/* Right Side: Actions and Date */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-[12px] font-semibold text-slate-700 dark:text-slate-300 p-0.5">
              <button 
                onClick={() => setActiveTab('Summary')}
                className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'Summary' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'}`}
              >Summary</button>
              <button 
                onClick={() => setActiveTab('Customers')}
                className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'Customers' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'}`}
              >Customers</button>
              <button 
                onClick={() => setActiveTab('Suppliers')}
                className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'Suppliers' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'}`}
              >Suppliers</button>
              <button className="px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1 border border-transparent">
                More <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>

            {/* Date Selector */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm h-8 ml-2">
              <button className="px-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-r border-slate-300 dark:border-slate-600 h-full flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="px-3 text-[12px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 h-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                {currentYearData.label}
              </div>
              <button className="px-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-l border-slate-300 dark:border-slate-600 h-full flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-300 dark:border-slate-600 overflow-hidden">
        {/* Table Toolbar */}
        <div className="flex items-center justify-between p-3 px-4 border-b border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-4">
            <input 
              type="text" 
              placeholder="Search" 
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-[12px] w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">Rows per page:</span>
              <select className="text-[12px] font-medium text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none border-none cursor-pointer">
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
            </div>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            View PDF
          </button>
        </div>

        {/* Vouchers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'Summary' && (
                  <>
                    <th className="py-2 px-4 whitespace-nowrap">Date &uarr;</th>
                    <th className="py-2 px-4 whitespace-nowrap">Ledger Name</th>
                    <th className="py-2 px-4 whitespace-nowrap">Voucher Type</th>
                    <th className="py-2 px-4 whitespace-nowrap">Voucher Number</th>
                    <th className="py-2 px-4 whitespace-nowrap text-right">Amount</th>
                    <th className="py-2 px-4 whitespace-nowrap text-center">Download</th>
                  </>
                )}
                {activeTab === 'Customers' && (
                  <>
                    <th className="py-2 px-4 whitespace-nowrap">Ledger Name &uarr;</th>
                    <th className="py-2 px-4 whitespace-nowrap">Last Sold</th>
                    <th className="py-2 px-4 whitespace-nowrap text-right">Total Quantity</th>
                    <th className="py-2 px-4 whitespace-nowrap text-right">Rate</th>
                  </>
                )}
                {activeTab === 'Suppliers' && (
                  <>
                    <th className="py-2 px-4 whitespace-nowrap">Ledger Name &uarr;</th>
                    <th className="py-2 px-4 whitespace-nowrap text-center">Last Purchase</th>
                    <th className="py-2 px-4 whitespace-nowrap text-right">Total Quantity</th>
                    <th className="py-2 px-4 whitespace-nowrap text-right">Rate</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {activeTab === 'Summary' && itemData.vouchers.map((v, i) => (
                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td 
                    onClick={() => setSearchParams(prev => { prev.set('voucher', v.vchNo); return prev; })}
                    className="py-2.5 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {v.date}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    {v.ledgerName}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    {v.type}
                  </td>
                  <td 
                    onClick={() => setSearchParams(prev => { prev.set('voucher', v.vchNo); return prev; })}
                    className="py-2.5 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {v.vchNo}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-800 dark:text-slate-200 text-right">
                    {formatINR(v.amount)}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] flex justify-center text-red-600 hover:text-red-800 cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM12 18l-4-4h3v-4h2v4h3l-4 4z"/></svg>
                  </td>
                </tr>
              ))}
              
              {activeTab === 'Customers' && itemData.customers.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td 
                    onClick={() => setSearchParams(prev => { prev.set('stockItemCustomer', c.id); return prev; })}
                    className="py-2.5 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {c.name}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    {c.lastSold}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-800 dark:text-slate-200 text-right">
                    {c.totalQty}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-800 dark:text-slate-200 text-right">
                    {c.rate}
                  </td>
                </tr>
              ))}
              
              {activeTab === 'Suppliers' && itemData.suppliers.length > 0 ? itemData.suppliers.map((s, i) => (
                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    {s.name}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-700 dark:text-slate-300 text-center">
                    {s.lastPurchase}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-800 dark:text-slate-200 text-right">
                    {s.totalQty}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] font-medium text-slate-800 dark:text-slate-200 text-right">
                    {s.rate}
                  </td>
                </tr>
              )) : activeTab === 'Suppliers' ? (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-[12px] font-medium text-slate-500 dark:text-slate-400">
                    No data available
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="py-2.5 px-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {activeTab === 'Summary' && '1-10 of 12'}
            {activeTab === 'Customers' && '1-1 of 1'}
            {activeTab === 'Suppliers' && '1-0 of 0'}
          </div>

          <div className="flex items-center gap-1">
            <button className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white text-[12px] font-bold shadow-sm">
              1
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[12px] font-medium transition-colors">
              2
            </button>
            <button className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
