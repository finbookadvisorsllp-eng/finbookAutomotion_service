import mongoose from 'mongoose';
import { Counter } from './SalesTransaction.model.js';

/**
 * Embedded sub-schema for Bill Allocation
 */
const BillAllocationSchema = new mongoose.Schema({
  billType:   { type: String, trim: true },
  billRef:    { type: String, trim: true },
  billAmount: { type: Number, default: 0 },
  dueDate:    { type: Date },
}, { _id: false });

/**
 * Embedded sub-schema for Cost Center Allocation
 */
const CostCenterAllocationSchema = new mongoose.Schema({
  costCategory:     { type: String, trim: true },
  costCenter:       { type: String, trim: true },
  allocationAmount: { type: Number, default: 0 },
}, { _id: false });

/**
 * Attached document reference
 */
const FundFlowAttachedDocumentSchema = new mongoose.Schema({
  originalName:  { type: String },
  cloudinaryUrl: { type: String },
  cloudinaryId:  { type: String },
  mimeType:      { type: String },
  sizeBytes:     { type: Number },
  uploadedAt:    { type: Date, default: Date.now },
}, { _id: false });

/**
 * Activity log entry
 */
const FundFlowActivityLogSchema = new mongoose.Schema({
  action:      { type: String, required: true },
  note:        { type: String, trim: true },
  performedBy: { type: String, trim: true },
  at:          { type: Date, default: Date.now },
}, { _id: false });

// ─── Main Fund Flow Transaction Schema ───────────────────────────────────────
const FundFlowTransactionSchema = new mongoose.Schema(
  {
    voucherType: {
      type: String,
      required: true,
      enum: ['cash_payment', 'bank_payment', 'contra'],
      index: true,
    },

    // Voucher details
    voucherNumber:       { type: String, unique: true, sparse: true },
    voucherNumberSeries: { type: String, default: 'Default' },
    voucherDate:         { type: Date },
    referenceNumber:     { type: String, trim: true },
    company:             { type: String, trim: true },

    // Party & Ledger selection
    partyLedger:         { type: String, trim: true },
    againstLedger:       { type: String, trim: true },
    amount:              { type: Number, default: 0 },
    drCrType:            { type: String, trim: true },
    ledgerGroup:         { type: String, trim: true },
    currency:            { type: String, default: 'INR' },

    // Cash Ledger details (for cash_payment)
    cashLedger:          { type: String, trim: true },
    cashAmount:          { type: Number, default: 0 },
    openingBalance:      { type: Number, default: 0 },

    // Bank Instrument details (for bank_payment)
    bankLedger:          { type: String, trim: true },
    transType:           { type: String, trim: true },
    instNumber:          { type: String, trim: true },
    instDate:            { type: Date },
    utr:                 { type: String, trim: true },
    ifscCode:            { type: String, trim: true },
    branchName:          { type: String, trim: true },
    bankBalance:         { type: Number, default: 0 },

    // Contra Transfer details (for contra)
    sourceLedger:        { type: String, trim: true },
    transferAmount:      { type: Number, default: 0 },
    destinationLedger:   { type: String, trim: true },
    amountReceived:      { type: Number, default: 0 },

    // Bill allocations
    billRows:            { type: [BillAllocationSchema], default: [] },

    // Cost Center Allocation
    costCenters:         { type: [CostCenterAllocationSchema], default: [] },

    // Taxation details
    gstApplicable:       { type: Boolean, default: false },
    gstLedger:           { type: String, trim: true },
    gstRate:             { type: Number, default: 0 },
    tdsApplicable:       { type: Boolean, default: false },
    tdsLedger:           { type: String, trim: true },
    tdsRate:             { type: Number, default: 0 },

    // Narration
    narration:           { type: String, trim: true, default: '' },

    // Computed totals
    totalDebit:          { type: Number, default: 0 },
    totalCredit:         { type: Number, default: 0 },
    difference:          { type: Number, default: 0 },

    // Entry mode
    entryMode: {
      type: String,
      enum: ['manual', 'ocr', 'csv'],
      default: 'manual',
    },

    // Workflow status
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'rejected', 'archived'],
      default: 'draft',
      index: true,
    },

    // Attachments
    attachedDocuments:   { type: [FundFlowAttachedDocumentSchema], default: [] },

    // Audit trail
    activityLog:         { type: [FundFlowActivityLogSchema], default: [] },

    // Tenant scope
    companyId:           { type: String, trim: true, index: true },

    // Who created/modified
    createdBy:           { type: String, trim: true },
    updatedBy:           { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: 'fund_flow_transactions',
  }
);

// Indexes for performance
FundFlowTransactionSchema.index({ voucherType: 1, status: 1, companyId: 1 });
FundFlowTransactionSchema.index({ partyLedger: 'text', voucherNumber: 'text', referenceNumber: 'text' });
FundFlowTransactionSchema.index({ voucherDate: -1 });
FundFlowTransactionSchema.index({ createdAt: -1 });

FundFlowTransactionSchema.virtual('displayName').get(function () {
  return this.referenceNumber || this.voucherNumber || `DRAFT-${this._id}`;
});

// Pre-save auto-increment voucher numbers
FundFlowTransactionSchema.pre('save', async function () {
  if (this.isNew && !this.voucherNumber) {
    const prefixMap = {
      cash_payment: 'CP',
      bank_payment: 'BP',
      contra:       'CT',
    };
    const prefix = prefixMap[this.voucherType] || 'FFV';
    const counter = await Counter.findByIdAndUpdate(
      prefix,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear();
    this.voucherNumber = `${prefix}-${year}-${String(counter.seq).padStart(4, '0')}`;
  }
});

const FundFlowTransaction = mongoose.model('FundFlowTransaction', FundFlowTransactionSchema);
export default FundFlowTransaction;
