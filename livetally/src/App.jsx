import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { HardHat } from 'lucide-react'

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

import "./index.css"

// ── Coming Soon placeholder for unbuilt routes ──────
const ComingSoon = ({ page }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5 text-slate-400">
      <HardHat size={32} />
    </div>
    <h2 className="text-xl font-black text-slate-800 mb-2">{page}</h2>
    <p className="text-sm text-slate-500 max-w-xs text-center leading-relaxed">
      This report is being built. It will connect to your live Tally data when ready.
    </p>
    <div className="mt-5 px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-600">
      Phase 2 — Coming Soon
    </div>
  </div>
)

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
          <Route path="/summary" element={<ComingSoon page="Business Summary" />} />
          <Route path="/alerts" element={<ComingSoon page="Alerts Center" />} />
          <Route path="/notif" element={<ComingSoon page="Notifications" />} />

          {/* ── Reports ── */}
          <Route path="/reports/pl" element={<ProfitLoss />} />
          <Route path="/reports/bs" element={<BalanceSheet />} />
          <Route path="/reports/cf" element={<CashFlow />} />
          <Route path="/reports/gst" element={<GSTReports />} />
          <Route path="/reports/tb" element={<ComingSoon page="Trial Balance" />} />
          <Route path="/reports/ledger" element={<ComingSoon page="Ledger Reports" />} />
          <Route path="/reports/daybook" element={<ComingSoon page="Day Book" />} />
          <Route path="/reports/outstanding" element={<ComingSoon page="Outstanding Reports" />} />

          {/* ── Sales & Customers ── */}
          <Route path="/sales" element={<SalesRegister />} />
          <Route path="/sales/analysis" element={<ComingSoon page="Sales Analysis" />} />
          <Route path="/sales/customers" element={<Customers />} />
          <Route path="/sales/receivables" element={<Receivables />} />
          <Route path="/sales/aging" element={<ComingSoon page="Customer Aging" />} />

          {/* ── Purchase & Vendors ── */}
          <Route path="/purchase" element={<PurchaseRegister />} />
          <Route path="/purchase/vendors" element={<Vendors />} />
          <Route path="/purchase/payables" element={<Payables />} />
          <Route path="/purchase/aging" element={<ComingSoon page="Vendor Aging" />} />
          <Route path="/purchase/bills" element={<ComingSoon page="Bills Due" />} />

          {/* ── Inventory ── */}
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/slow" element={<ComingSoon page="Slow Moving Items" />} />
          <Route path="/inventory/fast" element={<ComingSoon page="Fast Moving Items" />} />
          <Route path="/inventory/value" element={<ComingSoon page="Stock Valuation" />} />
          <Route path="/inventory/alerts" element={<ComingSoon page="Stock Alerts" />} />

          {/* ── Accounting ── */}
          <Route path="/accounting/journal" element={<ComingSoon page="Journal Entries" />} />
          <Route path="/accounting/payment" element={<ComingSoon page="Payment Vouchers" />} />
          <Route path="/accounting/receipt" element={<ComingSoon page="Receipt Vouchers" />} />
          <Route path="/accounting/ledger" element={<ComingSoon page="Ledger Search" />} />

          {/* ── Analytics ── */}
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/revenue" element={<ComingSoon page="Revenue Trends" />} />
          <Route path="/analytics/expense" element={<ComingSoon page="Expense Trends" />} />
          <Route path="/analytics/budget" element={<ComingSoon page="Budget vs Actual" />} />
          <Route path="/analytics/forecast" element={<ComingSoon page="Forecasts" />} />

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
