import { Search, Plus, RefreshCw, Settings2 } from 'lucide-react'

function EntityPanel({ title, nameColumn, emptyText, onAddClick, onIconAction }) {
  const handleIconClick = (name, payload) => {
    if (onIconAction) onIconAction(name, payload)
  }

  return (
    <section className="rounded-md border" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
      <div className="flex items-center justify-between border-b px-2.5 py-1.5" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold" style={{ color: '#2f49d8' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}
            aria-label={`Add ${title}`}
          >
            <Plus size={11} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text)' }} />
            <input
              placeholder="Search..."
              className="h-6 w-[180px] rounded border pl-7 pr-2 text-[11px] outline-none"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleIconClick('sync', title)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
            style={{ borderColor: 'var(--app-border)', color: '#6e79aa' }}
            aria-label="Sync"
          >
            <RefreshCw size={10} />
          </button>
          <button
            type="button"
            onClick={() => handleIconClick('settings', title)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
            style={{ borderColor: 'var(--app-border)', color: '#6e79aa' }}
            aria-label="Settings"
          >
            <Settings2 size={10} />
          </button>
        </div>
      </div>

      <div className="themed-scrollbar overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-[11px]">
          <thead style={{ backgroundColor: 'var(--app-table-head-bg)', color: 'var(--app-heading)' }}>
            <tr>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Sr No.</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>{nameColumn}</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Business Allocation</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Status</th>
              <th className="border-b px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b px-2 py-2" colSpan={5} style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
                {emptyText}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default EntityPanel
