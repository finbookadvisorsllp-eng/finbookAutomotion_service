import { create } from 'zustand';
import salesApi, { salesVoucherApi } from '../services/salesApi';
import bulkUploadApi from '../services/bulkUploadApi';


/**
 * useSalesStore — Zustand store for the entire Sales module.
 *
 * Covers:
 *  - Transaction list (with pagination + filters)
 *  - Single transaction detail
 *  - OCR workflow state (file → extraction → autofill)
 *  - CSV workflow state (file → preview → import result)
 *  - Form values (manual + OCR autofill)
 *  - Loading / error state per operation
 */

const DEFAULT_FORM = {
  voucherType: 'sales_invoice',
  voucherNumberSeries: 'Default',
  voucherDate: '',
  invoiceDate: '',
  invoiceNumber: '',
  referenceNumber: '',
  // Change by Anjalee: Credit Note specific date field
  creditNoteDate: '',
  salesLedger: '',
  gstRegistration: '',
  partyGstin: '',
  gstRegistrationType: '',
  partyLedger: '',
  consigneeLedger: 'Same as Party',
  entryTab: 'without_item',
  productLines: [{ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }],
  salesLines: [{ id: Date.now(), srNo: 1, salesLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }],
  additionalCharges: [],
  tdsDetails: [],
  tcsDetails: [{ id: Date.now() + 200, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }],
  narration: '',
  status: 'draft',
};

