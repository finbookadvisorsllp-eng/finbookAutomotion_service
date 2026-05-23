import { csvBulkValidator } from '../validations/sales.validation.js';
import { roundTo } from '../utils/helpers.js';
import crypto from 'crypto';

/**
 * CSV Service — Parses CSV/XLSX buffer and maps each row to a SalesTransaction.
 *
 * Expected CSV columns (case-insensitive header matching):
 *   invoiceNumber, invoiceDate, partyLedger, partyGstin,
 *   salesLedger, description, hsnSacCode, baseAmount, gstRate,
 *   tdsRate, tcsRate, narration
 */
class CsvService {
  /**
   * Parse a CSV buffer into structured row objects.
   * @param {Buffer} buffer
   * @returns {{ rows: object[], batchId: string }}
   */
  parseBuffer(buffer) {
    const text = buffer.toString('utf-8').trim();
    const lines = text.split(/\r?\n/);

    if (lines.length < 2) {
      throw new Error('CSV must contain at least one header row and one data row');
    }

    // Normalize headers: lowercase, strip spaces and BOM
    const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',');
    const headers = rawHeaders.map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // skip blank lines

      const values = this._splitCsvLine(line);
      const row = {};
      headers.forEach((header, idx) => {
        row[this._normalizeKey(header)] = (values[idx] || '').trim();
      });

      // Coerce numeric fields
      row.baseAmount = parseFloat(row.baseamount) || 0;
      row.gstRate    = parseFloat(row.gstrate)    || 0;
      row.tdsRate    = parseFloat(row.tdsrate)    || 0;
      row.tcsRate    = parseFloat(row.tcsrate)    || 0;

      rows.push(row);
    }

    return { rows, batchId: crypto.randomUUID() };
  }

  /**
   * Validate rows and build SalesTransaction-ready documents.
   */
  buildTransactionDocs(rows, batchId, voucherType, companyId, createdBy) {
    const { valid, errors } = csvBulkValidator(rows);

    const docs = valid.map((row) => {
      const gstRate     = parseFloat(row.gstRate) || 0;
      const baseAmount  = parseFloat(row.baseAmount) || 0;
      const halfRate    = gstRate / 2;
      const cgst        = roundTo((baseAmount * halfRate) / 100);
      const sgst        = roundTo((baseAmount * halfRate) / 100);
      const igst        = 0;
      const tdsAmount   = roundTo((baseAmount * (parseFloat(row.tdsRate) || 0)) / 100);
      const tcsAmount   = roundTo((baseAmount * (parseFloat(row.tcsRate) || 0)) / 100);
      const subTotal    = roundTo(baseAmount + cgst + sgst);
      const grandTotal  = roundTo(subTotal + tcsAmount - tdsAmount);

      return {
        voucherType,
        entryMode:    'csv',
        entryTab:     'without_item',
        invoiceNumber: row.invoiceNumber,
        invoiceDate:   new Date(row.invoiceDate),
        partyLedger:   row.partyLedger,
        partyGstin:    (row.partyGstin || '').toUpperCase(),
        salesLedger:   row.salesLedger || 'General Sales',
        salesLines: [
          {
            srNo:        1,
            salesLedger: row.salesLedger || 'General Sales',
            description: row.description || '',
            hsnSacCode:  row.hsnSacCode || '',
            amount:      baseAmount,
            gstRate,
            cgst,
            sgst,
            igst,
          },
        ],
        baseTotal:  baseAmount,
        subTotal,
        cgstTotal:  cgst,
        sgstTotal:  sgst,
        igstTotal:  igst,
        tdsTotal:   tdsAmount,
        tcsTotal:   tcsAmount,
        grandTotal,
        narration:  row.narration || '',
        status:     'draft',
        csvBatchId: batchId,
        companyId,
        createdBy,
        tdsDetails: tdsAmount > 0 ? [{ ledgerName: 'TDS', assessableValue: baseAmount, rate: row.tdsRate, amount: tdsAmount }] : [],
        tcsDetails: tcsAmount > 0 ? [{ ledgerName: 'TCS', assessableValue: baseAmount, rate: row.tcsRate, amount: tcsAmount }] : [],
      };
    });

    return { docs, errors };
  }

  /**
   * Generate a sample CSV template for download.
   */
  generateSampleCsv(voucherType = 'sales_invoice') {
    const headers = [
      'invoiceNumber', 'invoiceDate', 'partyLedger', 'partyGstin',
      'salesLedger', 'description', 'hsnSacCode',
      'baseAmount', 'gstRate', 'tdsRate', 'tcsRate', 'narration',
    ];

    const sampleRows = [
      [
        'INV-2026-0001', '2026-05-01', 'Apex Holdings Ltd', '27AABCU9603R1ZN',
        'General Sales', 'Professional Services', '998312',
        '50000', '18', '0', '0', 'Q1 Sales Entry',
      ],
      [
        'INV-2026-0002', '2026-05-03', 'Greenline Ventures', '29AABCG9823R1ZN',
        'Product Sales', 'Software Licenses', '997331',
        '25000', '18', '2', '0', 'Annual license fee',
      ],
    ];

    const csvLines = [
      headers.join(','),
      ...sampleRows.map((r) => r.join(',')),
    ];

    return csvLines.join('\n');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _normalizeKey(key) {
    // Map alternative column names to standard keys
    const map = {
      'invoiceno':    'invoiceNumber',
      'invoice_no':   'invoiceNumber',
      'invoicenum':   'invoiceNumber',
      'partyname':    'partyLedger',
      'party_name':   'partyLedger',
      'party':        'partyLedger',
      'gstin':        'partyGstin',
      'gst_no':       'partyGstin',
      'baseamount':   'baseAmount',
      'base_amount':  'baseAmount',
      'amount':       'baseAmount',
      'gstrate':      'gstRate',
      'gst_rate':     'gstRate',
      'gst%':         'gstRate',
      'tdsrate':      'tdsRate',
      'tds_rate':     'tdsRate',
      'tcsrate':      'tcsRate',
      'tcs_rate':     'tcsRate',
      'hsnsac':       'hsnSacCode',
      'hsn':          'hsnSacCode',
      'sac':          'hsnSacCode',
    };
    return map[key] || key;
  }

  _splitCsvLine(line) {
    const result = [];
    let inQuotes = false;
    let current  = '';

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}

export default new CsvService();
