import { TrendingUp } from 'lucide-react';
import { getFastMoving } from '../api';
import { fmt } from './CashBank/views/helpers';
import InventoryListPage, { Segmented, qtyFmt } from './Inventory/InventoryListPage';

const TOP_OPTS = [{ value: 10, label: 'Top 10' }, { value: 25, label: 'Top 25' },
  { value: 50, label: 'Top 50' }, { value: 0, label: 'All' }];

const columns = [
  { key: 'name', label: 'Item Name', render: (v) => <span className="report-strong">{v}</span> },
  { key: 'group', label: 'Group', render: (v) => <span className="report-muted">{v}</span> },
  { key: 'out', label: 'Qty Sold', align: 'right', sortKey: 'out', render: (v, r) => `${qtyFmt(v)} ${r.unit || ''}` },
  { key: 'salesValue', label: 'Sales Value', align: 'right', sortKey: 'salesvalue', money: true },
  { key: 'turnover', label: 'Turnover', align: 'right', render: (v) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{v ? `${v}x` : '—'}</span> },
  { key: 'closing', label: 'In Stock', align: 'right', sortKey: 'qty', render: (v, r) => `${qtyFmt(v)} ${r.unit || ''}` },
];

export default function FastMoving() {
  return (
    <InventoryListPage
      title="Fast Moving Items"
      subtitle="Highest-velocity items by quantity sold and inventory turnover."
      icon={TrendingUp}
      fetcher={getFastMoving}
      columns={columns}
      extra={{ top: 25 }}
      defaultLimit={25}
      searchPlaceholder="Search item…"
      renderControls={({ extra, setExtra }) => (
        <Segmented options={TOP_OPTS} value={extra.top} onChange={(t) => setExtra({ top: t })} />
      )}
      kpis={(meta) => {
        const s = meta?.summary || {};
        return [
          { label: 'Moving Items', value: s.totalItems ?? 0, tone: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total Outward Value', value: fmt(s.totalOutValue) },
        ];
      }}
    />
  );
}
