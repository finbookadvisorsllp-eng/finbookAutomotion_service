import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import logoUrl from '../assets/logo.png'
import {
  LayoutDashboard, BarChart2, Bell, TrendingUp, Scale, Droplet, FileText,
  Calendar, AlertTriangle, ReceiptText, ShoppingCart, Package,
  Snail, Rocket, CircleDollarSign, PieChart, ChevronDown, Landmark,
  ClipboardList, FileMinus, Truck, ClipboardCheck, FilePlus, Inbox, Bot,
  HeartPulse, Settings, ChevronRight
} from 'lucide-react'

const navGroups = [
  {
    id: 'overview', label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, badge: null },
      { id: 'bh', label: 'Business Health', path: '/health', icon: HeartPulse, badge: 'NEW' },
      { id: 'ai-cfo', label: 'AI CFO', path: '/ai-cfo', icon: Bot, badge: 'AI' },
      { id: 'alerts-notif', label: 'Alerts & Notifications', path: '/alerts', icon: Bell, badge: 7 },
    ],
  },
  {
    id: 'reports', label: 'Reports',
    items: [
      { id: 'pl', label: 'Profit & Loss', path: '/reports/pl', icon: TrendingUp },
      { id: 'bs', label: 'Balance Sheet', path: '/reports/bs', icon: Scale },
      { id: 'cf', label: 'Cash Flow', path: '/reports/cf', icon: Droplet },
      { id: 'tb', label: 'Trial Balance', path: '/reports/tb', icon: FileText },
      { id: 'daybook', label: 'Day Book', path: '/reports/daybook', icon: Calendar },
      { id: 'outstanding', label: 'Outstanding', path: '/reports/outstanding', icon: AlertTriangle },
      { id: 'profitab', label: 'Analytics', path: '/analytics', icon: PieChart },
    ],
  },
  {
    id: 'sales', label: 'Sales',
    items: [
      { id: 'sales-reg', label: 'Sales Register', path: '/sales', icon: ReceiptText },
      { id: 'sales-order', label: 'Sales Order', path: '/sales/order', icon: ClipboardList },
      { id: 'credit-note', label: 'Credit Note', path: '/sales/credit-note', icon: FileMinus },
      { id: 'delivery-note', label: 'Delivery Note', path: '/sales/delivery-note', icon: Truck },
    ],
  },
  {
    id: 'purchase', label: 'Purchase',
    items: [
      { id: 'purch-reg', label: 'Purchase Register', path: '/purchase', icon: ShoppingCart },
      { id: 'purchase-order', label: 'Purchase Order', path: '/purchase/order', icon: ClipboardCheck },
      { id: 'debit-note', label: 'Debit Note', path: '/purchase/debit-note', icon: FilePlus },
      { id: 'receipt-note', label: 'Receipt Note', path: '/purchase/receipt-note', icon: Inbox },
    ],
  },
  {
    id: 'inventory', label: 'Inventory',
    items: [
      { id: 'stock', label: 'Stock Summary', path: '/inventory', icon: Package },
      { id: 'slow', label: 'Slow Moving', path: '/inventory/slow', icon: Snail },
      { id: 'fast', label: 'Fast Moving', path: '/inventory/fast', icon: Rocket },
      { id: 'stock-val', label: 'Stock Valuation', path: '/inventory/value', icon: CircleDollarSign },
      { id: 'stock-alrt', label: 'Stock Alerts', path: '/inventory/alerts', icon: AlertTriangle, badge: 2 },
      { id: 'item-perf', label: 'Item Performance', path: '/inventory/performance', icon: BarChart2 },
    ],
  },
  {
    id: 'cash-bank', label: 'Cash & Bank',
    items: [
      { id: 'cb-dashboard', label: 'Cash & Bank', path: '/cash-bank', icon: Landmark }
    ],
  },
]

