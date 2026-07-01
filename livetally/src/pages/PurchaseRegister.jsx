import PurchaseRegisterReport from './PurchaseRegister/PurchaseRegisterReport';

// Purchase Register: dynamic, Tally-matched register served by the shared
// purchase-side document engine — full Gross/Net + grouping like Sales Register.
export default function PurchaseRegister() {
  return <PurchaseRegisterReport report="purchase" />;
}
