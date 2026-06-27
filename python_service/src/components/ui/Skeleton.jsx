// Shimmer skeleton. `.shimmer` keyframes already live in styles/index.css.
export default function Skeleton({ className = '', rounded = 'rounded-md' }) {
  return (
    <span
      className={`block ${rounded} ${className}`}
      style={{
        background: 'linear-gradient(90deg, var(--app-table-head-bg) 25%, var(--app-row-hover) 37%, var(--app-table-head-bg) 63%)',
        backgroundSize: '400% 100%',
        animation: 'shimmer 1.4s ease infinite',
      }}
    />
  )
}
