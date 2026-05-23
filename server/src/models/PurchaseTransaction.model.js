import mongoose from 'mongoose';
import { Counter } from './SalesTransaction.model.js'; // Reuse Counter or let it create its own counters

/**
 * Embedded sub-schema for a single product line item (with-item mode)
 */
const PurchaseProductLineSchema = new mongoose.Schema({
  srNo:            { type: Number, required: true },
  stockItem:       { type: String, trim: true },
  description:     { type: String, trim: true, default: '' },
  hsnSacCode:      { type: String, trim: true, default: '' },
  billQuantity:    { type: Number, default: 0, min: 0 },
  billRate:        { type: Number, default: 0, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  amount:          { type: Number, default: 0 },
  rcm:             { type: Boolean, default: false },
  taxabilityType:  { type: String, enum: ['Taxable', 'Exempt', 'Nil Rated', 'Non-GST'], default: 'Taxable' },
  gstRate:         { type: Number, default: 0 },
  cgst:            { type: Number, default: 0 },
  sgst:            { type: Number, default: 0 },
  igst:            { type: Number, default: 0 },
}, { _id: false });

/**
 * Embedded sub-schema for expense/purchase ledger lines (without-item mode)
 */
const PurchaseLedgerLineSchema = new mongoose.Schema({
  srNo:           { type: Number, required: true },
  purchaseLedger: { type: String, trim: true },
  description:    { type: String, trim: true, default: '' },
  hsnSacCode:     { type: String, trim: true, default: '' },
  amount:         { type: Number, default: 0, min: 0 },
  gstRate:        { type: Number, default: 0 },
  cgst:           { type: Number, default: 0 },
  sgst:           { type: Number, default: 0 },
  igst:           { type: Number, default: 0 },
}, { _id: false });

/**
 * Additional charges (freight, packing, etc.)
 */
const PurchaseAdditionalChargeSchema = new mongoose.Schema({
  taxableValue: { type: Number, default: 0 },
  ledgerName:   { type: String, trim: true },
  amount:       { type: Number, default: 0 },
  included:     { type: Boolean, default: false },
}, { _id: false });

/**
 * GST breakup line
 */
const PurchaseGSTDetailSchema = new mongoose.Schema({
  gstType:    { type: String, enum: ['CGST', 'SGST', 'IGST', 'CESS'] },
  ledgerName: { type: String, trim: true },
  rate:       { type: Number, default: 0 },
  amount:     { type: Number, default: 0 },
}, { _id: false });

/**
 * TDS line
 */
const PurchaseTDSDetailSchema = new mongoose.Schema({
  ledgerName:      { type: String, trim: true },
  assessableValue: { type: Number, default: 0 },
  rate:            { type: Number, default: 0 },
  amount:          { type: Number, default: 0 },
}, { _id: false });

/**
 * TCS line
 */
const PurchaseTCSDetailSchema = new mongoose.Schema({
  ledgerName:      { type: String, trim: true },
  assessableValue: { type: Number, default: 0 },
  rate:            { type: Number, default: 0 },
  amount:          { type: Number, default: 0 },
}, { _id: false });

/**
 * Attached document reference
 */
const PurchaseAttachedDocumentSchema = new mongoose.Schema({
  originalName:  { type: String },
  cloudinaryUrl: { type: String },
  cloudinaryId:  { type: String },
  mimeType:      { type: String },
  sizeBytes:     { type: Number },
  uploadedAt:    { type: Date, default: Date.now },
}, { _id: false });

/**
 * OCR extraction metadata
 */
const PurchaseOcrMetadataSchema = new mongoose.Schema({
  engine:          { type: String, default: 'google-vision' },
  confidence:      { type: Number, min: 0, max: 100 },
  rawText:         { type: String },
  extractedFields: { type: mongoose.Schema.Types.Mixed },
  processedAt:     { type: Date, default: Date.now },
  documentUrl:     { type: String },
  documentId:      { type: String },
}, { _id: false });

/**
 * Activity log entry
 */
const PurchaseActivityLogSchema = new mongoose.Schema({
  action:      { type: String, required: true },
  note:        { type: String, trim: true },
  performedBy: { type: String, trim: true },
  at:          { type: Date, default: Date.now },
}, { _id: false });

// ─── Main Purchase Transaction Schema ───────────────────────────────────────
const PurchaseTransactionSchema = new mongoose.Schema(
  {
    voucherType: {
      type: String,
      required: true,
      enum: ['purchase_order', 'purchase_invoice', 'debit_note'],
      index: true,
    },

    // Voucher metadata
    voucherNumber:       { type: String, unique: true, sparse: true },
    voucherNumberSeries: { type: String, default: 'Default' },
    voucherDate:         { type: Date },
    invoiceNumber:       { type: String, trim: true },
    invoiceDate:         { type: Date },
    poNumber:            { type: String, trim: true },

    // Ledger info
    purchaseLedger:      { type: String, trim: true },
    gstRegistration:     { type: String, trim: true },
    partyGstin:          { type: String, trim: true, uppercase: true },
    partyLedger:         { type: String, trim: true },
    consigneeLedger:     { type: String, trim: true, default: 'Same as Party' },

    // Entry mode
    entryMode: {
      type: String,
      enum: ['manual', 'ocr', 'csv'],
      default: 'manual',
    },

    // Tab mode
    entryTab: {
      type: String,
      enum: ['with_item', 'without_item'],
      default: 'with_item',
    },

    // Line items
    productLines:   { type: [PurchaseProductLineSchema], default: [] },
    purchaseLines:  { type: [PurchaseLedgerLineSchema], default: [] },

    // Additional charges
    additionalCharges: { type: [PurchaseAdditionalChargeSchema], default: [] },

    // Tax details
    gstDetails:    { type: [PurchaseGSTDetailSchema], default: [] },
    tdsDetails:    { type: [PurchaseTDSDetailSchema], default: [] },
    tcsDetails:    { type: [PurchaseTCSDetailSchema], default: [] },

    // Computed totals
    baseTotal:     { type: Number, default: 0 },
    subTotal:      { type: Number, default: 0 },
    cgstTotal:     { type: Number, default: 0 },
    sgstTotal:     { type: Number, default: 0 },
    igstTotal:     { type: Number, default: 0 },
    tcsTotal:      { type: Number, default: 0 },
    tdsTotal:      { type: Number, default: 0 },
    roundOff:      { type: Number, default: 0 },
    grandTotal:    { type: Number, default: 0 },

    narration:     { type: String, trim: true, default: '' },

    // Workflow status
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'rejected', 'archived'],
      default: 'draft',
      index: true,
    },

    // Reference links
    linkedPurchaseOrder: { type: String, trim: true },
    linkedInvoice:       { type: String, trim: true }, // for debit notes

    // Attachments
    attachedDocuments:  { type: [PurchaseAttachedDocumentSchema], default: [] },

    // OCR metadata
    ocrMetadata:        { type: PurchaseOcrMetadataSchema },

    // CSV import batch ID
    csvBatchId:         { type: String, sparse: true },

    // Audit trail
    activityLog:        { type: [PurchaseActivityLogSchema], default: [] },

    // Tenant scope
    companyId:          { type: String, trim: true, index: true },

    // Who created/modified
    createdBy:          { type: String, trim: true },
    updatedBy:          { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: 'purchase_transactions',
  }
);

// Indexes for performance
PurchaseTransactionSchema.index({ voucherType: 1, status: 1, companyId: 1 });
PurchaseTransactionSchema.index({ partyLedger: 'text', invoiceNumber: 'text', voucherNumber: 'text' });
PurchaseTransactionSchema.index({ invoiceDate: -1 });
PurchaseTransactionSchema.index({ createdAt: -1 });

PurchaseTransactionSchema.virtual('displayName').get(function () {
  return this.invoiceNumber || this.voucherNumber || `DRAFT-${this._id}`;
});

// Pre-save auto-increment voucher numbers
PurchaseTransactionSchema.pre('save', async function () {
  if (this.isNew && !this.voucherNumber) {
    const prefixMap = {
      purchase_order:   'PO',
      purchase_invoice: 'PI',
      debit_note:       'DN',
    };
    const prefix = prefixMap[this.voucherType] || 'VOU';
    const counter = await Counter.findByIdAndUpdate(
      prefix,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear();
    this.voucherNumber = `${prefix}-${year}-${String(counter.seq).padStart(4, '0')}`;
  }
});

const PurchaseTransaction = mongoose.model('PurchaseTransaction', PurchaseTransactionSchema);
export default PurchaseTransaction;
