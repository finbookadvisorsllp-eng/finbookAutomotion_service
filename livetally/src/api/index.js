// Typed API surface mirroring the LiveTally data exports — every function maps
// to a /api/v3 endpoint. `fy` is the financial year id, e.g. "2025-2026".
import { apiGet, apiGetFull, apiPost, apiPut, apiDelete, apiDownload, apiStream, auth, setCompanyId } from './client'

// ─── Auth ───
export const login = (email, password) => apiPost('/auth/login', { email, password })
export const me = () => apiGet('/auth/me')

// ─── Company / setup ───
export const getCompanies = () => apiGet('/companies')
export const getAllCompanies = () => apiGet('/companies/all')  // every tenant company (switcher)
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
export const getDashboardReceivablesAging = (fy) => apiGet('/dashboard/receivables-aging', { fy })
export const getDashboardCashFlow = (fy) => apiGet('/dashboard/cash-flow', { fy })
export const getRecentVouchers = (fy, limit) => apiGet('/dashboard/recent-vouchers', { fy, limit })
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
export const getBsGroupChildren = (groupId, fy) =>
  apiGet(`/reports/balance-sheet/group/${encodeURIComponent(groupId)}/children`, { fy })
export const getBsLedgerVouchers = (ledgerId, fy, page = 1, limit = 100) =>
  apiGetFull(`/reports/balance-sheet/ledger/${encodeURIComponent(ledgerId)}/vouchers`, { fy, page, limit })
export const getCashFlow = (fy, params = {}) => apiGet('/reports/cash-flow', { fy, ...params })
export const getCashFlowLedgerVouchers = (ledgerId, fy, page = 1, limit = 10, params = {}) =>
  apiGetFull(`/reports/cash-flow/ledger/${encodeURIComponent(ledgerId)}/vouchers`, { fy, page, limit, ...params })
export const getDayBook = (fy, date, page = 1, limit = 100, params = {}) =>
  apiGetFull('/reports/daybook', { fy, date, page, limit, ...params })
// ─── Outstanding (Receivables / Payables) ───
export const getReceivables = (fy, params = {}) =>
  apiGetFull('/reports/outstanding/receivables', { fy, page: 1, limit: 10, ...params })
export const getPayables = (fy, params = {}) =>
  apiGetFull('/reports/outstanding/payables', { fy, page: 1, limit: 10, ...params })
export const getAgingConfig = () => apiGet('/reports/outstanding/aging-config')
export const saveAgingConfig = (buckets) => apiPut('/reports/outstanding/aging-config', { buckets })
export const resetAgingConfig = () => apiDelete('/reports/outstanding/aging-config')
export const getOutstandingPartyVouchers = (ledgerId, fy, page = 1, limit = 10) =>
  apiGetFull(`/reports/outstanding/party/${encodeURIComponent(ledgerId)}/vouchers`, { fy, page, limit })
export const getVoucher = (ident) => apiGet(`/reports/voucher/${ident}`)

// ─── GST ───
export const getGstSummary = (fy) => apiGet('/reports/gst/summary', { fy })
export const getGstr1 = (fy) => apiGet('/reports/gst/gstr1', { fy })
export const getGstr3b = (fy) => apiGet('/reports/gst/gstr3b', { fy })
export const getGstRateBreakdown = (fy) => apiGet('/reports/gst/rate-breakdown', { fy })
export const getGstHsnSummary = (fy) => apiGet('/reports/gst/hsn-summary', { fy })

