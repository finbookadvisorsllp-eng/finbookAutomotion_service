import salesService from '../services/sales.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  sendSuccess, sendCreated, sendPaginated,
  sendNotFound, sendBadRequest,
} from '../utils/apiResponse.js';

// ─────────────────────────────────────────────────────────────────────────────
//  CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/sales?voucherType=sales_invoice&status=draft&page=1&limit=20
 * List transactions with filters, search, and pagination.
 */
export const listTransactions = asyncHandler(async (req, res) => {
  const { docs, total } = await salesService.listTransactions(req.query);
  const { page = 1, limit = 20 } = req.query;
  sendPaginated(res, docs, total, page, limit, 'Sales transactions retrieved');
});

/**
 * POST /api/sales
 * Create a new manual sales transaction.
 */
export const createTransaction = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    entryMode: 'manual',
    createdBy: req.user?.email || req.user?.id || 'system',
    companyId: req.body.companyId || req.user?.companyId,
  };
  const doc = await salesService.createTransaction(payload);
  sendCreated(res, doc, 'Sales transaction created successfully');
});

/**
 * GET /api/sales/:id
 * Get a single transaction by ID.
 */
export const getTransaction = asyncHandler(async (req, res) => {
  const doc = await salesService.getTransaction(req.params.id);
  sendSuccess(res, doc, 'Transaction retrieved');
});

/**
 * PUT /api/sales/:id
 * Update a transaction (only draft/pending_review allowed).
 */
export const updateTransaction = asyncHandler(async (req, res) => {
  const updatedBy = req.user?.email || req.user?.id || 'system';
  const doc = await salesService.updateTransaction(req.params.id, req.body, updatedBy);
  sendSuccess(res, doc, 'Transaction updated successfully');
});

/**
 * PATCH /api/sales/:id/status
 * Update workflow status: draft → pending_review → approved → archived
 * Body: { status, note }
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const performedBy = req.user?.email || req.user?.id || 'system';
  const doc = await salesService.updateStatus(req.params.id, status, note, performedBy);
  sendSuccess(res, doc, `Status updated to '${status}'`);
});

/**
 * DELETE /api/sales/:id
 * Hard delete (draft only).
 */
export const deleteTransaction = asyncHandler(async (req, res) => {
  await salesService.deleteTransaction(req.params.id);
  sendSuccess(res, null, 'Transaction deleted');
});

/**
 * GET /api/sales/stats?voucherType=sales_invoice&companyId=xxx
 * Get dashboard summary stats (counts + totals per status).
 */
export const getSummaryStats = asyncHandler(async (req, res) => {
  const { voucherType = 'sales_invoice', companyId } = req.query;
  const stats = await salesService.getSummaryStats(companyId, voucherType);
  sendSuccess(res, stats, 'Summary statistics retrieved');
});

// ─────────────────────────────────────────────────────────────────────────────
//  Activity Log / Comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/sales/:id/comments
 * Add a comment/note to the activity log.
 * Body: { note }
 */
export const addComment = asyncHandler(async (req, res) => {
  const { note } = req.body;
  if (!note?.trim()) return sendBadRequest(res, 'Comment text is required');
  const performedBy = req.user?.email || req.user?.id || 'anonymous';
  const doc = await salesService.addComment(req.params.id, note.trim(), performedBy);
  sendSuccess(res, doc, 'Comment added');
});

// ─────────────────────────────────────────────────────────────────────────────
//  AI-OCR Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/sales/ocr/extract
 * Upload a document, run OCR, return extracted fields for autofill.
 * Does NOT create a transaction — purely extraction.
 *
 * multipart/form-data: field name = "document"
 */
export const extractOcr = asyncHandler(async (req, res) => {
  if (!req.file) return sendBadRequest(res, 'Document file is required (field: "document")');

  const { buffer, mimetype, originalname } = req.file;
  const result = await salesService.extractOcr(buffer, mimetype, originalname);

  sendSuccess(res, result, 'OCR extraction successful. Review extracted fields before submitting.');
});

