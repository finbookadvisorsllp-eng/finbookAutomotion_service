import apiClient from '../lib/apiClient';

const PURCHASE_BASE = '/purchase';

// ─────────────────────────────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const purchaseApi = {
  /**
   * List transactions with filters + pagination
   */
  list: (params = {}) =>
    apiClient.get(PURCHASE_BASE, { params }).then((r) => r.data),

  /**
   * Get single transaction
   */
  getById: (id) =>
    apiClient.get(`${PURCHASE_BASE}/${id}`).then((r) => r.data),

  /**
   * Create a manual entry
   */
  create: (payload) =>
    apiClient.post(PURCHASE_BASE, payload).then((r) => r.data),

  /**
   * Update a transaction
   */
  update: (id, payload) =>
    apiClient.put(`${PURCHASE_BASE}/${id}`, payload).then((r) => r.data),

  /**
   * Delete a draft transaction
   */
  delete: (id) =>
    apiClient.delete(`${PURCHASE_BASE}/${id}`).then((r) => r.data),

  /**
   * Update workflow status
   */
  updateStatus: (id, status, note = '') =>
    apiClient.patch(`${PURCHASE_BASE}/${id}/status`, { status, note }).then((r) => r.data),

  /**
   * Get summary stats for dashboard cards
   */
  getStats: (voucherType = 'purchase_invoice', companyId) =>
    apiClient.get(`${PURCHASE_BASE}/stats`, { params: { voucherType, companyId } }).then((r) => r.data),

  /**
   * Add a comment to the activity log
   */
  addComment: (id, note) =>
    apiClient.post(`${PURCHASE_BASE}/${id}/comments`, { note }).then((r) => r.data),
};

export default purchaseApi;
