import apiClient from '../lib/apiClient';

const BASE_URL = '/bank/ai-statement';

export const bankStatementAiApi = {
  /**
   * Upload bank statement (PDF, XLSX, XLS, CSV) + bankLedger
   */
  uploadStatement: (file, bankLedger, forceReplace = false, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    form.append('bankLedger', bankLedger);
    if (forceReplace) {
      form.append('force_replace', 'true');
    }

    return apiClient.post(`${BASE_URL}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
      timeout: 180000
    }).then((r) => r.data);
  },

  /**
   * Get all processed bank statement document batches
   */
  getBatches: () =>
    apiClient.get(`${BASE_URL}/batches`).then((r) => r.data),

  /**
   * Get draft statement items for review
   */
  getBatchReview: (batchId) =>
    apiClient.get(`${BASE_URL}/review/${batchId}`).then((r) => r.data),

  /**
   * Update accountant edited transaction fields matching manual voucher entry schema
   */
  updateTransaction: (batchId, itemId, payload) =>
    apiClient.put(`${BASE_URL}/transaction/${batchId}/${itemId}`, payload).then((r) => r.data),

  /**
   * Bulk accept auto-suggested or accountant-confirmed ledgers for multiple items in 1 request
   */
  bulkAcceptSuggested: (batchId, items) =>
    apiClient.post(`${BASE_URL}/batch-accept-suggested`, { batch_id: batchId, items }).then((r) => r.data),

  /**
   * Save approved vouchers into accounting system with source='bank_statement'
   */
  saveVouchers: (batchId, itemIds) =>
    apiClient.post(`${BASE_URL}/save-vouchers`, { batch_id: batchId, item_ids: itemIds }).then((r) => r.data),

  /**
   * Push saved vouchers to Tally in ONE single combined XML request
   */
  pushToTally: (batchId, itemIds = null, voucherIds = null) =>
    apiClient.post(`${BASE_URL}/push-to-tally`, {
      batch_id: batchId,
      item_ids: itemIds,
      voucher_ids: voucherIds
    }).then((r) => r.data),

  /**
   * Preview single combined Tally XML for selected/saved vouchers
   */
  previewBatchXml: (batchId, itemIds = null, voucherIds = null) =>
    apiClient.post(`${BASE_URL}/preview-batch-xml`, {
      batch_id: batchId,
      item_ids: itemIds,
      voucher_ids: voucherIds
    }).then((r) => r.data),

  /**
   * Completely delete a processed bank statement draft batch
   */
  deleteBatch: (batchId) =>
    apiClient.delete(`${BASE_URL}/batch/${batchId}`).then((r) => r.data),
};

export default bankStatementAiApi;
