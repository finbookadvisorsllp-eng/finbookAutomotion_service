import PurchaseRegisterReport from './PurchaseRegister/PurchaseRegisterReport';

// Debit Note: dynamic, Tally-matched register (purchase returns) served by the
// shared purchase-side document engine — full Gross/Net + grouping like Purchase.
export default function DebitNote() {
  return <PurchaseRegisterReport report="debit_note" />;
}
