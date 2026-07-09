import { Plus, MessageSquare, Trash2 } from 'lucide-react'

// Conversation history panel (Phase 6.2). Lists this user's sessions; lets them
// start a new chat, switch sessions, or delete one.
export default function HistoryPanel({ sessions, activeId, onNew, onSelect, onDelete }) {
  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: 'var(--theme-kpi-bg)', border: '1px solid var(--aicfo-border)' }}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--aicfo-border)' }}>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-extrabold cursor-pointer transition-all hover:text-gray-400"
        >
          <Plus size={16} strokeWidth={3} /> New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1">
        {!sessions?.length && (
          <p className="text-[12px] text-center py-6" style={{ color: 'var(--theme-text-muted)' }}>
            No conversations yet.
          </p>
        )}
        {sessions?.map((s) => {
          const active = s.sessionId === activeId
          return (
            <div
              key={s.sessionId}
              onClick={() => onSelect(s.sessionId)}
              className="group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all"
              style={{
                background: active ? 'var(--color-sidebar-active-bg)' : 'transparent',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-sidebar-hover)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <MessageSquare size={14} className="shrink-0"
                style={{ color: active ? 'var(--color-sidebar-active-text)' : 'var(--theme-accent)' }} />
              <span className="flex-1 truncate text-[12.5px] font-bold"
                style={{ color: active ? 'var(--color-sidebar-active-text)' : 'var(--theme-text-main)' }}>
                {s.title || 'Conversation'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.sessionId) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded-md hover:bg-red-500/10"
                title="Delete conversation"
              >
                <Trash2 size={13} className="text-red-500" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
