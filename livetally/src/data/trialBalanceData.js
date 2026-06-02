export const trialBalanceData = {
  years: [
    { id: '2023-2024', label: '01/04/2023 - 31/03/2024' },
    { id: '2024-2025', label: '01/04/2024 - 31/03/2025' },
    { id: '2025-2026', label: '01/04/2025 - 31/03/2026' },
    { id: '2026-2027', label: '01/04/2026 - 31/03/2027' },
    { id: '2027-2028', label: '01/04/2027 - 31/03/2028' },
  ],
  data: {
    '2023-2024': {
      particulars: [
        { 
          id: 'ind-exp', name: 'Indirect Expenses', debit: 1170626.82, credit: 6.48, isExpandable: true,
          children: [
            { id: 'audit-fees', name: 'Audit Fees', debit: 30000.00, credit: 0, isDrillable: true },
            { id: 'bank-charges', name: 'Bank Charges', debit: 18386.76, credit: 0, isDrillable: true },
            { id: 'donation', name: 'Dada Darbar (Donation)', debit: 21000.00, credit: 0, isDrillable: true },
            { id: 'depreciation', name: 'Depreciation A/c', debit: 420597.00, credit: 0, isDrillable: true },
            { id: 'freight', name: 'Freight & Forwarding Charges', debit: 23010.00, credit: 0, isDrillable: true },
            { id: 'gst-expenses', name: 'Gst Expenses', debit: 7844.74, credit: 0, isDrillable: true },
            { id: 'gst-late-fees', name: 'GST Late Fees', debit: 1418.00, credit: 0, isDrillable: true },
            { id: 'insurance', name: 'Insurance', debit: 28396.00, credit: 0, isDrillable: true },
            { id: 'interest-tds', name: 'Interest in Tds', debit: 402.00, credit: 0, isDrillable: true },
            { id: 'interest-loan-1', name: 'Interest on Loan', debit: 463982.00, credit: 0, isDrillable: true },
            { id: 'interest-od', name: 'Interest on OD Loan', debit: 340356.00, credit: 0, isDrillable: true },
            { id: 'interest-gst-late', name: 'Intrest on Gst Late Fees', debit: 50.00, credit: 0, isDrillable: true },
            { id: 'interest-loan-2', name: 'Intrest on Loan', debit: 356196.00, credit: 0, isDrillable: true },
            { id: 'loan-processing', name: 'Loan Processing Fees', debit: 73692.64, credit: 0, isDrillable: true },
            { id: 'local-cartage', name: 'LOCAL CARTAGE', debit: 87400.00, credit: 0, isDrillable: true },
            { id: 'machine-maintenance', name: 'Machine Maintenance', debit: 4738.00, credit: 0, isDrillable: true }
          ]
        },
        { id: 'pl-ac', name: 'Profit & Loss A/c', debit: 258469.22, credit: 0, isDrillable: true },
        { 
          id: 'purc-ac', name: 'Purchase Accounts', debit: 13661956.04, credit: 0, isExpandable: true,
          children: [
            { id: 'gst-inward-service-18', name: 'GST Inward Service 18%', debit: 2473848.16, credit: 0, isDrillable: true },
            { id: 'gst-purchase-12', name: 'GST Purchase 12%', debit: 22762577.86, credit: 0, isDrillable: true },
            { id: 'gst-purchase-18', name: 'GST Purchase 18%', debit: 2825726.97, credit: 0, isDrillable: true },
            { id: 'gst-service-12', name: 'Gst Service @ 12%', debit: 152023.00, credit: 0, isDrillable: true },
            { id: 'purchase', name: 'Purchase', debit: 112700.00, credit: 0, isDrillable: true }
          ]
        },
        { 
          id: 'sales-ac', name: 'Sales Accounts', debit: 15700.60, credit: 15789101.31, isExpandable: true,
          children: [
            { id: 'gst-sales-12', name: 'GST Sales 12%', debit: 0, credit: 15948083.22, isDrillable: true },
            { id: 'gst-sales-18', name: 'GST Sales 18%', debit: 0, credit: 19637359.41, isDrillable: true },
            { id: 'gst-sales-return-18', name: 'GST Sales Return 18%', debit: 15700.60, credit: 0, isDrillable: true },
            { id: 'igst-sales-18', name: 'IGST Sales 18%', debit: 0, credit: 427350.00, isDrillable: true },
            { id: 'sales', name: 'Sales', debit: 0, credit: 642.00, isDrillable: true }
          ]
        },
        { 
          id: 'cur-asst', name: 'Current Assets', debit: 10493532.62, credit: 0, isExpandable: true,
          children: [
            { id: 'ca-op-stock', name: 'Opening Stock', debit: 4539126.20, credit: 0, isDrillable: true },
            { id: 'ca-cash', name: 'Cash-in-Hand', debit: 818696.92, credit: 0, isDrillable: true },
            { id: 'ca-loans', name: 'Loans & Advances (Asset)', debit: 85707.00, credit: 0, isDrillable: true },
            { id: 'ca-debtors', name: 'Sundry Debtors', debit: 7459807.99, credit: 143957.00, isDrillable: true }
          ]
        },
        { 
          id: 'cur-liab', name: 'Current Liabilities', debit: 82803.84, credit: 2479394.86, isExpandable: true,
          children: [
            { id: 'cl-duties', name: 'Duties & Taxes', debit: 340690.52, credit: 554829.12, isDrillable: true },
            { id: 'cl-prov', name: 'Provisions', debit: 0, credit: 36500.00, isDrillable: true },
            { id: 'cl-cred', name: 'Sundry Creditors', debit: 114194.00, credit: 4031221.99, isDrillable: true }
          ]
        },
        { 
          id: 'suspense', name: 'Suspense A/c', debit: 0, credit: 0, isExpandable: true,
          children: []
        },
        { 
          id: 'capital', name: 'Capital Account', debit: 4143027.19, credit: 6588981.61, isExpandable: true,
          children: [
            { id: 'cap-deepak', name: 'Deepak Kewlani', debit: 4688052.55, credit: 0, isDrillable: true },
            { id: 'cap-parkash', name: 'Parkash Lal Kewalramani', debit: 0, credit: 6845023.05, isDrillable: true }
          ]
        },
        { 
          id: 'ind-inc', name: 'Indirect Incomes', debit: 0, credit: 61125.98, isExpandable: true,
          children: [
            { id: 'discount-rx', name: 'DISCOUNT REC.', debit: 0, credit: 64441.98, isDrillable: true },
            { id: 'interest-tax-refund', name: 'Interest on Income Tax Refund', debit: 0, credit: 46.00, isDrillable: true }
          ]
        },
        { 
          id: 'fixed-asst', name: 'Fixed Assets', debit: 1133548.81, credit: 0, isExpandable: true,
          children: [
            { id: 'fa-car', name: 'Car Tata Punch EV', debit: 1064235.00, credit: 0, isDrillable: true },
            { id: 'fa-comp', name: 'Computers', debit: 1568.00, credit: 0, isDrillable: true },
            { id: 'fa-elec', name: 'Electrical Fitting', debit: 4508.00, credit: 0, isDrillable: true },
            { id: 'fa-laptop', name: 'LAPTOP', debit: 63814.00, credit: 0, isDrillable: true },
            { id: 'fa-lift', name: 'Lift', debit: 37271.00, credit: 0, isDrillable: true },
            { id: 'fa-mob', name: 'Mobile Phone', debit: 83326.63, credit: 0, isDrillable: true },
            { id: 'fa-office1', name: 'Office Equipments', debit: 7065.00, credit: 0, isDrillable: true },
            { id: 'fa-office2', name: 'Office Equpments with Gst 18%', debit: 103907.82, credit: 0, isDrillable: true },
            { id: 'fa-plant', name: 'Plant & Machinery', debit: 824726.00, credit: 0, isDrillable: true }
          ]
        },
        { 
          id: 'loans-liab', name: 'Loans (Liability)', debit: 0, credit: 7776099.90, isExpandable: true,
          children: [
            { id: 'll-bank-od', name: 'Bank OD A/c', debit: 0, credit: 1825079.55, isDrillable: true },
            { id: 'll-sec', name: 'Secured Loans', debit: 49212.00, credit: 4440631.00, isDrillable: true },
            { id: 'll-unsec', name: 'Unsecured Loans', debit: 0, credit: 2249115.10, isDrillable: true }
          ]
        },
        { 
          id: 'dir-exp', name: 'Direct Expenses', debit: 1735045.00, credit: 0, isExpandable: true,
          children: [
            { id: 'electricity', name: 'Electricity Expenses', debit: 1252511.40, credit: 0, isDrillable: true },
            { id: 'salary-wages', name: 'Salary & Wages', debit: 2836308.00, credit: 0, isDrillable: true }
          ]
        },
        { id: 'diff-op', name: 'Difference in Opening Balances', debit: 0, credit: 0, isExpandable: false },
      ],
      totalDebit: 32694710.14,
      totalCredit: 32694710.14,
    },
    '2024-2025': {
      particulars: [
        { id: 'fixed-asst', name: 'Fixed Assets', debit: 2177044.38, credit: 0, isExpandable: true },
        { id: 'ind-exp', name: 'Indirect Expenses', debit: 1739649.98, credit: 2.22, isExpandable: true },
        { id: 'cur-asst', name: 'Current Assets', debit: 11701633.21, credit: 17733.00, isExpandable: true },
        { id: 'sales-ac', name: 'Sales Accounts', debit: 0, credit: 15622762.35, isExpandable: true },
        { id: 'purc-ac', name: 'Purchase Accounts', debit: 12966670.35, credit: 0, isExpandable: true },
        { id: 'ind-inc', name: 'Indirect Incomes', debit: 0, credit: 3362.00, isExpandable: true },
        { id: 'pl-ac', name: 'Profit & Loss A/c', debit: 226082.88, credit: 0, isDrillable: true },
        { id: 'capital', name: 'Capital Account', debit: 4454196.55, credit: 6965023.05, isExpandable: true },
        { id: 'cur-liab', name: 'Current Liabilities', debit: 264650.58, credit: 6345097.26, isExpandable: true },
        { id: 'dir-exp', name: 'Direct Expenses', debit: 2004759.60, credit: 0, isExpandable: true },
        { id: 'loans-liab', name: 'Loans (Liability)', debit: 0, credit: 6580707.65, isExpandable: true },
        { id: 'diff-op', name: 'Difference in Opening Balances', debit: 0, credit: 0, isExpandable: false },
      ],
      totalDebit: 35534687.53,
      totalCredit: 35534687.53,
    },
    '2025-2026': {
      particulars: [
        { id: 'fixed-asst', name: 'Fixed Assets', debit: 2190421.45, credit: 0, isExpandable: true },
        { id: 'ind-exp', name: 'Indirect Expenses', debit: 92159.25, credit: 2.65, isExpandable: true },
        { id: 'dir-exp', name: 'Direct Expenses', debit: 349012.80, credit: 0, isExpandable: true },
        { id: 'loans-liab', name: 'Loans (Liability)', debit: 49212.00, credit: 8514825.65, isExpandable: true },
        { id: 'cur-liab', name: 'Current Liabilities', debit: 454884.52, credit: 4622551.11, isExpandable: true },
        { id: 'capital', name: 'Capital Account', debit: 4688052.55, credit: 6845023.05, isExpandable: true },
        { id: 'purc-ac', name: 'Purchase Accounts', debit: 1698249.60, credit: 0, isExpandable: true },
        { id: 'cur-asst', name: 'Current Assets', debit: 15145882.62, credit: 143957.00, isExpandable: true },
        { id: 'sales-ac', name: 'Sales Accounts', debit: 0, credit: 4543977.97, isExpandable: true },
        { id: 'pl-ac', name: 'Profit & Loss A/c', debit: 2462.64, credit: 0, isDrillable: true },
        { id: 'diff-op', name: 'Difference in Opening Balances', debit: 0, credit: 0, isExpandable: false },
      ],
      totalDebit: 24670337.43,
      totalCredit: 24670337.43,
    },
    '2026-2027': {
      particulars: [
        { id: 'capital', name: 'Capital Account', debit: 4688052.55, credit: 6845023.05, isExpandable: true },
        { id: 'loans-liab', name: 'Loans (Liability)', debit: 49212.00, credit: 8514825.65, isExpandable: true },
        { id: 'cur-liab', name: 'Current Liabilities', debit: 454880.62, credit: 4622551.11, isExpandable: true },
        { id: 'fixed-asst', name: 'Fixed Assets', debit: 2190421.45, credit: 0, isExpandable: true },
        { id: 'cur-asst', name: 'Current Assets', debit: 10763819.66, credit: 143920.60, isExpandable: true },
        { id: 'sales-ac', name: 'Sales Accounts', debit: 0, credit: 32.50, isExpandable: true },
        { id: 'pl-ac', name: 'Profit & Loss A/c', debit: 1979966.63, credit: 0, isDrillable: true },
        { id: 'diff-op', name: 'Difference in Opening Balances', debit: 0, credit: 0, isExpandable: false },
      ],
      totalDebit: 20126352.91,
      totalCredit: 20126352.91,
    },
    '2027-2028': {
      particulars: [],
      totalDebit: 0,
      totalCredit: 0,
    }
  }
};
