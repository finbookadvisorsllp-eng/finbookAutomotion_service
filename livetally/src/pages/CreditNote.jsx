import SalesRegisterReport from './SalesRegister/SalesRegisterReport';

// Credit Note: dynamic, Tally-matched register (sales returns) served by the
// shared sales-side document engine — full Gross/Net + grouping like Sales.
export default function CreditNote() {
  return <SalesRegisterReport report="credit_note" />;
}
