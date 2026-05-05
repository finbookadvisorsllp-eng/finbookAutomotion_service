import {
  LayoutDashboard,
  Database,
  Settings2,
  FileText,
  ReceiptText,
  BarChart3,
  ShoppingCart,
  Wallet,
  Landmark,
  ShieldCheck,
  FolderOpen,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'

const menuItems = [
  { key: 'Dashboard', icon: LayoutDashboard, children: ['User Data'] },
  { key: 'Manage', icon: Settings2, children: ['Manage Company', 'Manage Business User', 'Allocate Accountant'] },
  { key: 'Quotation', icon: FileText, children: ['Quotation Inbox'] },
  { key: 'Invoice', icon: ReceiptText, children: ['Invoice Inbox'] },
  { key: 'Sales', icon: BarChart3, children: ['Sales Inbox', 'Sales Review', 'Sales Archive'] },
  { key: 'Purchase/Expense', icon: ShoppingCart, children: ['Purchase Inbox', 'Purchase Review', 'Purchase Archive'] },
  { key: 'Petty Cash', icon: Wallet, children: ['Petty Cash Inbox', 'Petty Cash Review', 'Petty Cash Archive'] },
  { key: 'Bank', icon: Landmark, children: ['Manage Bank', 'Manage Rule', 'Inbox', 'Review', 'Archive'] },
  { key: 'Role Management', icon: ShieldCheck, children: ['Manage Roles', 'Manage User Permission'] },
  { key: 'My Documents', icon: FolderOpen },
  { key: 'Master Data', icon: Boxes, children: ['Party Ledger', 'Stock Ledger'] },
]

const SidebarItem = ({ item, activeItem, onItemClick, collapsed, isDark, openMenu, setOpenMenu }) => {
  const { key, icon: Icon, children } = item
  const hasChildren = !!children
  
  // A menu is considered open if it's explicitly set as the openMenu, 
  // or if its children include the currently active item (to keep it open when navigating)
  const isOpen = openMenu === key || (children && children.includes(activeItem) && openMenu === null) || (children && children.includes(activeItem) && openMenu === key)

  const isActive = activeItem === key || (children && children.includes(activeItem))

  const handleMenuClick = () => {
    if (hasChildren) {
      setOpenMenu(isOpen ? null : key) // Toggle open/close, closing others
    }
    onItemClick(key)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleMenuClick}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12px] transition-all duration-300 ${
          isActive
            ? 'font-bold shadow-[0_4px_12px_rgba(0,0,0,0.08)] scale-[1.02]'
            : 'hover:translate-x-1'
        }`}
        style={{
          color: isActive ? (isDark ? '#fff' : 'var(--app-heading)') : '#71717a',
          background: isActive 
            ? (isDark ? 'linear-gradient(135deg, #18181b 0%, #27272a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)')
            : 'transparent',
        }}
      >
        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? 'var(--app-accent)' : '#94949e' }} />
        {!collapsed && (
          <>
            <span className="truncate flex-1">{key}</span>
            {hasChildren && (
              <span className={`ml-auto transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} style={{ color: '#94949e' }}>
                <ChevronDown size={14} />
              </span>
            )}
          </>
        )}
      </button>

      {hasChildren && isOpen && !collapsed && (
        <div className="ml-7 mt-1 space-y-1 border-l-2" style={{ borderColor: isDark ? '#1e1e22' : '#f1f5f9' }}>
          {children.map((child) => {
            const isChildActive = activeItem === child
            return (
              <button
                type="button"
                key={child}
                onClick={() => { onItemClick(child); setOpenMenu(key); }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[11px] transition-all duration-200 ${isChildActive ? 'font-semibold' : 'hover:translate-x-1'}`}
                style={{
                  color: isChildActive ? 'var(--app-accent)' : '#71717a',
                  backgroundColor: isChildActive ? 'var(--app-accent-soft)' : 'transparent',
                }}
              >
                <div className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${isChildActive ? 'scale-125' : 'scale-100 opacity-40'}`} style={{ backgroundColor: isChildActive ? 'var(--app-accent)' : '#94949e' }} />
                {child}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Sidebar({ activeItem, onItemClick, collapsed, onToggle, isDark }) {
  const renderItems = useMemo(() => menuItems, [])
  const [openMenu, setOpenMenu] = useState(null)

  // Determine initial open menu based on activeItem
  useEffect(() => {
    const activeParent = renderItems.find(item => item.children && item.children.includes(activeItem));
    if (activeParent) {
      setOpenMenu(activeParent.key);
    }
  }, [activeItem, renderItems]);

  return (
    <aside
      className={`border-r px-2.5 py-2 transition-all duration-200 flex flex-col h-full shrink-0 ${
        collapsed ? 'w-[76px]' : 'w-[250px]'
      }`}
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-sidebar-bg)' }}
    >
      <style>{`
        .sidebar-scrollbar::-webkit-scrollbar { width: 4px; }
        .sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
      
      <div className="mb-1 flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border transition hover:bg-slate-50"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-heading)',
            backgroundColor: isDark ? 'var(--app-control-bg)' : '#ffffff',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="space-y-0.5 flex-1 overflow-y-auto sidebar-scrollbar pr-1 pb-4">
        {renderItems.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            activeItem={activeItem}
            onItemClick={onItemClick}
            collapsed={collapsed}
            isDark={isDark}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
