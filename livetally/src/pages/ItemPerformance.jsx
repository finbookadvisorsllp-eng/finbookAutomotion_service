import { BarChart3 } from 'lucide-react';
import { getItemPerformanceList } from '../api';
import { fmt } from './CashBank/views/helpers';
import InventoryListPage, { qtyFmt } from './Inventory/InventoryListPage';

const columns = [
  { key: 'name', label: 'Item Name', render: (v) => <span className="report-strong">{v}</span> },
  { key: 'group', label: 'Group', render: (v) => <span className="report-muted">{v}</span> },
  { key: 'salesQty', label: 'Qty Sold', align: 'right', sortKey: 'salesqty', render: (v, r) => `${qtyFmt(v)} ${r.unit || ''}` },
  { key: 'salesValue', label: 'Sales Value', align: 'right', sortKey: 'salesvalue', money: true },
  { key: 'purchaseValue', label: 'Purchase Value', align: 'right', money: true },
  { key: 'grossProfit', label: 'Gross Profit', align: 'right', sortKey: 'profit', render: (v) => (
    <span className={`font-bold ${v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmt(v)}</span>
  ) },
  { key: 'margin', label: 'Margin %', align: 'right', sortKey: 'margin', render: (v) => (
    <span className={`font-bold ${v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{v}%</span>
  ) },
];

export default function ItemPerformance() {
  return (
    <InventoryListPage
      title="Item-wise Performance"
      subtitle="Sales, purchase, and gross-profit contribution per item (COGS at weighted-average cost)."
      icon={BarChart3}
      fetcher={getItemPerformanceList}
      columns={columns}
      defaultLimit={25}
      searchPlaceholder="Search item…"
      kpis={(meta) => {
        const s = meta?.summary || {};
        return [
          { label: 'Items Sold', value: s.totalItems ?? 0 },
          { label: 'Total Sales Value', value: fmt(s.totalSalesValue), tone: 'text-blue-600 dark:text-blue-400' },
          { label: 'Gross Profit', value: fmt(s.totalGrossProfit), tone: 'text-emerald-600 dark:text-emerald-400' },
        ];
      }}
    />
  );
}
