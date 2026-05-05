import { useState } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import CompaniesPanel from './CompaniesPanel'
import DashboardTable from './DashboardTable'
import EntityPanel from './EntityPanel'
import QuotationInbox from './QuotationInbox'
import CreateQuotation from './CreateQuotation'
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

const brandTheme = {
  light: {
    appBg: '#F0F2F5',
    panelBg: '#FFFFFF',
    contentBg: '#F8FAFC',
    sidebarBg: '#FFFFFF',
    border: '#E2E8F0',
    heading: '#0F172A',
    text: '#475569',
    tableHeadBg: '#F8FAFF',
    rowBorder: '#F1F5F9',
    rowHover: '#F1F5F9',
    accent: '#10B981',
    accentSoft: '#ECFDF5',
    accentGradient: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
    controlBg: '#FFFFFF',
    controlHover: '#F8FAFC',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText: '#991B1B',
  },
  dark: {
    appBg: '#09090B',
    panelBg: '#121214',
    contentBg: '#0C0C0E',
    sidebarBg: '#111113',
    border: '#1E1E22',
    heading: '#FAFAFA',
    text: '#94949E',
    tableHeadBg: '#18181B',
    rowBorder: '#1E1E22',
    rowHover: '#1A1A1E',
    accent: '#00DC82',
    accentSoft: 'rgba(0, 220, 130, 0.15)',
    accentGradient: 'linear-gradient(135deg, #00DC82 0%, #36E4DA 100%)',
    controlBg: '#18181B',
    controlHover: '#212126',
    dangerBg: '#2D1616',
    dangerBorder: '#7F1D1D',
    dangerText: '#F87171',
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
  const [mode, setMode] = useState('dark')
  const [selectedCompany, setSelectedCompany] = useState(companies[0] ?? '')
  const theme = brandTheme[mode]
  const isDark = mode === 'dark'

  const renderContent = () => {
    if (activeItem === 'Manage Company') {
      return <CompaniesPanel />
    }
    if (activeItem === 'Manage Business User') {
      return (
        <EntityPanel
          title="Business Owner"
          nameColumn="Business Owner Name"
          emptyText="No Account Data Found."
        />
      )
    }
    if (activeItem === 'Allocate Accountant') {
      return (
        <EntityPanel
          title="Accountants"
          nameColumn="Accountant Name"
          emptyText="No Account Data Found."
        />
      )
    }
    if (activeItem === 'Quotation Inbox') {
      return <QuotationInbox isDark={isDark} onAdd={() => setActiveItem('Create Quotation')} />
    }
    if (activeItem === 'Create Quotation') {
      return <CreateQuotation isDark={isDark} onBack={() => setActiveItem('Quotation Inbox')} />
    }
    if (activeItem === 'Invoice Inbox') {
      return <InvoiceInbox isDark={isDark} onAdd={() => setActiveItem('Create Invoice')} />
    }
    if (activeItem === 'Create Invoice') {
      return <CreateInvoice isDark={isDark} onBack={() => setActiveItem('Invoice Inbox')} />
    }
    if (activeItem === 'Sales Inbox') {
      return <SalesPanel mode="Inbox" isDark={isDark} onAdd={() => setActiveItem('Create Sales')} />
    }
    if (activeItem === 'Sales Review') {
      return <SalesPanel mode="Review" isDark={isDark} />
    }
    if (activeItem === 'Sales Archive') {
      return <SalesPanel mode="Archive" isDark={isDark} />
    }
    if (activeItem === 'Create Sales') {
      return <CreateSales isDark={isDark} onBack={() => setActiveItem('Sales Inbox')} />
    }
    if (activeItem === 'Purchase Inbox') {
      return <PurchasePanel mode="Inbox" isDark={isDark} />
    }
    if (activeItem === 'Purchase Review') {
      return <PurchasePanel mode="Review" isDark={isDark} />
    }
    if (activeItem === 'Purchase Archive') {
      return <PurchasePanel mode="Archive" isDark={isDark} />
    }
    if (activeItem === 'Petty Cash Inbox') {
      return <PettyCashPanel mode="Inbox" isDark={isDark} />
    }
    if (activeItem === 'Petty Cash Review') {
      return <PettyCashPanel mode="Review" isDark={isDark} />
    }
    if (activeItem === 'Petty Cash Archive') {
      return <PettyCashPanel mode="Archive" isDark={isDark} />
    }
    if (activeItem === 'Manage Bank') {
      return <BankPanel mode="Manage Bank" isDark={isDark} />
    }
    if (activeItem === 'Manage Rule') {
      return <BankPanel mode="Manage Rule" isDark={isDark} />
    }
    if (activeItem === 'Inbox' || activeItem === 'Review' || activeItem === 'Archive') {
      // Check if it's the bank version (no prefix in activeItem)
      return <BankPanel mode={activeItem} isDark={isDark} />
    }
    if (activeItem === 'Manage Roles' || activeItem === 'Manage User Permission') {
      return <RolePanel mode={activeItem} isDark={isDark} />
    }
    if (activeItem === 'My Documents') {
      return <MyDocumentsPanel isDark={isDark} />
    }
    if (activeItem === 'Party Ledger' || activeItem === 'Stock Ledger') {
      return <MasterDataPanel mode={activeItem} isDark={isDark} />
    }
    if (activeItem === 'User Data' || activeItem === 'Dashboard') {
      return <DashboardTable isDark={isDark} />
    }
    return <DashboardTable isDark={isDark} />
  }

  return (
    <div
      className="min-h-screen p-3"
      style={{
        backgroundColor: theme.appBg,
        '--app-panel-bg': theme.panelBg,
        '--app-content-bg': theme.contentBg,
        '--app-sidebar-bg': theme.sidebarBg,
        '--app-border': theme.border,
        '--app-heading': theme.heading,
        '--app-text': theme.text,
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
      <div className="overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(16,24,40,0.06)]" style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}>
        <Navbar
          isDark={isDark}
          mode={mode}
          onModeToggle={() => setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          companies={companies}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
          subscriptionMessage={subscriptionMessage}
          credits={credits}
        />

        <div className="flex h-[calc(100vh-100px)]">
          <Sidebar
            activeItem={activeItem}
            onItemClick={setActiveItem}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((prev) => !prev)}
            isDark={isDark}
          />

          <main className="flex-1 overflow-hidden p-4" style={{ backgroundColor: theme.contentBg }}>
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
