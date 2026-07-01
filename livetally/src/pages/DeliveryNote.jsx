import SalesRegisterReport from './SalesRegister/SalesRegisterReport';

// Delivery Note: dynamic, Tally-matched challan register served by the shared
// sales-side document engine (non-accounting; quantity-driven goods movement).
export default function DeliveryNote() {
  return <SalesRegisterReport report="delivery_note" />;
}
