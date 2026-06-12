// Typed API surface mirroring the LiveTally data exports — every function maps
// to a /api/v3 endpoint. `fy` is the financial year id, e.g. "2025-2026".
import { apiGet, apiGetFull, apiPost, auth, setCompanyId } from './client'

// ─── Auth ───
export const login = (email, password) => apiPost('/auth/login', { email, password })
export const me = () => apiGet('/auth/me')

// ─── Company / setup ───
export const getCompanies = () => apiGet('/companies')
export const getCurrentCompany = () => apiGet('/companies/current')
export const getFinancialYears = () => apiGet('/companies/current/financial-years')
export const getMasterData = () => apiGet('/companies/current/master-data')
export const getLicense = () => apiGet('/setup/license')
export const getMasterStats = () => apiGet('/setup/master-stats')
export const getCompanyInfo = () => apiGet('/setup/company-info')

// ─── Dashboard / analytics / alerts ───
export const getDashboard = (fy) => apiGet('/dashboard/overview', { fy })
export const getKpis = (fy) => apiGet('/dashboard/kpis', { fy })
export const getMonthlyTrend = (fy) => apiGet('/dashboard/monthly-trend', { fy })
export const getExpenseBreakdown = (fy) => apiGet('/dashboard/expense-breakdown', { fy })
export const getRecentVouchers = (fy) => apiGet('/dashboard/recent-vouchers', { fy })
export const getTopCustomers = (fy) => apiGet('/dashboard/top-customers', { fy })
export const getTopVendors = (fy) => apiGet('/dashboard/top-vendors', { fy })
export const getTopItems = (fy) => apiGet('/dashboard/top-items', { fy })
export const getAnalytics = (fy) => apiGet('/analytics/overview', { fy })
export const getAlerts = (fy) => apiGet('/alerts', { fy })
export const getNotifications = (fy) => apiGet('/notifications', { fy })

// ─── Reports ───
export const getTrialBalance = (fy) => apiGet('/reports/trial-balance', { fy })
export const getTbGroupLedgers = (groupId, fy) =>
  apiGet(`/reports/trial-balance/group/${encodeURIComponent(groupId)}/ledgers`, { fy })
export const getTbLedgerVouchers = (ledgerId, fy, page = 1, limit = 100) =>
  apiGetFull(`/reports/trial-balance/ledger/${encodeURIComponent(ledgerId)}/vouchers`, { fy, page, limit })
export const getProfitLoss = (fy, params = {}) => apiGet('/reports/profit-loss', { fy, ...params })
export const getPlLedgerVouchers = (ledgerId, fy, page = 1, limit = 100, params = {}) =>
  apiGetFull(`/reports/profit-loss/ledger/${encodeURIComponent(ledgerId)}/vouchers`, { fy, page, limit, ...params })
export const getPlStockItems = (fy, params = {}) => apiGet('/reports/profit-loss/stock/items', { fy, ...params })
export const getPlStockItemLedger = (item, fy, params = {}) =>
  apiGet(`/reports/profit-loss/stock-item/${encodeURIComponent(item)}/ledger`, { fy, ...params })
// Opening Stock Summary (dedicated page): group summary + paginated item list.
export const getOpeningStock = (fy, params = {}) => apiGet('/reports/profit-loss/opening-stock', { fy, ...params })
export const getOpeningStockItems = (fy, params = {}) =>
  apiGetFull('/reports/profit-loss/opening-stock/items', { fy, page: 1, limit: 50, ...params })
export const getBalanceSheet = (fy) => apiGet('/reports/balance-sheet', { fy })
export const getCashFlow = (fy) => apiGet('/reports/cash-flow', { fy })
export const getDayBook = (fy, date, page = 1, limit = 100) =>
  apiGetFull('/reports/daybook', { fy, date, page, limit })
export const getReceivables = (fy) => apiGet('/reports/outstanding/receivables', { fy })
export const getPayables = (fy) => apiGet('/reports/outstanding/payables', { fy })
export const getVoucher = (ident) => apiGet(`/reports/voucher/${ident}`)

// ─── GST ───
export const getGstSummary = (fy) => apiGet('/reports/gst/summary', { fy })
export const getGstr1 = (fy) => apiGet('/reports/gst/gstr1', { fy })
export const getGstr3b = (fy) => apiGet('/reports/gst/gstr3b', { fy })
export const getGstRateBreakdown = (fy) => apiGet('/reports/gst/rate-breakdown', { fy })
export const getGstHsnSummary = (fy) => apiGet('/reports/gst/hsn-summary', { fy })

// ─── Sales ───
export const getSalesRegister = (fy, params = {}) => apiGetFull('/sales', { fy, ...params })
export const getSalesStats = (fy) => apiGet('/sales/stats', { fy })
export const getSalesAnalysis = (fy) => apiGet('/sales/analysis', { fy })
export const getSalesOrders = (fy) => apiGet('/sales/order', { fy })
export const getSalesOrderMonth = (month, fy) => apiGetFull(`/sales/order/month/${encodeURIComponent(month)}`, { fy })
export const getCreditNotes = (fy) => apiGet('/sales/credit-note', { fy })
export const getCreditNoteMonth = (month, fy) => apiGetFull(`/sales/credit-note/month/${encodeURIComponent(month)}`, { fy })
export const getDeliveryNotes = (fy) => apiGet('/sales/delivery-note', { fy })
export const getDeliveryNoteMonth = (month, fy) => apiGetFull(`/sales/delivery-note/month/${encodeURIComponent(month)}`, { fy })

// ─── Purchase ───
export const getPurchaseRegister = (fy, params = {}) => apiGetFull('/purchase', { fy, ...params })
export const getPurchaseStats = (fy) => apiGet('/purchase/stats', { fy })
export const getPurchaseTrends = (fy) => apiGet('/purchase/trends', { fy })
export const getPurchaseOrders = (fy) => apiGet('/purchase/order', { fy })
export const getDebitNotes = (fy) => apiGet('/purchase/debit-note', { fy })
export const getReceiptNotes = (fy) => apiGet('/purchase/receipt-note', { fy })

// ─── Parties ───
export const getCustomers = (fy) => apiGet('/parties/customers', { fy })
export const getVendors = (fy) => apiGet('/parties/vendors', { fy })
export const getCreditLimit = (fy) => apiGet('/parties/credit-limit', { fy })
export const getBillsDue = (fy) => apiGet('/parties/bills-due', { fy })

// ─── Cash & Bank ───
export const getCashBankDashboard = (fy) => apiGet('/cash-bank/dashboard', { fy })
export const getCashBankLedger = (accountId, fy) =>
  apiGet(`/cash-bank/ledger/${encodeURIComponent(accountId)}`, { fy })

// ─── Inventory ───
export const getInventory = (fy) => apiGet('/inventory', { fy })
export const getSlowMoving = (fy) => apiGet('/inventory/slow', { fy })
export const getFastMoving = (fy) => apiGet('/inventory/fast', { fy })
export const getStockValuation = (fy) => apiGet('/inventory/valuation', { fy })
export const getStockAlerts = (fy) => apiGet('/inventory/alerts', { fy })

// ─── Accounting registers ───
export const getJournal = (fy, params = {}) => apiGetFull('/accounting/journal', { fy, ...params })
export const getPaymentRegister = (fy, params = {}) => apiGetFull('/accounting/payment', { fy, ...params })
export const getReceiptRegister = (fy, params = {}) => apiGetFull('/accounting/receipt', { fy, ...params })

export { auth, setCompanyId }
