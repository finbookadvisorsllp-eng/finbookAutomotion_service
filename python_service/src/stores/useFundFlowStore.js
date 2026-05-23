import { create } from 'zustand';
import fundflowApi from '../services/fundflowApi';

const DEFAULT_FORM = {
  voucherType:         'cash_payment',
  voucherNumberSeries: 'Default',
  voucherDate:         new Date().toISOString().substring(0, 10),
  referenceNumber:     '',
  company:             'Main Company Ltd',
  partyLedger:         '',
  againstLedger:       '',
  amount:              0,
  drCrType:            'Debit (Dr)',
  ledgerGroup:         'Sundry Creditors',
  currency:            'INR',

  cashLedger:          '',
  cashAmount:          0,
  openingBalance:      25000,

  bankLedger:          '',
  transType:           '',
  instNumber:          '',
  instDate:            '',
  utr:                 '',
  ifscCode:            '',
  branchName:          '',
  bankBalance:         150000,

  sourceLedger:        '',
  transferAmount:      0,
  destinationLedger:   '',
  amountReceived:      0,

  billRows:            [],
  costCenters:         [],

  gstApplicable:       false,
  gstLedger:           '',
  gstRate:             0,
  tdsApplicable:       false,
  tdsLedger:           '',
  tdsRate:             0,

  narration:           '',
  status:              'draft',

  totalDebit:          0,
  totalCredit:         0,
  difference:          0,
};

const calculateFormTotals = (form) => {
  const f = { ...form };

  if (f.voucherType === 'cash_payment' || f.voucherType === 'bank_payment') {
    const amt = parseFloat(f.amount) || 0;
    f.totalDebit = amt;
    f.totalCredit = amt;
    f.difference = 0;
  } else if (f.voucherType === 'contra') {
    const sourceAmt = parseFloat(f.transferAmount) || 0;
    const destAmt = parseFloat(f.amountReceived) || 0;
    f.totalDebit = sourceAmt;
    f.totalCredit = destAmt;
    f.difference = Math.abs(sourceAmt - destAmt);
  }

  return f;
};

export const useFundFlowStore = create((set, get) => ({
  // ─── List State ──────────────────────────────────────────────────────────
  transactions:  [],
  totalCount:    0,
  currentPage:   1,
  pageLimit:     20,
  filters: {
    voucherType: 'cash_payment',
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
      const res = await fundflowApi.list(params);
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
      const res = await fundflowApi.getStats(voucherType);
      set({ stats: res.data });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      set((s) => ({ loading: { ...s.loading, stats: false } }));
    }
  },

  fetchTransaction: async (id) => {
    set((s) => ({ loading: { ...s.loading, detail: true }, error: null }));
    try {
      const res = await fundflowApi.getById(id);
      set({ selectedTransaction: res.data, form: { ...res.data } });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to retrieve transaction' });
    } finally {
      set((s) => ({ loading: { ...s.loading, detail: false } }));
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: Form Manipulation
  // ─────────────────────────────────────────────────────────────────────────

  setFormValue: (key, value) => set((s) => {
    const updatedForm = { ...s.form, [key]: value };
    return { form: calculateFormTotals(updatedForm) };
  }),

  setForm: (newForm) => set({ form: calculateFormTotals(newForm) }),

  resetForm: (voucherType = 'cash_payment') => set({
    form: {
      ...DEFAULT_FORM,
      voucherType,
      voucherDate: new Date().toISOString().substring(0, 10),
    },
    error: null,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  //  Actions: Save / Submit Workflow
  // ─────────────────────────────────────────────────────────────────────────

  saveDraft: async () => {
    const { form } = get();
    set((s) => ({ loading: { ...s.loading, save: true }, error: null }));
    try {
      const payload = { ...form, status: 'draft' };
      let res;
      if (form._id) {
        res = await fundflowApi.update(form._id, payload);
      } else {
        res = await fundflowApi.create(payload);
      }
      set({ form: { ...res.data } });
      return { success: true, data: res.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save draft';
      set({ error: msg });
      return { success: false, message: msg };
    } finally {
      set((s) => ({ loading: { ...s.loading, save: false } }));
    }
  },

  pushToReview: async () => {
    const { form } = get();
    set((s) => ({ loading: { ...s.loading, save: true }, error: null }));
    try {
      const payload = { ...form, status: 'pending_review' };
      let res;
      if (form._id) {
        res = await fundflowApi.update(form._id, payload);
      } else {
        res = await fundflowApi.create(payload);
      }
      set({ form: { ...res.data } });
      return { success: true, data: res.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit for review';
      set({ error: msg });
      return { success: false, message: msg };
    } finally {
      set((s) => ({ loading: { ...s.loading, save: false } }));
    }
  },

  updateStatus: async (id, nextStatus, note = '') => {
    set((s) => ({ loading: { ...s.loading, status: true } }));
    try {
      const res = await fundflowApi.updateStatus(id, nextStatus, note);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Status transition failed' };
    } finally {
      set((s) => ({ loading: { ...s.loading, status: false } }));
    }
  },

  deleteTransaction: async (id) => {
    try {
      await fundflowApi.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to delete transaction' };
    }
  },
}));

export default useFundFlowStore;
