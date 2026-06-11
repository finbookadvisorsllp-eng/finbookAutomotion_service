import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '../data/mockData';
import { useDateRange } from '../context/DateContext';
import { useApi } from '../hooks/useApi';
import {
    getProfitLoss,
    getPlLedgerVouchers,
    getPlStockItems,
    getPlStockItemLedger,
    getVoucher
} from '../api';

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
    const { fy, years, selectFy, selectedDateRange } = useDateRange();

    // Extract state from URL
    const ledgerId = searchParams.get('ledger');
    const voucherId = searchParams.get('voucher');
    const stockItemId = searchParams.get('stockItem');
    const stockItemCustomer = searchParams.get('stockItemCustomer');

    // Resolve backend parameter dictionary based on active date selection
    const getBackendParams = (fyVal, dateRangeVal) => {
        const params = {};
        if (!dateRangeVal) {
            if (fyVal) params.fy = fyVal;
            return params;
        }
        if (dateRangeVal.includes('Today')) {
            params.dateFilter = 'today';
        } else if (dateRangeVal.includes('Yesterday')) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            params.dateFilter = 'custom';
            params.fromDate = yesterday.toISOString().split('T')[0];
            params.toDate = params.fromDate;
        } else if (dateRangeVal.includes('This Month')) {
            params.dateFilter = 'this_month';
        } else if (dateRangeVal.includes('This Quarter')) {
            params.dateFilter = 'this_quarter';
        } else if (dateRangeVal.includes('This Year') || dateRangeVal.includes('This Financial Year')) {
            params.dateFilter = 'this_financial_year';
        } else {
            const match = dateRangeVal.match(/\(([^)]+)\)/);
            if (match) {
                const parts = match[1].split(' - ');
                if (parts.length === 2) {
                    const parseHeaderDate = (str) => {
                        const cleaned = str.replace(/(\d+)(st|nd|rd|th)/, '$1');
                        const dateParts = cleaned.trim().split(/\s+/);
                        if (dateParts.length !== 3) return null;
                        const day = parseInt(dateParts[0], 10);
                        const monthName = dateParts[1].slice(0, 3).toLowerCase();
                        const yearShort = dateParts[2].replace("'", "");
                        const year = parseInt(yearShort, 10) + 2000;
                        const months = {
                            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
                        };
                        const month = months[monthName];
                        if (!month) return null;
                        return `${year}-${month}-${String(day).padStart(2, '0')}`;
                    };
                    const fromDate = parseHeaderDate(parts[0]);
                    const toDate = parseHeaderDate(parts[1]);
                    if (fromDate && toDate) {
                        params.dateFilter = 'custom';
                        params.fromDate = fromDate;
                        params.toDate = toDate;
                    }
                }
            } else if (dateRangeVal.includes(' - ')) {
                const parts = dateRangeVal.split(' - ');
                if (parts.length === 2 && parts[0].includes('/')) {
                    const [d1, m1, y1] = parts[0].split('/');
                    const [d2, m2, y2] = parts[1].split('/');
                    params.dateFilter = 'custom';
                    params.fromDate = `${y1.trim()}-${m1.trim()}-${d1.trim()}`;
                    params.toDate = `${y2.trim()}-${m2.trim()}-${d2.trim()}`;
                }
            }
        }
        if (fyVal && !params.fy) {
            params.fy = fyVal;
        }
        return params;
    };

    const apiParams = getBackendParams(fy, selectedDateRange);

    // 1. Fetch main Profit & Loss report (L1 & L2)
    const { data: apiData, loading: plLoading, error: plError } = useApi(
        () => getProfitLoss(fy, apiParams),
        [fy, selectedDateRange],
        { skip: !fy }
    );

    // 2. Fetch vouchers list for selected ledger (L3)
    const { data: voucherRes, loading: vouchersLoading } = useApi(
        () => getPlLedgerVouchers(ledgerId, fy, 1, 100, apiParams),
        [ledgerId, fy, selectedDateRange],
        { skip: !ledgerId || ledgerId === 'stock-hand-closing' }
    );

    // 3. Fetch closing stock items list (L3 Closing Stock)
    const { data: stockItemsRes, loading: stockItemsLoading } = useApi(
        () => getPlStockItems(fy, apiParams),
        [fy, selectedDateRange],
        { skip: ledgerId !== 'stock-hand-closing' || !fy }
    );

    // 4. Fetch stock item performance ledger (L4 Stock Item Ledger)
    const { data: itemPerformanceRes, loading: itemPerformanceLoading } = useApi(
        () => getPlStockItemLedger(stockItemId, fy, apiParams),
        [stockItemId, fy, selectedDateRange],
        { skip: !stockItemId || !fy }
    );

    // 5. Fetch single voucher detail (L4 Voucher Detail / L5 Stock Customer Voucher Detail)
    const { data: voucherDetailRes, loading: voucherDetailLoading } = useApi(
        () => getVoucher(voucherId),
        [voucherId],
        { skip: !voucherId }
    );

    const [comparePeriod, setComparePeriod] = useState(null);
    const isComparing = comparePeriod !== null;

    const currentIndex = years.findIndex(y => y.id === fy);

    const currentYearData = apiData?.years?.[0] || {
        id: fy,
        label: selectedDateRange || '',
        isProfit: false,
        summary: { revenue: 0, gross: 0, net: 0 },
        particulars: []
    };

    // Map / compute helpers for deep drill-down components
    const getLedgerData = () => {
        if (!ledgerId) return null;
        if (ledgerId === 'stock-hand-closing') {
            return { id: 'stock-hand-closing', name: 'Closing Stock', debit: currentYearData.summary.closingStock || 0, credit: 0 };
        }
        if (ledgerId === 'stock-hand') {
            return { id: 'stock-hand', name: 'Stock in Hand', debit: currentYearData.summary.openingStock || 0, credit: 0 };
        }
        if (currentYearData.particulars) {
            for (const p of currentYearData.particulars) {
                if (p.ledgers) {
                    const ledger = p.ledgers.find(l => l.id === ledgerId);
                    if (ledger) return ledger;
                }
            }
        }
        return { id: ledgerId, name: ledgerId, debit: 0, credit: 0 };
    };

    const vouchers = voucherRes?.data || [];
    const stockItems = stockItemsRes || [];
    const voucherDetail = voucherDetailRes || null;

    // Find the stock item summary from the loaded closing stock list (or fallback empty)
    const getStockItemSummary = () => {
        if (!stockItemId) return null;
        return stockItems.find(item => item.name === stockItemId) || null;
    };

    // Dynamically compute the Level 4 Stock Item Ledger data using the master details + voucher history
    const getStockItemLedgerData = () => {
        if (!itemPerformanceRes) return null;
        const name = itemPerformanceRes.name;
        const vchs = itemPerformanceRes.vouchers || [];
        
        const customersMap = new Map();
        const suppliersMap = new Map();
        
        vchs.forEach(v => {
            const isSales = v.type === 'Sales' || v.type === 'Credit Note';
            const isPurchase = v.type === 'Purchase' || v.type === 'Debit Note';
            const qty = Math.abs(v.qty || 0);
            const amount = Math.abs(v.amount || 0);
            
            if (isSales && v.ledgerName) {
                if (!customersMap.has(v.ledgerName)) {
                    customersMap.set(v.ledgerName, {
                        id: v.ledgerName,
                        name: v.ledgerName,
                        lastSold: v.date,
                        totalQty: 0,
                        totalAmount: 0
                    });
                }
                const c = customersMap.get(v.ledgerName);
                c.totalQty += qty;
                c.totalAmount += amount;
            } else if (isPurchase && v.ledgerName) {
                if (!suppliersMap.has(v.ledgerName)) {
                    suppliersMap.set(v.ledgerName, {
                        name: v.ledgerName,
                        lastPurchase: v.date,
                        totalQty: 0,
                        totalAmount: 0
                    });
                }
                const s = suppliersMap.get(v.ledgerName);
                s.totalQty += qty;
                s.totalAmount += amount;
            }
        });
        
        const customers = Array.from(customersMap.values()).map(c => ({
            ...c,
            totalQty: c.totalQty.toFixed(2),
            rate: c.totalQty > 0 ? `₹${(c.totalAmount / c.totalQty).toFixed(2)}` : '₹0'
        }));
        
        const suppliers = Array.from(suppliersMap.values()).map(s => ({
            ...s,
            totalQty: s.totalQty.toFixed(2),
            rate: s.totalQty > 0 ? `₹${(s.totalAmount / s.totalQty).toFixed(2)}` : '₹0'
        }));
        
        const itemSummary = getStockItemSummary();
        const amount = itemSummary ? itemSummary.value : 0;
        const hsn = itemSummary ? itemSummary.hsn : '';
        const closingStock = itemSummary ? `${itemSummary.closing} ${itemSummary.unit || 'PCS'}` : '0 PCS';
        const avgPurRate = itemSummary ? itemSummary.rate : 0;
        const gstRate = itemSummary ? `${itemSummary.gstRate} %` : '0 %';
        
        return {
            name,
            amount,
            hsn,
            closingStock,
            avgPurRate,
            gstRate,
            vouchers: vchs.map(v => ({
                date: v.date,
                ledgerName: v.ledgerName,
                type: v.type,
                vchNo: v.vchNo,
                amount: v.amount
            })),
            customers,
            suppliers
        };
    };

    const itemData = getStockItemLedgerData();

    const getCustomerData = () => {
        if (!stockItemCustomer || !itemPerformanceRes) return null;
        const vchs = itemPerformanceRes.vouchers || [];
        const customerVouchers = vchs
            .filter(v => v.ledgerName === stockItemCustomer)
            .map(v => ({
                vchNo: v.vchNo,
                date: v.date,
                type: v.type,
                amount: v.amount
            }));
        return {
            name: stockItemCustomer,
            vouchers: customerVouchers
        };
    };

    const customerData = getCustomerData();

    const handlePrevYear = () => {
        if (currentIndex > 0) selectFy(years[currentIndex - 1].id);
    };

    const handleNextYear = () => {
        if (currentIndex < years.length - 1) selectFy(years[currentIndex + 1].id);
    };

    // Determine what level to render
    const renderCurrentLevel = () => {
        if (plLoading || (ledgerId && vouchersLoading) || (ledgerId === 'stock-hand-closing' && stockItemsLoading) || (stockItemId && itemPerformanceLoading) || (voucherId && voucherDetailLoading)) {
            return <div className="py-12 text-center text-[13px] text-slate-500 font-medium animate-pulse">Loading…</div>;
        }

        if (plError) {
            return <div className="py-12 text-center text-[13px] text-red-500 font-medium">Error loading report: {plError.message}</div>;
        }

        if (voucherId) {
            return <Level4VoucherDetail voucherData={voucherDetail} />;
        }

        if (stockItemCustomer) {
            return <Level5StockItemCustomer customerId={stockItemCustomer} currentYearData={currentYearData} customerData={customerData} />;
        }

        if (stockItemId) {
            return <Level4StockItemLedger itemId={stockItemId} currentYearData={currentYearData} itemData={itemData} />;
        }

        if (ledgerId === 'stock-hand-closing') {
            return <Level3StockList ledgerData={getLedgerData()} stockItems={stockItems} stockInfo={apiData?.stockInfo} />;
        }

        if (ledgerId) {
            return <Level3VoucherList ledgerData={getLedgerData()} vouchers={vouchers} />;
        }

        // Default Level 1 & 2 (Unified)
        return <Level1Summary data={currentYearData} isComparing={isComparing} comparePeriod={comparePeriod} setComparePeriod={setComparePeriod} />;
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
                        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 "><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h1 className="text-xl font-black text-slate-900 ">Profit & Loss</h1>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center glass-card">
                        <button
                            onClick={handlePrevYear}
                            disabled={currentIndex <= 0}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border-r border-slate-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <span className="px-4 text-sm font-semibold text-slate-700 min-w-[180px] text-center">
                            {currentYearData.label}
                        </span>
                        <button
                            onClick={handleNextYear}
                            disabled={currentIndex >= years.length - 1}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border-l border-slate-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* KPIs */}
            {!ledgerId && !voucherId && !stockItemId && !stockItemCustomer && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="glass-card p-3 px-4 flex items-center gap-3">
                        <div className={`p-2 rounded-full ${currentYearData.isProfit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                            {currentYearData.isProfit ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4-4 4 4 8-8" /><path d="m15 8 h4 v4" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 4 4 4-4 8 8" /><path d="m15 16 h4 v-4" /></svg>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                {currentYearData.isProfit ? 'Gross Profit' : 'Gross Loss'}
                            </p>
                            <p className="text-[16px] font-black text-slate-900 ">{formatINR(currentYearData.summary.gross)}</p>
                        </div>
                    </div>

                    <div className="glass-card p-3 px-4 flex items-center gap-3">
                        <div className={`p-2 rounded-full ${currentYearData.isProfit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                            {currentYearData.isProfit ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4-4 4 4 8-8" /><path d="m15 8 h4 v4" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 4 4 4-4 8 8" /><path d="m15 16 h4 v-4" /></svg>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                {currentYearData.isProfit ? 'Nett Profit' : 'Nett Loss'}
                            </p>
                            <p className="text-[16px] font-black text-slate-900 ">{formatINR(currentYearData.summary.net)}</p>
                        </div>
                    </div>

                    <div className="glass-card p-3 px-4 flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4-4 4 4 8-8" /><path d="m15 8 h4 v4" /></svg>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                Revenue
                            </p>
                            <p className="text-[16px] font-black text-slate-900 ">{formatINR(currentYearData.summary.revenue)}</p>
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

