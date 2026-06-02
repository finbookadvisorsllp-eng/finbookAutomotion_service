export const plDrillDownData = {
  years: [
    {
      id: '2023-2024',
      label: '01/04/2023 - 31/03/2024',
      isProfit: false,
      summary: {
        revenue: 3543977.97,
        gross: 885347.39,
        net: 977503.99,
      },
      particulars: [
        { id: 'sales-accounts', name: 'Sales Accounts', sign: '+', amount: 3543977.97, ledgers: [
          { id: 'gst-sales-12', name: 'GST Sales 12%', debit: 0, credit: 3500000.97 },
          { id: 'gst-sales-18', name: 'GST Sales 18%', debit: 0, credit: 43977.00 },
          { id: 'igst-sales-18', name: 'IGST Sales 18%', debit: 0, credit: 56936.00 }
        ]},
        { id: 'opening-stock', name: 'Opening Stock', sign: '-', amount: 6839263.71, ledgers: [
          { id: 'stock-hand', name: 'Stock in Hand', debit: 6839263.71, credit: 0 }
        ]},
        { id: 'purchase-accounts', name: 'Purchase Accounts', sign: '-', amount: 1698249.60, ledgers: [
          { id: 'gst-inward-service-18', name: 'GST Inward Service 18%', debit: 265229.00, credit: 0 },
          { id: 'gst-purchase-12', name: 'GST Purchase 12%', debit: 1118186.60, credit: 0 },
          { id: 'gst-purchase-18', name: 'GST Purchase 18%', debit: 187966.00, credit: 0 },
          { id: 'gst-service-12', name: 'Gst Service @ 12%', debit: 14168.00, credit: 0 },
          { id: 'purchase', name: 'Purchase', debit: 112700.00, credit: 0 }
        ]},
        { id: 'closing-stock', name: 'Less: Closing Stock', sign: '+', amount: 2457200.75, ledgers: [
          { id: 'stock-hand-closing', name: 'Closing Stock', debit: 2457200.75, credit: 0 }
        ]},
        { id: 'direct-expenses', name: 'Direct Expenses', sign: '-', amount: 349012.80, ledgers: [
          { id: 'electricity', name: 'Electricity', debit: 349012.80, credit: 0 }
        ]},
        { id: 'indirect-incomes', name: 'Indirect Incomes', sign: '+', amount: 0, ledgers: []},
        { id: 'indirect-expenses', name: 'Indirect Expenses', sign: '-', amount: 92156.60, ledgers: [
          { id: 'audit-fees', name: 'Audit Fees', debit: 30000.00, credit: 0 },
          { id: 'bank-charges', name: 'Bank Charges', debit: 92156.60, credit: 0 }
        ]}
      ]
    },
    {
      id: '2024-2025',
      label: '01/04/2024 - 31/03/2025',
      isProfit: true,
      summary: {
        revenue: 15622762.35,
        gross: 1959906.00,
        net: 223620.24,
      },
      particulars: [
        { id: 'sales-accounts', name: 'Sales Accounts', sign: '+', amount: 15622762.35, ledgers: [
          { id: 'gst-sales-12', name: 'GST Sales 12%', debit: 0, credit: 11500000.00 },
          { id: 'gst-sales-18', name: 'GST Sales 18%', debit: 0, credit: 4122762.35 },
          { id: 'sales', name: 'Sales', debit: 0, credit: 312.00 }
        ]},
        { id: 'opening-stock', name: 'Opening Stock', sign: '-', amount: 5530690.11, ledgers: [
          { id: 'stock-hand', name: 'Stock in Hand', debit: 5530690.11, credit: 0 }
        ]},
        { id: 'purchase-accounts', name: 'Purchase Accounts', sign: '-', amount: 12966670.35, ledgers: [
          { id: 'purchase-12', name: 'GST Purchase 12%', debit: 12966670.35, credit: 0 }
        ]},
        { id: 'closing-stock', name: 'Less: Closing Stock', sign: '+', amount: 6839263.71, ledgers: [
          { id: 'stock-hand-closing', name: 'Closing Stock', debit: 6839263.71, credit: 0 }
        ]},
        { id: 'direct-expenses', name: 'Direct Expenses', sign: '-', amount: 2004759.60, ledgers: [
          { id: 'electricity', name: 'Electricity', debit: 2004759.60, credit: 0 }
        ]},
        { id: 'indirect-incomes', name: 'Indirect Incomes', sign: '+', amount: 3362.00, ledgers: [
          { id: 'discount-rx', name: 'Discount Received', debit: 0, credit: 3362.00 }
        ]},
        { id: 'indirect-expenses', name: 'Indirect Expenses', sign: '-', amount: 1739647.76, ledgers: [
          { id: 'salary-wages', name: 'Salary & Wages', debit: 1739647.76, credit: 0 }
        ]}
      ]
    },
    {
      id: '2025-2026',
      label: '01/04/2025 - 31/03/2026',
      isProfit: false,
      summary: {
        revenue: 4543977.97,
        gross: 1885347.39,
        net: 1977503.99,
      },
      particulars: [
        { id: 'sales-accounts', name: 'Sales Accounts', sign: '+', amount: 4543977.97, ledgers: [
          { id: 'gst-sales-12', name: 'GST Sales 12%', debit: 0, credit: 4590538.97 },
          { id: 'gst-sales-18', name: 'GST Sales 18%', debit: 0, credit: 11032.00 },
          { id: 'sales', name: 'Sales', debit: 0, credit: 642.00 },
          { id: 'gst-sales-return-18', name: 'GST Sales Return 18%', debit: 58235.00, credit: 0 },
          { id: 'igst-sales-18', name: 'IGST Sales 18%', debit: 0, credit: 125430.00 }
        ]},
        { id: 'opening-stock', name: 'Opening Stock', sign: '-', amount: 6839263.71, ledgers: [
          { id: 'stock-hand', name: 'Stock in Hand', debit: 6839263.71, credit: 0 }
        ]},
        { id: 'purchase-accounts', name: 'Purchase Accounts', sign: '-', amount: 1698249.60, ledgers: [
          { id: 'gst-inward-service-18', name: 'GST Inward Service 18%', debit: 265229.00, credit: 0 },
          { id: 'gst-purchase-12', name: 'GST Purchase 12%', debit: 1118186.60, credit: 0 },
          { id: 'gst-purchase-18', name: 'GST Purchase 18%', debit: 187966.00, credit: 0 },
          { id: 'gst-service-12', name: 'Gst Service @ 12%', debit: 14168.00, credit: 0 },
          { id: 'purchase', name: 'Purchase', debit: 112700.00, credit: 0 }
        ]},
        { id: 'closing-stock', name: 'Less: Closing Stock', sign: '+', amount: 2457200.75, ledgers: [
          { id: 'stock-hand-closing', name: 'Closing Stock', debit: 2457200.75, credit: 0 }
        ]},
        { id: 'direct-expenses', name: 'Direct Expenses', sign: '-', amount: 349012.80, ledgers: [
          { id: 'electricity', name: 'Electricity', debit: 349012.80, credit: 0 }
        ]},
        { id: 'indirect-incomes', name: 'Indirect Incomes', sign: '+', amount: 0, ledgers: []},
        { id: 'indirect-expenses', name: 'Indirect Expenses', sign: '-', amount: 92156.60, ledgers: [
          { id: 'bank-charges', name: 'Bank Charges', debit: 92156.60, credit: 0 }
        ]}
      ]
    }
  ],

  vouchers: {
    'gst-sales-12': [
      { id: '1/2023-24', yearId: '2023-2024', date: '01 Apr 2023', type: 'Sales', refNo: '', amount: 14500.00, partyName: 'Shri M D Traders' },
      { id: 'FG-01/2025-26', yearId: '2025-2026', date: '01 Apr 2025', type: 'Sales', refNo: '', amount: 24633.00, partyName: 'Priya Enterprises' },
    ],
    'gst-sales-18': [
      { id: '16/2023-24', yearId: '2023-2024', date: '13 Apr 2023', type: 'Sales', refNo: '', amount: 56936.00, partyName: 'Navjeet India Limited' },
      { id: 'FG-201/2025-26', yearId: '2025-2026', date: '18 Jul 2025', type: 'Sales', refNo: 'PO-1001', amount: 11032.00, partyName: 'Apex Industries' },
    ],
    'igst-sales-18': [
      { id: '16/2023-24-IGST', yearId: '2023-2024', date: '13 Apr 2023', type: 'Sales', refNo: '', amount: 56936.00, partyName: 'Navjeet India Limited' },
      { id: 'FG-300/2025-26', yearId: '2025-2026', date: '10 Jun 2025', type: 'Sales', refNo: 'PO-200', amount: 125430.00, partyName: 'Interstate Traders' }
    ],
    'sales': [
      { id: 'FG-594/2024-25', yearId: '2024-2025', date: '31 Mar 2025', type: 'Sales', refNo: '', amount: 312.00, partyName: 'NandiniTest' }
    ],
    'gst-sales-return-18': [
      { id: 'CN-12/2025-26', yearId: '2025-2026', date: '05 May 2025', type: 'Credit Note', refNo: 'INV-120', amount: 58235.00, partyName: 'Global Corp' }
    ],
    'gst-inward-service-18': [
      { id: '501501', yearId: '2025-2026', date: '01 Apr 2025', type: 'Purchase', refNo: '', amount: 39382.00, partyName: 'Dummy Supplier' },
      { id: '90', yearId: '2025-2026', date: '28 Apr 2025', type: 'Purchase', refNo: '', amount: 33180.00, partyName: 'Dummy Supplier' },
      { id: '93', yearId: '2025-2026', date: '30 Apr 2025', type: 'Purchase', refNo: '', amount: 33700.00, partyName: 'Dummy Supplier' },
      { id: '95', yearId: '2025-2026', date: '30 Apr 2025', type: 'Purchase', refNo: '', amount: 1740.00, partyName: 'Dummy Supplier' },
      { id: '4', yearId: '2025-2026', date: '02 May 2025', type: 'Purchase', refNo: '', amount: 12320.00, partyName: 'Dummy Supplier' },
      { id: '531', yearId: '2025-2026', date: '07 May 2025', type: 'Purchase', refNo: '', amount: 32800.00, partyName: 'Dummy Supplier' },
      { id: '543', yearId: '2025-2026', date: '19 May 2025', type: 'Purchase', refNo: '', amount: 23756.00, partyName: 'Dummy Supplier' },
      { id: '546', yearId: '2025-2026', date: '21 May 2025', type: 'Purchase', refNo: '', amount: 28448.00, partyName: 'Dummy Supplier' },
      { id: '7', yearId: '2025-2026', date: '28 May 2025', type: 'Purchase', refNo: '', amount: 2000.00, partyName: 'Dummy Supplier' },
      { id: '8', yearId: '2025-2026', date: '28 May 2025', type: 'Purchase', refNo: '', amount: 10000.00, partyName: 'Dummy Supplier' }
    ],
    'electricity': [
      { id: '17', yearId: '2024-2025', date: '19 Apr 2024', type: 'Payment', refNo: '', amount: 52906.80 },
      { id: '93', yearId: '2024-2025', date: '30 Apr 2024', type: 'Journal', refNo: '', amount: 10581.00 },
      { id: '40', yearId: '2024-2025', date: '20 May 2024', type: 'Payment', refNo: '', amount: 51762.80 },
      { id: '100', yearId: '2024-2025', date: '31 May 2024', type: 'Journal', refNo: '', amount: 10353.00 },
      { id: '72', yearId: '2024-2025', date: '20 Jun 2024', type: 'Payment', refNo: '', amount: 53926.80 },
      { id: '101', yearId: '2024-2025', date: '30 Jun 2024', type: 'Journal', refNo: '', amount: 10785.00 },
      { id: '104', yearId: '2024-2025', date: '17 Jul 2024', type: 'Payment', refNo: '', amount: 65623.80 },
      { id: '102', yearId: '2024-2025', date: '31 Jul 2024', type: 'Journal', refNo: '', amount: 13125.00 },
      { id: '133', yearId: '2024-2025', date: '21 Aug 2024', type: 'Payment', refNo: '', amount: 70348.80 },
      { id: '103', yearId: '2024-2025', date: '31 Aug 2024', type: 'Journal', refNo: '', amount: 14070.00 },
    ],
    'discount-rx': [
      { id: '15', yearId: '2024-2025', date: '11 May 2024', type: 'Journal', refNo: '', amount: 3362.00 }
    ],
    'audit-fees': [
      { id: '65', yearId: '2023-2024', date: '31 Mar 2024', type: 'Journal', refNo: '', amount: 15000.00 }
    ]
  },

  voucherDetails: {
    '65': {
      voucherNo: '65',
      date: '31 Mar 2024',
      type: 'Journal',
      partyName: 'Audit Fees',
      entries: [
        { srNo: 1, partyName: 'Audit Fees', amount: 15000.00, isDr: true },
        { srNo: 2, partyName: 'Audit Fees Payable', amount: 15000.00, isDr: false }
      ],
      narration: ''
    },
    'FG-247/2024-25': {
      voucherNo: 'FG-247/2024-25',
      date: '03 Sep 2024',
      type: 'Sales',
      partyName: 'Nandji Industries',
      items: [
        { srNo: 1, name: '2 Ply Sheet 12%', hsn: '481910', qty: 5400.00, qtyUnit: 'PCS', rate: 3.00, rateUnit: 'PCS', grossRate: 3.36, grossRateUnit: 'PCS', discount: '0', amount: 16200.00 }
      ],
      narration: '3-Sep-24 13:14',
      taxes: {
        sgst: 972.00,
        cgst: 972.00,
        igst: 0,
        roundOff: 0
      },
      grossTotal: 18144.00
    },
    '17': {
      voucherNo: '17',
      date: '19 Apr 2024',
      type: 'Payment',
      partyName: 'AXIS BANK CC',
      bills: [
        { srNo: 1, partyName: 'AXIS BANK CC', amount: 52906.80 }
      ],
      paymentDetails: [
        { ledgerName: 'Electricity Expenses', amount: 52906.80 }
      ]
    },
    '15': {
      voucherNo: '15',
      date: '11 May 2024',
      type: 'Journal',
      partyName: 'Vindhya Papers',
      entries: [
        { srNo: 1, partyName: 'Vindhya Papers', amount: 3362.00, isDr: true },
        { srNo: 2, partyName: 'DISCOUNT REC.', amount: 3362.00, isDr: false }
      ],
      narration: '9-Jul-24 12:28'
    },
    'FG-01/2025-26': {
      voucherNo: 'FG-01/2025-26',
      date: '01 Apr 2025',
      type: 'Sales',
      partyName: 'Priya Enterprises',
      items: [
        { srNo: 1, name: 'Outer 5 Ply @ 12%', hsn: '481910', qty: 483, unit: 'PCS', rate: 51.00, grossRate: 57.12, discount: 0, amount: 24633.00 }
      ],
      taxes: {
        cgst: 1477.98,
        sgst: 1477.98,
        igst: 0,
      },
      totals: {
        grandTotal: 27589.00
      },
      narration: 'Being goods sold. Vehicle No: MH-04-AB-1234'
    },
    '1/2023-24': {
      voucherNo: '1/2023-24',
      date: '01 Apr 2023',
      type: 'Sales',
      partyName: 'Shri M D Traders',
      items: [
        { srNo: 1, name: 'Box 3 Ply', hsn: '481910', qty: 2500, unit: 'PCS', rate: 5.80, grossRate: 6.84, discount: 0, amount: 14500.00 }
      ],
      taxes: {
        sgst: 1305.00,
        cgst: 1305.00,
        igst: 0,
      },
      totals: {
        grandTotal: 17110.00
      },
      narration: '1-Jan-24 13:56'
    },
    '16/2023-24': {
      voucherNo: '16/2023-24',
      date: '13 Apr 2023',
      type: 'Sales',
      partyName: 'Navjeet India Limited',
      items: [
        { srNo: 1, name: 'Box 3 Ply', hsn: '481910', qty: 2588, unit: 'PCS', rate: 22.00, grossRate: 25.96, discount: 0, amount: 56936.00 }
      ],
      taxes: {
        sgst: 0,
        cgst: 0,
        igst: 10248.48,
        roundedOff: 0.48
      },
      totals: {
        grandTotal: 67184.00
      },
      narration: '30-Nov-23 11:47'
    },
    '16/2023-24-IGST': {
      voucherNo: '16/2023-24',
      date: '13 Apr 2023',
      type: 'Sales',
      partyName: 'Navjeet India Limited',
      items: [
        { srNo: 1, name: 'Box 3 Ply', hsn: '481910', qty: 2588, unit: 'PCS', rate: 22.00, grossRate: 25.96, discount: 0, amount: 56936.00 }
      ],
      taxes: {
        sgst: 0,
        cgst: 0,
        igst: 10248.48,
        roundedOff: 0.48
      },
      totals: {
        grandTotal: 67184.00
      },
      narration: '30-Nov-23 11:47'
    },
    'FG-594/2024-25': {
      voucherNo: 'FG-594/2024-25',
      date: '31 Mar 2025',
      type: 'Sales',
      partyName: 'NandiniTest',
      items: [
        { srNo: 1, name: 'Acrylic Co-Polymer', hsn: '', qty: 10, unit: 'Kgs.', rate: 30.00, grossRate: 35.40, discount: 0, amount: 300.00 },
        { srNo: 2, name: '21" Craft Paper 100gsm 14BF', hsn: '', qty: 12, unit: 'Kgs.', rate: 1.00, grossRate: 1.00, discount: 0, amount: 12.00 }
      ],
      taxes: {
      },
      totals: {
        grandTotal: 312.00
      },
      narration: 'nandini test v1'
    },
    'FG-201/2025-26': {
      voucherNo: 'FG-201/2025-26',
      date: '18 Jul 2025',
      type: 'Sales',
      partyName: 'Apex Industries',
      items: [
        { srNo: 1, name: 'Generic Item', hsn: '123456', qty: 100, unit: 'PCS', rate: 110.32, grossRate: 110.32, discount: 0, amount: 11032.00 }
      ],
      taxes: {},
      totals: { grandTotal: 11032.00 },
      narration: 'PO-1001 fulfillment'
    },
    'FG-300/2025-26': {
      voucherNo: 'FG-300/2025-26',
      date: '10 Jun 2025',
      type: 'Sales',
      partyName: 'Interstate Traders',
      items: [
        { srNo: 1, name: 'Bulk Materials', hsn: '998877', qty: 50, unit: 'TON', rate: 2508.60, grossRate: 2508.60, discount: 0, amount: 125430.00 }
      ],
      taxes: {},
      totals: { grandTotal: 125430.00 },
      narration: 'PO-200'
    },
    'CN-12/2025-26': {
      voucherNo: 'CN-12/2025-26',
      date: '05 May 2025',
      type: 'Credit Note',
      partyName: 'Global Corp',
      items: [
        { srNo: 1, name: 'Returned Goods', hsn: '112233', qty: 10, unit: 'PCS', rate: 5823.50, grossRate: 5823.50, discount: 0, amount: 58235.00 }
      ],
      taxes: {},
      totals: { grandTotal: 58235.00 },
      narration: 'Return against INV-120'
    },
    '501501': {
      voucherNo: '501501',
      date: '01 Apr 2025',
      type: 'Purchase',
      partyName: 'Harsh Trading',
      items: [
        { srNo: 1, name: 'Printing Job Work @18', hsn: '9989', qty: 0, unit: '', rate: '', grossRate: '48470.76/', discount: 0, amount: 39382.00 }
      ],
      taxes: {
        sgst: 3544.38,
        cgst: 3544.38,
        roundedOff: 0.24
      },
      totals: { grandTotal: 46471.00 },
      narration: ''
    }
  },

  stockItems: {
    'stock-hand-closing': [
      { id: 1, name: '2 Ply Sheet 12%', qty: -11932, rate: 28.97, value: 345675.05 },
      { id: 2, name: '2 Ply Sheets', qty: 422, rate: 5.19, value: 2189.75 },
      { id: 3, name: '21" Craft Paper 100gsm 14BF', qty: -12, rate: 0, value: 0 },
      { id: 4, name: '22" Craft Paer 100gsm 16BF', qty: 0, rate: 0, value: 0 },
      { id: 5, name: '22" Craft Paper 120gsm 16BF', qty: 0, rate: 0, value: 0 },
      { id: 6, name: '23" Craft Paper 100gsm 14BF', qty: 0, rate: 0, value: 0 },
      { id: 7, name: '23" Craft Paper 100gsm 16BF', qty: 0, rate: 0, value: 0 },
      { id: 8, name: '24" Craft Papaer 120 Gsm 16 BF', qty: 0, rate: 0, value: 0 },
      { id: 9, name: '24" Craft Paper 100 Gsm 16 BF', qty: 0, rate: 0, value: 0 },
      { id: 10, name: '26" Craft Paper 100 Gsm 16 BF', qty: 0, rate: 0, value: 0 }
    ]
  },

  stockItemLedger: {
    '1': {
      name: '2 Ply Sheet 12%',
      amount: '-3,45,964.64',
      hsn: '481910',
      closingStock: '-11942.00 PCS',
      avgPurRate: '28.97',
      gstRate: '18 %',
      vouchers: [
        { date: '03 Sep 2024', ledgerName: 'Nandji Industries', type: 'Sales', vchNo: 'FG-247/2024-25', amount: 16200.00 },
        { date: '03 Sep 2024', ledgerName: '', type: 'Stock Journal', vchNo: '42', amount: 57000.00 },
        { date: '13 Sep 2024', ledgerName: 'Nandji Industries', type: 'Sales', vchNo: 'FG-260/2024-25', amount: 17556.00 },
        { date: '28 Sep 2024', ledgerName: 'Nandji Industries', type: 'Sales', vchNo: 'FG-274/2024-25', amount: 18000.00 },
        { date: '03 Nov 2024', ledgerName: '', type: 'Stock Journal', vchNo: '43', amount: 21000.00 },
        { date: '11 Nov 2024', ledgerName: 'Nandji Industries', type: 'Sales', vchNo: 'FG-324/2024-25', amount: 18000.00 },
        { date: '04 Jan 2025', ledgerName: '', type: 'Stock Journal', vchNo: '44', amount: 30000.00 },
        { date: '10 Jan 2025', ledgerName: 'Nandji Industries', type: 'Sales', vchNo: 'FG-438/2024-25', amount: 3810.00 },
        { date: '24 Jan 2025', ledgerName: 'Nandji Industries', type: 'Sales', vchNo: 'FG-465/2024-25', amount: 8190.00 },
        { date: '17 Feb 2025', ledgerName: 'Nandji Industries', type: 'Sales', vchNo: 'FG-517/2024-25', amount: 28275.00 },
      ],
      customers: [
        { id: 'c1', name: 'Nandji Industries', lastSold: '03 Sep 2024', totalQty: '41772.00', rate: '3.00/PCS' }
      ],
      suppliers: []
    }
  },

  stockItemCustomerLedger: {
    'c1': {
      name: 'Nandji Industries',
      vouchers: [
        { vchNo: 'FG-247/2024-25', date: '03 Sep 2024', type: 'Sales', amount: -18144.00 },
        { vchNo: 'FG-260/2024-25', date: '13 Sep 2024', type: 'Sales', amount: -19663.00 },
        { vchNo: 'FG-274/2024-25', date: '28 Sep 2024', type: 'Sales', amount: -20160.00 },
        { vchNo: 'FG-324/2024-25', date: '11 Nov 2024', type: 'Sales', amount: -20160.00 },
        { vchNo: 'FG-438/2024-25', date: '10 Jan 2025', type: 'Sales', amount: -4267.00 },
        { vchNo: 'FG-465/2024-25', date: '24 Jan 2025', type: 'Sales', amount: -9173.00 },
        { vchNo: 'FG-517/2024-25', date: '17 Feb 2025', type: 'Sales', amount: -31668.00 },
        { vchNo: 'FG-590/2024-25', date: '29 Mar 2025', type: 'Sales', amount: -21949.00 },
      ]
    }
  }
};
