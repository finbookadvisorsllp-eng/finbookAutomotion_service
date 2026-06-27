import { create } from 'zustand';
import fundflowApi from '../services/fundflowApi';
import apiClient from '../lib/apiClient';

const DEFAULT_FORM = {
  voucherType:         'cash_payment',
  voucherNumberSeries: 'Default',
  voucherDate:         new Date().toISOString().substring(0, 10),
  referenceNumber:     '',
  company:             '',
  partyLedger:         '',
  againstLedger:       '',
  amount:              0,
  drCrType:            'Debit (Dr)',
  ledgerGroup:         'Sundry Creditors',

  cashLedger:          '',
  cashAmount:          0,
  openingBalance:      0,

  bankLedger:          '',
  transType:           '',
  instNumber:          '',
  instDate:            '',
  utr:                 '',
  ifscCode:            '',
  branchName:          '',
  bankBalance:         0,

  sourceLedger:        '',
  transferAmount:      0,
  destinationLedger:   '',
  amountReceived:      0,

  billRows:            [],
  ledgerRows:          [],
  costCenters:         [],
  costCenterApplicable: false,

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
  excessOption:        '',
  remarks:             '',
  entryMode:           'manual',
  costCategory:        '',
  costCenter:          '',
  costAmount:          0,
};

