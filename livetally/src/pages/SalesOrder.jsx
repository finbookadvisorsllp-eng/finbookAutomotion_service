import SalesRegisterReport from './SalesRegister/SalesRegisterReport';

// Sales Order: dynamic, Tally-matched order register served by the shared
// sales-side document engine (Sales Order is a non-accounting order voucher).
export default function SalesOrder() {
  return <SalesRegisterReport report="sales_order" />;
}
