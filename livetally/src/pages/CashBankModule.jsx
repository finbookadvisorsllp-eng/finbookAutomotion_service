import React from 'react';
import { useSearchParams } from 'react-router-dom';

import CashBankDashboard from './CashBank/CashBankDashboard';
import LedgerDetail from './CashBank/LedgerDetail';
import VoucherDetail from './CashBank/VoucherDetail';

export default function CashBankModule() {
  const [searchParams] = useSearchParams();

  const ledgerId = searchParams.get('ledgerId');
  const voucherId = searchParams.get('voucherId');
  const yearId = searchParams.get('year') || '2024-2025';

  // Level 3: Voucher Detail
  if (voucherId) {
    return <VoucherDetail voucherId={voucherId} yearId={yearId} ledgerId={ledgerId} />;
  }

  // Level 2: Ledger Detail
  if (ledgerId) {
    return <LedgerDetail ledgerId={ledgerId} yearId={yearId} />;
  }

  // Level 1: Dashboard
  return <CashBankDashboard />;
}
