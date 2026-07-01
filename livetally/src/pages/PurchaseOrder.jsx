import PurchaseRegisterReport from './PurchaseRegister/PurchaseRegisterReport';

// Purchase Order: dynamic, Tally-matched order register served by the shared
// purchase-side document engine (Purchase Order is a non-accounting order voucher).
export default function PurchaseOrder() {
  return <PurchaseRegisterReport report="purchase_order" />;
}
