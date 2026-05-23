import apiClient from '../lib/apiClient';

const SALES_BASE = '/sales';

// ─────────────────────────────────────────────────────────────────────────────
//  Types (JSDoc for IDE intellisense without TypeScript)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SalesListParams
 * @property {string} [voucherType] - 'sales_order'|'sales_invoice'|'credit_note'
 * @property {string} [status] - 'draft'|'pending_review'|'approved'|'archived'
 * @property {string} [search]
 * @property {number} [page]
 * @property {number} [limit]
 * @property {string} [dateFrom]
 * @property {string} [dateTo]
 * @property {string} [sortBy]
 * @property {string} [sortOrder]
 */

// ─────────────────────────────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const salesApi = {
  /**
   * List transactions with filters + pagination
   * @param {SalesListParams} params
   */
  list: (params = {}) =>
    apiClient.get(SALES_BASE, { params }).then((r) => r.data),

  /**
   * Get single transaction
   */
  getById: (id) =>
    apiClient.get(`${SALES_BASE}/${id}`).then((r) => r.data),

  /**
   * Create a manual entry
   */
  create: (payload) =>
    apiClient.post(SALES_BASE, payload).then((r) => r.data),

  /**
   * Update a transaction
   */
  update: (id, payload) =>
    apiClient.put(`${SALES_BASE}/${id}`, payload).then((r) => r.data),

  /**
   * Delete a draft transaction
   */
  delete: (id) =>
    apiClient.delete(`${SALES_BASE}/${id}`).then((r) => r.data),

  /**
   * Update workflow status
   * @param {string} id
   * @param {'pending_review'|'approved'|'rejected'|'archived'} status
   * @param {string} [note]
   */
  updateStatus: (id, status, note = '') =>
    apiClient.patch(`${SALES_BASE}/${id}/status`, { status, note }).then((r) => r.data),

  /**
   * Get summary stats for dashboard cards
   */
  getStats: (voucherType = 'sales_invoice', companyId) =>
    apiClient.get(`${SALES_BASE}/stats`, { params: { voucherType, companyId } }).then((r) => r.data),

  /**
   * Add a comment to the activity log
   */
  addComment: (id, note) =>
    apiClient.post(`${SALES_BASE}/${id}/comments`, { note }).then((r) => r.data),

  // ─── AI-OCR ──────────────────────────────────────────────────────────────

  /**
   * Step 1: Upload document for OCR extraction.
   * Returns extracted form fields for autofill.
   * @param {File} file
   * @param {Function} [onProgress] - progress callback (0-100)
   */
  extractOcr: (file, onProgress) => {
    const form = new FormData();
    form.append('document', file);
    return apiClient.post(`${SALES_BASE}/ocr/extract`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    }).then((r) => r.data);
  },

  /**
   * Step 2: Submit OCR-verified transaction
   * @param {Object} transactionPayload - form values after user review
   * @param {Object} ocrMeta - OCR metadata from extractOcr step
   */
  submitOcrTransaction: (transactionPayload, ocrMeta) =>
    apiClient.post(`${SALES_BASE}/ocr/submit`, { transactionPayload, ocrMeta }).then((r) => r.data),

  /**
   * Attach a document to an existing transaction
   * @param {string} id - transaction ID
   * @param {File} file
   */
  attachDocument: (id, file) => {
    const form = new FormData();
    form.append('document', file);
    return apiClient.post(`${SALES_BASE}/${id}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  /**
   * Get attached documents for a transaction
   */
  getDocuments: (id) =>
    apiClient.get(`${SALES_BASE}/${id}/documents`).then((r) => r.data),

  // ─── CSV Bulk Upload ──────────────────────────────────────────────────────

  /**
   * Preview CSV without importing — returns validation results
   * @param {File} file
   */
  previewCsv: (file) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`${SALES_BASE}/csv/preview`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  /**
   * Import CSV rows into the database
   * @param {File} file
   * @param {'sales_order'|'sales_invoice'|'credit_note'} voucherType
   */
  importCsv: (file, voucherType = 'sales_invoice') => {
    const form = new FormData();
    form.append('file', file);
    form.append('voucherType', voucherType);
    return apiClient.post(`${SALES_BASE}/csv/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  /**
   * Download sample CSV template
   * @param {'sales_order'|'sales_invoice'|'credit_note'} voucherType
   */
  downloadSampleCsv: async (voucherType = 'sales_invoice') => {
    const response = await apiClient.get(`${SALES_BASE}/csv/sample`, {
      params: { voucherType },
      responseType: 'blob',
    });
    const url  = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href     = url;
    link.download = `sample_${voucherType}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Export transaction(s) to Tally XML format
   * @param {string|string[]} ids - single ID or array of IDs
   */
  exportToTally: async (ids) => {
    const idList = Array.isArray(ids) ? ids.join(',') : ids;
    const response = await apiClient.get(`${SALES_BASE}/export/tally`, {
      params: { ids: idList },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tally_export_${new Date().getTime()}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  },
};

export default salesApi;
