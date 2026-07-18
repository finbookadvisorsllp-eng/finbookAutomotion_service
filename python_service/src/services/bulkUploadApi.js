import apiClient from '../lib/apiClient';

export const bulkUploadApi = {
  // ── Phase 2: Upload & OCR ──────────────────────────────────
  uploadFile: (file, onProgress, forceReplace = false, source = 'Manual Upload') => {
    const form = new FormData();
    form.append('file', file);
    form.append('force_replace', forceReplace);
    form.append('source', source);
    return apiClient.post('/bulk-upload/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    }).then((r) => r.data);
  },

  /**
   * Starts OCR processing. Returns immediately with status "processing" or cached "done".
   * Use pollOcrStatus() to wait for completion.
   */
  processOcr: (uploadId) =>
    apiClient.post('/bulk-upload/ocr/process', { upload_id: uploadId }, { timeout: 180000 }).then((r) => r.data),

  /**
   * Polls /ocr/status/{uploadId} until OCR completes, fails, or times out.
   * @returns {Promise<object>} The completed OCR response with status="done"
   * @throws {Error} if OCR failed or timed out
   */
  pollOcrStatus: async (uploadId, { maxWaitMs = 180000, intervalMs = 3000 } = {}) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = await apiClient.get(`/bulk-upload/ocr/status/${uploadId}`).then((r) => r.data);
      if (res.status === 'done')       return res;
      if (res.status === 'failed')     throw new Error(res.error || 'OCR processing failed');
      // still processing — wait before next poll
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`OCR timed out after ${maxWaitMs / 1000}s`);
  },

  extractFields: (uploadId) =>
    apiClient.post('/bulk-upload/ocr/extract', { upload_id: uploadId }, { timeout: 60000 }).then((r) => r.data),

  // ── Phase 3: Document Classification ──────────────────────
  /**
   * Classifies the document type using AI on OCR text.
   * IMPORTANT: OCR must be completed (pollOcrStatus) before calling this.
   * Returns: { success, document_type, confidence, reasoning }
   */
  classifyDocument: (uploadId) =>
    apiClient.post('/bulk-upload/ai/classify', { upload_id: uploadId }, { timeout: 60000 }).then((r) => r.data),

  // ── Phase 4: Full Accounting Extraction ───────────────────
  /**
   * Extracts full structured accounting data.
   * IMPORTANT: OCR must be completed (pollOcrStatus) before calling this.
   * Returns: { success, data: { header, items, totals, additionalFields, suggestions, overallConfidence } }
   */
  extractFullData: (uploadId, documentType = null, forceRerun = false) =>
    apiClient.post('/bulk-upload/ai/extract-full', {
      upload_id: uploadId,
      document_type: documentType,
      force_rerun: forceRerun,
    }, { timeout: 120000 }).then((r) => r.data),

  // ── Phase 5: Save Draft ───────────────────────────────────
  saveDraft: (uploadId, editedData, documentType = null, editor = 'User') =>
    apiClient.post('/bulk-upload/ai/save-draft', {
      upload_id: uploadId,
      edited_data: editedData,
      document_type: documentType,
      editor,
    }, { timeout: 30000 }).then((r) => r.data),

  // ── History & Metadata ────────────────────────────────────
  getHistory: (uploadId) =>
    apiClient.get(`/bulk-upload/ai/history/${uploadId}`).then((r) => r.data),

  getDocumentTypes: () =>
    apiClient.get('/bulk-upload/ai/document-types').then((r) => r.data),
  // ── Dynamic Document Understanding Engine (Phase NEW) ─────
  /**
   * THE MAIN AI CALL. Single endpoint replacing classify+extract.
   * Polls OCR status first, then calls /ai/analyze.
   * Returns: { success, schema: { document_type, sections[], suggestions, overall_confidence } }
   * The frontend renders sections[] directly — no hardcoded forms.
   */
  analyzeDocument: async (uploadId, forceRerun = false) => {
    // Ensure OCR is complete before calling analyze
    const ocrRes = await apiClient.post('/bulk-upload/ocr/process', { upload_id: uploadId }, { timeout: 180000 }).then((r) => r.data);
    if (ocrRes.status === 'processing') {
      await bulkUploadApi.pollOcrStatus(uploadId, { maxWaitMs: 180000, intervalMs: 3000 });
    } else if (ocrRes.status === 'failed') {
      throw new Error(ocrRes.error || 'OCR failed');
    }
    return apiClient.post('/bulk-upload/ai/analyze', {
      upload_id: uploadId,
      force_rerun: forceRerun,
    }, { timeout: 120000 }).then((r) => r.data);
  },

  /**
   * Re-runs only the AI analysis step (skips OCR, assumes OCR is already done).
   * Used by the Re-run AI button in the review screen.
   */
  reAnalyzeOnly: (uploadId) =>
    apiClient.post('/bulk-upload/ai/analyze', {
      upload_id: uploadId,
      force_rerun: true,
    }, { timeout: 120000 }).then((r) => r.data),

  /**
   * Saves user-edited dynamic form sections as a draft.
   * Never overwrites dynamic_schema or ocr_data.
   */
  saveDynamicDraft: (uploadId, editedSections, documentType = null, editor = 'User') =>
    apiClient.post('/bulk-upload/ai/save-dynamic-draft', {
      upload_id: uploadId,
      edited_sections: editedSections,
      document_type: documentType,
      editor,
    }, { timeout: 30000 }).then((r) => r.data),

  deleteDocument: (uploadId) =>
    apiClient.delete(`/bulk-upload/${uploadId}`).then((r) => r.data),

  updateStatus: (uploadId, status) =>
    apiClient.post('/bulk-upload/status', { upload_id: uploadId, status }).then((r) => r.data),

  listUploads: () =>
    apiClient.get('/bulk-upload').then((r) => r.data),

  getDocument: (uploadId) =>
    apiClient.get(`/bulk-upload/${uploadId}`).then((r) => r.data),

  getProgress: (uploadId) =>
    apiClient.get(`/bulk-upload/ocr/progress/${uploadId}`).then((r) => r.data),

  analyzeSpreadsheet: (file) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/bulk-upload/analyze-spreadsheet', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    }).then((r) => r.data);
  },
};

export default bulkUploadApi;
