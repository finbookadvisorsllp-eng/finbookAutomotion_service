import { create } from 'zustand';
import purchaseApi from '../services/purchaseApi';

/**
 * usePurchaseStore — Zustand store for the entire Purchase module.
 */

const DEFAULT_FORM = {
  voucherType: 'purchase_invoice',
  voucherNumberSeries: 'Default',
  voucherDate: '',
  invoiceDate: '',
  invoiceNumber: '',
  poNumber: '',
  debitNoteDate: '',
  referenceNumber: '',
  purchaseLedger: '',
  gstRegistration: '',
  partyGstin: '',
  partyLedger: '',
  consigneeLedger: 'Same as Party',
  entryTab: 'without_item',
  productLines: [{ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }],
  purchaseLines: [{ id: Date.now(), srNo: 1, purchaseLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }],
  additionalCharges: [],
  tdsDetails: [{ id: Date.now() + 100, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }],
  tcsDetails: [],
  narration: '',
  status: 'draft',
};

const calculateFormTotals = (form) => {
  let baseTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  // Compare first 2 chars of partyGstin and gstRegistration to determine if interstate
  const partyState = form.partyGstin?.trim().substring(0, 2);
  const companyState = form.gstRegistration ? (form.gstRegistration.includes('Maharashtra') ? '27' : '23') : '';
  const isInterstate = partyState && companyState && partyState !== companyState;

  if (form.entryTab === 'with_item' && Array.isArray(form.productLines)) {
    form.productLines.forEach((line) => {
      const qty = parseFloat(line.billQuantity) || 0;
      const rate = parseFloat(line.billRate) || 0;
      const disc = parseFloat(line.discountPercent) || 0;
      const amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
      line.amount = amount;
      const gstRate = parseFloat(line.gstRate) || 0;

      baseTotal += amount;
      if (line.taxabilityType === 'Taxable' && !line.rcm) {
        if (isInterstate) {
          igstTotal += (amount * gstRate) / 100;
        } else {
          cgstTotal += (amount * (gstRate / 2)) / 100;
          sgstTotal += (amount * (gstRate / 2)) / 100;
        }
      }
    });
  }

  if (form.entryTab === 'without_item' && Array.isArray(form.purchaseLines)) {
    form.purchaseLines.forEach((line) => {
      const amount = parseFloat(line.amount) || 0;
      const gstRate = parseFloat(line.gstRate) || 0;

      baseTotal += amount;
      if (isInterstate) {
        igstTotal += (amount * gstRate) / 100;
      } else {
        cgstTotal += (amount * (gstRate / 2)) / 100;
        sgstTotal += (amount * (gstRate / 2)) / 100;
      }
    });
  }

  let additionalTotal = 0;
  let runningTaxable = baseTotal;
  if (Array.isArray(form.additionalCharges)) {
    form.additionalCharges.forEach((c) => {
      const nameUpper = (c.ledgerName || '').toUpperCase();
      const isTaxLedger = nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST') || nameUpper.includes('UTGST');

      if (isTaxLedger) {
        c.taxableValue = runningTaxable.toFixed(2);
        const match = c.ledgerName.match(/(\d+(?:\.\d+)?)\s*%/);
        const rate = match ? parseFloat(match[1]) : null;
        if (rate !== null) {
          c.amount = parseFloat((runningTaxable * rate / 100).toFixed(2));
        } else {
          // Fallback if no percentage in name: use cgstTotal/sgstTotal/igstTotal if available, or 0
          if (nameUpper.includes('CGST')) {
            c.amount = parseFloat((cgstTotal || 0).toFixed(2));
          } else if (nameUpper.includes('SGST') || nameUpper.includes('UTGST')) {
            c.amount = parseFloat((sgstTotal || 0).toFixed(2));
          } else if (nameUpper.includes('IGST')) {
            c.amount = parseFloat((igstTotal || 0).toFixed(2));
          }
        }
      } else {
        c.taxableValue = "0.00";
        runningTaxable += parseFloat(c.amount) || 0;
      }
      additionalTotal += parseFloat(c.amount) || 0;
    });
  }

  const subTotal = baseTotal + cgstTotal + sgstTotal + igstTotal + additionalTotal;

  let tdsTotal = 0;
  if (Array.isArray(form.tdsDetails)) {
    form.tdsDetails.forEach((t) => { tdsTotal += parseFloat(t.amount) || 0; });
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

  const beforeRound = subTotal + tcsTotal - tdsTotal;
  const grandTotal = Math.round(beforeRound);
  const roundOff = grandTotal - beforeRound;

  // Build GST breakup details
  const gstDetails = [];
  if (cgstTotal > 0) gstDetails.push({ gstType: 'CGST', ledgerName: 'Input CGST', rate: 0, amount: parseFloat(cgstTotal.toFixed(2)) });
  if (sgstTotal > 0) gstDetails.push({ gstType: 'SGST', ledgerName: 'Input SGST', rate: 0, amount: parseFloat(sgstTotal.toFixed(2)) });
  if (igstTotal > 0) gstDetails.push({ gstType: 'IGST', ledgerName: 'Input IGST', rate: 0, amount: parseFloat(igstTotal.toFixed(2)) });

  return {
    ...form,
    baseTotal: baseTotal.toFixed(2),
    subTotal: subTotal.toFixed(2),
    cgstTotal: cgstTotal.toFixed(2),
    sgstTotal: sgstTotal.toFixed(2),
    igstTotal: igstTotal.toFixed(2),
    tdsTotal: tdsTotal.toFixed(2),
    tcsTotal: tcsTotal.toFixed(2),
    roundOff: roundOff.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    gstDetails,
  };
};

const normalizeVoucherType = (type) => {
  if (!type) return 'purchase_invoice';
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

export const usePurchaseStore = create((set, get) => ({

  // ─── List State ──────────────────────────────────────────────────────────
  transactions: [],
  totalCount: 0,
  currentPage: 1,
  pageLimit: 20,
  filters: {
    voucherType: 'purchase_invoice',
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

  // ─── Master Data State ────────────────────────────────────────────────────
  masterData: {
    purchaseLedgers: [],
    partyLedgers: [],
    partyLedgerDetails: {},
    gstRegistrations: [],
    stockItems: [],
    stockItemDetails: {},
    tdsLedgers: [],
    additionalChargeLedgers: [],
    voucherTypes: [],
    voucherTypesFull: [],
    purchaseOrders: [],
    purchaseOrdersRaw: [],
    debitNoteInvoices: [],
    debitNoteInvoicesRaw: [],
    loading: false,
  },

  // ─── Form State ──────────────────────────────────────────────────────────
  form: { ...DEFAULT_FORM },

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
      const res = await purchaseApi.list(params);

      // Normalize purchase_vouchers to match standard keys
      const normalizedList = (res.data || []).map(v => ({
        ...v,
        voucherType: normalizeVoucherType(v.voucherType),
        partyLedger: v.partyLedgerName || v.partyLedger || '',
        partyGstin: v.partyGSTIN || v.partyGstin || '',
        invoiceNumber: v.invoiceNumber || '',
        poNumber: v.poNumber || '',
        invoiceDate: v.voucherDate || v.invoiceDate || '', // fallback
        baseTotal: v.baseAmount || v.baseTotal || 0,
        status: (v.status || 'draft').toLowerCase(),
        entryTab: v.entryTab || (v.purchaseLines?.length ? 'without_item' : 'with_item'),
      }));

      // Sort normalizedList by date descending
      normalizedList.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.invoiceDate || a.voucherDate || 0);
        const dateB = new Date(b.createdAt || b.invoiceDate || b.voucherDate || 0);
        return dateB - dateA;
      });

      set({
        transactions: normalizedList,
        totalCount: res.pagination?.total || res.meta?.total || normalizedList.length || 0,
      });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load purchase transactions' });
    } finally {
      set((s) => ({ loading: { ...s.loading, list: false } }));
    }
  },

  fetchStats: async (voucherType) => {
    set((s) => ({ loading: { ...s.loading, stats: true } }));
    try {
      const res = await purchaseApi.getStats(voucherType);
      set({ stats: res.data });
    } catch (err) {
      console.error(err);
    } finally {
      set((s) => ({ loading: { ...s.loading, stats: false } }));
    }
  },

  fetchTransactionById: async (id) => {
    set((s) => ({ loading: { ...s.loading, detail: true }, error: null }));
    try {
      const res = await purchaseApi.getById(id);
      // Map database structure to UI rows with temporary UI ids
      const doc = res.data;

      const productLines = Array.isArray(doc.productLines) && doc.productLines.length > 0
        ? doc.productLines.map((line, idx) => ({ ...line, id: Date.now() + idx }))
        : [{ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }];

      const purchaseLines = Array.isArray(doc.purchaseLines) && doc.purchaseLines.length > 0
        ? doc.purchaseLines.map((line, idx) => ({ ...line, id: Date.now() + 100 + idx }))
        : [{ id: Date.now() + 50, srNo: 1, purchaseLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }];

      const additionalCharges = Array.isArray(doc.additionalCharges)
        ? doc.additionalCharges.map((line, idx) => ({ ...line, id: Date.now() + 200 + idx }))
        : [];

      const tdsDetails = Array.isArray(doc.tdsDetails)
        ? doc.tdsDetails.map((line, idx) => ({ ...line, id: Date.now() + 300 + idx }))
        : [];

      const tcsDetails = Array.isArray(doc.tcsDetails)
        ? doc.tcsDetails.map((line, idx) => ({ ...line, id: Date.now() + 400 + idx }))
        : [];

      const formValues = {
        ...doc,
        voucherType: normalizeVoucherType(doc.voucherType),
        voucherDate: formatDate(doc.voucherDate || doc.invoiceDate),
        invoiceDate: formatDate(doc.invoiceDate || doc.voucherDate),
        invoiceNumber: doc.invoiceNumber || doc.voucherNumber || '',
        voucherNumber: doc.voucherNumber || doc.invoiceNumber || '',
        debitNoteDate: doc.debitNoteDate || '',
        referenceNumber: doc.referenceNumber || '',
        productLines,
        purchaseLines,
        additionalCharges,
        tdsDetails,
        tcsDetails,
      };

      set({
        selectedTransaction: doc,
        form: calculateFormTotals(formValues),
      });

      if (formValues.partyLedger) {
        if (formValues.voucherType === 'debit_note') {
          await get().fetchPurchaseInvoicesForParty(formValues.partyLedger);
        } else if (formValues.voucherType === 'purchase_invoice') {
          get().fetchPurchaseOrdersForParty(formValues.partyLedger);
        }
      }
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load details' });
    } finally {
      set((s) => ({ loading: { ...s.loading, detail: false } }));
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: Form Manipulation
  // ─────────────────────────────────────────────────────────────────────────

  resetForm: (voucherType = 'purchase_invoice') => set({
    form: calculateFormTotals({
      ...DEFAULT_FORM,
      voucherType,
      purchaseLedger: get().masterData.purchaseLedgers?.[0] || '',
      productLines: [{ ...DEFAULT_FORM.productLines[0], id: Date.now() }],
      purchaseLines: [{ ...DEFAULT_FORM.purchaseLines[0], id: Date.now() + 50 }],
      tdsDetails: [{ id: Date.now() + 100, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }],
    }),
    selectedTransaction: null,
    error: null,
  }),

  updateForm: (fields) => set((s) => ({
    form: calculateFormTotals({ ...s.form, ...fields }),
  })),

  fetchMasterData: async () => {
    set((s) => ({ masterData: { ...s.masterData, loading: true } }));
    try {
      const res = await purchaseApi.getMasterData();
      if (res.success) {
        try {
          const partyRes = await purchaseApi.getPartyLedgers();
          const purchaseRes = await purchaseApi.getPurchaseLedgers();
          const purchaseOrdersRes = await purchaseApi.list({ voucherType: 'purchase_order', limit: 100 }).catch(() => ({ data: [] }));
          const purchaseOrders = (purchaseOrdersRes.data || [])
            .map(po => po.voucherNumber || po.invoiceNumber || po.poNumber)
            .filter(Boolean);

          if (partyRes.success && purchaseRes.success) {
            const partyNames = partyRes.data.map(l => l.name);
            const purchaseNames = purchaseRes.data.map(l => l.name);
            const partyDetails = {};
            partyRes.data.forEach(l => {
              partyDetails[l.name] = {
                id: l.id,
                gstin: l.gstin,
                gstState: l.gstState,
                registrationType: l.registrationType
              };
            });

            // Build stockItems list and stockItemDetails keyed by name for HSN autofill
            const stockRes = await purchaseApi.getStockItems().catch(() => ({ success: false, data: [] }));
            const stockItemsRaw = (stockRes.success && stockRes.data) ? stockRes.data : [];
            const stockNames = stockItemsRaw.map(item => item.name).filter(Boolean);
            const stockItemDetails = {};
            stockItemsRaw.forEach(item => {
              if (item.name) {
                stockItemDetails[item.name] = { hsnCode: item.hsnCode || '', gstRate: item.gstRate || 0, unit: item.unit || '' };
              }
            });

            set({
              masterData: {
                ...res.data,
                partyLedgers: partyNames.length ? partyNames : res.data.partyLedgers,
                purchaseLedgers: purchaseNames.length ? purchaseNames : res.data.purchaseLedgers,
                partyLedgerDetails: Object.keys(partyDetails).length ? partyDetails : res.data.partyLedgerDetails,
                stockItems: stockNames.length ? stockNames : res.data.stockItems,
                stockItemDetails: Object.keys(stockItemDetails).length ? stockItemDetails : (res.data.stockItemDetails || {}),
                purchaseOrders: purchaseOrders,
                purchaseOrdersRaw: purchaseOrdersRes.data || [],
                loading: false
              }
            });
            const nextPurchaseNames = purchaseNames.length ? purchaseNames : res.data.purchaseLedgers;
            if (!get().form._id && !get().form.purchaseLedger && nextPurchaseNames?.length > 0) {
              set((s) => ({
                form: {
                  ...s.form,
                  purchaseLedger: nextPurchaseNames[0]
                }
              }));
            }
            return;
          }
        } catch (e) {
          console.error("Failed to load purchase-voucher master data:", e);
        }

        set({
          masterData: {
            ...res.data,
            purchaseOrdersRaw: [],
            loading: false,
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err);
      set((s) => ({ masterData: { ...s.masterData, loading: false } }));
    }
  },

  fetchNextInvoiceNumber: async (voucherType = 'purchase_invoice') => {
    try {
      const res = await purchaseApi.getNextInvoiceNumber(voucherType);
      if (res?.success && res?.data?.invoiceNumber) {
        set((s) => ({
          form: calculateFormTotals({ 
            ...s.form, 
            invoiceNumber: res.data.invoiceNumber,
            voucherNumber: res.data.invoiceNumber
          }),
        }));
      }
    } catch (e) {
      // Silently fail
      console.warn('Could not fetch next invoice number:', e);
    }
  },

  fetchPurchaseOrdersForParty: (partyName) => set((s) => {
    const raw = s.masterData.purchaseOrdersRaw || [];
    const filtered = partyName
      ? raw.filter(po =>
        (po.partyLedgerName || po.partyLedger || '').toLowerCase() === partyName.toLowerCase()
      )
      : raw;
    const filteredNumbers = filtered
      .map(po => po.voucherNumber || po.invoiceNumber || po.poNumber)
      .filter(Boolean);
    return {
      masterData: { ...s.masterData, purchaseOrders: filteredNumbers }
    };
  }),

  autofillFromPurchaseOrder: (voucherNumber) => set((s) => {
    const raw = s.masterData.purchaseOrdersRaw || [];
    const po = raw.find(
      r => (r.voucherNumber || r.invoiceNumber || r.poNumber) === voucherNumber
    );
    if (!po) return {};

    const defaultProductLine = { srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 };
    const rawProductLines = po.productLines || po.inventoryEntries || [];
    const productLines = Array.isArray(rawProductLines) && rawProductLines.length > 0
      ? rawProductLines.map((line, idx) => {
          const stockItem = line.stockItem || line.stockItemName || '';
          const billQuantity = line.billQuantity !== undefined ? line.billQuantity : (parseFloat(line.billedQty) || parseFloat(line.actualQty) || 0);
          const billRate = line.billRate !== undefined ? line.billRate : (parseFloat(line.rate) || 0);
          const discountPercent = line.discountPercent !== undefined ? line.discountPercent : 0;
          return {
            ...defaultProductLine,
            ...line,
            stockItem,
            billQuantity,
            billRate,
            discountPercent,
            id: Date.now() + idx,
            srNo: idx + 1
          };
        })
      : [{ id: Date.now(), ...defaultProductLine }];

    const defaultPurchaseLine = { srNo: 1, purchaseLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 };
    const rawPurchaseLines = po.purchaseLines || po.ledgerEntries || [];
    const purchaseLines = Array.isArray(rawPurchaseLines) && rawPurchaseLines.length > 0
      ? rawPurchaseLines.map((line, idx) => {
          const purchaseLedger = line.purchaseLedger || line.ledgerName || '';
          return {
            ...defaultPurchaseLine,
            ...line,
            purchaseLedger,
            id: Date.now() + 100 + idx,
            srNo: idx + 1
          };
        })
      : [{ id: Date.now() + 50, ...defaultPurchaseLine }];

    const additionalCharges = Array.isArray(po.additionalCharges)
      ? po.additionalCharges.map((c, idx) => ({ ...c, id: Date.now() + 200 + idx }))
      : [];

    const tdsDetails = Array.isArray(po.tdsDetails) && po.tdsDetails.length > 0
      ? po.tdsDetails.map((t, idx) => ({ ...t, id: Date.now() + 300 + idx }))
      : [{ id: Date.now() + 300, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }];

    const entryTab = po.entryTab || ((po.productLines?.length || po.inventoryEntries?.length) ? 'with_item' : 'without_item');

    const partyName = po.partyLedgerName || po.partyLedger || s.form.partyLedger;
    const details = s.masterData.partyLedgerDetails?.[partyName] || {};

    const filledForm = {
      ...s.form,
      entryTab,
      partyLedger: partyName,
      partyGstin: po.partyGSTIN || po.partyGstin || details.gstin || s.form.partyGstin,
      gstRegistration: po.gstRegistration || (details.gstState ? `${details.gstState} Registration` : s.form.gstRegistration),
      gstRegistrationType: po.gstRegistrationType || details.registrationType || s.form.gstRegistrationType,
      consigneeLedger: po.consigneeLedger || s.form.consigneeLedger,
      purchaseLedger: po.purchaseLedger || (purchaseLines[0]?.purchaseLedger || (s.form.purchaseLedger || (s.masterData.purchaseLedgers?.[0] || ''))),
      narration: po.narration || s.form.narration,
      productLines,
      purchaseLines,
      additionalCharges,
      tdsDetails,
      poNumber: po.poNumber || po.voucherNumber || s.form.poNumber,
    };

    return { form: calculateFormTotals(filledForm) };
  }),

  // ─── Debit Note: Fetch purchase invoices for a party ──────────────────────
  fetchPurchaseInvoicesForParty: async (partyName) => {
    try {
      const res = await purchaseApi.getPurchaseInvoicesByParty(partyName);
      const docs = res?.data || [];
      const invoiceNumbers = docs
        .map(d => d.voucherNumber || d.invoiceNumber)
        .filter(Boolean);
      set((s) => ({
        masterData: {
          ...s.masterData,
          debitNoteInvoices: invoiceNumbers,
          debitNoteInvoicesRaw: docs,
        }
      }));
    } catch (e) {
      console.warn('Could not fetch purchase invoices for party:', e);
    }
  },

  // ─── Debit Note: Autofill from selected Purchase Invoice reference ──────────
  autofillFromPurchaseInvoice: (voucherNumber) => set((s) => {
    const raw = s.masterData.debitNoteInvoicesRaw || [];
    const inv = raw.find(
      r => (r.voucherNumber || r.invoiceNumber) === voucherNumber
    );
    if (!inv) return {};

    const defaultProductLine = { srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 };
    const rawProductLines = inv.productLines || inv.inventoryEntries || [];
    const productLines = Array.isArray(rawProductLines) && rawProductLines.length > 0
      ? rawProductLines.map((line, idx) => {
          const stockItem = line.stockItem || line.stockItemName || '';
          const billQuantity = line.billQuantity !== undefined ? line.billQuantity : (parseFloat(line.billedQty) || parseFloat(line.actualQty) || 0);
          const billRate = line.billRate !== undefined ? line.billRate : (parseFloat(line.rate) || 0);
          const discountPercent = line.discountPercent !== undefined ? line.discountPercent : 0;
          return {
            ...defaultProductLine,
            ...line,
            stockItem,
            billQuantity,
            billRate,
            discountPercent,
            id: Date.now() + idx,
            srNo: idx + 1
          };
        })
      : [{ id: Date.now(), ...defaultProductLine }];

    const defaultPurchaseLine = { srNo: 1, purchaseLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 };
    const rawPurchaseLines = inv.purchaseLines || inv.ledgerEntries || [];
    const purchaseLines = Array.isArray(rawPurchaseLines) && rawPurchaseLines.length > 0
      ? rawPurchaseLines.map((line, idx) => {
          const purchaseLedger = line.purchaseLedger || line.ledgerName || '';
          return {
            ...defaultPurchaseLine,
            ...line,
            purchaseLedger,
            id: Date.now() + 100 + idx,
            srNo: idx + 1
          };
        })
      : [{ id: Date.now() + 50, ...defaultPurchaseLine }];

    const additionalCharges = Array.isArray(inv.additionalCharges)
      ? inv.additionalCharges.map((c, idx) => ({ ...c, id: Date.now() + 200 + idx }))
      : [];

    const tdsDetails = Array.isArray(inv.tdsDetails) && inv.tdsDetails.length > 0
      ? inv.tdsDetails.map((t, idx) => ({ ...t, id: Date.now() + 300 + idx }))
      : [{ id: Date.now() + 300, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }];

    const entryTab = inv.entryTab || ((inv.productLines?.length || inv.inventoryEntries?.length) ? 'with_item' : 'without_item');

    const partyName = inv.partyLedgerName || inv.partyLedger || s.form.partyLedger;
    const details = s.masterData.partyLedgerDetails?.[partyName] || {};

    const filledForm = {
      ...s.form,
      entryTab,
      partyLedger: partyName,
      partyGstin: inv.partyGSTIN || inv.partyGstin || details.gstin || s.form.partyGstin,
      gstRegistration: inv.gstRegistration || (details.gstState ? `${details.gstState} Registration` : s.form.gstRegistration),
      gstRegistrationType: inv.gstRegistrationType || details.registrationType || s.form.gstRegistrationType,
      consigneeLedger: inv.consigneeLedger || s.form.consigneeLedger,
      purchaseLedger: inv.purchaseLedger || (purchaseLines[0]?.purchaseLedger || (s.form.purchaseLedger || (s.masterData.purchaseLedgers?.[0] || ''))),
      voucherDate: formatDate(inv.voucherDate || inv.invoiceDate),
      invoiceDate: formatDate(inv.invoiceDate || inv.voucherDate),
      productLines,
      purchaseLines,
      additionalCharges,
      tdsDetails,
      narration: inv.narration || s.form.narration,
    };

    return { form: calculateFormTotals(filledForm) };
  }),

  // --- Row management: Inventory Lines ---
  addProductLine: () => set((s) => {
    const nextLines = [...s.form.productLines, { id: Date.now(), srNo: s.form.productLines.length + 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }];
    return { form: calculateFormTotals({ ...s.form, productLines: nextLines }) };
  }),

  updateProductLine: (id, fields) => set((s) => {
    const nextLines = s.form.productLines.map((l) => {
      if (l.id === id) {
        const updated = { ...l, ...fields };
        const qty = parseFloat(updated.billQuantity) || 0;
        const rate = parseFloat(updated.billRate) || 0;
        const disc = parseFloat(updated.discountPercent) || 0;
        updated.amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
        return updated;
      }
      return l;
    });
    return { form: calculateFormTotals({ ...s.form, productLines: nextLines }) };
  }),

  removeProductLine: (id) => set((s) => {
    const nextLines = s.form.productLines.filter((l) => l.id !== id).map((l, idx) => ({ ...l, srNo: idx + 1 }));
    return { form: calculateFormTotals({ ...s.form, productLines: nextLines }) };
  }),

  // --- Row management: Expense / Service Lines ---
  addPurchaseLine: () => set((s) => {
    const nextLines = [...s.form.purchaseLines, { id: Date.now(), srNo: s.form.purchaseLines.length + 1, purchaseLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }];
    return { form: calculateFormTotals({ ...s.form, purchaseLines: nextLines }) };
  }),

  updatePurchaseLine: (id, fields) => set((s) => {
    const nextLines = s.form.purchaseLines.map((l) => {
      if (l.id === id) {
        return { ...l, ...fields };
      }
      return l;
    });
    return { form: calculateFormTotals({ ...s.form, purchaseLines: nextLines }) };
  }),

  removePurchaseLine: (id) => set((s) => {
    const nextLines = s.form.purchaseLines.filter((l) => l.id !== id).map((l, idx) => ({ ...l, srNo: idx + 1 }));
    return { form: calculateFormTotals({ ...s.form, purchaseLines: nextLines }) };
  }),

  // --- Additional Charges ---
  addAdditionalCharge: () => set((s) => {
    const nextCharges = [...s.form.additionalCharges, { id: Date.now(), ledgerName: '', taxableValue: 0, amount: 0 }];
    return { form: calculateFormTotals({ ...s.form, additionalCharges: nextCharges }) };
  }),

  updateAdditionalCharge: (id, fields) => set((s) => {
    const nextCharges = s.form.additionalCharges.map((l) => {
      if (l.id === id) {
        return { ...l, ...fields };
      }
      return l;
    });
    return { form: calculateFormTotals({ ...s.form, additionalCharges: nextCharges }) };
  }),

  removeAdditionalCharge: (id) => set((s) => {
    const nextCharges = s.form.additionalCharges.filter((l) => l.id !== id);
    return { form: calculateFormTotals({ ...s.form, additionalCharges: nextCharges }) };
  }),

  // --- TDS ---
  addTdsDetail: () => set((s) => {
    const nextTds = [...s.form.tdsDetails, { id: Date.now(), ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }];
    return { form: calculateFormTotals({ ...s.form, tdsDetails: nextTds }) };
  }),

  updateTdsDetail: (id, fields) => set((s) => {
    const nextTds = s.form.tdsDetails.map((l) => {
      if (l.id === id) {
        const updated = { ...l, ...fields };
        const assessable = parseFloat(updated.assessableValue) || 0;
        const rate = parseFloat(updated.rate) || 0;
        updated.amount = parseFloat(((assessable * rate) / 100).toFixed(2));
        return updated;
      }
      return l;
    });
    return { form: calculateFormTotals({ ...s.form, tdsDetails: nextTds }) };
  }),

  removeTdsDetail: (id) => set((s) => {
    const nextTds = s.form.tdsDetails.filter((l) => l.id !== id);
    return { form: calculateFormTotals({ ...s.form, tdsDetails: nextTds }) };
  }),

  // --- TCS ---
  addTcsDetail: () => set((s) => {
    const nextTcs = [...s.form.tcsDetails, { id: Date.now(), ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }];
    return { form: calculateFormTotals({ ...s.form, tcsDetails: nextTcs }) };
  }),

  updateTcsDetail: (id, fields) => set((s) => {
    const nextTcs = s.form.tcsDetails.map((l) => {
      if (l.id === id) {
        const updated = { ...l, ...fields };
        const assessable = parseFloat(updated.assessableValue) || 0;
        const rate = parseFloat(updated.rate) || 0;
        updated.amount = parseFloat(((assessable * rate) / 100).toFixed(2));
        return updated;
      }
      return l;
    });
    return { form: calculateFormTotals({ ...s.form, tcsDetails: nextTcs }) };
  }),

  removeTcsDetail: (id) => set((s) => {
    const nextTcs = s.form.tcsDetails.filter((l) => l.id !== id);
    return { form: calculateFormTotals({ ...s.form, tcsDetails: nextTcs }), };
  }),

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: CRUD Submit
  // ─────────────────────────────────────────────────────────────────────────

  saveTransaction: async (asDraft = true) => {
    const { form } = get();
    set((s) => ({ loading: { ...s.loading, save: true }, error: null }));
    try {
      const isWithItem = form.entryTab === 'with_item';
      let productLines = [];
      let purchaseLines = [];

      if (isWithItem) {
        const activeLines = (form.productLines || []).filter(l => l.stockItem && l.stockItem.trim() !== '');
        if (activeLines.length > 0) {
          productLines = activeLines.map(({ id: _id, ...rest }) => rest);
        } else {
          const firstLine = form.productLines?.[0] || { srNo: 1, stockItem: '', amount: 0, gstRate: 0 };
          const { id: _id, ...rest } = firstLine;
          productLines = [rest];
        }
        purchaseLines = [];
      } else {
        const activeLines = (form.purchaseLines || []).filter(l => l.purchaseLedger && l.purchaseLedger.trim() !== '');
        if (activeLines.length > 0) {
          purchaseLines = activeLines.map(({ id: _id, ...rest }) => rest);
        } else {
          const firstLine = form.purchaseLines?.[0] || { srNo: 1, purchaseLedger: '', amount: 0, gstRate: 0 };
          const { id: _id, ...rest } = firstLine;
          purchaseLines = [rest];
        }
        productLines = [];
      }

      const payload = {
        ...form,
        invoiceNumber: form.voucherNumber || form.invoiceNumber || '',
        debitNoteDate: form.debitNoteDate || undefined,
        referenceNumber: form.referenceNumber || '',
        status: asDraft ? 'draft' : 'pending_review',
        entryMode: 'manual',
        productLines,
        purchaseLines,
        additionalCharges: (form.additionalCharges || []).map(({ id: _id, ...rest }) => rest),
        tdsDetails: (form.tdsDetails || []).map(({ id: _id, ...rest }) => rest),
        tcsDetails: (form.tcsDetails || []).map(({ id: _id, ...rest }) => rest),
      };

      let res;
      if (form._id) {
        res = await purchaseApi.update(form._id, payload);
      } else {
        res = await purchaseApi.create(payload);
      }

      const savedDoc = res.data;
      if (savedDoc) {
        const productLines = Array.isArray(savedDoc.productLines) && savedDoc.productLines.length > 0
          ? savedDoc.productLines.map((line, idx) => ({ ...line, id: Date.now() + idx }))
          : [{ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }];

        const purchaseLines = Array.isArray(savedDoc.purchaseLines) && savedDoc.purchaseLines.length > 0
          ? savedDoc.purchaseLines.map((line, idx) => ({ ...line, id: Date.now() + 100 + idx }))
          : [{ id: Date.now() + 50, srNo: 1, purchaseLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }];

        const additionalCharges = Array.isArray(savedDoc.additionalCharges)
          ? savedDoc.additionalCharges.map((line, idx) => ({ ...line, id: Date.now() + 200 + idx }))
          : [];

        const tdsDetails = Array.isArray(savedDoc.tdsDetails)
          ? savedDoc.tdsDetails.map((line, idx) => ({ ...line, id: Date.now() + 300 + idx }))
          : [];

        const tcsDetails = Array.isArray(savedDoc.tcsDetails)
          ? savedDoc.tcsDetails.map((line, idx) => ({ ...line, id: Date.now() + 400 + idx }))
          : [];

        const updatedFormValues = {
          ...savedDoc,
          voucherType: normalizeVoucherType(savedDoc.voucherType),
          voucherDate: formatDate(savedDoc.voucherDate || savedDoc.invoiceDate),
          invoiceDate: formatDate(savedDoc.invoiceDate || savedDoc.voucherDate),
          debitNoteDate: savedDoc.debitNoteDate || '',
          referenceNumber: savedDoc.referenceNumber || '',
          productLines,
          purchaseLines,
          additionalCharges,
          tdsDetails,
          tcsDetails,
          _id: savedDoc._id || savedDoc.id || get().form._id,
        };

        set({
          selectedTransaction: savedDoc,
          form: calculateFormTotals(updatedFormValues)
        });

        if (updatedFormValues.partyLedger) {
          if (updatedFormValues.voucherType === 'debit_note') {
            await get().fetchPurchaseInvoicesForParty(updatedFormValues.partyLedger);
          } else if (updatedFormValues.voucherType === 'purchase_invoice') {
            get().fetchPurchaseOrdersForParty(updatedFormValues.partyLedger);
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
      const res = await purchaseApi.updateStatus(id, 'pending_review');
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
      const res = await purchaseApi.updateStatus(id, 'approved', note);
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
      await purchaseApi.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' };
    } finally {
      set((s) => ({ loading: { ...s.loading, status: false } }));
    }
  },
}));

export default usePurchaseStore;
