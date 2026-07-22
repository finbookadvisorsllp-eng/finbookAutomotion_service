import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null
  const sizeClasses = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}
    >
      <div className={`erp-card w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-slide-up`}
        style={{ borderRadius: 24 }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--theme-card-border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--theme-text-main)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'var(--theme-surface-secondary)', color: 'var(--theme-text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; e.currentTarget.style.color = '#f43f5e' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--theme-surface-secondary)'; e.currentTarget.style.color = 'var(--theme-text-muted)' }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
