import { Router } from 'express';
import * as salesController from '../controllers/sales.controller.js';
import { uploadDocument, uploadCSV } from '../config/multer.js';
import validate from '../middlewares/validate.js';
import { optionalAuth } from '../middlewares/auth.js';
import {
  createSalesValidator,
  updateSalesValidator,
  statusUpdateValidator,
  listSalesQueryValidator,
} from '../validations/sales.validation.js';

const router = Router();

// Apply optional auth on all routes (required auth can be enforced per-route)
router.use(optionalAuth);

// ─── Statistics ───────────────────────────────────────────────────────────────
// Must come BEFORE /:id routes to avoid "stats" being treated as an ID
router.get('/stats',               salesController.getSummaryStats);
router.get('/export/tally',        salesController.exportToTally);

// ─── CSV Bulk Upload ──────────────────────────────────────────────────────────
router.get( '/csv/sample',         salesController.downloadSampleCsv);
router.post('/csv/preview',        uploadCSV.single('file'),      salesController.previewCsv);
router.post('/csv/import',         uploadCSV.single('file'),      salesController.importCsv);

// ─── AI-OCR ───────────────────────────────────────────────────────────────────
router.post('/ocr/extract',        uploadDocument.single('document'), salesController.extractOcr);
router.post('/ocr/submit',         salesController.submitOcrTransaction);

// ─── CRUD ─────────────────────────────────────────────────────────────────────
router.get( '/',    validate(listSalesQueryValidator, 'query'), salesController.listTransactions);
router.post('/',    validate(createSalesValidator),             salesController.createTransaction);

router.get( '/:id',                salesController.getTransaction);
router.put( '/:id', validate(updateSalesValidator),            salesController.updateTransaction);
router.delete('/:id',              salesController.deleteTransaction);

// ─── Workflow Status ──────────────────────────────────────────────────────────
router.patch('/:id/status', validate(statusUpdateValidator), salesController.updateStatus);

// ─── Activity / Comments ──────────────────────────────────────────────────────
router.post('/:id/comments',       salesController.addComment);

// ─── Document Attachments ────────────────────────────────────────────────────
router.get( '/:id/documents',      salesController.getDocuments);
router.post('/:id/documents',      uploadDocument.single('document'), salesController.attachDocument);

export default router;
