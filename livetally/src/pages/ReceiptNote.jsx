import PurchaseRegisterReport from './PurchaseRegister/PurchaseRegisterReport';

// Receipt Note: dynamic, Tally-matched receipt register served by the shared
// purchase-side document engine (Receipt Note is a non-accounting receipt voucher).
export default function ReceiptNote() {
  return <PurchaseRegisterReport report="receipt_note" />;
}
