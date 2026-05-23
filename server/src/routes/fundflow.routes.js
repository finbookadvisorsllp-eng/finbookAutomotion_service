import { Router } from 'express';
import * as fundflowController from '../controllers/fundflow.controller.js';
import validate from '../middlewares/validate.js';
import { optionalAuth } from '../middlewares/auth.js';
import {
  createFundFlowValidator,
  updateFundFlowValidator,
  fundFlowStatusUpdateValidator,
  listFundFlowQueryValidator,
} from '../validations/fundflow.validation.js';

const router = Router();

// Apply optional auth on all routes
router.use(optionalAuth);

// ─── Statistics ───────────────────────────────────────────────────────────────
router.get('/stats',               fundflowController.getSummaryStats);

// ─── CRUD ─────────────────────────────────────────────────────────────────────
router.get( '/',    validate(listFundFlowQueryValidator, 'query'), fundflowController.listTransactions);
router.post('/',    validate(createFundFlowValidator),             fundflowController.createTransaction);

router.get( '/:id',                fundflowController.getTransaction);
router.put( '/:id', validate(updateFundFlowValidator),            fundflowController.updateTransaction);
router.delete('/:id',              fundflowController.deleteTransaction);

// ─── Workflow Status ──────────────────────────────────────────────────────────
router.patch('/:id/status', validate(fundFlowStatusUpdateValidator), fundflowController.updateStatus);

// ─── Activity / Comments ──────────────────────────────────────────────────────
router.post('/:id/comments',       fundflowController.addComment);

export default router;
