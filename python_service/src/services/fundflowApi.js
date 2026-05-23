import apiClient from '../lib/apiClient';

const FUNDFLOW_BASE = '/fundflow';

export const fundflowApi = {
  /**
   * List transactions with filters + pagination
   */
  list: (params = {}) =>
    apiClient.get(FUNDFLOW_BASE, { params }).then((r) => r.data),

  /**
   * Get single transaction
   */
  getById: (id) =>
    apiClient.get(`${FUNDFLOW_BASE}/${id}`).then((r) => r.data),

  /**
   * Create a manual entry
   */
  create: (payload) =>
    apiClient.post(FUNDFLOW_BASE, payload).then((r) => r.data),

  /**
   * Update a transaction
   */
  update: (id, payload) =>
    apiClient.put(`${FUNDFLOW_BASE}/${id}`, payload).then((r) => r.data),

  /**
   * Delete a draft transaction
   */
  delete: (id) =>
    apiClient.delete(`${FUNDFLOW_BASE}/${id}`).then((r) => r.data),

  /**
   * Update workflow status
   */
  updateStatus: (id, status, note = '') =>
    apiClient.patch(`${FUNDFLOW_BASE}/${id}/status`, { status, note }).then((r) => r.data),

  /**
   * Get summary stats for dashboard cards
   */
  getStats: (voucherType = 'cash_payment', companyId) =>
    apiClient.get(`${FUNDFLOW_BASE}/stats`, { params: { voucherType, companyId } }).then((r) => r.data),

  /**
   * Add a comment to the activity log
   */
  addComment: (id, note) =>
    apiClient.post(`${FUNDFLOW_BASE}/${id}/comments`, { note }).then((r) => r.data),
};

export default fundflowApi;