const calculateFormTotals = (form) => {
  let baseTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let cessTotal = 0;
  let itemAmount = 0;
  let ledgerAmount = 0;

  // Compare first 2 chars of partyGstin and gstRegistration to determine if interstate
  const getStateCode = (gstRegistration) => {
    if (!gstRegistration) return '';
    const numMatch = gstRegistration.match(/\b\d{2}\b/);
    if (numMatch) return numMatch[0];
    
    const regLower = gstRegistration.toLowerCase();
    const states = {
      'jammu': '01', 'himachal': '02', 'punjab': '03', 'chandigarh': '04', 'uttarakhand': '05',
      'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09', 'bihar': '10',
      'sikkim': '11', 'arunachal': '12', 'nagaland': '13', 'manipur': '14', 'mizoram': '15',
      'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19', 'jharkhand': '20',
      'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24', 'daman': '25',
      'dadra': '26', 'maharashtra': '27', 'andhra': '28', 'karnataka': '29', 'goa': '30',
      'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33', 'puducherry': '34', 'andaman': '35',
      'telangana': '36', 'ladakh': '38'
    };
    for (const [stateName, code] of Object.entries(states)) {
      if (regLower.includes(stateName)) return code;
    }
    return '';
  };

  const partyState = form.partyGstin?.trim().substring(0, 2);
  const companyState = getStateCode(form.gstRegistration) || '23';
  const isInterstate = partyState && companyState && partyState !== companyState;

  // Extract CESS rate from any CESS ledger in additionalCharges or salesLines
  let cessRate = 0;
  let hasCessLedger = false;
  let cessLedgerAmt = 0;
  const allChargesForCess = [...(form.salesLines || []), ...(form.additionalCharges || [])];
  allChargesForCess.forEach((c) => {
    const nameUpper = (c.ledgerName || c.salesLedger || '').toUpperCase();
    if (nameUpper.includes('CESS')) {
      hasCessLedger = true;
      const match = nameUpper.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) {
        cessRate = parseFloat(match[1]);
      } else {
        cessLedgerAmt += parseFloat(c.amount) || 0;
      }
    }
  });

  // Calculate total additional charges (non-tax ledgers)
  let totalAdditionalCharges = 0;
  if (Array.isArray(form.additionalCharges)) {
    form.additionalCharges.forEach((c) => {
      const nameUpper = (c.ledgerName || '').toUpperCase();
      const isTaxLedger = nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST') || nameUpper.includes('UTGST') || nameUpper.includes('CESS');
      if (!isTaxLedger) {
        totalAdditionalCharges += parseFloat(c.amount) || 0;
      }
    });
  }

  if (form.entryTab === 'with_item') {
    if (Array.isArray(form.productLines)) {
      form.productLines.forEach((line) => {
        const qty = parseFloat(line.billQuantity) || 0;
        const rate = parseFloat(line.billRate) || 0;
        const disc = parseFloat(line.discountPercent) || 0;
        const amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
        line.amount = amount;
        itemAmount += amount;
      });
    }

    // NOTE: salesLines in 'with_item' mode represent sales ledger distribution accounts,
    // NOT additional charges. Only the explicit additionalCharges array contributes here.
    // (Previously this loop incorrectly doubled the taxable base for OCR-imported invoices.)

    // Step 3, 4, 5, 6: Distribute additional charges and calculate tax item-wise
    if (Array.isArray(form.productLines)) {
      const itemLen = form.productLines.length;
      form.productLines.forEach((line) => {
        const amount = line.amount || 0;
        const ratio = itemAmount > 0 ? (amount / itemAmount) : (1 / itemLen);
        const distributedCharge = parseFloat((ratio * totalAdditionalCharges).toFixed(2));
        const taxableAmount = parseFloat((amount + distributedCharge).toFixed(2));
        const gstRate = parseFloat(line.gstRate) || 0;

        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        let cess = 0;

        if (line.taxabilityType === 'Taxable' && !line.rcm) {
          const gstAmt = taxableAmount * gstRate / 100;
          if (isInterstate) {
            igst = parseFloat(gstAmt.toFixed(2));
          } else {
            cgst = parseFloat((gstAmt / 2).toFixed(2));
            sgst = parseFloat((gstAmt / 2).toFixed(2));
          }
          
          // Calculate CESS
          let lineCessRate = parseFloat(line.cessRate || line.cess_rate) || 0;
          if (lineCessRate <= 0) {
            lineCessRate = cessRate;
          }
          if (lineCessRate > 0) {
            cess = parseFloat((taxableAmount * lineCessRate / 100).toFixed(2));
          }
        }

        // Set all required data model fields
        line.itemAmount = parseFloat(amount.toFixed(2));
        line.gstRate = gstRate;
        line.ratio = parseFloat(ratio.toFixed(4));
        line.distributedCharge = distributedCharge;
        line.taxableAmount = taxableAmount;
        line.cgst = cgst;
        line.sgst = sgst;
        line.igst = igst;
        line.cess = cess;
        line.totalTax = parseFloat((cgst + sgst + igst + cess).toFixed(2));
      });

      cgstTotal = form.productLines.reduce((sum, l) => sum + (l.cgst || 0), 0);
      sgstTotal = form.productLines.reduce((sum, l) => sum + (l.sgst || 0), 0);
      igstTotal = form.productLines.reduce((sum, l) => sum + (l.igst || 0), 0);
      cessTotal = form.productLines.reduce((sum, l) => sum + (l.cess || 0), 0);
      baseTotal = form.productLines.reduce((sum, l) => sum + (l.taxableAmount || 0), 0);
    }
  }

  if (form.entryTab === 'without_item' && Array.isArray(form.salesLines)) {
    let salesLedgerGstRate = 0;
    if (form.salesLedger) {
      const m = form.salesLedger.match(/(\d+)\s*%/);
      if (m) salesLedgerGstRate = parseFloat(m[1]);
      else if (/exempt|nil|zero/i.test(form.salesLedger)) salesLedgerGstRate = 0;
    }

    form.salesLines.forEach((line) => {
      const nameUpper = (line.salesLedger || '').toUpperCase();
      const isTaxLedger = nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST') || nameUpper.includes('UTGST') || nameUpper.includes('CESS');
      if (isTaxLedger) return;

      const amount = parseFloat(line.amount) || 0;
      const gstRate = salesLedgerGstRate > 0 ? salesLedgerGstRate : (parseFloat(line.gstRate) || 0);

      ledgerAmount += amount;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      let cess = 0;

      const gstAmt = amount * gstRate / 100;
      if (isInterstate) {
        igst = parseFloat(gstAmt.toFixed(2));
      } else {
        cgst = parseFloat((gstAmt / 2).toFixed(2));
        sgst = parseFloat((gstAmt / 2).toFixed(2));
      }

      // Calculate CESS
      let lineCessRate = parseFloat(line.cessRate || line.cess_rate) || 0;
      if (lineCessRate <= 0) {
        lineCessRate = cessRate;
      }
      if (lineCessRate > 0) {
        cess = parseFloat((amount * lineCessRate / 100).toFixed(2));
      }

      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      cessTotal += cess;

      line.taxableAmount = amount;
      line.cgst = cgst;
      line.sgst = sgst;
      line.igst = igst;
      line.cess = cess;
      line.totalTax = parseFloat((cgst + sgst + igst + cess).toFixed(2));
    });
    baseTotal = ledgerAmount;
  }

  // Fallback to manual CESS ledger amount if calculated is 0 but ledger is present
  if (cessTotal === 0 && hasCessLedger && cessLedgerAmt > 0) {
    cessTotal = cessLedgerAmt;
  }

  // Sum additional charges
  let additionalTotal = 0;
  if (Array.isArray(form.additionalCharges)) {
    form.additionalCharges.forEach((c) => {
      const nameUpper = (c.ledgerName || '').toUpperCase();
      const isTaxLedger = nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST') || nameUpper.includes('UTGST') || nameUpper.includes('CESS');

      if (isTaxLedger) {
        c.taxableValue = baseTotal.toFixed(2);
        if (nameUpper.includes('CGST')) {
          c.amount = parseFloat((cgstTotal || 0).toFixed(2));
        } else if (nameUpper.includes('SGST') || nameUpper.includes('UTGST')) {
          c.amount = parseFloat((sgstTotal || 0).toFixed(2));
        } else if (nameUpper.includes('IGST')) {
          c.amount = parseFloat((igstTotal || 0).toFixed(2));
        } else if (nameUpper.includes('CESS')) {
          c.amount = parseFloat((cessTotal || 0).toFixed(2));
        }
      } else {
        c.taxableValue = "0.00";
      }
      additionalTotal += parseFloat(c.amount) || 0;
    });
  }

  let tdsTotal = 0;
  if (Array.isArray(form.tdsDetails)) {
    form.tdsDetails.forEach((t) => {
      const baseAmt = parseFloat(baseTotal || 0);
      const rate = t.rate !== undefined ? parseFloat(t.rate) : 2;
      t.assessableValue = baseAmt;
      t.amount = parseFloat((baseAmt * rate / 100).toFixed(2));
      tdsTotal += t.amount;
    });
  }

  let tcsTotal = 0;
  if (Array.isArray(form.tcsDetails)) {
    form.tcsDetails.forEach((t) => {
      const assessable = parseFloat(t.assessableValue) || 0;
      const rate = parseFloat(t.rate) || 0;
      const amt = parseFloat(((assessable * rate) / 100).toFixed(2));
      t.amount = amt;
      tcsTotal += amt;
    });
  }

  // Pre-calculate HSN summary & Ledger summary tables
  const hsnMap = {};
  const lines = form.entryTab === 'with_item' ? (form.productLines || []) : (form.salesLines || []);
  lines.forEach((line) => {
    const hsn = (line.hsnSacCode || '').trim() || '-';
    if (!hsnMap[hsn]) {
      hsnMap[hsn] = { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
    }
    hsnMap[hsn].taxableValue += (form.entryTab === 'with_item' ? line.taxableAmount : line.amount) || 0;
    hsnMap[hsn].cgst += line.cgst || 0;
    hsnMap[hsn].sgst += line.sgst || 0;
    hsnMap[hsn].igst += line.igst || 0;
    hsnMap[hsn].cess += line.cess || 0;
  });

  const hsnTaxDetails = Object.values(hsnMap).map(row => ({
    hsn: row.hsn,
    taxableValue: parseFloat(row.taxableValue.toFixed(2)),
    cgst: parseFloat(row.cgst.toFixed(2)),
    sgst: parseFloat(row.sgst.toFixed(2)),
    igst: parseFloat(row.igst.toFixed(2)),
    cess: parseFloat(row.cess.toFixed(2)),
  }));

  const ledgerMap = {};
  if (form.entryTab === 'without_item' && Array.isArray(form.salesLines)) {
    form.salesLines.forEach((line) => {
      const nameUpper = (line.salesLedger || '').toUpperCase();
      const isTax = nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST') || nameUpper.includes('UTGST') || nameUpper.includes('CESS');
      if (isTax) return;

      const ledgerName = (line.salesLedger || '').trim() || '-';
      if (!ledgerMap[ledgerName]) {
        ledgerMap[ledgerName] = { ledgerName, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      }
      ledgerMap[ledgerName].taxableValue += line.amount || 0;
      ledgerMap[ledgerName].cgst += line.cgst || 0;
      ledgerMap[ledgerName].sgst += line.sgst || 0;
      ledgerMap[ledgerName].igst += line.igst || 0;
      ledgerMap[ledgerName].cess += line.cess || 0;
    });
  }

  const ledgerTaxDetails = Object.values(ledgerMap).map(row => ({
    ledgerName: row.ledgerName,
    taxableValue: parseFloat(row.taxableValue.toFixed(2)),
    cgst: parseFloat(row.cgst.toFixed(2)),
    sgst: parseFloat(row.sgst.toFixed(2)),
    igst: parseFloat(row.igst.toFixed(2)),
    cess: parseFloat(row.cess.toFixed(2)),
  }));

  let subTotal = 0;
  let grandTotal = 0;
  let roundOff = 0;

  subTotal = baseTotal + cgstTotal + sgstTotal + igstTotal + cessTotal;
  if (form.entryTab !== 'with_item') {
    subTotal += additionalTotal;
  }
  
  const beforeRound = subTotal + tcsTotal - tdsTotal;
  let roundOffVal = form.roundOff !== undefined ? parseFloat(form.roundOff) : (Math.round(beforeRound) - beforeRound);
  if (isNaN(roundOffVal)) {
    roundOffVal = Math.round(beforeRound) - beforeRound;
  }
  grandTotal = Math.round(beforeRound + roundOffVal);
  roundOff = roundOffVal;

  // Build GST breakup details
  const gstDetails = [];
  if (cgstTotal > 0) gstDetails.push({ gstType: 'CGST', ledgerName: 'Output CGST', rate: 0, amount: parseFloat(cgstTotal.toFixed(2)) });
  if (sgstTotal > 0) gstDetails.push({ gstType: 'SGST', ledgerName: 'Output SGST', rate: 0, amount: parseFloat(sgstTotal.toFixed(2)) });
  if (igstTotal > 0) gstDetails.push({ gstType: 'IGST', ledgerName: 'Output IGST', rate: 0, amount: parseFloat(igstTotal.toFixed(2)) });
  if (cessTotal > 0) gstDetails.push({ gstType: 'CESS', ledgerName: 'Cess Ledger', rate: 0, amount: parseFloat(cessTotal.toFixed(2)) });

  return {
    ...form,
    itemAmount: itemAmount.toFixed(2),
    ledgerAmount: ledgerAmount.toFixed(2),
    baseTotal: baseTotal.toFixed(2),
    subTotal: subTotal.toFixed(2),
    cgstTotal: cgstTotal.toFixed(2),
    sgstTotal: sgstTotal.toFixed(2),
    igstTotal: igstTotal.toFixed(2),
    cessTotal: cessTotal.toFixed(2),
    tdsTotal: tdsTotal.toFixed(2),
    tcsTotal: tcsTotal.toFixed(2),
    roundOff: roundOff.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    gstDetails,
    hsnTaxDetails,
    ledgerTaxDetails,
  };
};;

const normalizeVoucherType = (type) => {
  if (!type) return 'sales_invoice';
  return type.toLowerCase().replace(/[\s\-]+/g, '_');
};

const formatDate = (isoStr) => {
  if (!isoStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(isoStr)) return isoStr.slice(0, 10);
  try {
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch (e) {
    console.warn('formatDate error:', e);
  }
  return '';
};

export const useSalesStore = create((set, get) => ({

  // ─── List State ──────────────────────────────────────────────────────────
  transactions: [],
  totalCount: 0,
  currentPage: 1,
  pageLimit: 20,
  filters: {
    voucherType: 'sales_invoice',
    status: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },

  // ─── Detail State ─────────────────────────────────────────────────────────
  selectedTransaction: null,

  // ─── Stats State ─────────────────────────────────────────────────────────
  stats: null,

  // ─── Form State (manual + OCR autofill) ──────────────────────────────────
  form: { ...DEFAULT_FORM },

  // ─── OCR Workflow State ───────────────────────────────────────────────────
  ocr: {
    file: null,         // File object
    previewUrl: null,         // local object URL for PDF/image preview
    isExtracting: false,
    uploadProgress: 0,
    result: null,         // full extraction result from backend
    error: null,
  },

  // ─── CSV Workflow State ───────────────────────────────────────────────────
  csv: {
    file: null,
    isPreviewLoading: false,
    preview: null,         // { totalRows, validCount, failedCount, errors, preview[] }
    isImporting: false,
    importResult: null,         // { inserted, failed, errors }
    error: null,
  },

  // ─── Master Data State ────────────────────────────────────────────────────
  masterData: {
    salesLedgers: [],
    partyLedgers: [],
    partyLedgerDetails: {},
    gstRegistrations: [],
    stockItems: [],
    stockItemDetails: {},
    tcsLedgers: [],
    additionalChargeLedgers: [],
    taxLedgers: [],
    allLedgers: [],
    voucherTypes: [],
    salesOrders: [],
    salesOrdersRaw: [],
    // Change by Anjalee: Credit Note — sales invoices per selected party
    creditNoteInvoices: [],
    creditNoteInvoicesRaw: [],
    loading: false,
  },

  // ─── Loading / Error ─────────────────────────────────────────────────────
  loading: {
    list: false,
    detail: false,
    save: false,
    status: false,
    stats: false,
  },
  error: null,

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: List + Filters
  // ─────────────────────────────────────────────────────────────────────────

  setFilter: (key, value) => set((s) => ({
    filters: { ...s.filters, [key]: value },
    currentPage: 1,
  })),

  setPage: (page) => set({ currentPage: page }),

  fetchTransactions: async () => {
    const { filters, currentPage, pageLimit } = get();
    set((s) => ({ loading: { ...s.loading, list: true }, error: null }));
    try {
      const params = { ...filters, page: currentPage, limit: pageLimit };
      // Remove empty filters
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });

      const res = await salesApi.list(params);

      // Normalize sales_vouchers to match standard transaction keys
      const normalizedList = (res.data || []).map(v => ({
        ...v,
        voucherType: normalizeVoucherType(v.voucherType),
        partyLedger: v.partyLedgerName || v.partyLedger || '',
        partyGstin: v.partyGSTIN || v.partyGstin || '',
        invoiceNumber: v.invoiceNumber || '',
        // Change by Anjalee: Explicitly map referenceNumber so SalesPanel column can show it
        referenceNumber: v.referenceNumber || '',
        invoiceDate: v.voucherDate || v.invoiceDate || '', // fallback so date column is not blank
        baseTotal: v.baseAmount || v.baseTotal || 0,
        status: (v.status || 'draft').toLowerCase(), // map uppercase DRAFT/PENDING_REVIEW to lowercase
        entryTab: v.entryTab || (v.salesEntries?.length ? 'without_item' : 'with_item'),
      }));

      // Sort normalizedList by date or createdAt descending
      normalizedList.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.invoiceDate || a.voucherDate || 0);
        const dateB = new Date(b.createdAt || b.invoiceDate || b.voucherDate || 0);
        return dateB - dateA;
      });

      const total = res.pagination?.total || normalizedList.length || 0;

      set({
        transactions: normalizedList,
        totalCount: total,
      });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load transactions' });
    } finally {
      set((s) => ({ loading: { ...s.loading, list: false } }));
    }
  },

  fetchStats: async (voucherType) => {
    set((s) => ({ loading: { ...s.loading, stats: true } }));
    try {
      const res = await salesApi.getStats(voucherType);
      set({ stats: res.data });
    } catch (_) { /* silent */ } finally {
      set((s) => ({ loading: { ...s.loading, stats: false } }));
    }
  },

  fetchById: async (id) => {
    set((s) => ({ loading: { ...s.loading, detail: true }, error: null }));
    try {
      const res = await salesApi.getById(id);
      const data = res.data;

      // Map database structure to UI rows with temporary UI ids and default structures
      const defaultProductLine = { srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 };
      const productLines = Array.isArray(data.inventoryEntries) && data.inventoryEntries.length > 0
        ? data.inventoryEntries.map((line, idx) => ({ ...defaultProductLine, ...line, srNo: line.srNo || idx + 1, id: Date.now() + idx }))
        : (Array.isArray(data.productLines) && data.productLines.length > 0
          ? data.productLines.map((line, idx) => ({ ...defaultProductLine, ...line, srNo: line.srNo || idx + 1, id: Date.now() + idx }))
          : [{ id: Date.now(), ...defaultProductLine }]);

      const defaultSalesLine = { srNo: 1, salesLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 };
      const salesLines = Array.isArray(data.salesEntries) && data.salesEntries.length > 0
        ? data.salesEntries.map((line, idx) => ({
          ...defaultSalesLine,
          id: Date.now() + 100 + idx,
          srNo: idx + 1,
          salesLedger: line.ledgerName,
          description: line.description || '',
          hsnSacCode: line.hsnSacCode || '',
          amount: line.amount || 0,
          gstRate: line.gstRate || 0
        }))
        : (Array.isArray(data.salesLines) && data.salesLines.length > 0
          ? data.salesLines.map((line, idx) => ({ ...defaultSalesLine, ...line, srNo: line.srNo || idx + 1, id: Date.now() + 100 + idx }))
          : [{ id: Date.now() + 50, ...defaultSalesLine }]);

      const defaultAdditionalCharge = { ledgerName: '', amount: 0 };
      const additionalCharges = Array.isArray(data.additionalCharges)
        ? data.additionalCharges.map((line, idx) => ({ ...defaultAdditionalCharge, ...line, id: Date.now() + 200 + idx }))
        : [];

      const defaultTcsDetail = { ledgerName: '', assessableValue: 0, rate: 0, amount: 0 };
      const tcsDetails = Array.isArray(data.tcsDetails) && data.tcsDetails.length > 0
        ? data.tcsDetails.map((line, idx) => ({ ...defaultTcsDetail, ...line, id: Date.now() + 400 + idx }))
        : [{ id: Date.now() + 400, ...defaultTcsDetail }];

      const defaultTdsDetail = { ledgerName: '', assessableValue: 0, rate: 0, amount: 0 };
      const tdsDetails = Array.isArray(data.tdsDetails) && data.tdsDetails.length > 0
        ? data.tdsDetails.map((line, idx) => ({ ...defaultTdsDetail, ...line, id: Date.now() + 500 + idx }))
        : [];

      const formValues = {
        ...data,
        voucherType: normalizeVoucherType(data.voucherType),
        partyLedger: data.partyLedgerName || data.partyLedger || '',
        partyGstin: data.partyGSTIN || data.partyGstin || '',
        gstRegistration: data.gstRegistration || (data.companyState ? `${data.companyState} Registration` : (data.gstState ? `${data.gstState} Registration` : '')),
        gstRegistrationType: data.gstRegistrationType || '',
        consigneeLedger: data.consigneeLedger || 'Same as Party',
        consigneeGstin: data.consigneeGstin || '',
        entryMode: data.entryMode || 'manual',
        ocrMetadata: data.ocrMetadata || null,
        bulkMetadata: data.bulkMetadata || null,
        creditNoteDate: data.creditNoteDate || '',
        salesLedger: data.salesLedger || (salesLines[0]?.salesLedger || (get().masterData.salesLedgers?.[0] || '')),
        entryTab: data.entryTab || (data.salesEntries?.length ? 'without_item' : 'with_item'),
        voucherDate: formatDate(data.voucherDate || data.invoiceDate),
        invoiceDate: formatDate(data.invoiceDate || data.voucherDate),
        // Change by Anjalee: Explicitly map invoiceNumber so it shows on Edit
        invoiceNumber: data.invoiceNumber || '',
        voucherNumber: data.voucherNumber || '',
        productLines,
        salesLines,
        additionalCharges,
        tcsDetails,
        tdsDetails,
        referenceNumber: data.referenceNumber || '',
        _id: data._id || data.id,
      };

      set({
        selectedTransaction: data,
        form: calculateFormTotals(formValues)
      });

      if (formValues.partyLedger) {
        if (formValues.voucherType === 'credit_note') {
          await get().fetchCreditNoteInvoicesForParty(formValues.partyLedger);
        } else if (formValues.voucherType === 'sales_invoice') {
          get().fetchSalesOrdersForParty(formValues.partyLedger);
        }
      }

      return data;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load transaction' });
    } finally {
      set((s) => ({ loading: { ...s.loading, detail: false } }));
    }
  },

  fetchMasterData: async () => {
    set((s) => ({ masterData: { ...s.masterData, loading: true } }));
    try {
      const res = await salesApi.getMasterData();
      if (res.success) {
        // Change by Anjalee: Fetch and merge sales voucher master data for without-item mode
        try {
          const partyRes = await salesVoucherApi.getPartyLedgers();
          const salesRes = await salesVoucherApi.getSalesLedgers();
          const stockRes = await salesVoucherApi.getStockItems().catch(() => ({ success: false, data: [] }));
          const salesOrdersRes = await salesApi.list({ voucherType: 'sales_order', limit: 100 }).catch(() => ({ data: [] }));
          const salesOrders = (salesOrdersRes.data || [])
            .map(so => so.voucherNumber || so.invoiceNumber)
            .filter(Boolean);

          if (partyRes.success && salesRes.success) {
            const partyNames = partyRes.data.map(l => l.name);
            const salesNames = salesRes.data.map(l => l.name);
            const partyDetails = {};
            partyRes.data.forEach(l => {
              partyDetails[l.name] = {
                id: l.id,
                gstin: l.gstin,
                gstState: l.gstState,
                registrationType: l.registrationType,
                address: l.address || [],
                email: l.email || '',
                phone: l.phone || '',
                panNumber: l.panNumber || '',
                groupName: l.groupName || ''
              };
            });

            // Build stockItems list and stockItemDetails keyed by name for HSN autofill
            const stockItemsRaw = (stockRes.success && stockRes.data) ? stockRes.data : [];
            const stockNames = stockItemsRaw.map(item => item.name).filter(Boolean);
            const stockItemDetails = {};
            stockItemsRaw.forEach(item => {
              if (item.name) {
                stockItemDetails[item.name] = { hsnCode: item.hsnCode || '', gstRate: item.gstRate || 0, unit: item.unit || '', qty: item.qty || 0 };
              }
            });

            set({
              masterData: {
                ...res.data,
                partyLedgers: partyNames.length ? partyNames : res.data.partyLedgers,
                salesLedgers: salesNames.length ? salesNames : res.data.salesLedgers,
                partyLedgerDetails: Object.keys(partyDetails).length ? partyDetails : res.data.partyLedgerDetails,
                stockItems: stockNames.length ? stockNames : res.data.stockItems,
                stockItemDetails: Object.keys(stockItemDetails).length ? stockItemDetails : (res.data.stockItemDetails || {}),
                salesOrders: salesOrders,
                salesOrdersRaw: salesOrdersRes.data || [],
                loading: false
              }
            });
            const nextSalesNames = salesNames.length ? salesNames : res.data.salesLedgers;
            if (!get().form._id && !get().form.salesLedger && nextSalesNames?.length > 0) {
              set((s) => ({
                form: {
                  ...s.form,
                  salesLedger: nextSalesNames[0]
                }
              }));
            }
            return;
          }
        } catch (e) {
          console.error("Failed to load sales-voucher master data:", e);
        }

        set({
          masterData: {
            ...res.data,
            salesOrdersRaw: [],
            loading: false,
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err);
      set((s) => ({ masterData: { ...s.masterData, loading: false } }));
    }
  },


  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: Form Management
  // ─────────────────────────────────────────────────────────────────────────

  fetchNextInvoiceNumber: async (voucherType = 'sales_invoice') => {
    try {
      const res = await salesApi.getNextInvoiceNumber(voucherType);
      if (res?.success && res?.data?.invoiceNumber) {
        set((s) => ({
          form: calculateFormTotals({ ...s.form, voucherNumber: res.data.invoiceNumber }),
        }));
      }
    } catch (e) {
      // Silently fail — user can still type manually
      console.warn('Could not fetch next invoice number:', e);
    }
  },

  setFormField: (key, value) => set((s) => {
    const nextForm = { ...s.form, [key]: value };
    return {
      form: calculateFormTotals(nextForm),
    };
  }),

  setForm: (formData) => set((s) => {
    const nextForm = { ...s.form, ...formData };
    return {
      form: calculateFormTotals(nextForm),
    };
  }),

  resetForm: () => set({
    form: {
      ...DEFAULT_FORM,
      salesLedger: get().masterData.salesLedgers?.[0] || '',
      productLines: [{ ...DEFAULT_FORM.productLines[0], id: Date.now() }],
      salesLines: [{ ...DEFAULT_FORM.salesLines[0], id: Date.now() + 100 }],
      tcsDetails: [{ id: Date.now() + 200, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }]
    },
  }),

  // ─── Filter Sales Orders by Party ─────────────────────────────────────────
  // Change by Anjalee: When a party ledger is selected in Sales Invoice form,
  // filter the salesOrdersRaw list to only show orders for that party.
  fetchSalesOrdersForParty: (partyName) => set((s) => {
    const raw = s.masterData.salesOrdersRaw || [];
    const filtered = partyName
      ? raw.filter(so =>
        (so.partyLedgerName || '').toLowerCase() === partyName.toLowerCase()
      )
      : raw;
    const filteredNumbers = filtered
      .map(so => so.voucherNumber || so.invoiceNumber)
      .filter(Boolean);
    return {
      masterData: { ...s.masterData, salesOrders: filteredNumbers }
    };
  }),

  // ─── Autofill form from a selected Sales Order (for Sales Invoice) ──────────
  // Change by Anjalee: When user picks a Reference Number (Sales Order voucher no.)
  // in Sales Invoice form, load all data from that order into the invoice form.
  autofillFromSalesOrder: (voucherNumber) => set((s) => {
    const raw = s.masterData.salesOrdersRaw || [];
    const so = raw.find(
      r => (r.voucherNumber || r.invoiceNumber) === voucherNumber
    );
    if (!so) return {};

    // Map inventoryEntries → productLines
    const defaultProductLine = { srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 };
    const productLines = Array.isArray(so.inventoryEntries) && so.inventoryEntries.length > 0
      ? so.inventoryEntries.map((line, idx) => ({ ...defaultProductLine, ...line, id: Date.now() + idx, srNo: idx + 1 }))
      : [{ id: Date.now(), ...defaultProductLine }];

    // Map salesEntries → salesLines
    const defaultSalesLine = { srNo: 1, salesLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 };
    const salesLines = Array.isArray(so.salesEntries) && so.salesEntries.length > 0
      ? so.salesEntries.map((line, idx) => ({
        ...defaultSalesLine,
        id: Date.now() + 100 + idx,
        srNo: idx + 1,
        salesLedger: line.ledgerName || '',
        description: line.description || '',
        hsnSacCode: line.hsnSacCode || '',
        amount: line.amount || 0,
        gstRate: line.gstRate || 0,
      }))
      : [{ id: Date.now() + 50, ...defaultSalesLine }];

    // Map additionalCharges
    const additionalCharges = Array.isArray(so.additionalCharges)
      ? so.additionalCharges.map((c, idx) => ({ ...c, id: Date.now() + 200 + idx }))
      : [];

    // Map tcsDetails
    const tcsDetails = Array.isArray(so.tcsDetails) && so.tcsDetails.length > 0
      ? so.tcsDetails.map((t, idx) => ({ ...t, id: Date.now() + 400 + idx }))
      : [{ id: Date.now() + 400, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }];

    const entryTab = so.entryTab || (so.inventoryEntries?.length ? 'with_item' : 'without_item');

    const partyName = so.partyLedgerName || so.partyLedger || s.form.partyLedger;
    const details = s.masterData.partyLedgerDetails?.[partyName] || {};

    // Build the autofilled form — keep voucherType as sales_invoice, keep referenceNumber
    const filledForm = {
      ...s.form,
      entryTab,
      partyLedger: partyName,
      partyGstin: so.partyGSTIN || so.partyGstin || details.gstin || s.form.partyGstin,
      gstRegistration: so.gstRegistration || (details.gstState ? `${details.gstState} Registration` : s.form.gstRegistration),
      gstRegistrationType: so.gstRegistrationType || details.registrationType || s.form.gstRegistrationType,
      consigneeLedger: so.consigneeLedger || s.form.consigneeLedger,
      salesLedger: so.salesLedger || (salesLines[0]?.salesLedger || (s.form.salesLedger || (s.masterData.salesLedgers?.[0] || ''))),
      narration: so.narration || s.form.narration,
      productLines,
      salesLines,
      additionalCharges,
      tcsDetails,
      // Do NOT overwrite: voucherType (stays sales_invoice), referenceNumber, voucherNumber, invoiceNumber
    };

    return { form: calculateFormTotals(filledForm) };
  }),

  // ─── Credit Note: Fetch sales invoices for a party ───────────────────────
  // Change by Anjalee: When party ledger is selected in Credit Note form,
  // fetch all sales_invoice records for that party and store their voucher numbers
  // in masterData.creditNoteInvoices for the Reference Number dropdown.
  fetchCreditNoteInvoicesForParty: async (partyName) => {
    try {
      const res = await salesApi.getSalesInvoicesByParty(partyName);
      const docs = res?.data || [];
      const invoiceNumbers = docs
        .map(d => d.voucherNumber || d.invoiceNumber)
        .filter(Boolean);
      set((s) => ({
        masterData: {
          ...s.masterData,
          creditNoteInvoices: invoiceNumbers,
          creditNoteInvoicesRaw: docs,
        }
      }));
    } catch (e) {
      console.warn('Could not fetch invoices for party:', e);
    }
  },

  // ─── Credit Note: Autofill from selected Sales Invoice reference ───────────
  // Change by Anjalee: When user picks a Reference Number (sales invoice's voucherNumber)
  // in Credit Note form, copy all data from that invoice into the credit note form.
  autofillFromSalesInvoice: (voucherNumber) => set((s) => {
    const raw = s.masterData.creditNoteInvoicesRaw || [];
    const inv = raw.find(
      r => (r.voucherNumber || r.invoiceNumber) === voucherNumber
    );
    if (!inv) return {};



    const defaultProductLine = { srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 };
    const productLines = Array.isArray(inv.inventoryEntries) && inv.inventoryEntries.length > 0
      ? inv.inventoryEntries.map((line, idx) => ({ ...defaultProductLine, ...line, id: Date.now() + idx, srNo: idx + 1 }))
      : [{ id: Date.now(), ...defaultProductLine }];

    const defaultSalesLine = { srNo: 1, salesLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 };
    const salesLines = Array.isArray(inv.salesEntries) && inv.salesEntries.length > 0
      ? inv.salesEntries.map((line, idx) => ({
        ...defaultSalesLine,
        id: Date.now() + 100 + idx,
        srNo: idx + 1,
        salesLedger: line.ledgerName || '',
        description: line.description || '',
        hsnSacCode: line.hsnSacCode || '',
        amount: line.amount || 0,
        gstRate: line.gstRate || 0,
      }))
      : [{ id: Date.now() + 50, ...defaultSalesLine }];

    const additionalCharges = Array.isArray(inv.additionalCharges)
      ? inv.additionalCharges.map((c, idx) => ({ ...c, id: Date.now() + 200 + idx }))
      : [];

    const tcsDetails = Array.isArray(inv.tcsDetails) && inv.tcsDetails.length > 0
      ? inv.tcsDetails.map((t, idx) => ({ ...t, id: Date.now() + 400 + idx }))
      : [{ id: Date.now() + 400, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }];

    const entryTab = inv.entryTab || (inv.inventoryEntries?.length ? 'with_item' : 'without_item');

    const partyName = inv.partyLedgerName || inv.partyLedger || s.form.partyLedger;
    const details = s.masterData.partyLedgerDetails?.[partyName] || {};

    const filledForm = {
      ...s.form,
      entryTab,
      // Copy party details from the referenced invoice
      partyLedger: partyName,
      partyGstin: inv.partyGSTIN || inv.partyGstin || details.gstin || s.form.partyGstin,
      gstRegistration: inv.gstRegistration || (details.gstState ? `${details.gstState} Registration` : s.form.gstRegistration),
      gstRegistrationType: inv.gstRegistrationType || details.registrationType || s.form.gstRegistrationType,
      consigneeLedger: inv.consigneeLedger || s.form.consigneeLedger,
      salesLedger: inv.salesLedger || (salesLines[0]?.salesLedger || (s.form.salesLedger || (s.masterData.salesLedgers?.[0] || ''))),
      // Copy invoice date as voucher date reference
      voucherDate: formatDate(inv.voucherDate || inv.invoiceDate),
      invoiceDate: formatDate(inv.invoiceDate || inv.voucherDate),
      // Copy line items
      productLines,
      salesLines,
      additionalCharges,
      tcsDetails,
      narration: inv.narration || s.form.narration,
      // Do NOT overwrite: voucherType (stays credit_note), referenceNumber, creditNoteDate
    };

    return { form: calculateFormTotals(filledForm) };
  }),

  // ─── Autofill from OCR extraction result ─────────────────────────────────
  autofillFormFromOcr: (ocrFormFields) => set((s) => {
    const entryTab = ocrFormFields.productLines?.length ? 'with_item' : (ocrFormFields.salesLines?.length ? 'without_item' : s.form.entryTab);

    const filledForm = {
      ...s.form,
      entryTab,
      invoiceNumber: ocrFormFields.invoiceNumber || s.form.invoiceNumber,
      invoiceDate: ocrFormFields.invoiceDate || s.form.invoiceDate,
      partyLedger: ocrFormFields.partyLedger || s.form.partyLedger,
      partyGstin: ocrFormFields.partyGstin || s.form.partyGstin,
      salesLedger: ocrFormFields.salesLedger || s.form.salesLedger,

      productLines: ocrFormFields.productLines?.length
        ? ocrFormFields.productLines.map((l, i) => ({ ...l, id: Date.now() + i }))
        : s.form.productLines,

      salesLines: ocrFormFields.salesLines?.length
        ? ocrFormFields.salesLines.map((l, i) => ({ ...l, id: Date.now() + i + 100 }))
        : s.form.salesLines,

      narration: ocrFormFields.narration || s.form.narration,
    };

    return {
      form: calculateFormTotals(filledForm),
    };
  }),

  // ─── Line item helpers ────────────────────────────────────────────────────
  addProductLine: () => set((s) => {
    const newRow = { id: Date.now(), srNo: s.form.productLines.length + 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 };
    return {
      form: calculateFormTotals({ ...s.form, productLines: [...s.form.productLines, newRow] }),
    };
  }),

  updateProductLine: (id, fieldOrChanges, value) => set((s) => {
    const nextProductLines = s.form.productLines.map((l) => {
      if (l.id === id) {
        // Support both (id, field, value) and (id, {field: value, ...}) signatures
        const changes = typeof fieldOrChanges === 'object' && fieldOrChanges !== null
          ? fieldOrChanges
          : { [fieldOrChanges]: value };
        const updated = { ...l, ...changes };
        const qty = parseFloat(updated.billQuantity) || 0;
        const rate = parseFloat(updated.billRate) || 0;
        const disc = parseFloat(updated.discountPercent) || 0;
        updated.amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
        return updated;
      }
      return l;
    });
    return {
      form: calculateFormTotals({ ...s.form, productLines: nextProductLines }),
    };
  }),

  removeProductLine: (id) => set((s) => {
    const nextLines = s.form.productLines
      .filter((l) => l.id !== id)
      .map((l, i) => ({ ...l, srNo: i + 1 }));
    return {
      form: calculateFormTotals({ ...s.form, productLines: nextLines }),
    };
  }),

  addSalesLine: () => set((s) => {
    const newRow = { id: Date.now(), srNo: s.form.salesLines.length + 1, salesLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 };
    return {
      form: calculateFormTotals({ ...s.form, salesLines: [...s.form.salesLines, newRow] }),
    };
  }),

  // Change by Anjalee: Support both (id, field, value) and (id, {field: value, ...}) signatures
  updateSalesLine: (id, fieldOrChanges, value) => set((s) => {
    const nextLines = s.form.salesLines.map((l) => {
      if (l.id !== id) return l;
      const changes = typeof fieldOrChanges === 'object' && fieldOrChanges !== null
        ? fieldOrChanges
        : { [fieldOrChanges]: value };
      return { ...l, ...changes };
    });
    return {
      form: calculateFormTotals({ ...s.form, salesLines: nextLines }),
    };
  }),

  removeSalesLine: (id) => set((s) => {
    const nextLines = s.form.salesLines
      .filter((l) => l.id !== id)
      .map((l, i) => ({ ...l, srNo: i + 1 }));
    return {
      form: calculateFormTotals({ ...s.form, salesLines: nextLines }),
    };
  }),

  // ─── Additional Charges ───────────────────────────────────────────────────
  addAdditionalCharge: () => set((s) => {
    // Change by Anjalee: Initialise taxableValue: 0 so new rows never inherit product taxable value
    const newRow = { id: Date.now(), ledgerName: '', amount: 0, taxableValue: 0 };
    return {
      form: calculateFormTotals({ ...s.form, additionalCharges: [...s.form.additionalCharges, newRow] }),
    };
  }),

  updateAdditionalCharge: (id, field, value) => set((s) => {
    // Change by Anjalee: taxableValue is a free user input — update only the field that changed.
    // Do NOT force taxableValue = amount; both are independent per-row user entries.
    const nextCharges = s.form.additionalCharges.map((l) =>
      l.id === id ? { ...l, [field]: value } : l
    );
    return {
      form: calculateFormTotals({ ...s.form, additionalCharges: nextCharges }),
    };
  }),

  removeAdditionalCharge: (id) => set((s) => {
    const nextCharges = s.form.additionalCharges.filter((l) => l.id !== id);
    return {
      form: calculateFormTotals({ ...s.form, additionalCharges: nextCharges }),
    };
  }),

  // ─── TDS Details ──────────────────────────────────────────────────────────
  addTdsDetail: () => set((s) => {
    const newRow = { id: Date.now(), ledgerName: '', assessableValue: 0, rate: 0, amount: 0 };
    return {
      form: calculateFormTotals({ ...s.form, tdsDetails: [...s.form.tdsDetails, newRow] }),
    };
  }),

  updateTdsDetail: (id, field, value) => set((s) => {
    const nextTds = s.form.tdsDetails.map((l) => {
      if (l.id === id) {
        const updated = { ...l, [field]: value };
        const assessable = parseFloat(updated.assessableValue) || 0;
        const rate = parseFloat(updated.rate) || 0;
        updated.amount = parseFloat(((assessable * rate) / 100).toFixed(2));
        return updated;
      }
      return l;
    });
    return {
      form: calculateFormTotals({ ...s.form, tdsDetails: nextTds }),
    };
  }),

  removeTdsDetail: (id) => set((s) => {
    const nextTds = s.form.tdsDetails.filter((l) => l.id !== id);
    return {
      form: calculateFormTotals({ ...s.form, tdsDetails: nextTds }),
    };
  }),

  // ─── TCS Details ──────────────────────────────────────────────────────────
  addTcsDetail: () => set((s) => {
    const newRow = { id: Date.now(), ledgerName: '', assessableValue: 0, rate: 0, amount: 0 };
    return {
      form: calculateFormTotals({ ...s.form, tcsDetails: [...s.form.tcsDetails, newRow] }),
    };
  }),

  updateTcsDetail: (id, field, value) => set((s) => {
    const nextTcs = s.form.tcsDetails.map((l) => {
      if (l.id === id) {
        const updated = { ...l, [field]: value };
        const assessable = parseFloat(updated.assessableValue) || 0;
        const rate = parseFloat(updated.rate) || 0;
        updated.amount = parseFloat(((assessable * rate) / 100).toFixed(2));
        return updated;
      }
      return l;
    });
    return {
      form: calculateFormTotals({ ...s.form, tcsDetails: nextTcs }),
    };
  }),

  removeTcsDetail: (id) => set((s) => {
    const nextTcs = s.form.tcsDetails.filter((l) => l.id !== id);
    return {
      form: calculateFormTotals({ ...s.form, tcsDetails: nextTcs }),
    };
  }),

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: CRUD Submit
  // ─────────────────────────────────────────────────────────────────────────

  saveTransaction: async (asDraft = true) => {
    const { form } = get();
    set((s) => ({ loading: { ...s.loading, save: true }, error: null }));
    try {
      const isWithItem = form.entryTab === 'with_item';
      let inventoryEntries = [];
      let salesEntries = [];

      if (isWithItem) {
        const activeLines = (form.productLines || []).filter(l => l.stockItem && l.stockItem.trim() !== '');
        inventoryEntries = activeLines.map(({ id: _id, ...rest }) => ({
          ...rest,
          billQuantity: parseFloat(rest.billQuantity) || 0,
          billRate: parseFloat(rest.billRate) || 0,
          discountPercent: parseFloat(rest.discountPercent) || 0,
          amount: parseFloat(rest.amount) || 0,
          gstRate: parseFloat(rest.gstRate) || 0
        }));

        const activeSalesLines = (form.salesLines || []).filter(l => l.salesLedger && l.salesLedger.trim() !== '');
        salesEntries = activeSalesLines.map(({ id: _id, ...rest }) => ({
          ledgerName: rest.salesLedger,
          description: rest.description || '',
          hsnSacCode: rest.hsnSacCode || '',
          gstRate: parseFloat(rest.gstRate) || 0,
          amount: parseFloat(rest.amount) || 0
        }));
      } else {
        const activeLines = (form.salesLines || []).filter(l => l.salesLedger && l.salesLedger.trim() !== '');
        salesEntries = activeLines.map(({ id: _id, ...rest }) => ({
          ledgerName: rest.salesLedger,
          description: rest.description || '',
          hsnSacCode: rest.hsnSacCode || '',
          gstRate: parseFloat(rest.gstRate) || 0,
          amount: parseFloat(rest.amount) || 0
        }));
      }

      // Resolve partyLedgerId
      const partyLedgerId = get().masterData.partyLedgerDetails?.[form.partyLedger]?.id || undefined;

      const voucherPayload = {
        voucherNumber: form.voucherNumber || undefined,
        voucherDate: form.voucherDate || form.invoiceDate || undefined,
        voucherType: form.voucherType || 'sales_invoice',
        voucherSeries: form.voucherNumberSeries || 'Default',
        // Change by Anjalee: Include invoiceNumber so it is persisted to the database
        invoiceNumber: form.invoiceNumber || undefined,
        referenceNumber: form.referenceNumber || undefined,
        salesLedger: form.salesLedger || undefined,
        partyLedgerId: partyLedgerId || undefined,
        partyLedgerName: form.partyLedger,
        partyGSTIN: form.partyGstin || undefined,
        gstRegistrationType: form.gstRegistrationType || undefined,
        consigneeLedger: form.consigneeLedger || undefined,
        consigneeGstin: form.consigneeGstin || undefined,
        entryMode: form.entryMode || 'manual',
        ocrMetadata: form.ocrMetadata || undefined,
        bulkMetadata: form.bulkMetadata || undefined,
        creditNoteDate: form.creditNoteDate || undefined,
        tcsAmount: parseFloat(form.tcsTotal) || 0.0,
        roundOffAmount: parseFloat(form.roundOff) || 0.0,
        salesEntries,
        inventoryEntries,
        entryTab: form.entryTab || (isWithItem ? 'with_item' : 'without_item'),
        gstRegistration: form.gstRegistration || undefined,
        additionalCharges: (form.additionalCharges || []).map(({ id: _id, ...rest }) => ({
          ...rest,
          amount: parseFloat(rest.amount) || 0
        })),
        tcsDetails: (form.tcsDetails || []).map(({ id: _id, ...rest }) => ({
          ...rest,
          assessableValue: parseFloat(rest.assessableValue) || 0,
          rate: parseFloat(rest.rate) || 0,
          amount: parseFloat(rest.amount) || 0
        })),
        tdsDetails: (form.tdsDetails || []).map(({ id: _id, ...rest }) => ({
          ...rest,
          assessableValue: parseFloat(rest.assessableValue) || 0,
          rate: parseFloat(rest.rate) || 0,
          amount: parseFloat(rest.amount) || 0
        })),
        narration: form.narration || '',
        status: asDraft ? 'DRAFT' : 'PENDING_APPROVAL'
      };

      let res;
      if (form._id) {
        res = await salesApi.update(form._id, voucherPayload);
      } else {
        res = await salesApi.create(voucherPayload);
      }

      const savedDoc = res.data;
      if (savedDoc) {
        const productLines = Array.isArray(savedDoc.inventoryEntries) && savedDoc.inventoryEntries.length > 0
          ? savedDoc.inventoryEntries.map((line, idx) => ({ ...line, id: Date.now() + idx }))
          : (Array.isArray(savedDoc.productLines) && savedDoc.productLines.length > 0
            ? savedDoc.productLines.map((line, idx) => ({ ...line, id: Date.now() + idx }))
            : [{ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }]);

        const salesLines = Array.isArray(savedDoc.salesEntries) && savedDoc.salesEntries.length > 0
          ? savedDoc.salesEntries.map((line, idx) => ({
            id: Date.now() + 100 + idx,
            srNo: idx + 1,
            salesLedger: line.ledgerName,
            description: line.description || '',
            hsnSacCode: line.hsnSacCode || '',
            amount: line.amount || 0,
            gstRate: line.gstRate || 0
          }))
          : (Array.isArray(savedDoc.salesLines) && savedDoc.salesLines.length > 0
            ? savedDoc.salesLines.map((line, idx) => ({ ...line, id: Date.now() + 100 + idx }))
            : [{ id: Date.now() + 50, srNo: 1, salesLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }]);

        const additionalCharges = Array.isArray(savedDoc.additionalCharges)
          ? savedDoc.additionalCharges.map((line, idx) => ({ ...line, id: Date.now() + 200 + idx }))
          : [];

        const tcsDetails = Array.isArray(savedDoc.tcsDetails) && savedDoc.tcsDetails.length > 0
          ? savedDoc.tcsDetails.map((line, idx) => ({ ...line, id: Date.now() + 400 + idx }))
          : [{ id: Date.now() + 400, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }];

        const tdsDetails = Array.isArray(savedDoc.tdsDetails) && savedDoc.tdsDetails.length > 0
          ? savedDoc.tdsDetails.map((line, idx) => ({ ...line, id: Date.now() + 500 + idx }))
          : [];

        const updatedFormValues = {
          ...savedDoc,
          voucherType: normalizeVoucherType(savedDoc.voucherType),
          partyLedger: savedDoc.partyLedgerName || savedDoc.partyLedger || '',
          partyGstin: savedDoc.partyGSTIN || savedDoc.partyGstin || '',
          gstRegistration: savedDoc.gstRegistration || (savedDoc.companyState ? `${savedDoc.companyState} Registration` : (savedDoc.gstState ? `${savedDoc.gstState} Registration` : '')),
          gstRegistrationType: savedDoc.gstRegistrationType || '',
          consigneeLedger: savedDoc.consigneeLedger || 'Same as Party',
          consigneeGstin: savedDoc.consigneeGstin || '',
          entryMode: savedDoc.entryMode || 'manual',
          ocrMetadata: savedDoc.ocrMetadata || null,
          bulkMetadata: savedDoc.bulkMetadata || null,
          creditNoteDate: savedDoc.creditNoteDate || '',
          salesLedger: savedDoc.salesLedger || (salesLines[0]?.salesLedger || (get().masterData.salesLedgers?.[0] || '')),
          entryTab: savedDoc.entryTab || (savedDoc.salesEntries?.length ? 'without_item' : 'with_item'),
          voucherDate: formatDate(savedDoc.voucherDate || savedDoc.invoiceDate),
          invoiceDate: formatDate(savedDoc.invoiceDate || savedDoc.voucherDate),
          // Change by Anjalee: Map invoiceNumber and voucherNumber explicitly after save
          invoiceNumber: savedDoc.invoiceNumber || '',
          voucherNumber: savedDoc.voucherNumber || '',
          productLines,
          salesLines,
          additionalCharges,
          tcsDetails,
          tdsDetails,
          referenceNumber: savedDoc.referenceNumber || '',
          _id: savedDoc._id || savedDoc.id || get().form._id,
        };

        set({
          selectedTransaction: savedDoc,
          form: calculateFormTotals(updatedFormValues)
        });

        if (updatedFormValues.partyLedger) {
          if (updatedFormValues.voucherType === 'credit_note') {
            await get().fetchCreditNoteInvoicesForParty(updatedFormValues.partyLedger);
          } else if (updatedFormValues.voucherType === 'sales_invoice') {
            get().fetchSalesOrdersForParty(updatedFormValues.partyLedger);
          }
        }
      } else {
        set({ selectedTransaction: res.data });
      }
      return { success: true, data: res.data };

    } catch (err) {
      const message = err.response?.data?.message || 'Save failed';
      set({ error: message });
      return { success: false, message };
    } finally {
      set((s) => ({ loading: { ...s.loading, save: false } }));
    }
  },

  pushToReview: async (id) => {
    set((s) => ({ loading: { ...s.loading, status: true } }));
    try {
      const res = await salesApi.updateStatus(id, 'pending_approval');
      set({ selectedTransaction: res.data });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message };
    } finally {
      set((s) => ({ loading: { ...s.loading, status: false } }));
    }
  },

  approveTransaction: async (id, note) => {
    set((s) => ({ loading: { ...s.loading, status: true } }));
    try {
      const res = await salesApi.updateStatus(id, 'approved', note);
      set({ selectedTransaction: res.data });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message };
    } finally {
      set((s) => ({ loading: { ...s.loading, status: false } }));
    }
  },

  deleteTransaction: async (id) => {
    set((s) => ({ loading: { ...s.loading, status: true } }));
    try {
      await salesApi.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' };
    } finally {
      set((s) => ({ loading: { ...s.loading, status: false } }));
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: AI-OCR Workflow
  // ─────────────────────────────────────────────────────────────────────────

  setOcrFile: (file) => {
    const prev = get().ocr.previewUrl;
    if (prev) URL.revokeObjectURL(prev);
    const previewUrl = file ? URL.createObjectURL(file) : null;
    set((s) => ({
      ocr: { ...s.ocr, file, previewUrl, result: null, error: null, uploadProgress: 0 },
    }));
  },

  runOcrExtraction: async () => {
    const { ocr, autofillFormFromOcr } = get();
    if (!ocr.file) return { success: false, message: 'No file selected' };

    set((s) => ({
      ocr: { ...s.ocr, isExtracting: true, error: null, uploadProgress: 0 },
    }));

    try {
      // 1. Upload file using bulk upload endpoint
      const uploadRes = await bulkUploadApi.uploadFile(ocr.file, (progress) => {
        set((s) => ({ ocr: { ...s.ocr, uploadProgress: Math.min(progress, 85) } }));
      }, true);

      const uploadId = uploadRes.upload_id;

      // 2. Process OCR and run AI extraction
      const analyzeRes = await bulkUploadApi.analyzeDocument(uploadId, true);
      const schema = analyzeRes.schema;

      // 3. Map dynamic schema to formFields
      const fields = {};
      const productLines = [];
      
      const parseNumeric = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = val.toString().replace(/,/g, '').match(/[-+]?[0-9]*\.?[0-9]+/);
        return cleaned ? parseFloat(cleaned[0]) : 0;
      };

      for (const section of schema?.sections || []) {
        for (const field of section.fields || []) {
          if (field.type === 'table') {
            if (field.id === 'line_items' || field.id === 'inventoryEntries') {
              const rows = field.rows || field.value || [];
              for (const row of rows) {
                productLines.push({
                  stockItem: row.item_name || row.stockItem || '',
                  description: row.description || '',
                  hsnSacCode: row.hsn_code || row.hsnSacCode || '',
                  billQuantity: parseNumeric(row.qty || row.billQuantity || 0),
                  billRate: parseNumeric(row.rate || row.billRate || 0),
                  discountPercent: parseNumeric(row.discountPercent || 0),
                  amount: parseNumeric(row.amount || 0),
                  rcm: row.rcm === true || row.rcm === 'true',
                  taxabilityType: row.taxabilityType || 'Taxable',
                  gstRate: parseFloat((row.gst_rate || row.gstRate || 0).toString().replace(/%/g, '')),
                });
              }
            }
          } else {
            if (['invoice_number', 'invoiceNumber', 'voucher_number'].includes(field.id)) {
              fields.invoiceNumber = field.value || '';
              fields.voucherNumber = field.value || '';
            } else if (['invoice_date', 'invoiceDate', 'voucher_date'].includes(field.id)) {
              fields.invoiceDate = field.value || '';
              fields.voucherDate = field.value || '';
            } else if (['party_ledger', 'party', 'customerName', 'supplierName', 'vendorName'].includes(field.id)) {
              fields.partyLedger = field.value || '';
            } else if (['gstin', 'gstRegistration', 'partyGstin', 'supplierGSTIN', 'customerGSTIN'].includes(field.id)) {
              fields.partyGstin = field.value || '';
            } else if (['state', 'companyState', 'gstState'].includes(field.id)) {
              fields.gstRegistration = field.value ? `${field.value} Registration` : '';
            } else if (['narration', 'narration_remarks'].includes(field.id)) {
              fields.narration = field.value || '';
            }
          }
        }
      }

      if (productLines.length === 0) {
        productLines.push({ stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 });
      }

      const salesLines = productLines.map((l) => ({
        salesLedger: l.stockItem || '',
        description: l.description || '',
        hsnSacCode: l.hsnSacCode || '',
        amount: l.amount || 0,
        gstRate: l.gstRate || 0
      }));

      const formFields = {
        ...fields,
        productLines,
        salesLines,
        entryTab: productLines.some(l => l.stockItem) ? 'with_item' : 'without_item'
      };

      set((s) => ({
        ocr: {
          ...s.ocr,
          result: { confidence: schema.overall_confidence || 90, formFields },
          isExtracting: false,
          uploadProgress: 100
        }
      }));

      autofillFormFromOcr(formFields);
      return { success: true, data: { confidence: schema.overall_confidence || 90 } };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'OCR extraction failed';
      set((s) => ({
        ocr: { ...s.ocr, isExtracting: false, error: message },
      }));
      return { success: false, message };
    }
  },

  submitOcrTransaction: async () => {
    const { form, ocr } = get();
    if (!ocr.result) return { success: false, message: 'No OCR result to submit' };

    set((s) => ({ loading: { ...s.loading, save: true }, error: null }));
    try {
      const payload = {
        ...form,
        status: 'draft',
        entryMode: 'ocr',
        productLines: form.productLines.map(({ id: _id, ...rest }) => rest),
        salesLines: form.salesLines.map(({ id: _id, ...rest }) => rest),
      };
      const res = await salesApi.submitOcrTransaction(payload, ocr.result);
      set({ selectedTransaction: res.data });
      return { success: true, data: res.data };
    } catch (err) {
      const message = err.response?.data?.message || 'OCR submit failed';
      set({ error: message });
      return { success: false, message };
    } finally {
      set((s) => ({ loading: { ...s.loading, save: false } }));
    }
  },

  clearOcr: () => {
    const prev = get().ocr.previewUrl;
    if (prev) URL.revokeObjectURL(prev);
    set((s) => ({
      ocr: { file: null, previewUrl: null, isExtracting: false, uploadProgress: 0, result: null, error: null },
    }));
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: CSV Workflow
  // ─────────────────────────────────────────────────────────────────────────

  setCsvFile: (file) => set((s) => ({
    csv: { ...s.csv, file, preview: null, importResult: null, error: null },
  })),

  previewCsv: async () => {
    const { csv } = get();
    if (!csv.file) return { success: false, message: 'No file selected' };

    set((s) => ({ csv: { ...s.csv, isPreviewLoading: true, error: null } }));
    try {
      const res = await salesApi.previewCsv(csv.file);
      set((s) => ({ csv: { ...s.csv, preview: res.data, isPreviewLoading: false } }));
      return { success: true, data: res.data };
    } catch (err) {
      const message = err.response?.data?.message || 'CSV preview failed';
      set((s) => ({ csv: { ...s.csv, isPreviewLoading: false, error: message } }));
      return { success: false, message };
    }
  },

  importCsv: async (voucherType) => {
    const { csv } = get();
    if (!csv.file) return { success: false, message: 'No file selected' };

    set((s) => ({ csv: { ...s.csv, isImporting: true, error: null } }));
    try {
      const res = await salesApi.importCsv(csv.file, voucherType);
      set((s) => ({ csv: { ...s.csv, isImporting: false, importResult: res.data } }));
      return { success: true, data: res.data };
    } catch (err) {
      const message = err.response?.data?.message || 'CSV import failed';
      set((s) => ({ csv: { ...s.csv, isImporting: false, error: message } }));
      return { success: false, message };
    }
  },

  clearCsv: () => set((s) => ({
    csv: { file: null, isPreviewLoading: false, preview: null, isImporting: false, importResult: null, error: null },
  })),

  downloadSampleCsv: (voucherType) => salesApi.downloadSampleCsv(voucherType),

  exportToTally: async (ids) => {
    try {
      await salesApi.exportToTally(ids);
      return { success: true };
    } catch (err) {
      return { success: false, message: 'Export failed' };
    }
  },
}));

export default useSalesStore;