// ─── Sales ───
// Dynamic, Tally-matched Sales Register drill-down engine. One call serves every
// level (0 register → 1 invoice list → 2 voucher detail). `params` carries
// { level, groupBy, measure, groupValue, voucherId, fy, page, limit, search,
//   sort, order, fromDate, toDate }.
export const getSalesRegisterDrilldown = (params = {}) => apiGetFull('/sales/register/drilldown', params)
// Export the current Sales Register level (respects groupBy + measure + filters + date + company).
export const exportSalesRegister = (params = {}, format = 'pdf') =>
  apiDownload('/sales/register/export', { ...params, format },
    `sales-register.${format === 'excel' ? 'xlsx' : format}`)
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
// Dynamic, Tally-matched Purchase Register drill-down engine. One call serves every
// level (0 register → 1 invoice list → 2 voucher detail). `params` carries
// { level, groupBy, measure, groupValue, voucherId, fy, page, limit, search,
//   sort, order, fromDate, toDate }.
export const getPurchaseRegisterDrilldown = (params = {}) => apiGetFull('/purchase/register/drilldown', params)
// Export the current Purchase Register level (respects groupBy + measure + filters + date + company).
export const exportPurchaseRegister = (params = {}, format = 'pdf') =>
  apiDownload('/purchase/register/export', { ...params, format },
    `purchase-register.${format === 'excel' ? 'xlsx' : format}`)
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
// Generic Tally-like drill-down engine: one call serves every level (0..4).
// `params` carries { level, group, ledgerId, ledgerName, month, voucherId, fy,
//   page, limit, search, sort, order, voucherType, fromDate, toDate }.
export const getCashBankDrilldown = (params = {}) => apiGetFull('/cash-bank/drilldown', params)
// Export the current drill level (respects level + filters + date range + company).
export const exportCashBank = (params = {}, format = 'pdf') =>
  apiDownload('/cash-bank/export', { ...params, format },
    `cash-bank.${format === 'excel' ? 'xlsx' : format}`)

// ─── Inventory ─── (fully dynamic; every report is company + FY/date aware)
export const getStockSummary = (params = {}) => apiGetFull('/inventory', params)
// Stock Summary drill-down: 0 Groups → 1 Items → 2 Item ledger → 3 Voucher.
export const getInventoryDrilldown = (params = {}) => apiGetFull('/inventory/drilldown', params)
export const getSlowMoving = (params = {}) => apiGetFull('/inventory/slow', params)
export const getFastMoving = (params = {}) => apiGetFull('/inventory/fast', params)
export const getStockValuation = (params = {}) => apiGetFull('/inventory/valuation', params)
export const getStockAlerts = (params = {}) => apiGetFull('/inventory/alerts', params)
export const getItemPerformanceList = (params = {}) => apiGetFull('/inventory/performance', params)
export const getItemPerformance = (item, params = {}) =>
  apiGet(`/inventory/item/${encodeURIComponent(item)}/performance`, params)

// ─── Accounting registers ───
export const getJournal = (fy, params = {}) => apiGetFull('/accounting/journal', { fy, ...params })
export const getPaymentRegister = (fy, params = {}) => apiGetFull('/accounting/payment', { fy, ...params })
export const getReceiptRegister = (fy, params = {}) => apiGetFull('/accounting/receipt', { fy, ...params })

// ─── AI CFO ─── (virtual CFO chat + deterministic insights; grounded on the
// report services above, so every figure reconciles with its report page.)
export const aiCfoHealth = () => apiGet('/ai-cfo/health')
export const aiCfoChat = (message, sessionId, fy) =>
  apiPost('/ai-cfo/chat', { message, sessionId, fy })
// Streaming chat — onEvent(name, data) fires for 'meta' | 'token' | 'done' | 'error'.
export const aiCfoChatStream = (message, sessionId, fy, onEvent, signal) =>
  apiStream('/ai-cfo/chat/stream', { message, sessionId, fy }, { onEvent, signal })
export const aiCfoSessions = (limit = 50) => apiGet('/ai-cfo/history', { limit })
export const aiCfoMessages = (sessionId, limit = 200) => apiGet('/ai-cfo/history', { sessionId, limit })
export const aiCfoSuggestions = (fy) => apiGet('/ai-cfo/suggestions', { fy })
export const aiCfoDeleteConversation = (sessionId) => apiDelete('/ai-cfo/conversation', { sessionId })
export const aiCfoInsights = (fy) => apiGet('/ai-cfo/insights', { fy })
export const aiCfoHealthScore = (fy) => apiGet('/ai-cfo/health-score', { fy })
export const aiCfoRecommendations = (fy) => apiGet('/ai-cfo/recommendations', { fy })
export const aiCfoWarnings = (fy) => apiGet('/ai-cfo/warnings', { fy })
export const aiCfoAlerts = (fy) => apiGet('/ai-cfo/alerts', { fy })
export const aiCfoGetMemory = () => apiGet('/ai-cfo/memory')
export const aiCfoSetMemory = (key, value, category = 'general') =>
  apiPost('/ai-cfo/memory', { key, value, category })
export const aiCfoDeleteMemory = (key) => apiDelete('/ai-cfo/memory', { key })

export { auth, setCompanyId }