// Badge variant styles
const BADGE_STYLES = {
  NEW: 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(182,255,0,0.15)] dark:text-[#B6FF00]',
  AI: 'bg-violet-50 text-violet-700 dark:bg-[rgba(139,92,246,0.15)] dark:text-[#a78bfa]',
  number: 'bg-blue-600 text-white dark:bg-[#b6ff00] dark:text-[#050505]',
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState(['overview', 'reports', 'sales'])

  const toggleGroup = (id) =>
    setOpenGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>

      {/* ── Logo Header ── */}
      <div
        className="flex items-center gap-2.5 px-5 shrink-0"
        style={{
          height: 'var(--header-height)',
          borderBottom: '1px solid var(--color-sidebar-border)',
        }}
      >
        <img src={logoUrl} alt="Logo" className="h-9 w-auto object-contain" />
        <span
          className="sidebar-logo-text font-semibold tracking-tight"
          style={{
            fontSize: 15,
            color: 'var(--theme-text-main)',
            letterSpacing: '-0.02em',
          }}
        >
          Tally Vision
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 scrollbar-hide">
        {navGroups.map((group) => {
          const isOpen = openGroups.includes(group.id)
          return (
            <div key={group.id} className="mb-1">

              {/* ── Section Label ── */}
              <button
                onClick={() => !collapsed && toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer mt-4 first:mt-0 transition-colors duration-150"
                style={{ background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-sidebar-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span
                  className="nav-group-label whitespace-nowrap"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-sidebar-text-label)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {group.label}
                </span>
                <ChevronDown
                  size={12}
                  className={`nav-group-chevron transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--color-sidebar-text-label)' }}
                />
              </button>

              {/* ── Nav Items ── */}
              <div className={`overflow-hidden transition-all duration-200 ${isOpen || collapsed ? 'max-h-[700px]' : 'max-h-0'}`}>
                {group.items.map((item) => {
                  const active = isActive(item.path)
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      title={collapsed ? item.label : undefined}
                      onClick={() => navigate(item.path)}
                      className="relative w-full flex items-center gap-2.5 px-2.5 mt-0.5 text-left transition-all duration-150"
                      style={{
                        height: 36,
                        borderRadius: 10,
                        background: active ? 'var(--color-sidebar-active-bg)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-sidebar-hover)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Active left pill */}
                      {active && <div className="nav-active-bar" />}

                      {/* Icon */}
                      <span
                        className="shrink-0 flex items-center justify-center"
                        style={{
                          width: 18,
                          height: 18,
                          color: active ? 'var(--color-sidebar-active-text)' : 'var(--theme-text-muted)',
                        }}
                      >
                        <Icon size={17} strokeWidth={active ? 2 : 1.8} />
                      </span>

                      {/* Label */}
                      <span
                        className="nav-item-label whitespace-nowrap flex-1 truncate"
                        style={{
                          fontSize: 13.5,
                          fontWeight: active ? 600 : 500,
                          color: active ? 'var(--color-sidebar-active-text)' : 'var(--color-sidebar-text-muted)',
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {item.label}
                      </span>

                      {/* Badge */}
                      {item.badge && (
                        <span
                          className={`nav-item-badge shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                            typeof item.badge === 'number'
                              ? BADGE_STYLES.number
                              : BADGE_STYLES[item.badge] || BADGE_STYLES.number
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Divider ── */}
      <div className="mx-4 h-px" style={{ background: 'var(--color-sidebar-border)' }} />

      {/* ── Footer / User Card ── */}
      <div className="p-3">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
          style={{ background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-sidebar-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] text-white shrink-0"
            style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            }}
          >
            SE
          </div>

          {/* User info */}
          <div className="sidebar-user-info overflow-hidden flex-1">
            <p
              className="whitespace-nowrap truncate leading-tight"
              style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--theme-text-main)' }}
            >
              Sharma Enterprises
            </p>
            <p
              className="whitespace-nowrap truncate"
              style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--theme-text-muted)' }}
            >
              Business Owner
            </p>
          </div>

          <ChevronRight
            size={14}
            className="sidebar-user-info shrink-0"
            style={{ color: 'var(--theme-text-light)' }}
          />
        </div>
      </div>

    </div>
  )
}
