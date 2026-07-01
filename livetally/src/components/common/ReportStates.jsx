import { Loader2, Inbox, AlertTriangle, RefreshCw } from 'lucide-react';

/** Shared loading / empty / error blocks for every report drill level. */

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
      <Loader2 size={28} className="animate-spin text-blue-500" />
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
  );
}

export function EmptyState({ title = 'No records found', hint = 'Try adjusting the filters or date range.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
        <Inbox size={26} />
      </div>
      <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 max-w-xs">{hint}</p>
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <div className="p-3 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500">
        <AlertTriangle size={26} />
      </div>
      <p className="text-[13px] font-bold text-red-600 dark:text-red-400 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
