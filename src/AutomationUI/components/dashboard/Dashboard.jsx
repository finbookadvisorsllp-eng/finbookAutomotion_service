import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import CompaniesPanel from './CompaniesPanel'
import DashboardTable from './DashboardTable'
import EntityPanel from './EntityPanel'
import InvoiceInbox from './InvoiceInbox'
import CreateInvoice from './CreateInvoice'
import SalesPanel from './SalesPanel'
import CreateSales from './CreateSales'
import PurchasePanel from './PurchasePanel'
import PettyCashPanel from './PettyCashPanel'
import BankPanel from './BankPanel'
import RolePanel from './RolePanel'
import MyDocumentsPanel from './MyDocumentsPanel'
import MasterDataPanel from './MasterDataPanel'
import SalesOrder from './SalesOrder'
import SalesInvoice from './SalesInvoice'
import CreditNote from './CreditNote'
import PurchaseOrder from './PurchaseOrder'
import PurchaseInvoice from './PurchaseInvoice'
import DebitNote from './DebitNote'
import FundFlowVoucher from './FundFlowVoucher'
import VoucherEntryEngine from './VoucherEntryEngine'

// Modern SaaS design tokens — Linear / Vercel inspired.
// Light mode: warm neutrals, indigo→violet brand. Dark mode: deep cool slate.
const brandTheme = {
  light: {
    appBg: '#FAFAFB',
    panelBg: '#FFFFFF',
    contentBg: '#F6F7F9',
    sidebarBg: '#FFFFFF',
    border: '#ECEEF2',
    heading: '#0B0B12',
    text: '#5B6478',
    muted: '#8A93A6',
    tableHeadBg: '#F6F7F9',
    rowBorder: '#F1F2F5',
    rowHover: '#F6F7F9',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.08)',
    accentGradient: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #38BDF8 100%)',
    controlBg: '#FFFFFF',
    controlHover: '#F6F7F9',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText: '#B91C1C',
  },
  dark: {
    appBg: '#07070A',
    panelBg: 'rgba(15, 16, 22, 0.72)',
    contentBg: '#0A0A0F',
    sidebarBg: 'rgba(13, 14, 20, 0.72)',
    border: 'rgba(255, 255, 255, 0.08)',
    heading: '#e2bf22ff',
    text: '#9CA3B5',
    muted: '#6B7388',
    tableHeadBg: 'rgba(255, 255, 255, 0.03)',
    rowBorder: 'rgba(255, 255, 255, 0.06)',
    rowHover: 'rgba(255, 255, 255, 0.04)',
    accent: '#60A5FA',
    accentSoft: 'rgba(96, 165, 250, 0.14)',
    accentGradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #7DD3FC 100%)',
    controlBg: 'rgba(255, 255, 255, 0.03)',
    controlHover: 'rgba(255, 255, 255, 0.06)',
    dangerBg: 'rgba(239, 68, 68, 0.12)',
    dangerBorder: 'rgba(239, 68, 68, 0.30)',
    dangerText: '#FCA5A5',
  },
}

const defaultCompanies = ['Data Uncyclable', 'Finolax Advisors', 'Greenline Ventures', 'Apex Holdings']

