import { Clock } from 'lucide-react';
import { getSlowMoving } from '../api';
import { fmt } from './CashBank/views/helpers';
import InventoryListPage, { Segmented, qtyFmt } from './Inventory/InventoryListPage';

const DAY_OPTS = [30, 60, 90, 180].map((d) => ({ value: d, label: `${d} Days` }));

const columns = [
  { key: 'name', label: 'Item Name', render: (v) => <span className="report-strong">{v}</span> },
  { key: 'group', label: 'Group', render: (v) => <span className="report-muted">{v}</span> },
  { key: 'closing', label: 'Stock Qty', align: 'right', sortKey: 'qty', render: (v, r) => `${qtyFmt(v)} ${r.unit || ''}` },
  { key: 'value', label: 'Stock Value', align: 'right', money: true },
  { key: 'agingDays', label: 'Aging (Days)', align: 'right', sortKey: 'aging', render: (v) => (
    <span className={`font-bold ${v > 180 ? 'text-red-500' : v > 90 ? 'text-amber-500' : 'text-slate-500'}`}>{v == null ? 'Never sold' : `${v} days`}</span>
  ) },
  { key: 'lastSaleDate', label: 'Last Sale', render: (v) => v || '—' },
];

export default function SlowMoving() {
  return (
    <InventoryListPage
      title="Slow Moving Items"
      subtitle="Stock that has not sold within the selected window — capital held up."
      icon={Clock}
      fetcher={getSlowMoving}
      columns={columns}
      extra={{ days: 90 }}
      defaultLimit={25}
      searchPlaceholder="Search item…"
      renderControls={({ extra, setExtra }) => (
        <Segmented options={DAY_OPTS} value={extra.days} onChange={(d) => setExtra({ days: d })} />
      )}
      kpis={(meta) => {
        const s = meta?.summary || {};
        return [
          { label: `Dead Stock (${s.days || 90}d+)`, value: s.deadStockItems ?? 0, tone: 'text-amber-600 dark:text-amber-400' },
          { label: 'Dead Stock Value', value: fmt(s.deadStockValue), tone: 'text-red-600 dark:text-red-400' },
        ];
      }}
    />
  );
}
