import { Router } from 'express';
import * as purchaseController from '../controllers/purchase.controller.js';
import validate from '../middlewares/validate.js';
import { optionalAuth } from '../middlewares/auth.js';
import {
  createPurchaseValidator,
  updatePurchaseValidator,
  purchaseStatusUpdateValidator,
  listPurchaseQueryValidator,
} from '../validations/purchase.validation.js';

const router = Router();

// Apply optional auth on all routes
router.use(optionalAuth);

// ─── Statistics ───────────────────────────────────────────────────────────────
router.get('/stats',               purchaseController.getSummaryStats);

// ─── CRUD ─────────────────────────────────────────────────────────────────────
router.get( '/',    validate(listPurchaseQueryValidator, 'query'), purchaseController.listTransactions);
router.post('/',    validate(createPurchaseValidator),             purchaseController.createTransaction);

router.get( '/:id',                purchaseController.getTransaction);
router.put( '/:id', validate(updatePurchaseValidator),            purchaseController.updateTransaction);
router.delete('/:id',              purchaseController.deleteTransaction);

// ─── Workflow Status ──────────────────────────────────────────────────────────
router.patch('/:id/status', validate(purchaseStatusUpdateValidator), purchaseController.updateStatus);

// ─── Activity / Comments ──────────────────────────────────────────────────────
router.post('/:id/comments',       purchaseController.addComment);

export default router;
