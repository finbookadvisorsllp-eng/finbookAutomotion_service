import { ChevronRight, ArrowLeft } from 'lucide-react';

/**
 * Generic Tally-like breadcrumb trail.
 *
 *   items      : [{ label, key }]  — outermost first, current level last
 *   onNavigate : (index) => void   — jump back to any level (truncates deeper)
 *   onBack     : () => void        — optional explicit "back one level" button
 *
 * No report-specific logic — any drill-down report can drive it.
 */
export default function Breadcrumb({ items = [], onNavigate, onBack, bare = false }) {
  if (!items.length) return null;
  const lastIndex = items.length - 1;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${bare ? '' : 'glass-card px-3 py-2'}`}>
      {onBack && items.length > 1 && (
        <button
          onClick={onBack}
          title="Back"
          className="p-1 mr-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
      )}
      {items.map((item, idx) => {
        const isLast = idx === lastIndex;
        return (
          <div key={item.key ?? idx} className="flex items-center gap-2">
            {idx > 0 && <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
            {isLast ? (
              <span className="text-[13px] font-bold text-slate-900 dark:text-white max-w-[280px] truncate">
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => onNavigate?.(idx)}
                className="text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:underline max-w-[220px] truncate"
              >
                {item.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
