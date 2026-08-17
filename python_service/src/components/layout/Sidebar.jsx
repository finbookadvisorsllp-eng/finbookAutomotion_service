import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, FileText, TrendingUp, ShoppingCart, ArrowLeftRight,
  Landmark, BookOpen, Plug, Settings, ChevronDown, ChevronsLeft, ChevronsRight,
  Search, Pin, X,
  Inbox, Eye, Archive, ClipboardList, PenLine, Upload, ScanLine, CheckCheck,
  ArrowUpRight, ArrowDownLeft, SlidersHorizontal, Package, FolderArchive,
  Building2, Users, ShieldCheck, ReceiptText, FileMinus, Circle, Sparkles, Layers,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppStore } from '../../stores/useAppStore'


// Nav structure. Leaf `label`s MUST match keys in routePaths LABEL_TO_PATH so
// click->navigate and active highlighting keep working for free. Groups just
// organise the routes that already existed but had no nav entry.
const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Reports', icon: Sparkles, children: [
      'AI Report',
    ],
  },
  {
    label: 'Voucher Entry', icon: FileText, children: [
      'Manual Voucher Entry', 'Bulk Upload', 'OCR Upload', 'Text to Entry','Approval Center', 
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
  { label: 'Masters', icon: BookOpen },
  { label: 'Integrations', icon: Plug, children: ['Tally Connector', 'Document Archive'] },
  { label: 'Administration', icon: Settings, children: ['Companies', 'Clients', 'User & Role Management', 'Configuration'] },
]

// Per-leaf icon (replaces the dot bullet). Keyed by leaf label.
const LEAF_ICONS = {
  'AI Report': Sparkles,
  'Manual Voucher Entry': PenLine, 'Bulk Upload': Upload, 'OCR Upload': ScanLine, 'Text to Entry': FileText, 'Approval Center': CheckCheck, 
  'Sales Inbox': Inbox, 'Sales Review': Eye, 'Sales Archive': Archive, 'Sales Order': ClipboardList, 'Sales Invoice': ReceiptText, 'Credit Note (Sales Return)': FileMinus,
  'Purchase Inbox': Inbox, 'Purchase Review': Eye, 'Purchase Archive': Archive, 'Purchase Order': ClipboardList, 'Purchase Invoice': ReceiptText, 'Debit Note (Purchase Return)': FileMinus,
  'Payment': ArrowUpRight, 'Receipt': ArrowDownLeft, 'Contra': ArrowLeftRight, 'Fund Flow Review': Eye, 'Fund Flow Archive': Archive,
  'Manage Bank': Landmark, 'Manage Rule': SlidersHorizontal, 'Inbox': Inbox, 'Bank Review': Eye, 'Bank Archive': Archive,
  'Masters': BookOpen,
  'Tally Connector': Plug, 'Document Archive': FolderArchive,
  'Companies': Building2, 'Clients': Users, 'User & Role Management': ShieldCheck, 'Configuration': Settings,
}

const groupOf = (item) => NAV.find((g) => g.children?.includes(item))?.label
// Flat index for search: every leaf with its parent group label.
const ALL_LEAVES = NAV.flatMap((g) => g.children ? g.children.map((c) => ({ label: c, group: g.label })) : [{ label: g.label, group: null }])

function Leaf({ label, sub, active, onClick, indent, pinned, onTogglePin }) {
  return (
    <div className="group/leaf relative">
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ x: indent ? 4 : 2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`flex w-full items-center gap-2.5 rounded-full py-1.5 text-left transition-colors ${active ? '' : 'hover:bg-[var(--app-sidebar-hover)]'} ${indent ? 'pl-7 pr-7' : 'px-3 pr-7'}`}
        style={{ color: active ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-fg)', fontWeight: active ? 600 : 500 }}
      >
        {active && <motion.span layoutId="sidebar-active-bar" className="absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--app-sidebar-accent-soft)' }} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        {indent && (() => {
          const LeafIcon = LEAF_ICONS[label] || Circle
          return (
            <LeafIcon
              size={14}
              strokeWidth={active ? 2.4 : 1.9}
              className="relative z-10 shrink-0 transition-colors group-hover/leaf:scale-110"
              style={{ color: active ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-muted)' }}
            />
          )
        })()}
        <span className={`relative z-10 truncate flex-1 text-[12px] tracking-wide leading-tight transition-colors ${active ? '' : 'group-hover/leaf:text-[var(--app-sidebar-heading)]'}`}>
          {label}
          {sub && <span className="block text-[9.5px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--app-sidebar-muted)' }}>{sub}</span>}
        </span>
      </motion.button>
      {onTogglePin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePin(label) }}
          title={pinned ? 'Unpin' : 'Pin'}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-opacity ${pinned ? 'opacity-100' : 'opacity-0 group-hover/leaf:opacity-100'}`}
          style={{ color: pinned ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-muted)' }}
        >
          <Pin size={11} fill={pinned ? 'currentColor' : 'none'} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

function NavGroup({ group, activeItem, onItemClick, open, onToggleGroup, pins, onTogglePin }) {
  const Icon = group.icon
  const hasActive = group.children.some((c) => c === activeItem)
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleGroup(group.label)}
        className="group relative flex w-full items-center gap-3 rounded-full px-3 py-2 text-left transition-colors hover:bg-[var(--app-sidebar-hover)]"
        style={{ color: hasActive ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-fg)', fontWeight: hasActive ? 600 : 500 }}
      >
        <span className="flex h-5 w-5 items-center justify-center shrink-0 transition-transform" style={{ color: hasActive ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-muted)' }}>
          <Icon size={15} strokeWidth={hasActive ? 2.2 : 1.8} />
        </span>
        <span className="truncate flex-1 text-[12.5px] tracking-wide">{group.label}</span>
        <ChevronDown size={13} className="shrink-0 transition-transform" style={{ color: 'var(--app-sidebar-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-px pt-0.5">
              {group.children.map((child) => (
                <Leaf key={child} label={child} indent active={activeItem === child} onClick={() => onItemClick(child)} pinned={pins.includes(child)} onTogglePin={onTogglePin} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div className="px-3 pt-3 pb-1 text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-sidebar-muted)' }}>{children}</div>
}

const LEAF_TO_MODULE_ID = {
  'Dashboard': 'dashboard',
  'AI Report': 'aiReport',
  'Manual Voucher Entry': 'manualVoucher',
  'Bulk Upload': 'bulkUpload',
  'OCR Upload': 'ocrUpload',
  'Text to Entry': 'textToEntry',
  'Approval Center': 'approvalCenter',
  'Sales Inbox': 'salesInbox',
  'Sales Review': 'salesInbox',
  'Sales Archive': 'salesInbox',
  'Sales Order': 'salesOrder',
  'Sales Invoice': 'salesInvoice',
  'Credit Note (Sales Return)': 'salesReturn',
  'Purchase Inbox': 'purchaseInbox',
  'Purchase Review': 'purchaseInbox',
  'Purchase Archive': 'purchaseInbox',
  'Purchase Order': 'purchaseOrder',
  'Purchase Invoice': 'purchaseInvoice',
  'Debit Note (Purchase Return)': 'debitNote',
  'Payment': 'payment',
  'Receipt': 'receipt',
  'Contra': 'contra',
  'Fund Flow Review': 'payment',
  'Fund Flow Archive': 'payment',
  'Manage Bank': 'manageBank',
  'Manage Rule': 'manageBank',
  'Inbox': 'manageBank',
  'Bank Review': 'manageBank',
  'Bank Archive': 'manageBank',
  'Masters': 'ledgerMaster',
  'Ledger Master': 'ledgerMaster',
  'Item Master': 'itemMaster',
  'Tally Connector': 'tallyConnector',
  'Document Archive': 'documentArchive',
  'Companies': 'companies',
  'Clients': 'clients',
  'User & Role Management': 'usersRoles',
  'Configuration': 'configuration',
}

function checkLeafViewPermission(leafLabel, permissions, role) {
  if (leafLabel === 'AI Report' || leafLabel === 'Reports') return true
  const modId = LEAF_TO_MODULE_ID[leafLabel]
  if (!modId) return true

  // If role permissions matrix is present, evaluate view permission strictly first
  if (permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
    const modObj = permissions[modId]
    if (modObj !== undefined) {
      if (typeof modObj === 'boolean') return modObj
      if (typeof modObj === 'object' && modObj.view !== undefined) return Boolean(modObj.view)
    }
  }

  if (Array.isArray(permissions) && permissions.length > 0) {
    const item = permissions.find((p) => p.id === modId || p.name === modId)
    if (item) {
      if (typeof item.view !== 'undefined') return Boolean(item.view)
      if (typeof item.actions === 'object' && item.actions.view !== 'undefined') return Boolean(item.actions.view)
    }
  }

  // System Super Admin fallback
  const lowerRole = (role || '').toLowerCase()
  if (lowerRole === 'admin' || lowerRole === 'administrator' || lowerRole === 'superadmin') {
    return true
  }

  return true
}

function Sidebar({ activeItem, onItemClick, collapsed, onToggle }) {
  const role = useAppStore((s) => s.role)
  const permissions = useAppStore((s) => s.permissions) || useAppStore((s) => s.user?.permissions)

  const [openGroups, setOpenGroups] = useState(() => {
    const g = groupOf(activeItem)
    return g ? { [g]: true } : {}
  })
  const [query, setQuery] = useState('')
  const [pins, setPins] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebar_pins') || '[]') } catch { return [] }
  })
  const searchRef = useRef(null)

  const filteredNav = NAV.map((group) => {
    if (group.label === 'Administration' && role !== 'admin') return null

    if (group.children) {
      const allowedChildren = group.children.filter((child) =>
        checkLeafViewPermission(child, permissions, role)
      )
      if (allowedChildren.length === 0) return null
      return { ...group, children: allowedChildren }
    }

    if (!checkLeafViewPermission(group.label, permissions, role)) return null
    return group
  }).filter(Boolean)

  // Keep the active item's group open as the user navigates.
  useEffect(() => {
    const g = groupOf(activeItem)
    if (g) setOpenGroups((prev) => (prev[g] ? prev : { ...prev, [g]: true }))
  }, [activeItem])


  // ⌘K / Ctrl+K focuses the nav search (command palette feel).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (collapsed) onToggle()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, onToggle])

  const toggleGroup = (label) => setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  const togglePin = (label) => setPins((prev) => {
    const next = prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    localStorage.setItem('sidebar_pins', JSON.stringify(next))
    return next
  })

  const q = query.trim().toLowerCase()
  const results = q ? ALL_LEAVES.filter((l) => l.label.toLowerCase().includes(q)) : null

  return (
    <motion.aside
      animate={{ width: collapsed ? 70 : 248 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full shrink-0 relative overflow-hidden border-r shadow-sm select-none"
      style={{ borderColor: 'var(--app-sidebar-border)', backgroundColor: 'var(--app-sidebar-bg)' }}
    >
      <style>{`
        .sidebar-nav-container::-webkit-scrollbar { display: none; }
        .sidebar-nav-container { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-3.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-sidebar-accent)' }}>
            <svg viewBox="0 0 100 100" className="h-4 w-4" style={{ fill: 'var(--app-sidebar-bg)' }}>
              <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
            </svg>
          </div>
          {!collapsed && <span className="text-[16px] font-extrabold tracking-tight leading-tight truncate" style={{ color: 'var(--app-sidebar-heading)' }}>TallyHub</span>}
        </div>
      </div>

      {/* Command search (header) */}
      {!collapsed && (
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-sidebar-muted)' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full h-8 rounded-full border pl-8 pr-12 text-[12px] outline-none transition-all focus:border-[var(--app-sidebar-accent)]"
              style={{ borderColor: 'var(--app-sidebar-border)', backgroundColor: 'var(--app-sidebar-control-bg)', color: 'var(--app-sidebar-heading)' }}
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-sidebar-muted)' }}><X size={13} /></button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1 py-0.5 rounded border" style={{ color: 'var(--app-sidebar-muted)', borderColor: 'var(--app-sidebar-border)' }}>⌘K</kbd>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav-container flex-1 overflow-y-auto px-2 pb-3 space-y-px">
        {!collapsed && results ? (
          results.length > 0 ? (
            results.map((r) => (
              <Leaf key={r.label} label={r.label} sub={r.group} active={activeItem === r.label} onClick={() => { onItemClick(r.label); setQuery('') }} pinned={pins.includes(r.label)} onTogglePin={togglePin} />
            ))
          ) : (
            <div className="px-3 py-6 text-center text-[11px] font-medium" style={{ color: 'var(--app-sidebar-muted)' }}>No matches for “{query}”.</div>
          )
        ) : (
          <>
            {!collapsed && pins.length > 0 && (
              <>
                <SectionLabel>Pinned</SectionLabel>
                {pins.map((label) => (
                  <Leaf key={`pin-${label}`} label={label} active={activeItem === label} onClick={() => onItemClick(label)} pinned onTogglePin={togglePin} />
                ))}
                <div className="mx-3 my-2 border-t" style={{ borderColor: 'var(--app-sidebar-border)' }} />
              </>
            )}

            {filteredNav.map((entry) =>

              entry.children ? (
                collapsed ? (
                  <button
                    key={entry.label}
                    type="button"
                    onClick={() => { onToggle(); setOpenGroups((p) => ({ ...p, [entry.label]: true })) }}
                    title={entry.label}
                    className="group relative flex w-full items-center justify-center rounded-full px-3 py-2.5 transition-colors hover:bg-[var(--app-sidebar-hover)]"
                    style={{ color: entry.children.includes(activeItem) ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-muted)' }}
                  >
                    <entry.icon size={16} strokeWidth={entry.children.includes(activeItem) ? 2.2 : 1.8} />
                  </button>
                ) : (
                  <NavGroup
                    key={entry.label}
                    group={entry}
                    activeItem={activeItem}
                    onItemClick={onItemClick}
                    open={!!openGroups[entry.label]}
                    onToggleGroup={toggleGroup}
                    pins={pins}
                    onTogglePin={togglePin}
                  />
                )
              ) : collapsed ? (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => onItemClick(entry.label)}
                  title={entry.label}
                  className="group relative flex w-full items-center justify-center rounded-full px-3 py-2.5 transition-colors hover:bg-[var(--app-sidebar-hover)]"
                  style={{ color: activeItem === entry.label ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-muted)' }}
                >
                  <entry.icon size={16} strokeWidth={activeItem === entry.label ? 2.2 : 1.8} />
                </button>
              ) : (
                <motion.button
                  key={entry.label}
                  type="button"
                  onClick={() => onItemClick(entry.label)}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={`group/leaf relative flex w-full items-center gap-3 rounded-full px-3 py-2 text-left transition-colors ${activeItem === entry.label ? '' : 'hover:bg-[var(--app-sidebar-hover)]'}`}
                  style={{ color: activeItem === entry.label ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-fg)', fontWeight: activeItem === entry.label ? 600 : 500 }}
                >
                  {activeItem === entry.label && <motion.span layoutId="sidebar-active-bar" className="absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--app-sidebar-accent-soft)' }} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <span className="relative z-10 flex h-5 w-5 items-center justify-center shrink-0 transition-transform" style={{ color: activeItem === entry.label ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-muted)' }}>
                    <entry.icon size={15} strokeWidth={activeItem === entry.label ? 2.2 : 1.8} />
                  </span>
                  <span className="relative z-10 truncate flex-1 text-[12.5px] tracking-wide">{entry.label}</span>
                </motion.button>
              )
            )}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-full h-9 px-3 rounded-full flex items-center justify-center gap-2 font-semibold text-[12px] transition-colors"
          style={{ color: 'var(--app-sidebar-accent)', backgroundColor: 'var(--app-sidebar-accent-soft)', border: 'none' }}
        >
          {collapsed ? <ChevronsRight size={14} className="shrink-0" /> : (<><ChevronsLeft size={14} className="shrink-0" /><span className="truncate">Collapse</span></>)}
        </button>
      </div>
    </motion.aside>
  )
}

export default Sidebar
