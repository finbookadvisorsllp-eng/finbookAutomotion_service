import OpenDoodle from './OpenDoodle'
import Button from './Button'

// One shared empty/error/done placeholder using real Open Doodles art.
//   variant: empty | error | done | lost  (or pass `doodle` to override)
const VARIANT_DOODLE = { empty: 'unboxing', error: 'laying', done: 'jumping', lost: 'strolling' }

export default function EmptyState({
  variant = 'empty',
  doodle,
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
  compact = false,
}) {
  const name = doodle || VARIANT_DOODLE[variant] || 'unboxing'
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'py-16'} px-4 ${className}`}>
      <OpenDoodle name={name} float className={compact ? 'w-28 h-24' : 'w-40 h-32'} tint="var(--app-muted)" />
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
