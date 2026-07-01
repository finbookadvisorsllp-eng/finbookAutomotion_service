import CashBankReport from './CashBank/CashBankReport';

// Cash & Bank: a single, fully dynamic, Tally-like drill-down report.
// All levels (summary → ledger → monthly → date-wise → voucher) are served by
// one engine and navigated in-place with URL-synced breadcrumbs.
export default function CashBankModule() {
  return <CashBankReport />;
}