const calculateFormTotals = (form) => {
  const f = { ...form };

  if (f.voucherType === 'cash_payment' || f.voucherType === 'bank_payment') {
    // If ledgerRows exist and have entries, auto-sum their amounts
    if (f.ledgerRows && f.ledgerRows.length > 0) {
      const ledgerTotal = f.ledgerRows.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
      f.amount = ledgerTotal;
    }
    const amt = parseFloat(f.amount) || 0;
    f.totalDebit = amt;
    f.totalCredit = amt;
    f.difference = 0;
    f.cashAmount = f.amount;
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

  // ─── Master Data State ────────────────────────────────────────────────────
  masterData: {
    ledgers: [],
    gstLedgers: [],
    tdsLedgers: [],
    costCenters: [],
    costCategories: [],
    gstRates: [],
    tdsRates: [],
    voucherTypes: [],
    voucherTypesFull: [],
    loading: false,
  },

  selectedPartyDetails: null,

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

  fetchMasterData: async () => {
    set((s) => ({ masterData: { ...s.masterData, loading: true } }));
    try {
      const res = await fundflowApi.getLedgers();
      let compData = { voucherTypes: [], voucherTypesFull: [] };
      try {
        const compRes = await apiClient.get('/companies/current/master-data').then(r => r.data);
        if (compRes.success && compRes.data) {
          compData = compRes.data;
        }
      } catch (e) {
        console.error("Failed to fetch company master data in fundflow:", e);
      }

      if (res.success) {
        const data = res.data;
        if (data && !Array.isArray(data)) {
          set({
            masterData: {
              ledgers: data.ledgers || [],
              gstLedgers: data.gstLedgers || [],
              tdsLedgers: data.tdsLedgers || [],
              costCenters: data.costCenters || [],
              costCategories: data.costCategories || [],
              gstRates: data.gstRates || [],
              tdsRates: data.tdsRates || [],
              voucherTypes: compData.voucherTypes || [],
              voucherTypesFull: compData.voucherTypesFull || [],
              loading: false
            }
          });
        } else {
          set({
            masterData: {
              ledgers: data || [],
              gstLedgers: [],
              tdsLedgers: [],
              costCenters: [],
              costCategories: [],
              gstRates: [],
              tdsRates: [],
              voucherTypes: compData.voucherTypes || [],
              voucherTypesFull: compData.voucherTypesFull || [],
              loading: false
            }
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch fundflow master data:", err);
      set((s) => ({ masterData: { ...s.masterData, loading: false } }));
    }
  },

  fetchTransaction: async (id) => {
    set((s) => ({ loading: { ...s.loading, detail: true }, error: null }));
    try {
      const res = await fundflowApi.getById(id);
      set({
        selectedTransaction: res.data,
        form: {
          ...res.data,
          entryMode: res.data.entryMode || 'manual',
          excessOption: res.data.excessOption || '',
          remarks: res.data.remarks || '',
          costCategory: res.data.costCategory || '',
          costCenter: res.data.costCenter || '',
          costAmount: res.data.costAmount || 0,
        }
      });
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
    if (updatedForm.voucherType === 'cash_payment' || updatedForm.voucherType === 'bank_payment') {
      if (key === 'amount') {
        updatedForm.cashAmount = value;
      } else if (key === 'cashAmount') {
        updatedForm.amount = value;
      }
    }
    return { form: calculateFormTotals(updatedForm) };
  }),

  setForm: (newForm) => set({ form: calculateFormTotals(newForm) }),

  resetForm: (voucherType = 'cash_payment') => set({
    form: {
      ...DEFAULT_FORM,
      voucherType,
      drCrType: voucherType === 'bank_payment' ? 'Credit (Cr)' : 'Debit (Dr)',
      voucherDate: new Date().toISOString().substring(0, 10),
      excessOption: '',
      remarks: '',
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
      set({
        form: {
          ...res.data,
          entryMode: res.data.entryMode || 'manual',
          excessOption: res.data.excessOption || '',
          remarks: res.data.remarks || '',
          costCategory: res.data.costCategory || '',
          costCenter: res.data.costCenter || '',
          costAmount: res.data.costAmount || 0,
        }
      });
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
      const payload = { ...form, status: 'pending_approval' };
      let res;
      if (form._id) {
        res = await fundflowApi.update(form._id, payload);
      } else {
        res = await fundflowApi.create(payload);
      }
      set({
        form: {
          ...res.data,
          entryMode: res.data.entryMode || 'manual',
          excessOption: res.data.excessOption || '',
          remarks: res.data.remarks || '',
          costCategory: res.data.costCategory || '',
          costCenter: res.data.costCenter || '',
          costAmount: res.data.costAmount || 0,
        }
      });
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

  fetchNextVoucherNumber: async (voucherType) => {
    try {
      const res = await fundflowApi.getNextVoucherNumber(voucherType);
      if (res.success && res.data) {
        set((s) => ({ form: { ...s.form, voucherNumber: res.data.voucherNumber } }));
      }
    } catch (err) {
      console.error('Failed to fetch next voucher number:', err);
    }
  },

  fetchPartyDetails: async (partyName) => {
    if (!partyName) {
      set({ selectedPartyDetails: null });
      return;
    }
    try {
      const res = await fundflowApi.getPartyDetails(partyName);
      if (res.success && res.data) {
        set({ selectedPartyDetails: res.data });
        
        const details = res.data;
        
        // Default DR/CR type:
        // Group = Sundry Creditors -> Debit
        // Group = Sundry Debtors -> Credit
        // Group = Expense Ledger / Expense -> Debit
        let defaultDrCr = get().form.voucherType === 'bank_payment' ? 'Credit (Cr)' : 'Debit (Dr)';
        get().setFormValue('drCrType', defaultDrCr);
        get().setFormValue('ledgerGroup', details.groupName);
        get().setFormValue('excessOption', '');
        
        // Auto-fill Bill Allocation table: Initialize a single row matching the voucher amount
        const voucherAmount = parseFloat(get().form.amount) || 0;
        if (details.pendingBills && details.pendingBills.length > 0) {
          get().setFormValue('billRows', [{
            id: Date.now(),
            billType: 'Against Ref',
            billNo: '',
            billRef: '',
            date: '',
            dueDate: '',
            billAmount: 0,
            pendingAmount: 0,
            allocationAmount: voucherAmount,
            allocatedAmount: voucherAmount
          }]);
        } else {
          get().setFormValue('billRows', [{
            id: Date.now(),
            billType: 'On Account',
            billNo: '',
            billRef: '',
            date: '',
            dueDate: '',
            billAmount: 0,
            pendingAmount: 0,
            allocationAmount: voucherAmount,
            allocatedAmount: voucherAmount
          }]);
        }

        // Autofill Cost Center Details
        if (details.isCostCentresOn) {
          const master = get().masterData || {};
          const categories = master.costCategories || [];
          const centers = master.costCenters || [];
          
          const defaultCategory = categories[0] || 'Primary Cost Category';
          const filteredCenters = centers.filter(c => c.category === defaultCategory);
          const defaultCenter = (filteredCenters[0] || centers[0])?.name || 'Mumbai Branch';
          const defaultAmount = parseFloat(get().form.amount) || 0;
          
          get().setFormValue('costCategory', defaultCategory);
          get().setFormValue('costCenter', defaultCenter);
          get().setFormValue('costAmount', defaultAmount);
          get().setFormValue('costCenters', [{ category: defaultCategory, name: defaultCenter, amount: defaultAmount }]);
        } else {
          get().setFormValue('costCategory', '');
          get().setFormValue('costCenter', '');
          get().setFormValue('costAmount', 0);
          get().setFormValue('costCenters', []);
        }

        // Autofill GST Details
        if (details.gstApplicable) {
          const master = get().masterData || {};
          const gstLedgers = master.gstLedgers || [];
          const gstRates = master.gstRates || [];
          
          const defaultGstLedger = gstLedgers[0]?.name || (gstLedgers[0] || 'CGST @ 9%');
          const defaultGstRate = gstRates[0] || '18%';
          
          get().setFormValue('gstApplicable', true);
          get().setFormValue('gstLedger', typeof defaultGstLedger === 'object' ? defaultGstLedger.name : defaultGstLedger);
          get().setFormValue('gstRate', defaultGstRate);
        } else {
          get().setFormValue('gstApplicable', false);
          get().setFormValue('gstLedger', '');
          get().setFormValue('gstRate', '');
        }

        // Autofill TDS Details
        if (details.tdsApplicable) {
          const master = get().masterData || {};
          const tdsLedgers = master.tdsLedgers || [];
          const tdsRates = master.tdsRates || [];
          
          const defaultTdsLedger = tdsLedgers[0]?.name || (tdsLedgers[0] || 'TDS Payable');
          const defaultTdsRate = tdsRates[0] || '10%';
          
          get().setFormValue('tdsApplicable', true);
          get().setFormValue('tdsLedger', typeof defaultTdsLedger === 'object' ? defaultTdsLedger.name : defaultTdsLedger);
          get().setFormValue('tdsRate', defaultTdsRate);
        } else {
          get().setFormValue('tdsApplicable', false);
          get().setFormValue('tdsLedger', '');
          get().setFormValue('tdsRate', '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch party details:', err);
    }
  },

  fetchCashBankBalance: async (ledgerName, type) => {
    if (!ledgerName) return;
    try {
      const res = await fundflowApi.getPartyDetails(ledgerName);
      if (res.success && res.data) {
        const balance = res.data.outstandingBalance || 0.0;
        if (type === 'cash') {
          set((s) => ({ form: { ...s.form, openingBalance: balance } }));
        } else if (type === 'bank') {
          set((s) => ({ form: { ...s.form, bankBalance: balance } }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch cash/bank balance:', err);
    }
  },
}));

export default useFundFlowStore;
