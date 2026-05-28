import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

// Layout
import Sidebar from './components/Sidebar'
import Header from './components/Header'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProfitLoss from './pages/ProfitLoss'
import BalanceSheet from './pages/BalanceSheet'
import CashFlow from './pages/CashFlow'
import Receivables from './pages/Receivables'
import Payables from './pages/Payables'
import SalesRegister from './pages/SalesRegister'
import PurchaseRegister from './pages/PurchaseRegister'
import Inventory from './pages/Inventory'
import GSTReports from './pages/GSTReports'
import Analytics from './pages/Analytics'
import Customers from './pages/Customers'
import Vendors from './pages/Vendors'
import Administration from './pages/Administration'
import TallySetup from './pages/TallySetup'

// New Pages
import Alerts from './pages/Alerts'
import Notifications from './pages/Notifications'
import TrialBalance from './pages/TrialBalance'
import LedgerReports from './pages/LedgerReports'
import DayBook from './pages/DayBook'
import OutstandingReports from './pages/OutstandingReports'
import SalesAnalysis from './pages/SalesAnalysis'
import CustomerAging from './pages/CustomerAging'
import CreditLimit from './pages/CreditLimit'
import VendorAging from './pages/VendorAging'
import BillsDue from './pages/BillsDue'
import PurchaseTrends from './pages/PurchaseTrends'
import SlowMoving from './pages/SlowMoving'
import FastMoving from './pages/FastMoving'
import StockValuation from './pages/StockValuation'
import StockAlerts from './pages/StockAlerts'
import ItemPerformance from './pages/ItemPerformance'
import GenericReport from './pages/GenericReport'

import "./index.css"

// ── App Shell (Sidebar + Header + Content) ──────────
function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

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
        />
        <main className="content-area">
          {children}
        </main>
      </div>
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
      <AppShell>
        <Routes>
          {/* ── Overview ── */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/summary" element={<GenericReport title="Business Summary" description="Overview of your entire business performance." />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/notif" element={<Notifications />} />

          {/* ── Reports ── */}
          <Route path="/reports/pl" element={<ProfitLoss />} />
          <Route path="/reports/bs" element={<BalanceSheet />} />
          <Route path="/reports/cf" element={<CashFlow />} />
          <Route path="/reports/gst" element={<GSTReports />} />
          <Route path="/reports/tb" element={<TrialBalance />} />
          <Route path="/reports/ledger" element={<LedgerReports />} />
          <Route path="/reports/daybook" element={<DayBook />} />
          <Route path="/reports/outstanding" element={<OutstandingReports />} />

          {/* ── Sales & Customers ── */}
          <Route path="/sales" element={<SalesRegister />} />
          <Route path="/sales/analysis" element={<SalesAnalysis />} />
          <Route path="/sales/customers" element={<Customers />} />
          <Route path="/sales/receivables" element={<Receivables />} />
          <Route path="/sales/aging" element={<CustomerAging />} />
          <Route path="/sales/credit-limit" element={<CreditLimit />} />

          {/* ── Purchase & Vendors ── */}
          <Route path="/purchase" element={<PurchaseRegister />} />
          <Route path="/purchase/vendors" element={<Vendors />} />
          <Route path="/purchase/payables" element={<Payables />} />
          <Route path="/purchase/aging" element={<VendorAging />} />
          <Route path="/purchase/bills" element={<BillsDue />} />
          <Route path="/purchase/trends" element={<PurchaseTrends />} />

          {/* ── Inventory ── */}
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/slow" element={<SlowMoving />} />
          <Route path="/inventory/fast" element={<FastMoving />} />
          <Route path="/inventory/value" element={<StockValuation />} />
          <Route path="/inventory/alerts" element={<StockAlerts />} />
          <Route path="/inventory/performance" element={<ItemPerformance />} />

          {/* ── Accounting ── */}
          <Route path="/accounting/journal" element={<GenericReport title="Journal Entries" description="View and manage all journal vouchers." />} />
          <Route path="/accounting/payment" element={<GenericReport title="Payment Vouchers" description="View and manage all payment vouchers." />} />
          <Route path="/accounting/receipt" element={<GenericReport title="Receipt Vouchers" description="View and manage all receipt vouchers." />} />
          <Route path="/accounting/ledger" element={<GenericReport title="Ledger Search" description="Search and view specific ledger accounts." />} />

          {/* ── Analytics ── */}
          <Route path="/analytics" element={<Analytics />} />

          {/* ── Administration ── */}
          <Route path="/admin" element={<Administration />} />
          <Route path="/admin/users" element={<Administration />} />
          <Route path="/admin/audit" element={<Administration />} />
          <Route path="/admin/billing" element={<Administration />} />
          <Route path="/setup" element={<TallySetup />} />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
