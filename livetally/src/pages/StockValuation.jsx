import { Wallet } from 'lucide-react';
import { getStockValuation } from '../api';
import { fmt } from './CashBank/views/helpers';
import InventoryListPage, { qtyFmt } from './Inventory/InventoryListPage';

const columns = [
  { key: 'name', label: 'Item Name', render: (v) => <span className="report-strong">{v}</span> },
  { key: 'group', label: 'Group', render: (v) => <span className="report-muted">{v}</span> },
  { key: 'closing', label: 'Quantity', align: 'right', sortKey: 'qty', render: (v, r) => `${qtyFmt(v)} ${r.unit || ''}` },
  { key: 'rate', label: 'Rate', align: 'right', money: true },
  { key: 'costingMethod', label: 'Method', render: (v) => <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{v}</span> },
  { key: 'value', label: 'Closing Value', align: 'right', sortKey: 'value', render: (v) => <span className="font-black" style={{ color: 'var(--report-text)' }}>{fmt(v)}</span> },
];

export default function StockValuation() {
  return (
    <InventoryListPage
      title="Stock Valuation"
      subtitle="Closing stock valued by each item's own Tally costing method."
      icon={Wallet}
      fetcher={getStockValuation}
      columns={columns}
      defaultLimit={25}
      searchPlaceholder="Search item…"
      kpis={(meta) => {
        const cards = [{ label: 'Total Closing Value', value: fmt(meta?.totalValue), tone: 'text-blue-600 dark:text-blue-400' }];
        (meta?.byMethod || []).filter((m) => m.value).slice(0, 3).forEach((m) =>
          cards.push({ label: m.name, value: fmt(m.value) }));
        return cards;
      }}
    />
  );
}
