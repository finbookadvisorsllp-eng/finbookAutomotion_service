import { motion } from 'motion/react'
import {
  ArrowUpRight,
  Inbox,
  CheckCircle2,
  Archive as ArchiveIcon,
  TrendingUp,
  Wallet,
  ShoppingCart,
  Building2,
  Sparkles,
} from 'lucide-react'

const columnGroups = [
  { title: 'Sale', key: 'sale', icon: TrendingUp },
  { title: 'Purchase / Expense', key: 'purchase', icon: ShoppingCart },
  { title: 'Bank', key: 'bank', icon: Wallet },
]

const groupedColumns = ['Inbox', 'Review', 'Archive', 'Delete', 'Total']

const rows = [
  {
    srNo: 1,
    organization: 'Finolax Advisors',
    companies: 'GRAALIS',
    createdAt: '2024-04-04',
    totalTransactions: 472,
    sale: { inbox: 0, review: 0, archive: 0, delete: 0, total: 471 },
    purchase: { inbox: 0, review: 0, archive: 0, delete: 0, total: 471 },
    bank: { inbox: 0, review: 0, archive: 0, delete: 0, total: 471 },
  },
]

const kpis = [
  { label: 'Inbox', value: 12, icon: Inbox, trend: '+3 today', tone: 'indigo' },
  { label: 'Awaiting review', value: 5, icon: CheckCircle2, trend: '-2 vs last wk', tone: 'amber' },
  { label: 'Archived this month', value: 248, icon: ArchiveIcon, trend: '+18%', tone: 'emerald' },
  { label: 'Active companies', value: 4, icon: Building2, trend: 'all healthy', tone: 'violet' },
]

