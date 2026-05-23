import fundflowRepository from '../repositories/fundflow.repository.js';
import ApiError from '../utils/ApiError.js';

class FundFlowService {
  /**
   * Create a new fund flow transaction
   */
  async createTransaction(payload) {
    const computed = this._computeTotals(payload);
    
    // Auto-create initial activity log
    computed.activityLog = [
      {
        action: 'create',
        note: `Fund flow entry created with status: ${computed.status}`,
        performedBy: computed.createdBy || 'System',
        at: new Date(),
      }
    ];

    return fundflowRepository.create(computed);
  }

  /**
   * Retrieve single transaction by ID
   */
  async getTransaction(id) {
    const transaction = await fundflowRepository.findById(id);
    if (!transaction) {
      throw new ApiError(404, 'Fund flow transaction not found');
    }
    return transaction;
  }

  /**
   * Update transaction by ID
   */
  async updateTransaction(id, payload, updatedBy) {
    const existing = await fundflowRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Fund flow transaction not found');
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

    const updated = await fundflowRepository.updateById(id, computed);
    await fundflowRepository.addActivityLog(id, updateLog);
    return updated;
  }

  /**
   * Update workflow status (status transition)
   */
  async updateStatus(id, nextStatus, note, performedBy) {
    const existing = await fundflowRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Fund flow transaction not found');
    }

    this._validateStatusTransition(existing.status, nextStatus);

    const updateLog = {
      action: nextStatus,
      note: note || `Status transitioned to ${nextStatus}`,
      performedBy: performedBy || 'System',
      at: new Date(),
    };

    const updated = await fundflowRepository.updateById(id, { status: nextStatus, updatedBy: performedBy });
    await fundflowRepository.addActivityLog(id, updateLog);
    return updated;
  }

  /**
   * Delete transaction (draft only)
   */
  async deleteTransaction(id) {
    const existing = await fundflowRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Fund flow transaction not found');
    }
    return fundflowRepository.deleteById(id);
  }

  /**
   * List fund flow transactions with pagination + filters
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

    return fundflowRepository.findMany({ filters, page, limit, sort });
  }

  /**
   * Get dashboard summary statistics
   */
  async getSummaryStats(companyId, voucherType) {
    return fundflowRepository.getSummaryStats(companyId, voucherType);
  }

  /**
   * Add comments to activity log
   */
  async addComment(id, note, performedBy) {
    const existing = await fundflowRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Fund flow transaction not found');
    }
    return fundflowRepository.addActivityLog(id, {
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

    if (p.voucherType === 'cash_payment' || p.voucherType === 'bank_payment') {
      const amt = parseFloat(p.amount) || 0;
      p.totalDebit = amt;
      p.totalCredit = amt;
      p.difference = 0;
    } else if (p.voucherType === 'contra') {
      const sourceAmt = parseFloat(p.transferAmount) || 0;
      const destAmt = parseFloat(p.amountReceived) || 0;
      p.totalDebit = sourceAmt;
      p.totalCredit = destAmt;
      p.difference = Math.abs(sourceAmt - destAmt);
    }

    return p;
  }
}

export default new FundFlowService();
