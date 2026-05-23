import { create } from 'zustand';
import purchaseApi from '../services/purchaseApi';

/**
 * usePurchaseStore — Zustand store for the entire Purchase module.
 */

const DEFAULT_FORM = {
  voucherType:         'purchase_invoice',
  voucherNumberSeries: 'Default',
  voucherDate:         '',
  invoiceDate:         '',
  invoiceNumber:       '',
  poNumber:            '',
  purchaseLedger:      '',
  gstRegistration:     'Madhya Pradesh Registration',
  partyGstin:          '',
  partyLedger:         '',
  consigneeLedger:     'Same as Party',
  entryTab:            'without_item',
  productLines:        [{ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }],
  purchaseLines:       [{ id: Date.now(), srNo: 1, purchaseLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }],
  additionalCharges:   [],
  tdsDetails:          [{ id: Date.now() + 100, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }],
  tcsDetails:          [],
  narration:           '',
  status:              'draft',
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
  if (Array.isArray(form.additionalCharges)) {
    form.additionalCharges.forEach((c) => { additionalTotal += parseFloat(c.amount) || 0; });
  }

  const subTotal = baseTotal + cgstTotal + sgstTotal + igstTotal + additionalTotal;

  let tdsTotal = 0;
  if (Array.isArray(form.tdsDetails)) {
    form.tdsDetails.forEach((t) => {
      const assessable = parseFloat(t.assessableValue) || subTotal;
      const rate = parseFloat(t.rate) || 0;
      const amt = parseFloat(((assessable * rate) / 100).toFixed(2));
      t.amount = amt;
      tdsTotal += amt;
    });
  }

  let tcsTotal = 0;
  if (Array.isArray(form.tcsDetails)) {
    form.tcsDetails.forEach((t) => {
      const assessable = parseFloat(t.assessableValue) || subTotal;
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

export const usePurchaseStore = create((set, get) => ({

  // ─── List State ──────────────────────────────────────────────────────────
  transactions:  [],
  totalCount:    0,
  currentPage:   1,
  pageLimit:     20,
  filters: {
    voucherType: 'purchase_invoice',
    status:      '',
    search:      '',
    dateFrom:    '',
    dateTo:      '',
    sortBy:      'createdAt',
    sortOrder:   'desc',
  },

  // ─── Detail State ─────────────────────────────────────────────────────────
  selectedTransaction: null,

  // ─── Stats State ─────────────────────────────────────────────────────────
  stats: null,

  // ─── Form State ──────────────────────────────────────────────────────────
  form: { ...DEFAULT_FORM },

  // ─── Loading / Error ─────────────────────────────────────────────────────
  loading: {
    list:    false,
    detail:  false,
    save:    false,
    status:  false,
    stats:   false,
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
      set({
        transactions: res.data || [],
        totalCount:   res.meta?.total || 0,
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

      // Format ISO dates to YYYY-MM-DD
      const formatDate = (isoStr) => isoStr ? new Date(isoStr).toISOString().slice(0, 10) : '';

      set({
        selectedTransaction: doc,
        form: calculateFormTotals({
          ...doc,
          voucherDate: formatDate(doc.voucherDate),
          invoiceDate: formatDate(doc.invoiceDate),
          productLines,
          purchaseLines,
          additionalCharges,
          tdsDetails,
          tcsDetails,
        }),
      });
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
    }),
    selectedTransaction: null,
    error: null,
  }),

  updateForm: (fields) => set((s) => ({
    form: calculateFormTotals({ ...s.form, ...fields }),
  })),

  // --- Row management: Inventory Lines ---
  addProductLine: () => set((s) => {
    const nextLines = [...s.form.productLines, { id: Date.now(), srNo: s.form.productLines.length + 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }];
    return { form: calculateFormTotals({ ...s.form, productLines: nextLines }) };
  }),

  updateProductLine: (id, fields) => set((s) => {
    const nextLines = s.form.productLines.map((l) => {
      if (l.id === id) {
        return { ...l, ...fields };
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
        status:    asDraft ? 'draft' : 'pending_review',
        entryMode: 'manual',
        productLines,
        purchaseLines,
        additionalCharges: (form.additionalCharges || []).map(({ id: _id, ...rest }) => rest),
        tdsDetails:        (form.tdsDetails || []).map(({ id: _id, ...rest }) => rest),
        tcsDetails:        (form.tcsDetails || []).map(({ id: _id, ...rest }) => rest),
      };

      let res;
      if (form._id) {
        res = await purchaseApi.update(form._id, payload);
      } else {
        res = await purchaseApi.create(payload);
      }
      set({ selectedTransaction: res.data });
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