function Dashboard({
  companies = defaultCompanies,
  subscriptionMessage = 'Your subscription expires in 8 days',
  credits = 372,
}) {
  const [activeItem, setActiveItem] = useState('User Data')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mode, setMode] = useState('light')
  const [selectedCompany, setSelectedCompany] = useState(companies[0] ?? '')
  const theme = brandTheme[mode]
  const isDark = mode === 'dark'

  // Close mobile drawer when navigating
  useEffect(() => {
    setMobileNavOpen(false)
  }, [activeItem])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [mobileNavOpen])

  const renderContent = () => {
    if (activeItem === 'Manage Company') return <CompaniesPanel />
    if (activeItem === 'Manage Business User') return <EntityPanel title="Business Owner" nameColumn="Business Owner Name" emptyText="No Account Data Found." />
    if (activeItem === 'Allocate Accountant') return <EntityPanel title="Accountants" nameColumn="Accountant Name" emptyText="No Account Data Found." />

    if (activeItem === 'Invoice Inbox') return <InvoiceInbox isDark={isDark} onAdd={() => setActiveItem('Create Invoice')} />
    if (activeItem === 'Create Invoice') return <CreateInvoice isDark={isDark} onBack={() => setActiveItem('Invoice Inbox')} />
    if (activeItem === 'Sales Inbox') return <SalesPanel mode="Inbox" isDark={isDark} onAdd={() => setActiveItem('Create Sales')} />
    if (activeItem === 'Sales Review') return <SalesPanel mode="Review" isDark={isDark} />
    if (activeItem === 'Sales Archive') return <SalesPanel mode="Archive" isDark={isDark} />
    if (activeItem === 'Create Sales') return <CreateSales isDark={isDark} onBack={() => setActiveItem('Sales Inbox')} />
    if (activeItem === 'Sales Order') return <SalesOrder isDark={isDark} />
    if (activeItem === 'Sales Invoice') return <SalesInvoice isDark={isDark} />
    if (activeItem === 'Credit Note (Sales Return)') return <CreditNote isDark={isDark} />
    if (activeItem === 'Purchase Inbox') return <PurchasePanel mode="Inbox" isDark={isDark} />
    if (activeItem === 'Purchase Review') return <PurchasePanel mode="Review" isDark={isDark} />
    if (activeItem === 'Purchase Archive') return <PurchasePanel mode="Archive" isDark={isDark} />
    if (activeItem === 'Purchase Order') return <PurchaseOrder isDark={isDark} />
    if (activeItem === 'Purchase Invoice') return <PurchaseInvoice isDark={isDark} />
    if (activeItem === 'Debit Note (Purchase Return)') return <DebitNote isDark={isDark} />
    if (activeItem === 'Cash Payment') return <PettyCashPanel mode="Inbox" isDark={isDark} voucherType="cash_payment" title="Cash Payment" />;
    if (activeItem === 'Bank Payment') return <PettyCashPanel mode="Inbox" isDark={isDark} voucherType="bank_payment" title="Bank Payment" />;
    if (activeItem === 'Contra') return <PettyCashPanel mode="Inbox" isDark={isDark} voucherType="contra" title="Contra" />;
    if (activeItem === 'Fund Flow Review') return <PettyCashPanel mode="Review" isDark={isDark} />;
    if (activeItem === 'Fund Flow Archive') return <PettyCashPanel mode="Archive" isDark={isDark} />;
    if (activeItem === 'Manage Bank') return <BankPanel mode="Manage Bank" isDark={isDark} />
    if (activeItem === 'Manage Rule') return <BankPanel mode="Manage Rule" isDark={isDark} />
    if (activeItem === 'Inbox' || activeItem === 'Bank Review' || activeItem === 'Bank Archive') {
      const mode = activeItem === 'Bank Review' ? 'Review' : (activeItem === 'Bank Archive' ? 'Archive' : activeItem);
      return <BankPanel mode={mode} isDark={isDark} />
    }
    if (activeItem === 'Manage Roles' || activeItem === 'Manage User Permission') return <RolePanel mode={activeItem} isDark={isDark} />
    if (activeItem === 'My Documents') return <MyDocumentsPanel isDark={isDark} />
    if (activeItem === 'Party Ledger' || activeItem === 'Stock Ledger') return <MasterDataPanel mode={activeItem} isDark={isDark} />
    return <DashboardTable isDark={isDark} />
  }

  return (
    <div
      className={`min-h-screen  relative overflow-hidden ${isDark ? 'dark' : ''}`}
      style={{
        backgroundColor: theme.appBg,
        color: theme.heading,
        '--app-panel-bg': theme.panelBg,
        '--app-content-bg': theme.contentBg,
        '--app-sidebar-bg': theme.sidebarBg,
        '--app-border': theme.border,
        '--app-heading': theme.heading,
        '--app-text': theme.text,
        '--app-muted': theme.muted,
        '--app-accent': theme.accent,
        '--app-accent-soft': theme.accentSoft,
        '--app-accent-gradient': theme.accentGradient,
        '--app-table-head-bg': theme.tableHeadBg,
        '--app-row-border': theme.rowBorder,
        '--app-row-hover': theme.rowHover,
        '--app-control-bg': theme.controlBg,
        '--app-control-hover': theme.controlHover,
        '--app-danger-bg': theme.dangerBg,
        '--app-danger-border': theme.dangerBorder,
        '--app-danger-text': theme.dangerText,
      }}
    >
      {/* Ambient background — subtle grid + soft brand orbs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 app-grid-bg opacity-60" />
        <div
          className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
            animation: 'softPulse 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-[10%] right-[-8%] h-[480px] w-[480px] rounded-full blur-[120px]"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(56,189,248,0.14) 0%, transparent 70%)',
            animation: 'softPulse 18s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[20%] h-[420px] w-[420px] rounded-full blur-[120px]"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(96,165,250,0.16) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(29,78,216,0.10) 0%, transparent 70%)',
            animation: 'softPulse 16s ease-in-out infinite',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-xl h-screen flex flex-col md:rounded-2xl border relative z-10 glass-surface"
        style={{
          borderColor: theme.border,
          boxShadow: isDark
            ? '0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 24px 60px -24px rgba(15,23,42,0.18), 0 1px 0 rgba(15,23,42,0.02)',
        }}
      >
        <Navbar
          isDark={isDark}
          mode={mode}
          onModeToggle={() => setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          companies={companies}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
          subscriptionMessage={subscriptionMessage}
          credits={credits}
          onMobileNavToggle={() => setMobileNavOpen((p) => !p)}
        />

        <div className="flex flex-1 relative overflow-hidden">
          {/* Desktop sidebar */}
          <div className="hidden md:flex h-full">
            <Sidebar
              activeItem={activeItem}
              onItemClick={setActiveItem}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
              isDark={isDark}
            />
          </div>

          {/* Mobile drawer */}
          <AnimatePresence>
            {mobileNavOpen && (
              <>
                <motion.div
                  key="mobile-nav-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setMobileNavOpen(false)}
                  className="absolute inset-0 z-30 bg-black/30 md:hidden backdrop-blur-sm"
                />
                <motion.div
                  key="mobile-nav-drawer"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  className="absolute left-0 top-0 bottom-0 z-40 md:hidden h-full"
                >
                  <Sidebar
                    activeItem={activeItem}
                    onItemClick={setActiveItem}
                    collapsed={false}
                    onToggle={() => setMobileNavOpen(false)}
                    isDark={isDark}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col overflow-hidden">
            <main
              className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 md:p-5"
              style={{ backgroundColor: 'transparent' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeItem}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full flex flex-col"
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </main>

            <footer
              className="px-4 py-2.5 text-[11.5px] font-semibold text-center border-t"
              style={{
                borderColor: theme.border,
                color: theme.muted,
                backgroundColor: 'transparent',
              }}
            >
              © {new Date().getFullYear()} Finbook Advisors. All rights reserved.
            </footer>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard
