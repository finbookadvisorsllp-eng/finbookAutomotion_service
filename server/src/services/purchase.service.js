import purchaseRepository from '../repositories/purchase.repository.js';
import ApiError from '../utils/ApiError.js'; // Adjust the import path if needed

// Simple local roundTo helper just in case
const localRoundTo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

class PurchaseService {
  /**
   * Create a new purchase transaction
   */
  async createTransaction(payload) {
    const computed = this._computeTotals(payload);
    
    // Auto-create initial activity log
    computed.activityLog = [
      {
        action: 'create',
        note: `Purchase entry created with status: ${computed.status}`,
        performedBy: computed.createdBy || 'System',
        at: new Date(),
      }
    ];

    return purchaseRepository.create(computed);
  }

  /**
   * Retrieve single purchase transaction by ID
   */
  async getTransaction(id) {
    const transaction = await purchaseRepository.findById(id);
    if (!transaction) {
      throw new ApiError(404, 'Purchase transaction not found');
    }
    return transaction;
  }

  /**
   * Update transaction by ID
   */
  async updateTransaction(id, payload, updatedBy) {
    const existing = await purchaseRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Purchase transaction not found');
    }

    if (payload.status) {
      this._validateStatusTransition(existing.status, payload.status);
    }

    const computed = this._computeTotals(payload);
    computed.updatedBy = updatedBy;

    // Log the update
    const updateLog = {
      action: 'update',
      note: 'Transaction updated manually',
      performedBy: updatedBy || 'System',
      at: new Date(),
    };

    const updated = await purchaseRepository.updateById(id, computed);
    await purchaseRepository.addActivityLog(id, updateLog);
    return updated;
  }

  /**
   * Update only the status of the transaction (workflow transition)
   */
  async updateStatus(id, nextStatus, note, performedBy) {
    const existing = await purchaseRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Purchase transaction not found');
    }

    this._validateStatusTransition(existing.status, nextStatus);

    const updateLog = {
      action: nextStatus,
      note: note || `Status transitioned to ${nextStatus}`,
      performedBy: performedBy || 'System',
      at: new Date(),
    };

    const updated = await purchaseRepository.updateById(id, { status: nextStatus, updatedBy: performedBy });
    await purchaseRepository.addActivityLog(id, updateLog);
    return updated;
  }

  /**
   * Delete transaction (or soft-delete if appropriate, let's implement hard-delete since repository supports deleteById)
   */
  async deleteTransaction(id) {
    const existing = await purchaseRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Purchase transaction not found');
    }
    return purchaseRepository.deleteById(id);
  }

  /**
   * List purchase transactions with pagination + filters
   */
  async listTransactions(queryParams) {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 50;

    const filters = {
      voucherType: queryParams.voucherType || undefined,
      status:      queryParams.status || undefined,
      companyId:   queryParams.companyId || undefined,
      partyLedger: queryParams.partyLedger || undefined,
      search:      queryParams.search || undefined,
      dateFrom:    queryParams.dateFrom || undefined,
      dateTo:      queryParams.dateTo || undefined,
    };

    let sort = { createdAt: -1 };
    if (queryParams.sortBy) {
      const order = queryParams.sortOrder === 'asc' ? 1 : -1;
      sort = { [queryParams.sortBy]: order };
    }

    return purchaseRepository.findMany({ filters, page, limit, sort });
  }

  /**
   * Get dashboard summary statistics
   */
  async getSummaryStats(companyId, voucherType) {
    return purchaseRepository.getSummaryStats(companyId, voucherType);
  }

  /**
   * Add comments to activity log
   */
  async addComment(id, note, performedBy) {
    const existing = await purchaseRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Purchase transaction not found');
    }
    return purchaseRepository.addActivityLog(id, {
      action: 'comment',
      note,
      performedBy,
      at: new Date(),
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Validate allowed status transitions
   */
  _validateStatusTransition(current, next) {
    if (current === next) return;
    const allowed = {
      draft:          ['pending_review', 'archived'],
      pending_review: ['approved', 'rejected', 'draft'],
      approved:       ['archived'],
      rejected:       ['draft'],
      archived:       [],
    };

    if (!allowed[current]?.includes(next)) {
      throw new ApiError(400, `Cannot transition from '${current}' to '${next}'. Allowed: ${allowed[current]?.join(', ') || 'none'}`);
    }
  }

  /**
   * Compute totals matching the calculations exactly
   */
  _computeTotals(payload) {
    const p = { ...payload };

    let baseTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    // Determine Interstate status
    const partyState = p.partyGstin?.trim().substring(0, 2);
    const companyState = p.gstRegistration ? (p.gstRegistration.includes('Maharashtra') ? '27' : '23') : '';
    const isInterstate = !!(partyState && companyState && partyState !== companyState);

    // Tab 1: With Item Inventory
    if (p.entryTab === 'with_item' && Array.isArray(p.productLines)) {
      p.productLines = p.productLines.map((line) => {
        const qty = parseFloat(line.billQuantity) || 0;
        const rate = parseFloat(line.billRate) || 0;
        const disc = parseFloat(line.discountPercent) || 0;
        const amount = localRoundTo(qty * rate * (1 - disc / 100));
        const gstRate = parseFloat(line.gstRate) || 0;
        
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (line.taxabilityType === 'Taxable' && !line.rcm) {
          if (isInterstate) {
            igst = localRoundTo((amount * gstRate) / 100);
          } else {
            cgst = localRoundTo((amount * (gstRate / 2)) / 100);
            sgst = localRoundTo((amount * (gstRate / 2)) / 100);
          }
        }

        baseTotal += amount;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

        return { ...line, amount, cgst, sgst, igst };
      });
    }

    // Tab 2: Without Item (Purchase/Expense Ledger)
    if (p.entryTab === 'without_item' && Array.isArray(p.purchaseLines)) {
      p.purchaseLines = p.purchaseLines.map((line) => {
        const amount = parseFloat(line.amount) || 0;
        const gstRate = parseFloat(line.gstRate) || 0;
        
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (isInterstate) {
          igst = localRoundTo((amount * gstRate) / 100);
        } else {
          cgst = localRoundTo((amount * (gstRate / 2)) / 100);
          sgst = localRoundTo((amount * (gstRate / 2)) / 100);
        }

        baseTotal += amount;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

        return { ...line, amount, cgst, sgst, igst };
      });
    }

    // Additional Charges
    let additionalTotal = 0;
    if (Array.isArray(p.additionalCharges)) {
      p.additionalCharges.forEach((c) => {
        additionalTotal += parseFloat(c.amount) || 0;
      });
    }

    const subTotal = localRoundTo(baseTotal + cgstTotal + sgstTotal + igstTotal + additionalTotal);

    // TDS Total (from tdsDetails)
    let tdsTotal = 0;
    if (Array.isArray(p.tdsDetails)) {
      p.tdsDetails = p.tdsDetails.map((t) => {
        const assessable = parseFloat(t.assessableValue) || subTotal;
        const rate = parseFloat(t.rate) || 0;
        const amount = localRoundTo((assessable * rate) / 100);
        tdsTotal += amount;
        return { ...t, assessableValue: assessable, amount };
      });
    }

    // TCS Total (from tcsDetails)
    let tcsTotal = 0;
    if (Array.isArray(p.tcsDetails)) {
      p.tcsDetails = p.tcsDetails.map((t) => {
        const assessable = parseFloat(t.assessableValue) || subTotal;
        const rate = parseFloat(t.rate) || 0;
        const amount = localRoundTo((assessable * rate) / 100);
        tcsTotal += amount;
        return { ...t, assessableValue: assessable, amount };
      });
    }

    const beforeRound = localRoundTo(subTotal + tcsTotal - tdsTotal);
    const grandTotal = Math.round(beforeRound);
    const roundOff = localRoundTo(grandTotal - beforeRound);

    // GST Details Breakup array
    p.gstDetails = [];
    if (cgstTotal > 0) p.gstDetails.push({ gstType: 'CGST', ledgerName: 'Input CGST', rate: 0, amount: cgstTotal });
    if (sgstTotal > 0) p.gstDetails.push({ gstType: 'SGST', ledgerName: 'Input SGST', rate: 0, amount: sgstTotal });
    if (igstTotal > 0) p.gstDetails.push({ gstType: 'IGST', ledgerName: 'Input IGST', rate: 0, amount: igstTotal });

    return {
      ...p,
      baseTotal: localRoundTo(baseTotal),
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
}

export default new PurchaseService();
