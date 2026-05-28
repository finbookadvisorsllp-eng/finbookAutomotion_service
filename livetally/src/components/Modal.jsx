export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null
  const sizeClasses = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 transition-all text-lg font-light">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
