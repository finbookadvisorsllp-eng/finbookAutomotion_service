import fundflowService from '../services/fundflow.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  sendSuccess, sendCreated, sendPaginated,
  sendBadRequest,
} from '../utils/apiResponse.js';

// ─────────────────────────────────────────────────────────────────────────────
//  CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/fundflow?voucherType=cash_payment&status=draft&page=1&limit=20
 * List transactions with filters, search, and pagination.
 */
export const listTransactions = asyncHandler(async (req, res) => {
  const { docs, total } = await fundflowService.listTransactions(req.query);
  const { page = 1, limit = 20 } = req.query;
  sendPaginated(res, docs, total, page, limit, 'Fund Flow transactions retrieved');
});

/**
 * POST /api/fundflow
 * Create a new manual fund flow transaction.
 */
export const createTransaction = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    entryMode: 'manual',
    createdBy: req.user?.email || req.user?.id || 'system',
    companyId: req.body.companyId || req.user?.companyId,
  };
  const doc = await fundflowService.createTransaction(payload);
  sendCreated(res, doc, 'Fund Flow transaction created successfully');
});

/**
 * GET /api/fundflow/:id
 * Get a single transaction by ID.
 */
export const getTransaction = asyncHandler(async (req, res) => {
  const doc = await fundflowService.getTransaction(req.params.id);
  sendSuccess(res, doc, 'Transaction retrieved');
});

/**
 * PUT /api/fundflow/:id
 * Update a transaction (only draft/pending_review allowed).
 */
export const updateTransaction = asyncHandler(async (req, res) => {
  const updatedBy = req.user?.email || req.user?.id || 'system';
  const doc = await fundflowService.updateTransaction(req.params.id, req.body, updatedBy);
  sendSuccess(res, doc, 'Transaction updated successfully');
});

/**
 * PATCH /api/fundflow/:id/status
 * Update workflow status: draft → pending_review → approved → archived
 * Body: { status, note }
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const performedBy = req.user?.email || req.user?.id || 'system';
  const doc = await fundflowService.updateStatus(req.params.id, status, note, performedBy);
  sendSuccess(res, doc, `Status updated to '${status}'`);
});

/**
 * DELETE /api/fundflow/:id
 * Hard delete (draft only).
 */
export const deleteTransaction = asyncHandler(async (req, res) => {
  await fundflowService.deleteTransaction(req.params.id);
  sendSuccess(res, null, 'Transaction deleted');
});

/**
 * GET /api/fundflow/stats?voucherType=cash_payment&companyId=xxx
 * Get dashboard summary stats (counts + totals per status).
 */
export const getSummaryStats = asyncHandler(async (req, res) => {
  const { voucherType = 'cash_payment', companyId } = req.query;
  const stats = await fundflowService.getSummaryStats(companyId, voucherType);
  sendSuccess(res, stats, 'Summary statistics retrieved');
});

// ─────────────────────────────────────────────────────────────────────────────
//  Activity Log / Comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/fundflow/:id/comments
 * Add a comment/note to the activity log.
 * Body: { note }
 */
export const addComment = asyncHandler(async (req, res) => {
  const { note } = req.body;
  if (!note?.trim()) return sendBadRequest(res, 'Comment text is required');
  const performedBy = req.user?.email || req.user?.id || 'anonymous';
  const doc = await fundflowService.addComment(req.params.id, note.trim(), performedBy);
  sendSuccess(res, doc, 'Comment added');
});
