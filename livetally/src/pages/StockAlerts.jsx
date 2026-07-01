import { AlertTriangle, Info } from 'lucide-react';
import { getStockAlerts } from '../api';
import { qtyFmt } from './Inventory/InventoryListPage';
import InventoryListPage from './Inventory/InventoryListPage';

const ALERT_BADGE = {
  negative: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  zero: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
};

const columns = [
  { key: 'name', label: 'Item Name', render: (v) => <span className="report-strong">{v}</span> },
  { key: 'group', label: 'Group', render: (v) => <span className="report-muted">{v}</span> },
  { key: 'closing', label: 'Current Stock', align: 'right', sortKey: 'qty', render: (v, r) => (
    <span className={`font-black ${r.alertType === 'negative' ? 'text-red-600' : 'text-amber-600'}`}>{qtyFmt(v)} {r.unit || ''}</span>
  ) },
  { key: 'alertType', label: 'Alert Type', render: (v) => (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ALERT_BADGE[v] || ''}`}>
      {v === 'negative' ? 'Negative Stock' : 'Out of Stock'}
    </span>
  ) },
];

export default function StockAlerts() {
  return (
    <InventoryListPage
      title="Stock Alerts"
      subtitle="Items needing attention — out of stock and negative (oversold) balances."
      icon={AlertTriangle}
      fetcher={getStockAlerts}
      columns={columns}
      defaultLimit={25}
      searchPlaceholder="Search item…"
      kpis={(meta) => {
        const s = meta?.summary || {};
        return [
          { label: 'Negative Stock', value: s.negativeCount ?? 0, tone: 'text-red-600 dark:text-red-400' },
          { label: 'Out of Stock', value: s.zeroCount ?? 0, tone: 'text-amber-600 dark:text-amber-400' },
          { label: 'Total Alerts', value: s.totalAlerts ?? 0 },
        ];
      }}
      renderBanner={(meta) => meta?.dataGaps?.length ? (
        <div className="report-card px-4 py-3 flex items-start gap-2.5" style={{ borderLeft: '3px solid #f59e0b' }}>
          <Info size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[12px] font-semibold" style={{ color: 'var(--report-text-soft)' }}>{meta.dataGaps[0]}</p>
        </div>
      ) : null}
    />
  );
}
