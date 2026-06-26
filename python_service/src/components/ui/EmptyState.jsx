import Doodle from './Doodle'
import Button from './Button'

// One shared empty/error/done placeholder. Replaces the dozens of plain-text
// "No X found" blocks. Optional action renders a primary button.
//   variant: empty | error | done | lost
export default function EmptyState({
  variant = 'empty',
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
  compact = false,
}) {
  const doodle = { empty: 'empty', error: 'error', done: 'done', lost: 'lost' }[variant] || 'empty'
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'py-16'} px-4 ${className}`}>
      <Doodle name={doodle} className={compact ? 'w-28 h-20' : 'w-40 h-28'} style={{ color: 'var(--app-muted)' }} />
      {title && <h3 className="mt-3 text-[13px] font-bold" style={{ color: 'var(--app-heading)' }}>{title}</h3>}
      <p className="mt-1 text-[11.5px] font-medium max-w-xs" style={{ color: 'var(--app-muted)' }}>
        {message || 'Nothing here yet.'}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" icon={actionIcon} onClick={onAction} className="mt-4">{actionLabel}</Button>
      )}
    </div>
  )
}
