export const cashBankDataV2 = {
  years: [
    { id: '2023-2024', label: '01/04/2023 - 31/03/2024' },
    { id: '2024-2025', label: '01/04/2024 - 31/03/2025' }
  ],
  dashboard: {
    '2024-2025': {
      summary: {
        cashInHand: 269660.00,
        bankBalance: 1875320.00,
        totalBalance: 2144980.00,
        todaysReceipts: 395000.00,
        todaysPayments: 220850.00,
        pendingCheques: 125000.00
      },
      cashAccounts: [
        { id: 'cash-in-hand', name: 'Cash In Hand', balance: 245680.00 },
        { id: 'petty-cash', name: 'Petty Cash', balance: 15230.00 },
        { id: 'office-cash', name: 'Office Cash', balance: 8750.00 }
      ],
      bankAccounts: [
        { id: 'hdfc-bank', name: 'HDFC Bank - 50200012345678', balance: 1245320.00 },
        { id: 'icici-bank', name: 'ICICI Bank - 000123456789', balance: 480000.00 },
        { id: 'sbi-bank', name: 'State Bank of India - 34785623910', balance: 150000.00 }
      ],
      recentTransactions: [
        { id: 'PAY-46', date: '07/04/2024', party: 'Global Suppliers', type: 'Payment', amount: 220000.00 },
        { id: 'RCPT-13', date: '08/04/2024', party: 'PQR Solutions', type: 'Receipt', amount: 245000.00 },
        { id: 'PAY-47', date: '10/04/2024', party: 'Bank Charges', type: 'Payment', amount: 850.00 },
        { id: 'RCPT-12', date: '06/04/2024', party: 'XYZ Enterprises', type: 'Receipt', amount: 150000.00 },
        { id: 'PAY-45', date: '05/04/2024', party: 'ABC Traders', type: 'Payment', amount: 75000.00 }
      ],
      allAccounts: [
        { id: 'cash-in-hand', name: 'Cash In Hand', type: 'Cash', opening: 195420.00, receipts: 2245210.00, payments: 2194950.00, closing: 245680.00 },
        { id: 'petty-cash', name: 'Petty Cash', type: 'Cash', opening: 10000.00, receipts: 215600.00, payments: 210370.00, closing: 15230.00 },
        { id: 'office-cash', name: 'Office Cash', type: 'Cash', opening: 5000.00, receipts: 125000.00, payments: 121250.00, closing: 8750.00 },
        { id: 'hdfc-bank', name: 'HDFC Bank - 50200012345678', type: 'Bank', opening: 500000.00, receipts: 7520350.00, payments: 6775030.00, closing: 1245320.00 },
        { id: 'icici-bank', name: 'ICICI Bank - 000123456789', type: 'Bank', opening: 200000.00, receipts: 4500000.00, payments: 4220000.00, closing: 480000.00 },
        { id: 'sbi-bank', name: 'State Bank of India - 34785623910', type: 'Bank', opening: 50000.00, receipts: 1800000.00, payments: 1700000.00, closing: 150000.00 }
      ]
    }
  },
  ledgers: {
    'hdfc-bank': {
      id: 'hdfc-bank',
      name: 'HDFC Bank - 50200012345678',
      type: 'Bank Account',
      openingBalance: 500000.00,
      currentBalance: 1245320.00,
      transactions: [
        { id: 'PAY-45', date: '05/04/2024', party: 'ABC Traders', type: 'Payment', no: 'PAY-45', ref: 'NEFT000123', receipts: 0, payments: 75000.00, running: 425000.00 },
        { id: 'RCPT-12', date: '06/04/2024', party: 'XYZ Enterprises', type: 'Receipt', no: 'RCPT-12', ref: 'NEFT000456', receipts: 150000.00, payments: 0, running: 575000.00 },
        { id: 'PAY-46', date: '07/04/2024', party: 'Global Suppliers', type: 'Payment', no: 'PAY-46', ref: 'CHEQ000789', receipts: 0, payments: 220000.00, running: 355000.00 },
        { id: 'RCPT-13', date: '08/04/2024', party: 'PQR Solutions', type: 'Receipt', no: 'RCPT-13', ref: 'NEFT000987', receipts: 245000.00, payments: 0, running: 600000.00 },
        { id: 'PAY-47', date: '10/04/2024', party: 'Bank Charges', type: 'Payment', no: 'PAY-47', ref: '-', receipts: 0, payments: 850.00, running: 599150.00 }
      ],
      monthly: [
        { month: 'April', opening: 500000.00, receipts: 395000.00, payments: 295850.00, closing: 599150.00 },
        { month: 'May', opening: 599150.00, receipts: 1200000.00, payments: 800000.00, closing: 999150.00 },
        { month: 'June', opening: 999150.00, receipts: 800000.00, payments: 553830.00, closing: 1245320.00 }
      ]
    },
    'cash-in-hand': {
      id: 'cash-in-hand',
      name: 'Cash In Hand',
      type: 'Cash Account',
      openingBalance: 195420.00,
      currentBalance: 245680.00,
      transactions: [
        { id: 'RCPT-14', date: '01/04/2024', party: 'Cash Sales', type: 'Receipt', no: 'RCPT-14', ref: '-', receipts: 50260.00, payments: 0, running: 245680.00 }
      ],
      monthly: [
        { month: 'April', opening: 195420.00, receipts: 50260.00, payments: 0, closing: 245680.00 }
      ]
    }
  },
  vouchers: {
    'PAY-45': {
      id: 'PAY-45',
      type: 'Payment',
      date: '05/04/2024',
      createdBy: 'Admin',
      modifiedBy: 'System',
      party: {
        name: 'ABC Traders',
        gst: '27AADCB2230M1Z2',
        mobile: '+91 9876543210',
        email: 'accounts@abctraders.com'
      },
      details: {
        receiptAmount: 0,
        paymentAmount: 75000.00,
        mode: 'Bank Transfer'
      },
      entries: [
        { account: 'ABC Traders A/c', type: 'Dr', amount: 75000.00 },
        { account: 'HDFC Bank A/c', type: 'Cr', amount: 75000.00 }
      ],
      narration: 'Being payment made to ABC Traders via NEFT against invoice #INV-2024-001.'
    },
    'RCPT-12': {
      id: 'RCPT-12',
      type: 'Receipt',
      date: '06/04/2024',
      createdBy: 'Accountant',
      modifiedBy: '-',
      party: {
        name: 'XYZ Enterprises',
        gst: '29ABCDE1234F2Z5',
        mobile: '+91 8765432109',
        email: 'finance@xyzenterprises.in'
      },
      details: {
        receiptAmount: 150000.00,
        paymentAmount: 0,
        mode: 'Bank Transfer'
      },
      entries: [
        { account: 'HDFC Bank A/c', type: 'Dr', amount: 150000.00 },
        { account: 'XYZ Enterprises A/c', type: 'Cr', amount: 150000.00 }
      ],
      narration: 'Being amount received from XYZ Enterprises against bill no #SALES-101.'
    },
    'PAY-46': {
      id: 'PAY-46',
      type: 'Payment',
      date: '07/04/2024',
      createdBy: 'Admin',
      modifiedBy: '-',
      party: {
        name: 'Global Suppliers',
        gst: '07BBPGG1234H1Z8',
        mobile: '+91 7654321098',
        email: 'billing@globalsuppliers.com'
      },
      details: {
        receiptAmount: 0,
        paymentAmount: 220000.00,
        mode: 'Cheque'
      },
      entries: [
        { account: 'Global Suppliers A/c', type: 'Dr', amount: 220000.00 },
        { account: 'HDFC Bank A/c', type: 'Cr', amount: 220000.00 }
      ],
      narration: 'Being payment made via Cheque No 000789 for material supply.'
    },
    'RCPT-13': {
      id: 'RCPT-13',
      type: 'Receipt',
      date: '08/04/2024',
      createdBy: 'Admin',
      modifiedBy: '-',
      party: {
        name: 'PQR Solutions',
        gst: '33AABCP1234D1Z2',
        mobile: '+91 9988776655',
        email: 'info@pqrsolutions.com'
      },
      details: {
        receiptAmount: 245000.00,
        paymentAmount: 0,
        mode: 'Bank Transfer'
      },
      entries: [
        { account: 'HDFC Bank A/c', type: 'Dr', amount: 245000.00 },
        { account: 'PQR Solutions A/c', type: 'Cr', amount: 245000.00 }
      ],
      narration: 'Being receipt from PQR Solutions for software implementation.'
    },
    'PAY-47': {
      id: 'PAY-47',
      type: 'Payment',
      date: '10/04/2024',
      createdBy: 'System',
      modifiedBy: '-',
      party: {
        name: 'Bank Charges',
        gst: '-',
        mobile: '-',
        email: '-'
      },
      details: {
        receiptAmount: 0,
        paymentAmount: 850.00,
        mode: 'Direct Debit'
      },
      entries: [
        { account: 'Bank Charges A/c', type: 'Dr', amount: 850.00 },
        { account: 'HDFC Bank A/c', type: 'Cr', amount: 850.00 }
      ],
      narration: 'Being quarterly bank maintenance charges debited.'
    }
  }
};
