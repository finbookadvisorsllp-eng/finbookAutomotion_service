import { useEffect, useState } from 'react'
import {
  LayoutDashboard, FileText, TrendingUp, ShoppingCart, ArrowLeftRight,
  Landmark, BookOpen, Plug, Settings, ChevronDown, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

// Nav structure. Leaf `label`s MUST match keys in routePaths LABEL_TO_PATH so
// click->navigate and active highlighting keep working for free. Groups just
// organise the routes that already existed but had no nav entry.
const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Voucher Entry', icon: FileText, children: [
      'Manual Voucher Entry', 'Bulk Upload', 'OCR Upload', 'Approval Center',
    ],
  },
  {
    label: 'Sales', icon: TrendingUp, children: [
      'Sales Inbox', 'Sales Review', 'Sales Archive', 'Sales Order', 'Sales Invoice', 'Credit Note (Sales Return)',
    ],
  },
  {
    label: 'Purchase', icon: ShoppingCart, children: [
      'Purchase Inbox', 'Purchase Review', 'Purchase Archive', 'Purchase Order', 'Purchase Invoice', 'Debit Note (Purchase Return)',
    ],
  },
  {
    label: 'Fund Flow', icon: ArrowLeftRight, children: [
      'Payment', 'Receipt', 'Contra', 'Fund Flow Review', 'Fund Flow Archive',
    ],
  },
  {
    label: 'Bank', icon: Landmark, children: [
      'Manage Bank', 'Manage Rule', 'Inbox', 'Bank Review', 'Bank Archive',
    ],
  },
  { label: 'Masters', icon: BookOpen, children: ['Ledger Master', 'Item Master'] },
  { label: 'Integrations', icon: Plug, children: ['Tally Connector', 'Document Archive'] },
  { label: 'Administration', icon: Settings, children: ['Companies', 'Clients', 'User & Role Management', 'Configuration'] },
]

const groupOf = (item) => NAV.find((g) => g.children?.includes(item))?.label

function Leaf({ label, active, onClick, indent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg py-2 text-left transition-colors hover:bg-[var(--app-control-hover)] ${indent ? 'pl-9 pr-3' : 'px-3'}`}
      style={{ color: active ? 'var(--app-accent)' : 'var(--app-text)', backgroundColor: active ? 'var(--app-accent-soft)' : 'transparent', fontWeight: active ? 600 : 500 }}
    >
      {active && <motion.span layoutId="sidebar-active-bar" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{ backgroundColor: 'var(--app-accent)' }} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      {indent && <span className="h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: active ? 'var(--app-accent)' : 'var(--app-muted)' }} />}
      <span className="truncate flex-1 text-[12.5px] tracking-wide">{label}</span>
    </button>
  )
}

function NavGroup({ group, activeItem, onItemClick, collapsed, open, onToggleGroup, onExpandSidebar }) {
  const Icon = group.icon
  const hasActive = group.children.some((c) => c === activeItem)
  return (
    <div>
      <button
        type="button"
        onClick={() => (collapsed ? onExpandSidebar() : onToggleGroup(group.label))}
        className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--app-control-hover)]"
        style={{ color: hasActive ? 'var(--app-accent)' : 'var(--app-text)', fontWeight: hasActive ? 600 : 500 }}
        title={collapsed ? group.label : undefined}
      >
        <span className="flex h-5 w-5 items-center justify-center shrink-0" style={{ color: hasActive ? 'var(--app-accent)' : 'var(--app-muted)' }}>
          <Icon size={16} strokeWidth={hasActive ? 2.2 : 1.8} />
        </span>
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-[13px] tracking-wide">{group.label}</span>
            <ChevronDown size={13} className="shrink-0 transition-transform" style={{ color: 'var(--app-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
          </>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="py-0.5 space-y-0.5">
              {group.children.map((child) => (
                <Leaf key={child} label={child} indent active={activeItem === child} onClick={() => onItemClick(child)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Sidebar({ activeItem, onItemClick, collapsed, onToggle }) {
  const [openGroups, setOpenGroups] = useState(() => {
    const g = groupOf(activeItem)
    return g ? { [g]: true } : {}
  })

  // Keep the active item's group open as the user navigates.
  useEffect(() => {
    const g = groupOf(activeItem)
    if (g) setOpenGroups((prev) => (prev[g] ? prev : { ...prev, [g]: true }))
  }, [activeItem])

  const toggleGroup = (label) => setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))

  return (
    <motion.aside
      animate={{ width: collapsed ? 70 : 240 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full shrink-0 relative overflow-hidden border-r shadow-sm select-none"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-sidebar-bg)' }}
    >
      <style>{`
        .sidebar-nav-container::-webkit-scrollbar { display: none; }
        .sidebar-nav-container { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="relative h-7 w-7 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full" style={{ color: 'var(--app-accent)', fill: 'var(--app-accent)' }}>
              <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2.5 w-2.5 border-2 border-white rotate-45 transform"></div>
            </div>
          </div>
          {!collapsed && <span className="text-[16px] font-extrabold tracking-tight leading-tight truncate" style={{ color: 'var(--app-heading)' }}>TallyHub</span>}
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav-container flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map((entry) =>
          entry.children ? (
            <NavGroup
              key={entry.label}
              group={entry}
              activeItem={activeItem}
              onItemClick={onItemClick}
              collapsed={collapsed}
              open={!!openGroups[entry.label]}
              onToggleGroup={toggleGroup}
              onExpandSidebar={() => { onToggle(); setOpenGroups((p) => ({ ...p, [entry.label]: true })) }}
            />
          ) : collapsed ? (
            <button
              key={entry.label}
              type="button"
              onClick={() => onItemClick(entry.label)}
              title={entry.label}
              className="group relative flex w-full items-center justify-center rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--app-control-hover)]"
              style={{ color: activeItem === entry.label ? 'var(--app-accent)' : 'var(--app-muted)' }}
            >
              <entry.icon size={16} strokeWidth={activeItem === entry.label ? 2.2 : 1.8} />
            </button>
          ) : (
            <button
              key={entry.label}
              type="button"
              onClick={() => onItemClick(entry.label)}
              className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--app-control-hover)]"
              style={{ color: activeItem === entry.label ? 'var(--app-accent)' : 'var(--app-text)', backgroundColor: activeItem === entry.label ? 'var(--app-accent-soft)' : 'transparent', fontWeight: activeItem === entry.label ? 600 : 500 }}
            >
              {activeItem === entry.label && <motion.span layoutId="sidebar-active-bar" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{ backgroundColor: 'var(--app-accent)' }} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="flex h-5 w-5 items-center justify-center shrink-0" style={{ color: activeItem === entry.label ? 'var(--app-accent)' : 'var(--app-muted)' }}>
                <entry.icon size={16} strokeWidth={activeItem === entry.label ? 2.2 : 1.8} />
              </span>
              <span className="truncate flex-1 text-[13px] tracking-wide">{entry.label}</span>
            </button>
          )
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-full h-9 px-3 rounded-lg flex items-center justify-center gap-2 font-semibold text-[12px] transition-colors"
          style={{ color: 'var(--app-accent)', backgroundColor: 'var(--app-accent-soft)', border: 'none' }}
        >
          {collapsed ? <ChevronsRight size={14} className="shrink-0" /> : (<><ChevronsLeft size={14} className="shrink-0" /><span className="truncate">Collapse</span></>)}
        </button>
      </div>
    </motion.aside>
  )
}

export default Sidebar
