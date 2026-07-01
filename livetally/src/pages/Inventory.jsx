import StockSummaryReport from './Inventory/StockSummaryReport';

// Stock Summary: dynamic, Tally-matched inventory report with full drill-down
// (Stock Group → Item → Item Ledger → Voucher), valued per each item's costing
// method, fully company + financial-year aware.
export default function Inventory() {
  return <StockSummaryReport />;
}
