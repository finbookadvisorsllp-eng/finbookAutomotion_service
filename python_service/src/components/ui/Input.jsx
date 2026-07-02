import { forwardRef } from 'react'
import { Search } from 'lucide-react'

const fieldStyle = {
  backgroundColor: 'var(--app-control-bg)',
  borderColor: 'var(--app-border)',
  color: 'var(--app-heading)',
}

// Themed text input. Label optional.
export const TextInput = forwardRef(function TextInput(
  { label, className = '', inputClassName = '', ...props },
  ref,
) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>
          {label}
        </span>
      )}
      <input
        ref={ref}
        className={`w-full h-9 rounded-lg border px-3 text-[12px] font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] ${inputClassName}`}
        style={fieldStyle}
        {...props}
      />
    </label>
  )
})

// Search box with leading icon — consolidates the repeated panel search inputs.
export const SearchInput = forwardRef(function SearchInput(
  { value, onChange, placeholder = 'Search…', className = '', size = 'sm', ...props },
  ref,
) {
  const h = size === 'md' ? 'h-9' : 'h-7.5'
  return (
    <div className={`relative group ${className}`}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors text-[var(--app-muted)] group-focus-within:text-[var(--app-accent)]"
        size={13}
      />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${h} rounded-lg border pl-8.5 pr-3 text-[11px] font-semibold outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]`}
        style={fieldStyle}
        {...props}
      />
    </div>
  )
})
