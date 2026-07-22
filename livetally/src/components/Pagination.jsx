import { ChevronLeft, ChevronRight } from 'lucide-react';

// Reusable, server-side pagination control used across all report drill-downs.
// Driven entirely by the API pagination envelope:
//   { page, pageSize, totalRecords, totalPages, hasNext, hasPrevious }
const PAGE_SIZES = [10, 25, 50, 100];

export default function Pagination({ pagination, onPageChange, onPageSizeChange }) {
  const page = pagination?.page || 1;
  const pageSize = pagination?.pageSize ?? pagination?.limit ?? 10;
  const total = pagination?.totalRecords ?? pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? pagination?.pages ?? 0;
  const hasPrev = pagination?.hasPrevious ?? page > 1;
  const hasNext = pagination?.hasNext ?? page < totalPages;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Compact page-number window with gaps (1 … 4 5 6 … 20).
  const nums = new Set([1]);
  for (let n = page - 1; n <= page + 1; n++) if (n > 1 && n < totalPages) nums.add(n);
  if (totalPages > 1) nums.add(totalPages);
  const ordered = [...nums].sort((a, b) => a - b);
  const withGaps = [];
  ordered.forEach((n, i) => { if (i > 0 && n - ordered[i - 1] > 1) withGaps.push('…'); withGaps.push(n); });

  return (
    <div
      className="py-3 px-5 flex flex-wrap items-center justify-between gap-3"
      style={{
        borderTop: '1px solid var(--theme-card-border)',
        background: 'var(--theme-card-bg)',
        borderRadius: '0 0 20px 20px',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
          {start}–{end} of {total}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="text-[12px] font-medium px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
              style={{
                color: 'var(--theme-text-main)',
                background: 'var(--theme-card-bg)',
                border: '1px solid var(--theme-card-border)',
                borderRadius: 8,
              }}
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(page - 1)} disabled={!hasPrev}
            className="p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none disabled:opacity-30"
            style={{
              border: '1px solid var(--theme-card-border)',
              color: 'var(--theme-text-muted)',
              background: 'var(--theme-card-bg)',
            }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--report-row-hover)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-card-bg)'}
          >
            <ChevronLeft size={16} />
          </button>
          {withGaps.map((n, i) => n === '…' ? (
            <span key={`g${i}`} className="w-8 h-8 flex items-center justify-center text-[12px]" style={{ color: 'var(--theme-text-light)' }}>…</span>
          ) : (
            <button key={n} onClick={() => onPageChange(n)}
              className="w-8 h-8 flex items-center justify-center text-[12px] font-medium transition-colors"
              style={{
                borderRadius: 8,
                border: `1px solid ${n === page ? '#2563eb' : 'var(--theme-card-border)'}`,
                background: n === page ? '#2563eb' : 'var(--theme-card-bg)',
                color: n === page ? '#ffffff' : 'var(--theme-text-muted)',
              }}
              onMouseEnter={e => { if (n !== page) e.currentTarget.style.background = 'var(--report-row-hover)' }}
              onMouseLeave={e => { if (n !== page) e.currentTarget.style.background = 'var(--theme-card-bg)' }}
            >
              {n}
            </button>
          ))}
          <button onClick={() => onPageChange(page + 1)} disabled={!hasNext}
            className="p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none disabled:opacity-30"
            style={{
              border: '1px solid var(--theme-card-border)',
              color: 'var(--theme-text-muted)',
              background: 'var(--theme-card-bg)',
            }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--report-row-hover)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-card-bg)'}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
