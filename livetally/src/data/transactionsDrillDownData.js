export const drillDownData = {
  salesOrder: {
    total: 823036702.00,
    months: [
      { id: 'Mar 26', label: 'Mar 26', amount: 59957980.00 },
      { id: 'Feb 26', label: 'Feb 26', amount: 50003506.00 },
      { id: 'Jan 26', label: 'Jan 26', amount: 59092466.00 },
      { id: 'Dec 25', label: 'Dec 25', amount: 76999792.00 },
      { id: 'Nov 25', label: 'Nov 25', amount: 86482902.00 },
      { id: 'Oct 25', label: 'Oct 25', amount: 79049502.00 },
      { id: 'Sep 25', label: 'Sep 25', amount: 55202240.00 },
      { id: 'Aug 25', label: 'Aug 25', amount: 53307730.00 },
      { id: 'Jul 25', label: 'Jul 25', amount: 55140070.00 },
      { id: 'Jun 25', label: 'Jun 25', amount: 80042956.00 },
    ],
    vouchers: {
      'Mar 26': [
        { id: 'ADL/25-26/2652', date: '31 Mar 2026', name: 'Akola Electronics', type: 'Sales B2B Credit', amount: 393884.00 },
        { id: 'ADL/25-26/2651', date: '31 Mar 2026', name: 'Neemuch Electronics', type: 'Sales B2B Credit', amount: 179478.00 },
        { id: 'ADL/25-26/2650', date: '31 Mar 2026', name: 'Pali Trading House', type: 'Sales B2B Credit', amount: 261370.00 },
        { id: 'ADL/25-26/2649', date: '31 Mar 2026', name: 'Deccan Electronics', type: 'Sales B2B Credit', amount: 111392.00 },
        { id: 'ADL/25-26/2648', date: '31 Mar 2026', name: 'Pune Appliances', type: 'Sales B2B Credit', amount: 244260.00 },
        { id: 'ADL/25-26/2647', date: '31 Mar 2026', name: 'Jaipur Electronics Pvt Ltd', type: 'Sales B2B Credit', amount: 224654.00 },
        { id: 'ADL/25-26/2646', date: '31 Mar 2026', name: 'Ratlam Electronics', type: 'Sales B2B Credit', amount: 123370.00 },
        { id: 'ADL/CS/25-26/264', date: '30 Mar 2026', name: 'Cash in Hand', type: 'Cash Sales Retail', amount: 120714.00 },
        { id: 'ADL/25-26/2645', date: '30 Mar 2026', name: 'Narmada River Traders', type: 'Sales B2B Credit', amount: 486986.00 },
        { id: 'ADL/25-26/2644', date: '29 Mar 2026', name: 'Orange City Electronics', type: 'Sales B2B Credit', amount: 260742.00 },
      ]
    },
    voucherDetails: {
      'ADL/25-26/2652': {
        voucherNo: 'ADL/25-26/2652',
        partyName: 'Akola Electronics',
        date: '31 Mar 2026',
        type: 'Sales B2B Credit',
        items: [
          { srNo: 1, name: 'Samsung 1.5T 5 Star Inverter Split AC', hsn: '8415', qty: 2, unit: 'Pcs', rate: 44900.00, grossRate: 52982.00, discount: 0, amount: 89800.00 },
          { srNo: 2, name: 'Lloyd 1.5T 5 Star Inverter Split AC', hsn: '8415', qty: 4, unit: 'Pcs', rate: 40100.00, grossRate: 47318.00, discount: 0, amount: 160400.00 },
          { srNo: 3, name: 'Haier 220L Single Door Refrigerator', hsn: '8418', qty: 2, unit: 'Pcs', rate: 19300.00, grossRate: 22774.00, discount: 0, amount: 38600.00 },
          { srNo: 4, name: 'Godrej 6 kg Chest Freezer', hsn: '8418', qty: 2, unit: 'Pcs', rate: 22500.00, grossRate: 26550.00, discount: 0, amount: 45000.00 },
        ],
        summary: [
          { name: 'Sales - Out of State', amount: 333800.00 },
          { name: 'GST Output (IGST)', amount: 60084.00 },
        ],
        grossTotal: 393884.00
      }
    }
  },
  creditNote: {
    total: 1250450.00,
    months: [
      { id: 'Mar 26', label: 'Mar 26', amount: 450000.00 },
      { id: 'Feb 26', label: 'Feb 26', amount: 320450.00 },
      { id: 'Jan 26', label: 'Jan 26', amount: 480000.00 },
    ],
    vouchers: {
      'Mar 26': [
        { id: 'CN/25-26/101', date: '15 Mar 2026', name: 'Akola Electronics', type: 'Credit Note', amount: 25000.00 },
        { id: 'CN/25-26/102', date: '20 Mar 2026', name: 'Deccan Electronics', type: 'Credit Note', amount: 15000.00 },
      ]
    },
    voucherDetails: {
      'CN/25-26/101': {
        voucherNo: 'CN/25-26/101',
        partyName: 'Akola Electronics',
        date: '15 Mar 2026',
        type: 'Credit Note',
        items: [
          { srNo: 1, name: 'Samsung 1.5T 5 Star Inverter Split AC', hsn: '8415', qty: 1, unit: 'Pcs', rate: 44900.00, grossRate: 52982.00, discount: 0, amount: 44900.00 },
        ],
        summary: [
          { name: 'Sales Return', amount: 44900.00 },
        ],
        grossTotal: 44900.00
      }
    }
  },
  deliveryNote: {
    total: 5500000.00,
    months: [
      { id: 'Mar 26', label: 'Mar 26', amount: 2500000.00 },
      { id: 'Feb 26', label: 'Feb 26', amount: 1500000.00 },
      { id: 'Jan 26', label: 'Jan 26', amount: 1500000.00 },
    ],
    vouchers: {
      'Mar 26': [
        { id: 'DN/25-26/501', date: '10 Mar 2026', name: 'Pune Appliances', type: 'Delivery Note', amount: 500000.00, vehicle: 'MH-12-AB-1234' },
      ]
    },
    voucherDetails: {
      'DN/25-26/501': {
        voucherNo: 'DN/25-26/501',
        partyName: 'Pune Appliances',
        date: '10 Mar 2026',
        type: 'Delivery Note',
        vehicle: 'MH-12-AB-1234',
        items: [
          { srNo: 1, name: 'Godrej 6 kg Chest Freezer', hsn: '8418', qty: 10, unit: 'Pcs', rate: 22500.00, grossRate: 26550.00, discount: 0, amount: 225000.00 },
        ],
        summary: [
          { name: 'Goods Value', amount: 225000.00 },
        ],
        grossTotal: 225000.00
      }
    }
  },
  purchaseOrder: {
    total: 85600000.00,
    months: [
      { id: 'Mar 26', label: 'Mar 26', amount: 15500000.00 },
      { id: 'Feb 26', label: 'Feb 26', amount: 12000000.00 },
      { id: 'Jan 26', label: 'Jan 26', amount: 9500000.00 },
    ],
    vouchers: {
      'Mar 26': [
        { id: 'PO-2026-101', date: '01 Mar 2026', name: 'TechSupply Co.', type: 'Purchase Order', amount: 450000.00 },
        { id: 'PO-2026-102', date: '02 Mar 2026', name: 'Global Logistics', type: 'Purchase Order', amount: 85000.00 },
      ]
    },
    voucherDetails: {
      'PO-2026-101': {
        voucherNo: 'PO-2026-101',
        partyName: 'TechSupply Co.',
        date: '01 Mar 2026',
        type: 'Purchase Order',
        items: [
          { srNo: 1, name: 'Server Rack 42U', hsn: '8471', qty: 5, unit: 'Pcs', rate: 75000.00, grossRate: 88500.00, discount: 0, amount: 375000.00 },
        ],
        summary: [
          { name: 'Basic Value', amount: 375000.00 },
          { name: 'IGST @ 18%', amount: 67500.00 },
        ],
        grossTotal: 442500.00
      }
    }
  },
  debitNote: {
    total: 410000.00,
    months: [
      { id: 'Mar 26', label: 'Mar 26', amount: 125000.00 },
      { id: 'Feb 26', label: 'Feb 26', amount: 85000.00 },
      { id: 'Jan 26', label: 'Jan 26', amount: 200000.00 },
    ],
    vouchers: {
      'Mar 26': [
        { id: 'DN-2026-401', date: '02 Mar 2026', name: 'TechSupply Co.', type: 'Debit Note', amount: 15000.00 },
      ]
    },
    voucherDetails: {
      'DN-2026-401': {
        voucherNo: 'DN-2026-401',
        partyName: 'TechSupply Co.',
        date: '02 Mar 2026',
        type: 'Debit Note',
        items: [
          { srNo: 1, name: 'Defective Switch', hsn: '8517', qty: 2, unit: 'Pcs', rate: 7500.00, grossRate: 7500.00, discount: 0, amount: 15000.00 },
        ],
        summary: [
          { name: 'Purchase Return', amount: 15000.00 },
        ],
        grossTotal: 15000.00
      }
    }
  },
  receiptNote: {
    total: 6200000.00,
    months: [
      { id: 'Mar 26', label: 'Mar 26', amount: 1800000.00 },
      { id: 'Feb 26', label: 'Feb 26', amount: 2400000.00 },
    ],
    vouchers: {
      'Mar 26': [
        { id: 'RN-2026-801', date: '05 Mar 2026', name: 'OfficeMart', type: 'Receipt Note', amount: 120000.00 },
      ]
    },
    voucherDetails: {
      'RN-2026-801': {
        voucherNo: 'RN-2026-801',
        partyName: 'OfficeMart',
        date: '05 Mar 2026',
        type: 'Receipt Note',
        items: [
          { srNo: 1, name: 'Office Chairs', hsn: '9403', qty: 20, unit: 'Pcs', rate: 5000.00, grossRate: 5900.00, discount: 0, amount: 100000.00 },
        ],
        summary: [
          { name: 'Goods Received', amount: 100000.00 },
          { name: 'CGST @ 9%', amount: 9000.00 },
          { name: 'SGST @ 9%', amount: 9000.00 },
        ],
        grossTotal: 118000.00
      }
    }
  }
};