/**
 * POST /api/sales/ocr/submit
 * Submit the user-verified form data (with OCR metadata) to create a transaction.
 * Body: { transactionPayload: {...}, ocrMeta: { confidence, cloudinaryUrl, ... } }
 */
export const submitOcrTransaction = asyncHandler(async (req, res) => {
  const { transactionPayload, ocrMeta } = req.body;

  if (!transactionPayload) return sendBadRequest(res, 'transactionPayload is required');
  if (!ocrMeta)            return sendBadRequest(res, 'ocrMeta is required');

  const createdBy = req.user?.email || req.user?.id || 'system';
  const doc = await salesService.createFromOcr(transactionPayload, ocrMeta, createdBy);

  sendCreated(res, doc, 'Transaction created from OCR data');
});

/**
 * POST /api/sales/:id/documents
 * Attach a document to an existing transaction.
 * multipart/form-data: field name = "document"
 */
export const attachDocument = asyncHandler(async (req, res) => {
  if (!req.file) return sendBadRequest(res, 'Document file is required');

  const { buffer, mimetype, originalname } = req.file;
  const doc = await salesService.attachDocument(req.params.id, buffer, mimetype, originalname);

  sendSuccess(res, doc, 'Document attached successfully');
});

/**
 * GET /api/sales/:id/documents
 * Return the list of attached documents for a transaction.
 */
export const getDocuments = asyncHandler(async (req, res) => {
  const doc = await salesService.getTransaction(req.params.id);
  sendSuccess(res, doc.attachedDocuments || [], 'Documents retrieved');
});

// ─────────────────────────────────────────────────────────────────────────────
//  CSV Bulk Upload Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/sales/csv/preview
 * Parse & validate CSV without inserting — returns preview + errors.
 * multipart/form-data: field name = "file"
 */
export const previewCsv = asyncHandler(async (req, res) => {
  if (!req.file) return sendBadRequest(res, 'CSV file is required (field: "file")');

  const preview = salesService.parseAndPreviewCsv(req.file.buffer);
  sendSuccess(res, preview, 'CSV preview ready. Review before confirming import.');
});

/**
 * POST /api/sales/csv/import
 * Confirm and execute the CSV bulk import.
 * multipart/form-data: file + query/body: { voucherType }
 */
export const importCsv = asyncHandler(async (req, res) => {
  if (!req.file) return sendBadRequest(res, 'CSV file is required (field: "file")');

  const voucherType = req.body.voucherType || req.query.voucherType || 'sales_invoice';
  const createdBy   = req.user?.email || req.user?.id || 'system';
  const companyId   = req.body.companyId || req.user?.companyId;

  const result = await salesService.importCsv(req.file.buffer, voucherType, companyId, createdBy);

  const statusCode = result.inserted > 0 ? 201 : 422;
  res.status(statusCode).json({
    success: result.inserted > 0,
    message: `Imported ${result.inserted} records. ${result.failed} failed.`,
    data: result,
  });
});

/**
 * GET /api/sales/csv/sample?voucherType=sales_invoice
 * Download a pre-filled sample CSV template.
 */
export const downloadSampleCsv = asyncHandler(async (req, res) => {
  const voucherType = req.query.voucherType || 'sales_invoice';
  const content = salesService.getSampleCsvContent(voucherType);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="sample_${voucherType}.csv"`);
  res.send(content);
});

/**
 * GET /api/sales/export/tally?ids=id1,id2
 * Generate and download Tally XML for selected transactions.
 */
export const exportToTally = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  if (!ids) return sendBadRequest(res, 'Transaction IDs are required');

  const idArray = ids.split(',');
  const xml = await salesService.generateTallyXml(idArray);

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="tally_export_${Date.now()}.xml"`);
  res.send(xml);
});
