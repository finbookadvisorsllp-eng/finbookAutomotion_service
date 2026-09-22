import apiClient from '../lib/apiClient';

const BANK_AI_BASE = '/bank/ai-statement';

const bankRulesApi = {
  /**
   * Fetch saved mapping rules for a specific bank ledger or all ledgers
   */
  getRules: async (bankLedger, filters = {}) => {
    const params = {};
    if (bankLedger) params.bankLedger = bankLedger;
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
          params[k] = v;
        }
      });
    }
    const res = await apiClient.get(`${BANK_AI_BASE}/rules`, { params, timeout: 60000 });
    return res.data;
  },

  /**
   * Create a new pattern -> party ledger mapping rule
   */
  createRule: async (ruleData) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules`, ruleData);
    return res.data;
  },

  /**
   * Update an existing mapping rule
   */
  updateRule: async (ruleId, updates) => {
    const res = await apiClient.put(`${BANK_AI_BASE}/rules/${ruleId}`, updates);
    return res.data;
  },

  /**
   * Toggle rule active/disabled status
   */
  toggleRuleStatus: async (ruleId) => {
    const res = await apiClient.patch(`${BANK_AI_BASE}/rules/${ruleId}/status`);
    return res.data;
  },

  /**
   * Duplicate an existing mapping rule
   */
  duplicateRule: async (ruleId) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules/${ruleId}/duplicate`);
    return res.data;
  },

  /**
   * Delete a rule by ID
   */
  deleteRule: async (ruleId) => {
    const res = await apiClient.delete(`${BANK_AI_BASE}/rules/${ruleId}`);
    return res.data;
  },

  /**
   * Test a rule before saving against batch or sample narrations
   */
  testRule: async (testData) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules/test`, testData);
    return res.data;
  },

  /**
   * Trigger Engine B: AI pattern discovery on a statement batch
   */
  discoverPatterns: async (batchId, bankLedger) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules/discover`, {
      batch_id: batchId,
      bank_ledger: bankLedger
    });
    return res.data;
  },

  /**
   * Fetch candidate suggestions awaiting human review
   * NOTE: First call per batch triggers LLM pattern analysis — allow 60s timeout.
   */
  getSuggestions: async (bankLedger, queryParams = {}) => {
    const params = {};
    if (bankLedger) params.bankLedger = bankLedger;
    if (queryParams) {
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
          params[k] = v;
        }
      });
    }
    const res = await apiClient.get(`${BANK_AI_BASE}/rules/suggestions`, { params, timeout: 60000 });
    return res.data;
  },

  /**
   * Approve an AI candidate suggestion into an active rule
   */
  approveSuggestion: async (suggestionId, payload) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules/suggestions/${suggestionId}/approve`, payload);
    return res.data;
  },

  /**
   * Reject an AI candidate suggestion
   */
  rejectSuggestion: async (suggestionId) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules/suggestions/${suggestionId}/reject`);
    return res.data;
  },

  /**
   * Submit user feedback when correcting a transaction mapping
   */
  submitFeedback: async (feedbackData) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules/feedback`, feedbackData);
    return res.data;
  },

  /**
   * Apply all saved rules for bankLedger across current batch draft items
   */
  applyRulesToBatch: async (batchId, bankLedger) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/rules/apply-to-batch`, {
      batch_id: batchId,
      bank_ledger: bankLedger
    });
    return res.data;
  },

  /**
   * Fetch extracted pattern groups for the 4-column Ledger Mapping tab
   * NOTE: May run party resolution — allow 60s timeout.
   */
  getLedgerMappings: async (bankLedger, params = {}) => {
    const res = await apiClient.get(`${BANK_AI_BASE}/ledger-mappings`, {
      params: { bankLedger, ...params },
      timeout: 60000
    });
    return res.data;
  },

  /**
   * Confirm or update party ledger mapping for an extracted pattern
   */
  confirmLedgerMapping: async (payload) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/ledger-mappings/confirm`, payload);
    return res.data;
  },

  /**
   * Live preview extraction of party candidates when token index is changed
   */
  extractPatternPreview: async (payload) => {
    const res = await apiClient.post(`${BANK_AI_BASE}/patterns/extract-preview`, payload);
    return res.data;
  }
};

export default bankRulesApi;
