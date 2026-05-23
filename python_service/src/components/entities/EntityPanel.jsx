import { motion } from 'motion/react'
import { Search, Plus, RefreshCw, Settings2, Inbox } from 'lucide-react'

function EntityPanel({ title, nameColumn, emptyText, onAddClick, onIconAction }) {
  const handleIconClick = (name, payload) => {
    if (onIconAction) onIconAction(name, payload)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
    >
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--app-heading)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-semibold text-white shadow-sm focus-ring"
            style={{ background: 'var(--app-accent-gradient)' }}
          >
            <Plus size={12} /> New
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--app-muted)' }}
            />
            <input
              placeholder="Search…"
              className="h-8 w-[220px] rounded-lg border pl-8 pr-2.5 text-[12px] outline-none focus-ring"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-control-bg)',
                color: 'var(--app-heading)',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleIconClick('sync', title)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)',
              backgroundColor: 'var(--app-control-bg)',
            }}
            aria-label="Sync"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            onClick={() => handleIconClick('settings', title)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)',
              backgroundColor: 'var(--app-control-bg)',
            }}
            aria-label="Settings"
          >
            <Settings2 size={13} />
          </button>
        </div>
      </header>

      <div className="themed-scrollbar overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-[12px]">
          <thead style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
            <tr style={{ color: 'var(--app-muted)' }}>
              {['Sr No.', nameColumn, 'Business Allocation', 'Status', 'Action'].map((h) => (
                <th
                  key={h}
                  className="border-b px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: 'var(--app-row-border)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-3 py-12">
                <div
                  className="flex flex-col items-center justify-center gap-2 text-center"
                  style={{ color: 'var(--app-muted)' }}
                >
                  <span
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
                  >
                    <Inbox size={18} />
                  </span>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--app-heading)' }}>
                    {emptyText}
                  </p>
                  <p className="text-[11.5px]">Add your first {title.toLowerCase()} to get started.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}

export default EntityPanel
