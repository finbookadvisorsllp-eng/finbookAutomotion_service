import FundFlowTransaction from '../models/FundFlowTransaction.model.js';

class FundFlowRepository {
  /**
   * Create a new fund flow transaction
   */
  async create(data) {
    const doc = new FundFlowTransaction(data);
    return doc.save();
  }

  /**
   * Find by ID
   */
  async findById(id) {
    return FundFlowTransaction.findById(id).lean();
  }

  /**
   * Update by ID
   */
  async updateById(id, data) {
    return FundFlowTransaction.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  }

  /**
   * Soft-delete: mark as archived
   */
  async archiveById(id, updatedBy) {
    return FundFlowTransaction.findByIdAndUpdate(
      id,
      { status: 'archived', updatedBy },
      { new: true }
    ).lean();
  }

  /**
   * Hard delete (draft only)
   */
  async deleteById(id) {
    return FundFlowTransaction.findByIdAndDelete(id);
  }

  /**
   * Paginated list with filters
   */
  async findMany({ filters, page, limit, sort }) {
    const query = this._buildFilterQuery(filters);
    const sortObj = sort || { createdAt: -1 };

    const [docs, total] = await Promise.all([
      FundFlowTransaction.find(query)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FundFlowTransaction.countDocuments(query),
    ]);

    return { docs, total };
  }

  /**
   * Aggregate summary stats for dashboard cards
   */
  async getSummaryStats(companyId, voucherType) {
    const match = {};
    if (voucherType) match.voucherType = voucherType;
    if (companyId) match.companyId = companyId;

    const result = await FundFlowTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count:      { $sum: 1 },
          totalValue: { $sum: '$amount' },
        },
      },
    ]);

    const stats = {
      draft:          { count: 0, totalValue: 0 },
      pending_review: { count: 0, totalValue: 0 },
      approved:       { count: 0, totalValue: 0 },
      archived:       { count: 0, totalValue: 0 },
    };

    result.forEach(({ _id, count, totalValue }) => {
      if (stats[_id] !== undefined) {
        stats[_id] = { count, totalValue };
      }
    });

    return stats;
  }

  /**
   * Bulk insert for CSV imports
   */
  async bulkCreate(docs) {
    return FundFlowTransaction.insertMany(docs, { ordered: false });
  }

  /**
   * Push an activity log entry
   */
  async addActivityLog(id, logEntry) {
    return FundFlowTransaction.findByIdAndUpdate(
      id,
      { $push: { activityLog: logEntry } },
      { new: true }
    ).lean();
  }

  /**
   * Push an attached document reference
   */
  async addAttachedDocument(id, docRef) {
    return FundFlowTransaction.findByIdAndUpdate(
      id,
      { $push: { attachedDocuments: docRef } },
      { new: true }
    ).lean();
  }

  /**
   * Find multiple by IDs
   */
  async findManyByIds(ids) {
    return FundFlowTransaction.find({ _id: { $in: ids } }).lean();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _buildFilterQuery(filters = {}) {
    const query = {};

    if (filters.voucherType)  query.voucherType = filters.voucherType;
    if (filters.status) {
      if (typeof filters.status === 'string' && filters.status.includes(',')) {
        query.status = { $in: filters.status.split(',') };
      } else {
        query.status = filters.status;
      }
    }
    if (filters.companyId)    query.companyId = filters.companyId;
    if (filters.partyLedger)  query.partyLedger = new RegExp(filters.partyLedger, 'i');

    if (filters.search) {
      query.$or = [
        { referenceNumber: new RegExp(filters.search, 'i') },
        { voucherNumber:   new RegExp(filters.search, 'i') },
        { partyLedger:     new RegExp(filters.search, 'i') },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      query.voucherDate = {};
      if (filters.dateFrom) query.voucherDate.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.voucherDate.$lte = new Date(filters.dateTo);
    }

    return query;
  }
}

export default new FundFlowRepository();
