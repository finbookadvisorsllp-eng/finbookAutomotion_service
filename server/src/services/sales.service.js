import salesRepository from '../repositories/sales.repository.js';
import CsvImportJob from '../models/CsvImportJob.model.js';
import ocrService from './ocr.service.js';
import csvService from './csv.service.js';
import ApiError from '../utils/ApiError.js';
import { roundTo } from '../utils/helpers.js';

/**
 * SalesService — pure business logic layer.
 * Orchestrates repositories, OCR, CSV, and totals calculation.
 * Controllers call this; this calls repositories and other services.
 */
class SalesService {

  // ─────────────────────────────────────────────────────────────────────────
  //  CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async createTransaction(payload) {
    const enriched = this._computeTotals(payload);
    enriched.activityLog = [{
      action: 'created',
      note: `Entry created via ${payload.entryMode || 'manual'}`,
      performedBy: payload.createdBy || 'system',
      at: new Date(),
    }];
    return salesRepository.create(enriched);
  }

  async getTransaction(id) {
    const doc = await salesRepository.findById(id);
    if (!doc) throw ApiError.notFound('Sales transaction');
    return doc;
  }

  async updateTransaction(id, payload, updatedBy) {
    const existing = await salesRepository.findById(id);
    if (!existing) throw ApiError.notFound('Sales transaction');

    if (['approved', 'archived'].includes(existing.status)) {
      throw ApiError.forbidden('Cannot edit an approved or archived transaction');
    }

    const enriched = this._computeTotals({ ...existing, ...payload });
    enriched.updatedBy = updatedBy;

    const updated = await salesRepository.updateById(id, enriched);

    await salesRepository.addActivityLog(id, {
      action: 'updated',
      note: 'Transaction fields updated',
      performedBy: updatedBy || 'system',
      at: new Date(),
    });

    return updated;
  }

  async updateStatus(id, status, note, performedBy) {
    const existing = await salesRepository.findById(id);
    if (!existing) throw ApiError.notFound('Sales transaction');

    this._validateStatusTransition(existing.status, status);

    const updated = await salesRepository.updateById(id, { status, updatedBy: performedBy });

    await salesRepository.addActivityLog(id, {
      action: `status_changed_to_${status}`,
      note: note || `Status updated to ${status}`,
      performedBy: performedBy || 'system',
      at: new Date(),
    });

    return updated;
  }

  async deleteTransaction(id) {
    const existing = await salesRepository.findById(id);
    if (!existing) throw ApiError.notFound('Sales transaction');
    if (existing.status === 'approved') {
      throw ApiError.forbidden('Approved transactions cannot be deleted. Archive instead.');
    }
    return salesRepository.deleteById(id);
  }

  async listTransactions(queryParams) {
    const {
      page = 1, limit = 20, status, voucherType, search,
      dateFrom, dateTo, partyLedger, sortBy, sortOrder, companyId,
    } = queryParams;

    const filters = { status, voucherType, search, dateFrom, dateTo, partyLedger, companyId };
    const sort = { [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1 };

    return salesRepository.findMany({
      filters, page: parseInt(page), limit: parseInt(limit), sort,
    });
  }

  async getSummaryStats(companyId, voucherType = 'sales_invoice') {
    return salesRepository.getSummaryStats(companyId, voucherType);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  AI-OCR WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Step 1: Upload + Extract
   * Returns extracted fields — does NOT create a transaction yet.
   * The frontend autofills the form; user reviews and submits manually.
   */
  async extractOcr(buffer, mimeType, originalName) {
    const result = await ocrService.processDocument(buffer, mimeType, originalName);

    // Map OCR fields to form fields (same shape as CreateSales form)
    const formFields = this._mapOcrToFormFields(result.fields);

    return {
      confidence: result.confidence,
      rawText: result.rawText,
      cloudinaryUrl: result.cloudinaryUrl,
      cloudinaryId: result.cloudinaryId,
      sizeBytes: result.sizeBytes,
      mimeType: result.mimeType,
      originalName: result.originalName,
      processedAt: result.processedAt,
      // These fields autofill the frontend form
      formFields,
    };
  }

  /**
   * Step 2: Create transaction with OCR metadata attached
   * Called after user reviews & approves the autofilled form.
   */
  async createFromOcr(payload, ocrMeta, createdBy) {
    const enriched = this._computeTotals(payload);
    enriched.entryMode = 'ocr';
    enriched.ocrMetadata = {
      engine: 'google-vision',
      confidence: ocrMeta.confidence,
      rawText: ocrMeta.rawText,
      extractedFields: ocrMeta.formFields,
      processedAt: ocrMeta.processedAt || new Date(),
      documentUrl: ocrMeta.cloudinaryUrl,
      documentId: ocrMeta.cloudinaryId,
    };
    enriched.attachedDocuments = [{
      originalName: ocrMeta.originalName,
      cloudinaryUrl: ocrMeta.cloudinaryUrl,
      cloudinaryId: ocrMeta.cloudinaryId,
      mimeType: ocrMeta.mimeType,
      sizeBytes: ocrMeta.sizeBytes,
      uploadedAt: new Date(),
    }];
    enriched.createdBy = createdBy;
    enriched.activityLog = [
      {
        action: 'ocr_extracted',
        note: `AI OCR extracted data at ${ocrMeta.confidence}% confidence`,
        performedBy: 'system',
        at: ocrMeta.processedAt || new Date(),
      },
      {
        action: 'created',
        note: 'Transaction submitted after OCR review',
        performedBy: createdBy || 'system',
        at: new Date(),
      },
    ];
    return salesRepository.create(enriched);
  }

  /**
   * Attach additional documents to an existing transaction
   */
  async attachDocument(id, buffer, mimeType, originalName) {
    const existing = await salesRepository.findById(id);
    if (!existing) throw ApiError.notFound('Sales transaction');

    const result = await ocrService.processDocument(buffer, mimeType, originalName);

    return salesRepository.addAttachedDocument(id, {
      originalName: result.originalName,
      cloudinaryUrl: result.cloudinaryUrl,
      cloudinaryId: result.cloudinaryId,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      uploadedAt: new Date(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BULK CSV WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Step 1: Preview CSV rows (validate without inserting)
   */
  parseAndPreviewCsv(buffer) {
    const { rows, batchId } = csvService.parseBuffer(buffer);
    const { docs, errors } = csvService.buildTransactionDocs(rows, batchId, 'sales_invoice', null, null);
    return {
      batchId,
      totalRows: rows.length,
      validCount: docs.length,
      failedCount: errors.length,
      errors,
      preview: docs.slice(0, 5), // first 5 rows as preview
    };
  }

  /**
   * Step 2: Confirm and import CSV rows
   */
  async importCsv(buffer, voucherType, companyId, createdBy) {
    const { rows, batchId } = csvService.parseBuffer(buffer);
    const { docs, errors } = csvService.buildTransactionDocs(rows, batchId, voucherType, companyId, createdBy);

    // Create job tracking record
    const job = await CsvImportJob.create({
      batchId,
      voucherType,
      filename: `import_${Date.now()}.csv`,
      totalRows: rows.length,
      successCount: 0,
      failedCount: errors.length,
      errors,
      status: docs.length > 0 ? 'processing' : 'failed',
      companyId,
      createdBy,
    });

    if (docs.length === 0) {
      await CsvImportJob.findByIdAndUpdate(job._id, { status: 'failed' });
      return {
        batchId,
        inserted: 0,
        failed: rows.length,
        errors,
        status: 'failed',
      };
    }

    // Bulk insert with ordered: false so one failure doesn't block rest
    let inserted = 0;
    const insertErrors = [...errors];
    try {
      const result = await salesRepository.bulkCreate(docs);
      inserted = result.length;
    } catch (err) {
      // Mongoose insertMany with ordered:false returns writeErrors
      if (err.writeErrors) {
        inserted = docs.length - err.writeErrors.length;
        err.writeErrors.forEach((we) => {
          insertErrors.push({ row: we.index + 2, message: we.errmsg });
        });
      } else {
        throw err;
      }
    }

    await CsvImportJob.findByIdAndUpdate(job._id, {
      successCount: inserted,
      failedCount: insertErrors.length,
      errors: insertErrors,
      status: 'completed',
    });

    return {
      batchId,
      inserted,
      failed: insertErrors.length,
      errors: insertErrors,
      status: 'completed',
    };
  }

  /**
   * Download sample CSV template
   */
  getSampleCsvContent(voucherType) {
    return csvService.generateSampleCsv(voucherType);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ACTIVITY LOG
  // ─────────────────────────────────────────────────────────────────────────

  async addComment(id, note, performedBy) {
    const existing = await salesRepository.findById(id);
    if (!existing) throw ApiError.notFound('Sales transaction');
    return salesRepository.addActivityLog(id, {
      action: 'comment',
      note,
      performedBy,
      at: new Date(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute all financial totals from line items.
   * This is the single source of truth — never trust client-sent totals.
   */
  _computeTotals(payload) {
    const p = { ...payload };

    let baseTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    if (p.entryTab === 'with_item' && Array.isArray(p.productLines)) {
      p.productLines = p.productLines.map((line) => {
        const qty = parseFloat(line.billQuantity) || 0;
        const rate = parseFloat(line.billRate) || 0;
        const disc = parseFloat(line.discountPercent) || 0;
        const amount = roundTo(qty * rate * (1 - disc / 100));
        const gstRate = parseFloat(line.gstRate) || 0;
        const halfRate = gstRate / 2;
        const cgst = line.rcm ? 0 : roundTo((amount * halfRate) / 100);
        const sgst = line.rcm ? 0 : roundTo((amount * halfRate) / 100);
        const igst = 0;

        baseTotal += amount;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

        return { ...line, amount, cgst, sgst, igst };
      });
    }

    if (p.entryTab === 'without_item' && Array.isArray(p.salesLines)) {
      p.salesLines = p.salesLines.map((line) => {
        const amount = parseFloat(line.amount) || 0;
        const gstRate = parseFloat(line.gstRate) || 0;
        const halfRate = gstRate / 2;
        const cgst = roundTo((amount * halfRate) / 100);
        const sgst = roundTo((amount * halfRate) / 100);
        const igst = 0;

        baseTotal += amount;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

        return { ...line, amount, cgst, sgst, igst };
      });
    }

    // Additional charges
    let additionalTotal = 0;
    if (Array.isArray(p.additionalCharges)) {
      p.additionalCharges.forEach((c) => { additionalTotal += parseFloat(c.amount) || 0; });
    }

    const subTotal = roundTo(baseTotal + cgstTotal + sgstTotal + igstTotal + additionalTotal);

    // TDS
    let tdsTotal = 0;
    if (Array.isArray(p.tdsDetails)) {
      p.tdsDetails.forEach((t) => { tdsTotal += parseFloat(t.amount) || 0; });
    }

    // TCS
    let tcsTotal = 0;
    if (Array.isArray(p.tcsDetails)) {
      p.tcsDetails.forEach((t) => { tcsTotal += parseFloat(t.amount) || 0; });
    }

    const beforeRound = roundTo(subTotal + tcsTotal - tdsTotal);
    const grandTotal = roundTo(beforeRound);
    const roundOff = roundTo(Math.round(beforeRound) - beforeRound);

    // Auto-build GST details for audit
    p.gstDetails = [];
    if (cgstTotal > 0) p.gstDetails.push({ gstType: 'CGST', ledgerName: 'Output CGST', rate: 0, amount: cgstTotal });
    if (sgstTotal > 0) p.gstDetails.push({ gstType: 'SGST', ledgerName: 'Output SGST', rate: 0, amount: sgstTotal });
    if (igstTotal > 0) p.gstDetails.push({ gstType: 'IGST', ledgerName: 'Output IGST', rate: 0, amount: igstTotal });

    return {
      ...p,
      baseTotal: roundTo(baseTotal),
      subTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      tdsTotal,
      tcsTotal,
      roundOff,
      grandTotal,
    };
  }

  /**
   * Map OCR extracted fields → form field names used in CreateSales.jsx
   */
  _mapOcrToFormFields(fields) {
    const items = fields.items || [];
    
    // Inventory Items
    const productLines = items.map((item, i) => ({
      srNo: i + 1,
      stockItem: item.description || '',
      description: item.description || '',
      hsnSacCode: item.hsnSacCode || '',
      billQuantity: parseFloat(item.quantity) || 1,
      billRate: parseFloat(item.rate) || parseFloat(item.amount) || 0,
      discountPercent: 0,
      amount: parseFloat(item.amount) || 0,
      gstRate: parseFloat(item.gstRate) || 0,
    }));

    // Accounting Ledgers
    const salesLines = items.map((item, i) => ({
      srNo: i + 1,
      salesLedger: item.ledger || fields.salesLedger || 'General Sales',
      description: item.description || '',
      hsnSacCode: item.hsnSacCode || '',
      amount: parseFloat(item.amount) || 0,
      gstRate: parseFloat(item.gstRate) || 0,
    }));
    
    // Default if no items
    if (items.length === 0) {
      salesLines.push({
        srNo: 1,
        salesLedger: fields.salesLedger || 'General Sales',
        description: fields.description || '',
        hsnSacCode: fields.hsnSacCode || '',
        amount: parseFloat(fields.baseAmount) || 0,
        gstRate: parseFloat(fields.gstRate) || 0,
      });
    }

    return {
      invoiceNumber: fields.invoiceNumber || '',
      invoiceDate: fields.invoiceDate || '',
      partyLedger: fields.partyName || '',
      partyGstin: fields.partyGstin || '',
      salesLedger: fields.salesLedger || '',
      productLines,
      salesLines,
      baseTotal: parseFloat(fields.baseAmount) || 0,
      cgstTotal: parseFloat(fields.cgst) || 0,
      sgstTotal: parseFloat(fields.sgst) || 0,
      igstTotal: parseFloat(fields.igst) || 0,
      grandTotal: parseFloat(fields.grandTotal) || 0,
      narration: fields.narration || '',
    };
  }

  /**
   * Validate allowed status transitions (state machine)
   */
  _validateStatusTransition(current, next) {
    if (current === next) return;
    const allowed = {
      draft: ['pending_review', 'archived'],
      pending_review: ['approved', 'rejected', 'draft'],
      approved: ['archived'],
      rejected: ['draft'],
      archived: [],
    };

    if (!allowed[current]?.includes(next)) {
      throw ApiError.badRequest(
        `Cannot transition from '${current}' to '${next}'. Allowed: ${allowed[current]?.join(', ') || 'none'}`
      );
    }
  }

  /**
   * Generate Tally-compatible XML for selected transactions.
   */
  async generateTallyXml(ids) {
    const transactions = await salesRepository.findManyByIds(ids);

    let xml = `<?xml version="1.0"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>`;

    transactions.forEach(tx => {
      const dateStr = tx.invoiceDate ? new Date(tx.invoiceDate).toISOString().slice(0, 10).replace(/-/g, '') : '';
      xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${dateStr}</DATE>
            <VOUCHERNUMBER>${tx.voucherNumber || tx.invoiceNumber}</VOUCHERNUMBER>
            <REFERENCE>${tx.invoiceNumber}</REFERENCE>
            <PARTYLEDGERNAME>${tx.partyLedger}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${tx.partyLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${tx.grandTotal}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${tx.salesLedger || 'Sales Account'}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${tx.baseTotal}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

      if (tx.cgstTotal > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${tx.cgstTotal}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }
      if (tx.sgstTotal > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${tx.sgstTotal}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }
      if (tx.igstTotal > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${tx.igstTotal}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }

      xml += `
            <NARRATION>${tx.narration || ''}</NARRATION>
          </VOUCHER>
        </TALLYMESSAGE>`;
    });

    xml += `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return xml;
  }
}

export default new SalesService();
