import SalesTransaction from '../models/SalesTransaction.model.js';
import { buildPagination, buildSort } from '../utils/helpers.js';

const ALLOWED_SORT_FIELDS = [
  'invoiceDate', 'voucherDate', 'grandTotal', 'createdAt', 'partyLedger',
];

/**
 * SalesRepository — all DB interactions for Sales module.
 * Controllers should NEVER call Mongoose directly.
 */
class SalesRepository {
  /**
   * Create a new sales transaction
   */
  async create(data) {
    const doc = new SalesTransaction(data);
    return doc.save();
  }

  /**
   * Find by ID
   */
  async findById(id) {
    return SalesTransaction.findById(id).lean();
  }

  /**
   * Update by ID (returns updated doc)
   */
  async updateById(id, data) {
    return SalesTransaction.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  }

  /**
   * Soft-delete: mark as archived
   */
  async archiveById(id, updatedBy) {
    return SalesTransaction.findByIdAndUpdate(
      id,
      { status: 'archived', updatedBy },
      { new: true }
    ).lean();
  }

  /**
   * Hard delete (admin only)
   */
  async deleteById(id) {
    return SalesTransaction.findByIdAndDelete(id);
  }

  /**
   * Paginated list with filters
   */
  async findMany({ filters, page, limit, sort }) {
    const query = this._buildFilterQuery(filters);
    const sortObj = sort || { createdAt: -1 };

    const [docs, total] = await Promise.all([
      SalesTransaction.find(query)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SalesTransaction.countDocuments(query),
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

    const result = await SalesTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count:      { $sum: 1 },
          totalValue: { $sum: '$grandTotal' },
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
    return SalesTransaction.insertMany(docs, { ordered: false });
  }

  /**
   * Push an activity log entry
   */
  async addActivityLog(id, logEntry) {
    return SalesTransaction.findByIdAndUpdate(
      id,
      { $push: { activityLog: logEntry } },
      { new: true }
    ).lean();
  }

  /**
   * Push an attached document reference
   */
  async addAttachedDocument(id, docRef) {
    return SalesTransaction.findByIdAndUpdate(
      id,
      { $push: { attachedDocuments: docRef } },
      { new: true }
    ).lean();
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
    if (filters.csvBatchId)   query.csvBatchId = filters.csvBatchId;

    if (filters.search) {
      query.$or = [
        { invoiceNumber: new RegExp(filters.search, 'i') },
        { voucherNumber: new RegExp(filters.search, 'i') },
        { partyLedger:   new RegExp(filters.search, 'i') },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      query.invoiceDate = {};
      if (filters.dateFrom) query.invoiceDate.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.invoiceDate.$lte = new Date(filters.dateTo);
    }

    return query;
  }

  /**
   * Find multiple by IDs
   */
  async findManyByIds(ids) {
    return SalesTransaction.find({ _id: { $in: ids } }).lean();
  }
}

export default new SalesRepository();
