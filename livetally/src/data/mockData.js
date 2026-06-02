// =====================================================
// TallyView by FinBook — Comprehensive Mock Data
// Indian Business Data (FY 2024-25)
// =====================================================

export const company = {
  name: 'Sharma Enterprises Pvt Ltd',
  shortName: 'Sharma Ent.',
  gstin: '27AABCS1429B1Z5',
  pan: 'AABCS1429B',
  state: 'Maharashtra',
  city: 'Mumbai',
  industry: 'Trading & Distribution',
  financialYear: '2024-25',
  lastSync: '2025-05-27T04:30:00Z',
  syncStatus: 'synced',
  dataSource: 'Tally Prime 4.1',
  accountant: 'CA Rajesh Kumar & Associates',
  tallyVersion: 'Tally Prime 4.1',
  companies: [
    { id: 1, name: 'Sharma Enterprises Pvt Ltd', color: '#f59e0b' },
    { id: 2, name: 'Sharma Retail LLP', color: '#10b981' },
    { id: 3, name: 'Sharma Holdings', color: '#6366f1' },
  ],
};

// ─── Currency Formatter ───────────────────────────
export const formatINR = (val, compact = false) => {
  if (compact) {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

export const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

// ─── KPI Summary ──────────────────────────────────
export const kpiData = {
  sales: {
    current: 4820000,
    previous: 4150000,
    change: 16.1,
    trend: 'up',
    label: 'Total Sales',
    icon: '📈',
    variant: 'sales',
    subtitle: 'vs last year',
    sparkData: [280, 310, 295, 340, 380, 420, 390, 440, 480, 460, 500, 520],
  },
  purchase: {
    current: 3150000,
    previous: 2890000,
    change: 9.0,
    trend: 'up',
    label: 'Total Purchase',
    icon: '🛒',
    variant: 'purchase',
    subtitle: 'vs last year',
    sparkData: [180, 200, 195, 210, 240, 270, 250, 280, 310, 290, 320, 340],
  },
  receivables: {
    current: 1280000,
    previous: 1450000,
    change: -11.7,
    trend: 'down',
    label: 'Receivables',
    icon: '💸',
    variant: 'receivables',
    subtitle: 'vs last year',
    sparkData: [160, 155, 148, 162, 145, 138, 142, 151, 139, 143, 136, 128],
    warning: '₹1.7L overdue 90+ days',
  },
  payables: {
    current: 840000,
    previous: 920000,
    change: -8.7,
    trend: 'down',
    label: 'Payables',
    icon: '🧾',
    variant: 'payables',
    subtitle: 'vs last year',
    sparkData: [110, 105, 98, 102, 96, 92, 88, 95, 90, 87, 85, 84],
  },
  cashBank: {
    current: 1560000,
    previous: 1280000,
    change: 21.9,
    trend: 'up',
    label: 'Cash & Bank Balance',
    icon: '🏦',
    variant: 'cash',
    subtitle: 'vs last year',
    sparkData: [90, 95, 88, 102, 110, 118, 105, 122, 130, 128, 145, 156],
  },
  netProfit: {
    current: 870000,
    previous: 720000,
    change: 20.8,
    trend: 'up',
    label: 'Net Profit',
    icon: '💰',
    variant: 'profit',
    subtitle: '18.1% margin',
    margin: 18.1,
    sparkData: [40, 55, 48, 62, 70, 75, 68, 82, 90, 85, 95, 100],
  },
};

// ─── Monthly Trend (Revenue vs Expense) ─────────
export const monthlyTrend = [
  { month: 'Apr', revenue: 3200000, expense: 2650000, profit: 550000 },
  { month: 'May', revenue: 3550000, expense: 2900000, profit: 650000 },
  { month: 'Jun', revenue: 3100000, expense: 2620000, profit: 480000 },
  { month: 'Jul', revenue: 3800000, expense: 3050000, profit: 750000 },
  { month: 'Aug', revenue: 4100000, expense: 3280000, profit: 820000 },
  { month: 'Sep', revenue: 4400000, expense: 3520000, profit: 880000 },
  { month: 'Oct', revenue: 4050000, expense: 3240000, profit: 810000 },
  { month: 'Nov', revenue: 4600000, expense: 3680000, profit: 920000 },
  { month: 'Dec', revenue: 5100000, expense: 4080000, profit: 1020000 },
  { month: 'Jan', revenue: 4750000, expense: 3800000, profit: 950000 },
  { month: 'Feb', revenue: 5200000, expense: 4160000, profit: 1040000 },
  { month: 'Mar', revenue: 5500000, expense: 4400000, profit: 1100000 },
];

// ─── Cash Flow ───────────────────────────────────
export const cashFlowData = [
  { month: 'Oct', operating: 820000, investing: -150000, financing: -80000, net: 590000 },
  { month: 'Nov', operating: 920000, investing: -200000, financing: -100000, net: 620000 },
  { month: 'Dec', operating: 1020000, investing: -80000, financing: -120000, net: 820000 },
  { month: 'Jan', operating: 950000, investing: -300000, financing: -90000, net: 560000 },
  { month: 'Feb', operating: 1040000, investing: -120000, financing: -80000, net: 840000 },
  { month: 'Mar', operating: 1100000, investing: -180000, financing: -100000, net: 820000 },
];

// ─── Receivables Aging ───────────────────────────
export const receivablesAging = [
  { bucket: '0–30 Days', amount: 520000, count: 12, color: '#10b981', pct: 40.6 },
  { bucket: '31–60 Days', amount: 380000, count: 8, color: '#f59e0b', pct: 29.7 },
  { bucket: '61–90 Days', amount: 210000, count: 5, color: '#f97316', pct: 16.4 },
  { bucket: '90+ Days', amount: 170000, count: 3, color: '#ef4444', pct: 13.3 },
];

// ─── Payables Aging ──────────────────────────────
export const payablesAging = [
  { bucket: '0–30 Days', amount: 380000, count: 8, color: '#10b981', pct: 45.2 },
  { bucket: '31–60 Days', amount: 260000, count: 5, color: '#f59e0b', pct: 31.0 },
  { bucket: '61–90 Days', amount: 120000, count: 3, color: '#f97316', pct: 14.3 },
  { bucket: '90+ Days', amount: 80000, count: 2, color: '#ef4444', pct: 9.5 },
];

// ─── Top Customers ───────────────────────────────
export const topCustomers = [
  { id: 1, name: 'Reliance Retail Ltd', city: 'Mumbai', sales: 820000, outstanding: 145000, lastTxn: '2025-05-24', status: 'active' },
  { id: 2, name: 'D-Mart Stores Pvt Ltd', city: 'Pune', sales: 680000, outstanding: 0, lastTxn: '2025-05-20', status: 'active' },
  { id: 3, name: 'Metro Cash & Carry', city: 'Navi Mumbai', sales: 540000, outstanding: 89000, lastTxn: '2025-05-18', status: 'active' },
  { id: 4, name: 'BigBazaar Hyper Market', city: 'Thane', sales: 420000, outstanding: 210000, lastTxn: '2025-05-15', status: 'overdue' },
  { id: 5, name: 'Star Bazaar Retail', city: 'Nashik', sales: 380000, outstanding: 0, lastTxn: '2025-05-22', status: 'active' },
  { id: 6, name: 'Heritage Foods Ltd', city: 'Mumbai', sales: 290000, outstanding: 62000, lastTxn: '2025-05-10', status: 'warning' },
  { id: 7, name: 'Nature Basket Stores', city: 'Pune', sales: 245000, outstanding: 0, lastTxn: '2025-05-19', status: 'active' },
  { id: 8, name: 'Apna Bazar Co-op', city: 'Mumbai', sales: 198000, outstanding: 47000, lastTxn: '2025-05-08', status: 'warning' },
];

// ─── Top Vendors ─────────────────────────────────
export const topVendors = [
  { id: 1, name: 'Hindustan Unilever Ltd', city: 'Mumbai', purchase: 680000, outstanding: 120000, dueDate: '2025-06-05', status: 'active' },
  { id: 2, name: 'ITC Limited', city: 'Kolkata', purchase: 540000, outstanding: 0, dueDate: '2025-05-30', status: 'paid' },
  { id: 3, name: 'Nestle India Ltd', city: 'Delhi', purchase: 420000, outstanding: 85000, dueDate: '2025-06-10', status: 'active' },
  { id: 4, name: 'Britannia Industries', city: 'Bangalore', purchase: 380000, outstanding: 195000, dueDate: '2025-05-28', status: 'overdue' },
  { id: 5, name: 'Dabur India Ltd', city: 'Delhi', purchase: 245000, outstanding: 0, dueDate: '2025-06-15', status: 'paid' },
  { id: 6, name: 'Godrej Consumer Products', city: 'Mumbai', purchase: 198000, outstanding: 65000, dueDate: '2025-06-08', status: 'active' },
];

// ─── Top Items / Products ────────────────────────
export const topItems = [
  { id: 1, name: 'Surf Excel 1kg', category: 'FMCG', qty: 2840, value: 680000, trend: 'up', margin: 18 },
  { id: 2, name: 'Parle-G Biscuits 800g', category: 'Food', qty: 5200, value: 520000, trend: 'up', margin: 14 },
  { id: 3, name: 'Dettol Handwash 500ml', category: 'Healthcare', qty: 1890, value: 412000, trend: 'stable', margin: 22 },
  { id: 4, name: 'Maggi Noodles 12pk', category: 'Food', qty: 3200, value: 384000, trend: 'down', margin: 16 },
  { id: 5, name: 'Colgate MaxFresh 200g', category: 'Personal Care', qty: 2100, value: 315000, trend: 'up', margin: 20 },
  { id: 6, name: 'Lays Chips Variety Pack', category: 'Snacks', qty: 4800, value: 288000, trend: 'up', margin: 25 },
  { id: 7, name: 'Tata Salt 1kg', category: 'Grocery', qty: 6500, value: 195000, trend: 'stable', margin: 12 },
  { id: 8, name: 'Amul Butter 500g', category: 'Dairy', qty: 1200, value: 180000, trend: 'up', margin: 15 },
];

// ─── Recent Vouchers ─────────────────────────────
export const recentVouchers = [
  { id: 'SI-2025-1842', date: '2025-05-27', type: 'Sales Invoice', party: 'Reliance Retail Ltd', amount: 145000, gst: 26100, status: 'paid', dueDate: '2025-06-10' },
  { id: 'PI-2025-0923', date: '2025-05-26', type: 'Purchase Invoice', party: 'Hindustan Unilever Ltd', amount: 98000, gst: 17640, status: 'pending', dueDate: '2025-06-05' },
  { id: 'RC-2025-0441', date: '2025-05-26', type: 'Receipt', party: 'D-Mart Stores Pvt Ltd', amount: 85000, gst: 0, status: 'paid', dueDate: null },
  { id: 'SI-2025-1841', date: '2025-05-25', type: 'Sales Invoice', party: 'Metro Cash & Carry', amount: 220000, gst: 39600, status: 'paid', dueDate: '2025-06-15' },
  { id: 'PI-2025-0922', date: '2025-05-25', type: 'Purchase Invoice', party: 'Nestle India Ltd', amount: 62000, gst: 11160, status: 'pending', dueDate: '2025-06-10' },
  { id: 'PM-2025-0318', date: '2025-05-24', type: 'Payment', party: 'ITC Limited', amount: 120000, gst: 0, status: 'paid', dueDate: null },
  { id: 'SI-2025-1840', date: '2025-05-24', type: 'Sales Invoice', party: 'BigBazaar Hyper Market', amount: 310000, gst: 55800, status: 'overdue', dueDate: '2025-05-10' },
  { id: 'JV-2025-0089', date: '2025-05-23', type: 'Journal', party: 'Depreciation Entry', amount: 18000, gst: 0, status: 'posted', dueDate: null },
  { id: 'SI-2025-1839', date: '2025-05-22', type: 'Sales Invoice', party: 'Star Bazaar Retail', amount: 95000, gst: 17100, status: 'paid', dueDate: '2025-06-01' },
  { id: 'PI-2025-0921', date: '2025-05-22', type: 'Purchase Invoice', party: 'Britannia Industries', amount: 195000, gst: 35100, status: 'overdue', dueDate: '2025-05-28' },
];

// ─── Alerts ──────────────────────────────────────
export const alerts = [
  { id: 1, type: 'danger', icon: '⚠️', text: 'Overdue receivables', value: '₹3.8L', subtext: '5 invoices past due date', action: 'View Receivables' },
  { id: 2, type: 'danger', icon: '🔴', text: 'Britannia payment overdue', value: '₹1.95L', subtext: 'Due 28 May — 3 days overdue', action: 'Pay Now' },
  { id: 3, type: 'warning', icon: '🕐', text: 'Bills due this week', value: '₹2.1L', subtext: '4 vendor bills due by 31 May', action: 'View Payables' },
  { id: 4, type: 'warning', icon: '📦', text: 'Low stock alert', value: '6 items', subtext: 'Below reorder level', action: 'View Inventory' },
  { id: 5, type: 'info', icon: '🔄', text: 'GST return due', value: 'GSTR-1', subtext: 'Due by 11 June 2025', action: 'View GST' },
  { id: 6, type: 'success', icon: '✅', text: 'Collections improved', value: '+21%', subtext: 'vs last month', action: 'View Analytics' },
];

// ─── P&L Data ────────────────────────────────────
export const plData = {
  income: {
    'Sales Revenue': 4820000,
    'Other Income': 125000,
    'Discount Received': 42000,
  },
  directExpenses: {
    'Purchase of Goods': 3150000,
    'Freight Inward': 98000,
    'Packing Material': 45000,
  },
  indirectExpenses: {
    'Salaries & Wages': 380000,
    'Rent & Utilities': 120000,
    'Office Expenses': 48000,
    'Depreciation': 72000,
    'Marketing & Advertisement': 85000,
    'Professional Fees': 36000,
    'Bank Charges': 18000,
    'Miscellaneous': 15000,
  },
};

// ─── Balance Sheet Data ──────────────────────────
export const balanceSheet = {
  assets: {
    currentAssets: {
      'Cash & Bank': 1560000,
      'Sundry Debtors': 1280000,
      'Closing Stock': 1820000,
      'Loans & Advances': 245000,
      'Other Current Assets': 89000,
    },
    fixedAssets: {
      'Plant & Machinery': 850000,
      'Furniture & Fixtures': 320000,
      'Computers & Equipment': 185000,
      'Vehicles': 650000,
    },
  },
  liabilities: {
    currentLiabilities: {
      'Sundry Creditors': 840000,
      'GST Payable': 182000,
      'TDS Payable': 48000,
      'Short-term Loans': 500000,
      'Other Current Liabilities': 125000,
    },
    ownersFunds: {
      'Capital Account': 2800000,
      'Reserves & Surplus': 1506000,
    },
  },
};

// ─── GST Summary ─────────────────────────────────
export const gstSummary = {
  gstr1: { period: 'Apr 2025', status: 'filed', taxable: 4820000, cgst: 289200, sgst: 289200, igst: 144600, totalTax: 723000 },
  gstr3b: { period: 'Apr 2025', status: 'filed', liability: 723000, itc: 498000, netPayable: 225000, paid: 225000 },
  itcSummary: { opening: 85000, received: 498000, utilized: 498000, closing: 85000 },
  taxBreakdown: [
    { rate: '5%', taxable: 1200000, tax: 60000 },
    { rate: '12%', taxable: 1500000, tax: 180000 },
    { rate: '18%', taxable: 1800000, tax: 324000 },
    { rate: '28%', taxable: 320000, tax: 89600 },
  ],
};

// ─── Stock Summary ───────────────────────────────
export const stockItems = [
  { id: 1, name: 'Surf Excel 1kg', group: 'Detergents', unit: 'Nos', opening: 500, in: 2800, out: 2840, closing: 460, value: 110400, reorder: 200, status: 'ok' },
  { id: 2, name: 'Parle-G Biscuits 800g', group: 'Biscuits', unit: 'Pkt', opening: 1200, in: 5000, out: 5200, closing: 1000, value: 75000, reorder: 500, status: 'ok' },
  { id: 3, name: 'Dettol Handwash 500ml', group: 'Healthcare', unit: 'Nos', opening: 300, in: 1900, out: 1890, closing: 310, value: 93000, reorder: 150, status: 'ok' },
  { id: 4, name: 'Maggi Noodles 12pk', group: 'Noodles', unit: 'Pkt', opening: 800, in: 3000, out: 3200, closing: 600, value: 84000, reorder: 300, status: 'warning' },
  { id: 5, name: 'Colgate MaxFresh 200g', group: 'Toothpaste', unit: 'Nos', opening: 600, in: 2100, out: 2100, closing: 600, value: 90000, reorder: 250, status: 'ok' },
  { id: 6, name: 'Lays Chips Variety', group: 'Snacks', unit: 'Pkt', opening: 2000, in: 4500, out: 4800, closing: 1700, value: 119000, reorder: 800, status: 'ok' },
  { id: 7, name: 'Tata Salt 1kg', group: 'Grocery', unit: 'Pkt', opening: 3000, in: 6000, out: 6500, closing: 2500, value: 75000, reorder: 1000, status: 'ok' },
  { id: 8, name: 'Amul Butter 500g', group: 'Dairy', unit: 'Nos', opening: 200, in: 1200, out: 1200, closing: 200, value: 70000, reorder: 150, status: 'ok' },
  { id: 9, name: 'Haldiram Namkeen 400g', group: 'Snacks', unit: 'Pkt', opening: 150, in: 500, out: 620, closing: 30, value: 2100, reorder: 100, status: 'critical' },
  { id: 10, name: 'Frooti Mango 1L', group: 'Beverages', unit: 'Nos', opening: 100, in: 400, out: 480, closing: 20, value: 1400, reorder: 150, status: 'critical' },
];

// ─── Sales Register ──────────────────────────────
export const salesData = [
  { id: 'SI-2025-1842', date: '2025-05-27', party: 'Reliance Retail Ltd', items: 12, taxable: 122881, gst: 22119, total: 145000, status: 'paid', payMode: 'NEFT' },
  { id: 'SI-2025-1841', date: '2025-05-25', party: 'Metro Cash & Carry', items: 18, taxable: 186441, gst: 33559, total: 220000, status: 'paid', payMode: 'Cheque' },
  { id: 'SI-2025-1840', date: '2025-05-24', party: 'BigBazaar Hyper Market', items: 24, taxable: 262712, gst: 47288, total: 310000, status: 'overdue', payMode: 'Credit' },
  { id: 'SI-2025-1839', date: '2025-05-22', party: 'Star Bazaar Retail', items: 8, taxable: 80508, gst: 14492, total: 95000, status: 'paid', payMode: 'NEFT' },
  { id: 'SI-2025-1838', date: '2025-05-21', party: 'Heritage Foods Ltd', items: 15, taxable: 186441, gst: 33559, total: 220000, status: 'pending', payMode: 'Credit' },
  { id: 'SI-2025-1837', date: '2025-05-20', party: 'D-Mart Stores Pvt Ltd', items: 30, taxable: 338983, gst: 61017, total: 400000, status: 'paid', payMode: 'RTGS' },
  { id: 'SI-2025-1836', date: '2025-05-19', party: 'Nature Basket Stores', items: 10, taxable: 127119, gst: 22881, total: 150000, status: 'paid', payMode: 'NEFT' },
  { id: 'SI-2025-1835', date: '2025-05-18', party: 'Apna Bazar Co-op', items: 6, taxable: 63559, gst: 11441, total: 75000, status: 'pending', payMode: 'Credit' },
  { id: 'SI-2025-1834', date: '2025-05-17', party: 'Reliance Retail Ltd', items: 20, taxable: 211864, gst: 38136, total: 250000, status: 'paid', payMode: 'NEFT' },
  { id: 'SI-2025-1833', date: '2025-05-16', party: 'Metro Cash & Carry', items: 14, taxable: 152542, gst: 27458, total: 180000, status: 'paid', payMode: 'NEFT' },
  { id: 'SI-2025-1832', date: '2025-05-15', party: 'BigBazaar Hyper Market', items: 22, taxable: 296610, gst: 53390, total: 350000, status: 'paid', payMode: 'Cheque' },
  { id: 'SI-2025-1831', date: '2025-05-14', party: 'D-Mart Stores Pvt Ltd', items: 28, taxable: 254237, gst: 45763, total: 300000, status: 'paid', payMode: 'RTGS' },
];

// ─── Purchase Register ───────────────────────────
export const purchaseData = [
  { id: 'PI-2025-0923', date: '2025-05-26', party: 'Hindustan Unilever Ltd', items: 15, taxable: 83051, gst: 14949, total: 98000, status: 'pending', dueDate: '2025-06-05' },
  { id: 'PI-2025-0922', date: '2025-05-25', party: 'Nestle India Ltd', items: 10, taxable: 52542, gst: 9458, total: 62000, status: 'pending', dueDate: '2025-06-10' },
  { id: 'PI-2025-0921', date: '2025-05-22', party: 'Britannia Industries', items: 20, taxable: 165254, gst: 29746, total: 195000, status: 'overdue', dueDate: '2025-05-28' },
  { id: 'PI-2025-0920', date: '2025-05-20', party: 'ITC Limited', items: 18, taxable: 101695, gst: 18305, total: 120000, status: 'paid', dueDate: null },
  { id: 'PI-2025-0919', date: '2025-05-18', party: 'Dabur India Ltd', items: 12, taxable: 84746, gst: 15254, total: 100000, status: 'paid', dueDate: null },
  { id: 'PI-2025-0918', date: '2025-05-15', party: 'Godrej Consumer Products', items: 8, taxable: 55085, gst: 9915, total: 65000, status: 'pending', dueDate: '2025-06-08' },
  { id: 'PI-2025-0917', date: '2025-05-12', party: 'Hindustan Unilever Ltd', items: 22, taxable: 169492, gst: 30508, total: 200000, status: 'paid', dueDate: null },
  { id: 'PI-2025-0916', date: '2025-05-10', party: 'Nestle India Ltd', items: 14, taxable: 127119, gst: 22881, total: 150000, status: 'paid', dueDate: null },
];

// ─── Budget vs Actual ────────────────────────────
export const budgetVsActual = [
  { category: 'Sales Revenue', budget: 5000000, actual: 4820000, variance: -180000 },
  { category: 'Purchase Cost', budget: 3000000, actual: 3150000, variance: 150000 },
  { category: 'Gross Profit', budget: 2000000, actual: 1670000, variance: -330000 },
  { category: 'Salaries', budget: 350000, actual: 380000, variance: 30000 },
  { category: 'Rent', budget: 120000, actual: 120000, variance: 0 },
  { category: 'Marketing', budget: 100000, actual: 85000, variance: -15000 },
  { category: 'Net Profit', budget: 1000000, actual: 870000, variance: -130000 },
];

// ─── Expense Breakdown ───────────────────────────
export const expenseBreakdown = [
  { name: 'Purchase', value: 3150000, color: '#2563eb' },
  { name: 'Salaries', value: 380000, color: '#7c3aed' },
  { name: 'Rent', value: 120000, color: '#0ea5e9' },
  { name: 'Marketing', value: 85000, color: '#10b981' },
  { name: 'Depreciation', value: 72000, color: '#f59e0b' },
  { name: 'Other', value: 117000, color: '#94a3b8' },
];

// ─── Notifications ───────────────────────────────
export const notifications = [
  { id: 1, type: 'alert', message: 'BigBazaar invoice overdue by 17 days', time: '2 hours ago', read: false },
  { id: 2, type: 'sync', message: 'Tally sync completed successfully', time: '4 hours ago', read: false },
  { id: 3, type: 'gst', message: 'GSTR-1 due in 14 days for May 2025', time: '1 day ago', read: true },
  { id: 4, type: 'stock', message: '2 items critically low in stock', time: '1 day ago', read: true },
  { id: 5, type: 'alert', message: 'Britannia payment overdue by 3 days', time: '2 days ago', read: true },
];
