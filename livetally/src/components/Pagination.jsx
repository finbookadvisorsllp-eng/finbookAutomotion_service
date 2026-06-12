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
    <div className="py-2.5 px-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium text-slate-500">{start}-{end} of {total}</span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(page - 1)} disabled={!hasPrev}
            className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
            <ChevronLeft size={16} />
          </button>
          {withGaps.map((n, i) => n === '…' ? (
            <span key={`g${i}`} className="w-7 h-7 flex items-center justify-center text-slate-400 text-[12px]">…</span>
          ) : (
            <button key={n} onClick={() => onPageChange(n)}
              className={`w-7 h-7 flex items-center justify-center rounded text-[12px] transition-colors ${n === page ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-200 font-medium'}`}>
              {n}
            </button>
          ))}
          <button onClick={() => onPageChange(page + 1)} disabled={!hasNext}
            className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
