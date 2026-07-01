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
    <div className="py-2.5 px-4 border-t border-[var(--report-divider)] flex flex-wrap items-center justify-between gap-3 bg-[var(--theme-card-bg)]">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold text-[var(--theme-text-muted)]">{start}-{end} of {total}</span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--theme-text-muted)]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="text-[11px] font-bold text-[var(--theme-text-main)] bg-[var(--theme-card-bg)] border border-[var(--report-border)] rounded-none px-1.5 py-1 focus:outline-none focus:border-[var(--theme-text-main)] focus:ring-0 transition-colors cursor-pointer"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(page - 1)} disabled={!hasPrev}
            className="p-1 rounded-none border border-[var(--report-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--report-row-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer focus:outline-none">
            <ChevronLeft size={16} />
          </button>
          {withGaps.map((n, i) => n === '…' ? (
            <span key={`g${i}`} className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-light)] text-[12px]">…</span>
          ) : (
            <button key={n} onClick={() => onPageChange(n)}
              className={`w-7 h-7 flex items-center justify-center rounded-none text-[12px] border transition-colors ${n === page ? 'border-blue-600 bg-blue-600 text-white font-bold' : 'border-[var(--report-border)] text-[var(--theme-text-muted)] bg-[var(--theme-card-bg)] hover:bg-[var(--report-row-hover)] hover:text-[var(--theme-text-main)]'}`}>
              {n}
            </button>
          ))}
          <button onClick={() => onPageChange(page + 1)} disabled={!hasNext}
            className="p-1 rounded-none border border-[var(--report-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--report-row-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer focus:outline-none">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
