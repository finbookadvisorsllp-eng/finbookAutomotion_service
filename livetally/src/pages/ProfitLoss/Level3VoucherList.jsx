import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '../../data/mockData';
import Pagination from '../../components/Pagination';

export default function Level3VoucherList({ ledgerData, vouchers = [], pagination, onPageChange, onPageSizeChange, searchTerm = '', onSearchChange, isLoadingVouchers = false }) {
    const [, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('Ledger Summary');

    if (!ledgerData) return null;

    const closingBalance = ledgerData.debit || ledgerData.credit || 0;

    return (
        <div className="report-card rounded-none border-[var(--report-border)] bg-[var(--theme-card-bg)] shadow-none animate-fade-in overflow-hidden">

            {/* Tabs */}
            <div className="flex items-center gap-4 px-4 pt-2.5 border-b border-[var(--report-divider)] bg-[var(--theme-card-bg)]">
                <button
                    onClick={() => setActiveTab('Ledger Summary')}
                    className={`pb-2 text-[13px] font-bold transition-colors rounded-none focus:outline-none ${activeTab === 'Ledger Summary' ? 'text-[var(--theme-text-main)] border-b-2 border-[var(--theme-text-main)]' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'}`}
                >
                    Ledger Summary
                </button>
                <button
                    onClick={() => setActiveTab('Items Sold')}
                    className={`pb-2 text-[13px] font-bold transition-colors rounded-none focus:outline-none ${activeTab === 'Items Sold' ? 'text-[var(--theme-text-main)] border-b-2 border-[var(--theme-text-main)]' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'}`}
                >
                    Items Sold
                </button>
                <button
                    onClick={() => setActiveTab('Items Purchased')}
                    className={`pb-2 text-[13px] font-bold transition-colors rounded-none focus:outline-none ${activeTab === 'Items Purchased' ? 'text-[var(--theme-text-main)] border-b-2 border-[var(--theme-text-main)]' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'}`}
                >
                    Items Purchased
                </button>
            </div>

            {activeTab === 'Ledger Summary' && (
                <>
                    {/* Filters Bar */}
                    <div className="flex justify-between items-center gap-2.5 p-3 px-4 border-b border-[var(--report-divider)] bg-[var(--theme-card-bg)]">
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="px-3 py-1.5 text-[12px] w-64 bg-[var(--theme-card-bg)] border border-[var(--report-border)] rounded-none text-[var(--theme-text-main)] placeholder-[var(--theme-text-light)] focus:outline-none focus:border-[var(--theme-text-main)] focus:ring-0 transition-colors"
                        />
                        <div className="flex items-center gap-2.5 bg-[var(--theme-card-bg)]">
                            <select className="px-3 py-1.5 text-[12px] font-semibold bg-[var(--theme-card-bg)] border border-[var(--report-border)] rounded-none text-[var(--theme-text-main)] focus:outline-none focus:border-[var(--theme-text-main)] focus:ring-0 transition-colors cursor-pointer">
                                <option>All Vouchers</option>
                                <option>Sales</option>
                                <option>Credit Note</option>
                            </select>

                            <div className="flex items-center bg-[var(--theme-card-bg)] border border-[var(--report-border)] rounded-none">
                                <button className="px-2.5 py-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--report-row-hover)] transition-colors border-r border-[var(--report-border)] focus:outline-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <div className="px-3 text-[12px] font-semibold flex items-center gap-2 text-[var(--theme-text-main)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--theme-text-light)]"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                    01/04/2024 - 31/03/2025
                                </div>
                                <button className="px-2 py-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--report-row-hover)] transition-colors border-l border-[var(--report-border)] focus:outline-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            </div>

                            <button className="p-1.5 border border-[var(--report-border)] rounded-none text-red-600 dark:text-red-400 hover:bg-[var(--report-row-hover)] transition-colors focus:outline-none">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M10 13v4" /><path d="M14 13v4" /><path d="M10 13h4" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Vouchers Table */}
                    <div className="overflow-x-auto bg-[var(--theme-card-bg)]">
                        <table className="report-table min-w-[800px]">
                            <thead>
                                <tr>
                                    <th>Voucher No</th>
                                    <th>Voucher Type</th>
                                    <th>Ref.No</th>
                                    <th className="flex items-center gap-1">Date <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg></th>
                                    <th className="text-right">Amount</th>
                                    <th className="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className={`bg-[var(--theme-card-bg)] transition-opacity duration-200 ${isLoadingVouchers ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                {vouchers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-6 text-center text-[12.5px] text-[var(--theme-text-muted)] font-medium bg-[var(--theme-card-bg)]">
                                            No vouchers found for this ledger.
                                        </td>
                                    </tr>
                                ) : (
                                    vouchers.map(voucher => (
                                        <tr key={voucher.id}>
                                            <td>
                                                <button
                                                    onClick={() => setSearchParams(prev => {
                                                        const newParams = new URLSearchParams(prev);
                                                        newParams.set('voucher', voucher.id);
                                                        return newParams;
                                                    })}
                                                    className="report-link text-[12.5px] font-bold text-left focus:outline-none"
                                                >
                                                    {voucher.id}
                                                </button>
                                            </td>
                                            <td className="text-[12.5px] font-semibold">{voucher.type}</td>
                                            <td className="text-[12.5px] font-semibold">{voucher.refNo || ''}</td>
                                            <td
                                                className="report-link text-[12.5px] font-semibold cursor-pointer"
                                                onClick={() => setSearchParams(prev => {
                                                    const newParams = new URLSearchParams(prev);
                                                    newParams.set('voucher', voucher.id);
                                                    return newParams;
                                                })}
                                            >
                                                {voucher.date}
                                            </td>
                                            <td className="report-num text-[12.5px] font-bold">
                                                {formatINR(voucher.amount)}
                                            </td>
                                            <td className="text-center">
                                                <button className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors inline-flex justify-center w-full focus:outline-none">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M10 13v4" /><path d="M14 13v4" /><path d="M10 13h4" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Ledger closing-balance chip */}
                    <div className="flex justify-center py-3.5 border-t border-[var(--report-divider)] bg-[var(--theme-card-bg)]">
                        <div className="px-4 py-1.5 bg-[var(--report-head-bg)] rounded-none text-[11px] font-bold text-[var(--theme-text-main)] border border-[var(--report-border)]">
                            <span className="opacity-75 font-semibold mr-1">Closing:</span>
                            {formatINR(closingBalance)}
                            <span className={`ml-1 ${ledgerData.debit > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {ledgerData.debit > 0 ? 'Dr' : 'Cr'}
                            </span>
                        </div>
                    </div>

                    {/* Real server-side pagination */}
                    <Pagination pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
                </>
            )}

            {(activeTab === 'Items Sold' || activeTab === 'Items Purchased') && (
                <>
                    {/* Filters Bar for Items */}
                    <div className="flex justify-between items-center gap-2.5 p-3 px-4 border-b border-[var(--report-divider)] bg-[var(--theme-card-bg)]">
                        <input
                            type="text"
                            placeholder="Search"
                            className="px-3 py-1.5 text-[12px] w-64 bg-[var(--theme-card-bg)] border border-[var(--report-border)] rounded-none text-[var(--theme-text-main)] placeholder-[var(--theme-text-light)] focus:outline-none focus:border-[var(--theme-text-main)] focus:ring-0 transition-colors"
                        />

                        <div className="flex items-center gap-2 bg-[var(--theme-card-bg)]">
                            <div className="flex items-center bg-[var(--theme-card-bg)] border border-[var(--report-border)] rounded-none">
                                <button className="px-2.5 py-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--report-row-hover)] transition-colors border-r border-[var(--report-border)] focus:outline-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <div className="px-3 text-[12px] font-semibold flex items-center gap-2 text-[var(--theme-text-main)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--theme-text-light)]"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                    01/04/2024 - 31/03/2025
                                </div>
                                <button className="px-2 py-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--report-row-hover)] transition-colors border-l border-[var(--report-border)] focus:outline-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            </div>

                            <button className="p-1.5 border border-[var(--report-border)] rounded-none text-red-600 dark:text-red-400 hover:bg-[var(--report-row-hover)] transition-colors focus:outline-none">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15v-4" /><path d="M12 15v-4" /><path d="M15 15v-4" /><path d="M9 15h6" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto bg-[var(--theme-card-bg)]">
                        <table className="report-table min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="w-[40%] flex items-center gap-1">Item Name <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg></th>
                                    <th>{activeTab === 'Items Sold' ? 'Last Sold' : 'Last Purchased'}</th>
                                    <th>Total Quantity</th>
                                    <th className="text-right">Avg.Rate</th>
                                </tr>
                            </thead>
                            <tbody className="bg-[var(--theme-card-bg)]">
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-[12.5px] text-[var(--theme-text-muted)] font-semibold bg-[var(--theme-card-bg)] border-none">
                                        No data available
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="py-3 px-4 flex items-center justify-between border-t border-[var(--report-divider)] bg-[var(--theme-card-bg)]">
                        <div className="text-[11px] font-bold text-[var(--theme-text-muted)]">
                            1-0 of 0
                        </div>

                        <div className="flex items-center gap-2 bg-[var(--theme-card-bg)]">
                            <button className="w-8 h-8 flex items-center justify-center rounded-none border border-[var(--report-border)] text-[var(--theme-text-light)] bg-[var(--report-head-bg)] cursor-not-allowed focus:outline-none">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            </button>
                            <button className="w-8 h-8 flex items-center justify-center rounded-none border border-[var(--report-border)] text-[var(--theme-text-light)] bg-[var(--report-head-bg)] cursor-not-allowed focus:outline-none">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </button>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}