const toneStyles = {
  indigo: { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)' },
  amber: { fg: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  emerald: { fg: '#059669', bg: 'rgba(5,150,105,0.10)' },
  violet: { fg: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
}

function KpiCard({ kpi, index }) {
  const Icon = kpi.icon
  const tone = toneStyles[kpi.tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-xl border p-4 transition-shadow hover:shadow-md"
      style={{
        borderColor: 'var(--app-border)',
        backgroundColor: 'var(--app-panel-bg)',
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          <Icon size={16} />
        </div>
        <div
          className="flex items-center gap-0.5 text-[10.5px] font-semibold"
          style={{ color: 'var(--app-muted)' }}
        >
          {kpi.trend}
          <ArrowUpRight size={12} />
        </div>
      </div>
      <div className="mt-4">
        <div
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--app-muted)' }}
        >
          {kpi.label}
        </div>
        <div
          className="text-[28px] font-semibold mt-0.5 leading-none"
          style={{ color: 'var(--app-heading)' }}
        >
          {kpi.value}
        </div>
      </div>
    </motion.div>
  )
}

function Cell({ value, dim }) {
  return (
    <td
      className="border-b px-3 py-2.5 text-[12px]"
      style={{
        borderColor: 'var(--app-row-border)',
        color: dim ? 'var(--app-muted)' : 'var(--app-heading)',
        fontWeight: dim ? 500 : 600,
      }}
    >
      {value}
    </td>
  )
}

function GroupCells({ values }) {
  return groupedColumns.map((label) => {
    const v = values[label.toLowerCase()]
    const dim = v === 0
    return <Cell key={label} value={v} dim={dim} />
  })
}

function DashboardTable() {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <span className="chip mb-2.5">
            <Sparkles size={11} /> Customer workspace
          </span>
          <h1
            className="text-[26px] font-semibold leading-tight"
            style={{ color: 'var(--app-heading)' }}
          >
            Welcome back —{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'var(--app-accent-gradient)' }}
            >
              here's your books today
            </span>
          </h1>
          <p
            className="mt-1.5 text-[13px] max-w-xl"
            style={{ color: 'var(--app-text)' }}
          >
            Track sales, purchases and bank movement in one place. Your AI accountant flags anomalies before close.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-[12px] font-semibold focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-control-bg)',
              color: 'var(--app-heading)',
            }}
          >
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12px] font-semibold text-white shadow-sm hover:shadow transition-shadow focus-ring"
            style={{ background: 'var(--app-accent-gradient)' }}
          >
            <Sparkles size={13} /> New transaction
          </button>
        </div>
      </motion.section>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} kpi={kpi} index={i} />
        ))}
      </section>

      {/* Table */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-xl border overflow-hidden"
        style={{
          borderColor: 'var(--app-border)',
          backgroundColor: 'var(--app-panel-bg)',
        }}
      >
        <header
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div>
            <h2
              className="text-[14px] font-semibold"
              style={{ color: 'var(--app-heading)' }}
            >
              Companies overview
            </h2>
            <p
              className="text-[11.5px] mt-0.5"
              style={{ color: 'var(--app-muted)' }}
            >
              Cross-module activity for every company in this workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {columnGroups.map((g) => {
              const Icon = g.icon
              return (
                <span
                  key={g.key}
                  className="hidden sm:inline-flex items-center gap-1.5 text-[10.5px] font-medium"
                  style={{ color: 'var(--app-muted)' }}
                >
                  <Icon size={11} /> {g.title}
                </span>
              )
            })}
          </div>
        </header>

        <div className="themed-scrollbar overflow-x-auto">
          <table className="min-w-[1220px] w-full border-collapse">
            <thead>
              <tr
                style={{
                  color: 'var(--app-muted)',
                  backgroundColor: 'var(--app-table-head-bg)',
                }}
              >
                {['Sr No.', 'Organization', 'Companies', 'Created', 'Total Tx'].map((h) => (
                  <th
                    key={h}
                    rowSpan={2}
                    className="border-b border-r px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ borderColor: 'var(--app-row-border)' }}
                  >
                    {h}
                  </th>
                ))}
                {columnGroups.map((group) => (
                  <th
                    key={group.key}
                    colSpan={5}
                    className="border-b border-r px-3 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ borderColor: 'var(--app-row-border)' }}
                  >
                    {group.title}
                  </th>
                ))}
              </tr>
              <tr
                style={{
                  color: 'var(--app-muted)',
                  backgroundColor: 'var(--app-table-head-bg)',
                }}
              >
                {columnGroups.map((group) =>
                  groupedColumns.map((item, idx) => (
                    <th
                      key={`${group.key}-${item}`}
                      className={`border-b px-2.5 py-1.5 text-center text-[9.5px] font-semibold uppercase tracking-wider ${
                        idx === 4 ? 'border-r' : ''
                      }`}
                      style={{ borderColor: 'var(--app-row-border)' }}
                    >
                      {item}
                    </th>
                  )),
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, i) => (
                <motion.tr
                  key={row.srNo}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  className="transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--app-row-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Cell value={row.srNo} dim />
                  <td
                    className="border-b px-3 py-2.5 text-[12px]"
                    style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-7 w-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ background: 'var(--app-accent-gradient)' }}
                      >
                        {row.organization
                          .split(' ')
                          .map((s) => s[0])
                          .join('')
                          .slice(0, 2)}
                      </span>
                      <div className="leading-tight">
                        <div className="font-semibold">{row.organization}</div>
                        <div className="text-[10.5px]" style={{ color: 'var(--app-muted)' }}>
                          {row.companies}
                        </div>
                      </div>
                    </div>
                  </td>
                  <Cell value={row.companies} dim />
                  <Cell value={row.createdAt} dim />
                  <Cell value={row.totalTransactions} />
                  <GroupCells values={row.sale} />
                  <GroupCells values={row.purchase} />
                  <GroupCells values={row.bank} />
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="flex items-center justify-between px-4 py-2.5 border-t"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--app-muted)' }}>
            Showing 1–10 of 1
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'var(--app-muted)' }}>
              Rows
            </span>
            <select
              className="rounded-md border px-2 py-1 text-[11px] outline-none focus-ring"
              style={{
                borderColor: 'var(--app-border)',
                color: 'var(--app-heading)',
                backgroundColor: 'var(--app-control-bg)',
              }}
              defaultValue="10"
              aria-label="Rows per page"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </motion.section>
    </div>
  )
}

export default DashboardTable
