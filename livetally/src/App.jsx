import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { DateProvider } from './context/DateContext'
import { AICFOProvider } from './context/AICFOContext'

// Layout — always mounted, kept eager.
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import AICFOLauncher from './components/AICFOLauncher'

// Login gates the whole app (rendered before the router), so it stays eager.
import Login from './pages/Login'

// Pages — lazy-loaded so each route's JS (and its heavy deps like recharts) is
// only downloaded when that page is first visited, shrinking the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ProfitLoss = lazy(() => import('./pages/ProfitLoss'))
const OpeningStockSummary = lazy(() => import('./pages/OpeningStockSummary'))
const BalanceSheet = lazy(() => import('./pages/BalanceSheet'))
const CashFlow = lazy(() => import('./pages/CashFlow'))
const Receivables = lazy(() => import('./pages/Receivables'))
const Payables = lazy(() => import('./pages/Payables'))
const SalesRegister = lazy(() => import('./pages/SalesRegister/SalesRegisterReport'))
const PurchaseRegister = lazy(() => import('./pages/PurchaseRegister'))
const Inventory = lazy(() => import('./pages/Inventory'))
const GSTReports = lazy(() => import('./pages/GSTReports'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Customers = lazy(() => import('./pages/Customers'))
const Vendors = lazy(() => import('./pages/Vendors'))
const SalesOrder = lazy(() => import('./pages/SalesOrder'))
const CreditNote = lazy(() => import('./pages/CreditNote'))
const DeliveryNote = lazy(() => import('./pages/DeliveryNote'))
const PurchaseOrder = lazy(() => import('./pages/PurchaseOrder'))
const DebitNote = lazy(() => import('./pages/DebitNote'))
const ReceiptNote = lazy(() => import('./pages/ReceiptNote'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Notifications = lazy(() => import('./pages/Notifications'))
const TrialBalance = lazy(() => import('./pages/TrialBalance'))
const DayBook = lazy(() => import('./pages/DayBook'))
const OutstandingReports = lazy(() => import('./pages/OutstandingReports'))
const SalesAnalysis = lazy(() => import('./pages/SalesAnalysis'))
const CreditLimit = lazy(() => import('./pages/CreditLimit'))
const BillsDue = lazy(() => import('./pages/BillsDue'))
const PurchaseTrends = lazy(() => import('./pages/PurchaseTrends'))
const SlowMoving = lazy(() => import('./pages/SlowMoving'))
const FastMoving = lazy(() => import('./pages/FastMoving'))
const StockValuation = lazy(() => import('./pages/StockValuation'))
const StockAlerts = lazy(() => import('./pages/StockAlerts'))
const ItemPerformance = lazy(() => import('./pages/ItemPerformance'))
const GenericReport = lazy(() => import('./pages/GenericReport'))
const CashBankModule = lazy(() => import('./pages/CashBankModule'))
const AICFO = lazy(() => import('./pages/AICFO/AICFO'))
// Business Health — one hub page with tabs (Overview / Score / Decisions /
// Opportunities & Risks / Impact). The tab lives in the URL so deep-links and
// evidence cross-links keep working; the whole feature code-splits as one chunk.
const BusinessHealth = lazy(() => import('./pages/BusinessHealth/BusinessHealth'))

import "./index.css"

// Premium skeleton fallback shown while a lazy route chunk loads.
function RouteFallback() {
  return (
    <div className="animate-fade-in flex flex-col gap-5 py-2">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton" style={{ width: 280, height: 28, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 180, height: 14, borderRadius: 6 }} />
        </div>
        <div className="flex gap-2">
          <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 90, height: 36, borderRadius: 12 }} />
        </div>
      </div>
      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 110, borderRadius: 20 }} />
        ))}
      </div>
      {/* Chart area skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 skeleton" style={{ height: 340, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 340, borderRadius: 20 }} />
      </div>
    </div>
  )
}

// ── App Shell (Sidebar + Header + Content) ──────────
function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const location = useLocation()

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Apply dark mode class to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [isDarkMode])

  return (
    <div className="app-layout">
      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay lg:hidden ${mobileOpen ? 'active' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
      />
      <div className={`main-area ${collapsed ? 'collapsed' : ''}`}>
        <Header
          collapsed={collapsed}
          onToggleSidebar={() => {
            if (window.innerWidth < 1024) {
              setMobileOpen(true)
            } else {
              setCollapsed(c => !c)
            }
          }}
          isDarkMode={isDarkMode}
          toggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
        <main className="content-area">
          <Suspense fallback={<RouteFallback />}>
            {children}
          </Suspense>
        </main>
      </div>

      {/* Global AI CFO launcher — fixed bottom-right, on every page. */}
      <AICFOLauncher />
    </div>
  )
}

