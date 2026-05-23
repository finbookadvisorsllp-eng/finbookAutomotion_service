import { create } from 'zustand';
import salesApi from '../services/salesApi';

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
  voucherType:         'sales_invoice',
  voucherNumberSeries: 'Default',
  voucherDate:         '',
  invoiceDate:         '',
  invoiceNumber:       '',
  salesLedger:         '',
  gstRegistration:     '',
  partyGstin:          '',
  partyLedger:         '',
  consigneeLedger:     'Same as Party',
  entryTab:            'with_item',
  productLines:        [{ id: Date.now(), srNo: 1, stockItem: '', description: '', hsnSacCode: '', billQuantity: 0, billRate: 0, discountPercent: 0, amount: 0, rcm: false, taxabilityType: 'Taxable', gstRate: 0 }],
  salesLines:          [{ id: Date.now(), srNo: 1, salesLedger: '', description: '', hsnSacCode: '', amount: 0, gstRate: 0 }],
  additionalCharges:   [],
  tdsDetails:          [],
  tcsDetails:          [{ id: Date.now() + 200, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }],
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

  if (form.entryTab === 'without_item' && Array.isArray(form.salesLines)) {
    form.salesLines.forEach((line) => {
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
  if (cgstTotal > 0) gstDetails.push({ gstType: 'CGST', ledgerName: 'Output CGST', rate: 0, amount: parseFloat(cgstTotal.toFixed(2)) });
  if (sgstTotal > 0) gstDetails.push({ gstType: 'SGST', ledgerName: 'Output SGST', rate: 0, amount: parseFloat(sgstTotal.toFixed(2)) });
  if (igstTotal > 0) gstDetails.push({ gstType: 'IGST', ledgerName: 'Output IGST', rate: 0, amount: parseFloat(igstTotal.toFixed(2)) });

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

export const useSalesStore = create((set, get) => ({

  // ─── List State ──────────────────────────────────────────────────────────
  transactions:  [],
  totalCount:    0,
  currentPage:   1,
  pageLimit:     20,
  filters: {
    voucherType: 'sales_invoice',
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

  // ─── Form State (manual + OCR autofill) ──────────────────────────────────
  form: { ...DEFAULT_FORM },

  // ─── OCR Workflow State ───────────────────────────────────────────────────
  ocr: {
    file:          null,         // File object
    previewUrl:    null,         // local object URL for PDF/image preview
    isExtracting:  false,
    uploadProgress: 0,
    result:        null,         // full extraction result from backend
    error:         null,
  },

  // ─── CSV Workflow State ───────────────────────────────────────────────────
  csv: {
    file:          null,
    isPreviewLoading: false,
    preview:       null,         // { totalRows, validCount, failedCount, errors, preview[] }
    isImporting:   false,
    importResult:  null,         // { inserted, failed, errors }
    error:         null,
  },

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
      const res = await salesApi.list(params);
      set({
        transactions: res.data || [],
        totalCount:   res.meta?.total || 0,
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
      set({ selectedTransaction: res.data });
      return res.data;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load transaction' });
    } finally {
      set((s) => ({ loading: { ...s.loading, detail: false } }));
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: Form Management
  // ─────────────────────────────────────────────────────────────────────────

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
      productLines: [{ ...DEFAULT_FORM.productLines[0], id: Date.now() }],
      salesLines: [{ ...DEFAULT_FORM.salesLines[0], id: Date.now() + 100 }],
      tcsDetails: [{ id: Date.now() + 200, ledgerName: '', assessableValue: 0, rate: 0, amount: 0 }]
    },
  }),

  // ─── Autofill from OCR extraction result ─────────────────────────────────
  autofillFormFromOcr: (ocrFormFields) => set((s) => {
    const entryTab = ocrFormFields.productLines?.length ? 'with_item' : (ocrFormFields.salesLines?.length ? 'without_item' : s.form.entryTab);
    
    const filledForm = {
      ...s.form,
      entryTab,
      invoiceNumber:   ocrFormFields.invoiceNumber   || s.form.invoiceNumber,
      invoiceDate:     ocrFormFields.invoiceDate     || s.form.invoiceDate,
      partyLedger:     ocrFormFields.partyLedger     || s.form.partyLedger,
      partyGstin:      ocrFormFields.partyGstin      || s.form.partyGstin,
      salesLedger:     ocrFormFields.salesLedger     || s.form.salesLedger,
      
      productLines:    ocrFormFields.productLines?.length 
        ? ocrFormFields.productLines.map((l, i) => ({ ...l, id: Date.now() + i })) 
        : s.form.productLines,
      
      salesLines:      ocrFormFields.salesLines?.length 
        ? ocrFormFields.salesLines.map((l, i) => ({ ...l, id: Date.now() + i + 100 })) 
        : s.form.salesLines,
        
      narration:       ocrFormFields.narration       || s.form.narration,
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

  updateProductLine: (id, field, value) => set((s) => {
    const nextProductLines = s.form.productLines.map((l) => {
      if (l.id === id) {
        const updated = { ...l, [field]: value };
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

  updateSalesLine: (id, field, value) => set((s) => {
    const nextLines = s.form.salesLines.map((l) => l.id === id ? { ...l, [field]: value } : l);
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
    const newRow = { id: Date.now(), ledgerName: '', amount: 0 };
    return {
      form: calculateFormTotals({ ...s.form, additionalCharges: [...s.form.additionalCharges, newRow] }),
    };
  }),

  updateAdditionalCharge: (id, field, value) => set((s) => {
    const nextCharges = s.form.additionalCharges.map((l) => l.id === id ? { ...l, [field]: value } : l);
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
      let productLines = [];
      let salesLines = [];

      if (isWithItem) {
        const activeLines = (form.productLines || []).filter(l => l.stockItem && l.stockItem.trim() !== '');
        if (activeLines.length > 0) {
          productLines = activeLines.map(({ id: _id, ...rest }) => rest);
        } else {
          const firstLine = form.productLines?.[0] || { srNo: 1, stockItem: '', amount: 0, gstRate: 0 };
          const { id: _id, ...rest } = firstLine;
          productLines = [rest];
        }
        salesLines = [];
      } else {
        const activeLines = (form.salesLines || []).filter(l => l.salesLedger && l.salesLedger.trim() !== '');
        if (activeLines.length > 0) {
          salesLines = activeLines.map(({ id: _id, ...rest }) => rest);
        } else {
          const firstLine = form.salesLines?.[0] || { srNo: 1, salesLedger: '', amount: 0, gstRate: 0 };
          const { id: _id, ...rest } = firstLine;
          salesLines = [rest];
        }
        productLines = [];
      }

      const payload = {
        ...form,
        status:    asDraft ? 'draft' : 'pending_review',
        entryMode: 'manual',
        productLines,
        salesLines,
        additionalCharges: (form.additionalCharges || []).map(({ id: _id, ...rest }) => rest),
        tdsDetails:        (form.tdsDetails || []).map(({ id: _id, ...rest }) => rest),
        tcsDetails:        (form.tcsDetails || []).map(({ id: _id, ...rest }) => rest),
      };

      let res;
      if (form._id) {
        res = await salesApi.update(form._id, payload);
      } else {
        res = await salesApi.create(payload);
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
      const res = await salesApi.updateStatus(id, 'pending_review');
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
      const res = await salesApi.extractOcr(ocr.file, (progress) => {
        set((s) => ({ ocr: { ...s.ocr, uploadProgress: progress } }));
      });

      set((s) => ({
        ocr: { ...s.ocr, result: res.data, isExtracting: false, uploadProgress: 100 },
      }));

      // Auto-fill the form fields
      if (res.data?.formFields) {
        autofillFormFromOcr(res.data.formFields);
      }

      return { success: true, data: res.data };
    } catch (err) {
      const message = err.response?.data?.message || 'OCR extraction failed';
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
        status:    'draft',
        entryMode: 'ocr',
        productLines: form.productLines.map(({ id: _id, ...rest }) => rest),
        salesLines:   form.salesLines.map(({ id: _id, ...rest }) => rest),
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
