import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { plDrillDownData } from '../data/plDrillDownData';
import { formatINR } from '../data/mockData';

// Import Drill-Down Components
import Breadcrumbs from './ProfitLoss/Breadcrumbs';
import Level1Summary from './ProfitLoss/Level1Summary';
import Level3VoucherList from './ProfitLoss/Level3VoucherList';
import Level3StockList from './ProfitLoss/Level3StockList';
import Level4StockItemLedger from './ProfitLoss/Level4StockItemLedger';
import Level5StockItemCustomer from './ProfitLoss/Level5StockItemCustomer';
import Level4VoucherDetail from './ProfitLoss/Level4VoucherDetail';

export default function ProfitLoss() {
  const [searchParams] = useSearchParams();
  const yearParam = searchParams.get('year');

  const initialYearIndex = () => {
    if (yearParam) {
      const idx = plDrillDownData.years.findIndex(y => y.id === yearParam);
      if (idx !== -1) return idx;
    }
    return 1; // Default to 2024-2025
  };

  const [currentYearIndex, setCurrentYearIndex] = useState(initialYearIndex);

  useEffect(() => {
    if (yearParam) {
      const idx = plDrillDownData.years.findIndex(y => y.id === yearParam);
      if (idx !== -1) setCurrentYearIndex(idx);
    }
  }, [yearParam]);

  // Extract state from URL
  const ledgerId = searchParams.get('ledger');
  const voucherId = searchParams.get('voucher');
  const stockItemId = searchParams.get('stockItem');
  const stockItemCustomer = searchParams.get('stockItemCustomer');

  const currentYearData = plDrillDownData.years[currentYearIndex];

  // Helper functions for deeper levels
  const getLedgerData = () => {
    if (!ledgerId) return null;
    for (const p of currentYearData.particulars) {
      const ledger = p.ledgers.find(l => l.id === ledgerId);
      if (ledger) return ledger;
    }
    return null;
  };

  const getVouchers = () => {
    if (!ledgerId) return [];
    const allVouchers = plDrillDownData.vouchers[ledgerId] || [];
    return allVouchers.filter(v => v.yearId === currentYearData.id);
  };

  const getVoucherDetail = () => {
    if (!voucherId) return null;
    return plDrillDownData.voucherDetails[voucherId];
  };

  const handlePrevYear = () => {
    if (currentYearIndex > 0) setCurrentYearIndex(prev => prev - 1);
  };

  const handleNextYear = () => {
    if (currentYearIndex < plDrillDownData.years.length - 1) setCurrentYearIndex(prev => prev + 1);
  };

  // Determine what level to render
  const renderCurrentLevel = () => {
    if (voucherId) {
      return <Level4VoucherDetail voucherData={getVoucherDetail()} />;
    }
    
    if (stockItemCustomer) {
      return <Level5StockItemCustomer customerId={stockItemCustomer} currentYearData={currentYearData} />;
    }
    
    if (stockItemId) {
      return <Level4StockItemLedger itemId={stockItemId} currentYearData={currentYearData} />;
    }
    
    if (ledgerId === 'stock-hand-closing') {
      return <Level3StockList ledgerData={getLedgerData()} currentYearData={currentYearData} />;
    }

    if (ledgerId) {
      return <Level3VoucherList ledgerData={getLedgerData()} vouchers={getVouchers()} />;
    }
    
    // Default Level 1 & 2 (Unified)
    return <Level1Summary data={currentYearData} />;
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-screen">
      {/* Dynamic Breadcrumbs / Header for deeper levels */}
      {ledgerId && !voucherId && !stockItemId && !stockItemCustomer && (
        <Breadcrumbs ledgerName={getLedgerData()?.name || ledgerId} currentYearData={currentYearData} />
      )}

      {/* Header & Global Actions */}
      {!ledgerId && !voucherId && !stockItemId && !stockItemCustomer && (
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-300"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Profit & Loss</h1>
          </div>
          
          {/* Year Selector */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
            <button 
              onClick={handlePrevYear}
              disabled={currentYearIndex === 0}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border-r border-slate-200 dark:border-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span className="px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[180px] text-center">
              {currentYearData.label}
            </span>
            <button 
              onClick={handleNextYear}
              disabled={currentYearIndex === plDrillDownData.years.length - 1}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border-l border-slate-200 dark:border-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      {!ledgerId && !voucherId && !stockItemId && !stockItemCustomer && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-slate-800 p-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className={`p-2 rounded-full ${currentYearData.isProfit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-red-50 text-red-600 dark:bg-red-500/10'}`}>
               {currentYearData.isProfit ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4-4 4 4 8-8"/><path d="m15 8 h4 v4"/></svg>
               ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 4 4 4-4 8 8"/><path d="m15 16 h4 v-4"/></svg>
               )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                {currentYearData.isProfit ? 'Gross Profit' : 'Gross Loss'}
              </p>
              <p className="text-[16px] font-black text-slate-900 dark:text-white">{formatINR(currentYearData.summary.gross)}</p>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className={`p-2 rounded-full ${currentYearData.isProfit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-red-50 text-red-600 dark:bg-red-500/10'}`}>
              {currentYearData.isProfit ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4-4 4 4 8-8"/><path d="m15 8 h4 v4"/></svg>
               ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 4 4 4-4 8 8"/><path d="m15 16 h4 v-4"/></svg>
               )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                {currentYearData.isProfit ? 'Nett Profit' : 'Nett Loss'}
              </p>
              <p className="text-[16px] font-black text-slate-900 dark:text-white">{formatINR(currentYearData.summary.net)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4-4 4 4 8-8"/><path d="m15 8 h4 v4"/></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                Revenue
              </p>
              <p className="text-[16px] font-black text-slate-900 dark:text-white">{formatINR(currentYearData.summary.revenue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Content Area */}
      <div className="flex-1 pb-10">
        {renderCurrentLevel()}
      </div>
    </div>
  );
}