// ── Main App ────────────────────────────────────────
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const isLoggedIn = isAuthenticated || isDemoMode

  if (!isLoggedIn) {
    return (
      <Login
        onLogin={() => setIsAuthenticated(true)}
        onDemo={() => setIsDemoMode(true)}
      />
    )
  }

  return (
    <BrowserRouter>
      <DateProvider>
        <AICFOProvider>
        <AppShell>
          <Routes>
            {/* ── Business Health (one hub, tab in the URL) ── */}
            <Route path="/health" element={<BusinessHealth />} />
            <Route path="/health/:tab" element={<BusinessHealth />} />

            {/* ── Overview ── */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/ai-cfo" element={<AICFO />} />
            <Route path="/summary" element={<GenericReport title="Business Summary" description="Overview of your entire business performance." />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/notif" element={<Notifications />} />

            {/* ── Reports ── */}
            <Route path="/reports/pl" element={<ProfitLoss />} />
            <Route path="/reports/pl/opening-stock" element={<OpeningStockSummary />} />
            <Route path="/reports/bs" element={<BalanceSheet />} />
            <Route path="/reports/cf" element={<CashFlow />} />
            <Route path="/reports/gst" element={<GSTReports />} />
            <Route path="/reports/tb" element={<TrialBalance />} />
            <Route path="/reports/daybook" element={<DayBook />} />
            <Route path="/reports/outstanding" element={<OutstandingReports />} />

            {/* ── Sales & Customers ── */}
            <Route path="/sales" element={<SalesRegister />} />
            <Route path="/sales/order" element={<SalesOrder />} />
            <Route path="/sales/credit-note" element={<CreditNote />} />
            <Route path="/sales/delivery-note" element={<DeliveryNote />} />
            <Route path="/sales/analysis" element={<SalesAnalysis />} />
            <Route path="/sales/customers" element={<Customers />} />
            <Route path="/sales/receivables" element={<Receivables />} />
            <Route path="/sales/credit-limit" element={<CreditLimit />} />

            {/* ── Purchase & Vendors ── */}
            <Route path="/purchase" element={<PurchaseRegister />} />
            <Route path="/purchase/order" element={<PurchaseOrder />} />
            <Route path="/purchase/debit-note" element={<DebitNote />} />
            <Route path="/purchase/receipt-note" element={<ReceiptNote />} />
            <Route path="/purchase/vendors" element={<Vendors />} />
            <Route path="/purchase/payables" element={<Payables />} />
            <Route path="/purchase/bills" element={<BillsDue />} />
            <Route path="/purchase/trends" element={<PurchaseTrends />} />

            {/* ── Cash & Bank ── */}
            <Route path="/cash-bank" element={<CashBankModule />} />

            {/* ── Inventory ── */}
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/slow" element={<SlowMoving />} />
            <Route path="/inventory/fast" element={<FastMoving />} />
            <Route path="/inventory/value" element={<StockValuation />} />
            <Route path="/inventory/alerts" element={<StockAlerts />} />
            <Route path="/inventory/performance" element={<ItemPerformance />} />


            {/* ── Analytics ── */}
            <Route path="/analytics" element={<Analytics />} />


            {/* ── Fallback ── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
        </AICFOProvider>
      </DateProvider>
    </BrowserRouter>
  )
}
