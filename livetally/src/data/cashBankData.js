export const cashBankData = {
  years: [
    {
      id: '2023-2024',
      label: '01/04/2023 - 31/03/2024',
    },
    {
      id: '2024-2025',
      label: '01/04/2024 - 31/03/2025',
    },
    {
      id: '2025-2026',
      label: '01/04/2025 - 31/03/2026',
    }
  ],

  data: {
    '2023-2024': {
      cash: {
        totalOpening: 120500.00,
        totalDebit: 450000.00,
        totalCredit: 380500.00,
        totalClosing: 190000.00,
        accounts: [
          { id: 'main-cash', name: 'Main Cash', opening: 110000.00, debit: 420000.00, credit: 350000.00, closing: 180000.00, isDrillable: true },
          { id: 'petty-cash', name: 'Petty Cash', opening: 10500.00, debit: 30000.00, credit: 30500.00, closing: 10000.00, isDrillable: true }
        ]
      },
      bank: {
        totalOpening: 2500000.00,
        totalDebit: 15400000.00,
        totalCredit: 12100000.00,
        totalClosing: 5800000.00,
        accounts: [
          { id: 'hdfc-bank', name: 'HDFC Bank C/A', opening: 1200000.00, debit: 8000000.00, credit: 6000000.00, closing: 3200000.00, isDrillable: true },
          { id: 'sbi-bank', name: 'SBI Current A/c', opening: 800000.00, debit: 5000000.00, credit: 4100000.00, closing: 1700000.00, isDrillable: true },
          { id: 'icici-bank', name: 'ICICI Bank CC', opening: 500000.00, debit: 2400000.00, credit: 2000000.00, closing: 900000.00, isDrillable: true }
        ]
      }
    },
    '2024-2025': {
      cash: {
        totalOpening: 190000.00,
        totalDebit: 600000.00,
        totalCredit: 550000.00,
        totalClosing: 240000.00,
        accounts: [
          { id: 'main-cash', name: 'Main Cash', opening: 180000.00, debit: 550000.00, credit: 500000.00, closing: 230000.00, isDrillable: true },
          { id: 'petty-cash', name: 'Petty Cash', opening: 10000.00, debit: 50000.00, credit: 50000.00, closing: 10000.00, isDrillable: true }
        ]
      },
      bank: {
        totalOpening: 5800000.00,
        totalDebit: 22500000.00,
        totalCredit: 20000000.00,
        totalClosing: 8300000.00,
        accounts: [
          { id: 'hdfc-bank', name: 'HDFC Bank C/A', opening: 3200000.00, debit: 12000000.00, credit: 10500000.00, closing: 4700000.00, isDrillable: true },
          { id: 'sbi-bank', name: 'SBI Current A/c', opening: 1700000.00, debit: 7500000.00, credit: 6500000.00, closing: 2700000.00, isDrillable: true },
          { id: 'icici-bank', name: 'ICICI Bank CC', opening: 900000.00, debit: 3000000.00, credit: 3000000.00, closing: 900000.00, isDrillable: true }
        ]
      }
    },
    '2025-2026': {
      cash: {
        totalOpening: 240000.00,
        totalDebit: 750000.00,
        totalCredit: 700000.00,
        totalClosing: 290000.00,
        accounts: [
          { id: 'main-cash', name: 'Main Cash', opening: 230000.00, debit: 650000.00, credit: 600000.00, closing: 280000.00, isDrillable: true },
          { id: 'petty-cash', name: 'Petty Cash', opening: 10000.00, debit: 100000.00, credit: 100000.00, closing: 10000.00, isDrillable: true }
        ]
      },
      bank: {
        totalOpening: 8300000.00,
        totalDebit: 31000000.00,
        totalCredit: 27500000.00,
        totalClosing: 11800000.00,
        accounts: [
          { id: 'hdfc-bank', name: 'HDFC Bank C/A', opening: 4700000.00, debit: 18000000.00, credit: 15500000.00, closing: 7200000.00, isDrillable: true },
          { id: 'sbi-bank', name: 'SBI Current A/c', opening: 2700000.00, debit: 9000000.00, credit: 8000000.00, closing: 3700000.00, isDrillable: true },
          { id: 'icici-bank', name: 'ICICI Bank CC', opening: 900000.00, debit: 4000000.00, credit: 4000000.00, closing: 900000.00, isDrillable: true }
        ]
      }
    }
  }
};
