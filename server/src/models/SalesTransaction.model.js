import mongoose from 'mongoose';

/**
 * Embedded sub-schema for a single line item (with-item mode)
 */
const ProductLineSchema = new mongoose.Schema({
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
 * Embedded sub-schema for service/sales ledger lines (without-item mode)
 */
const SalesLedgerLineSchema = new mongoose.Schema({
  srNo:        { type: Number, required: true },
  salesLedger: { type: String, trim: true },
  description: { type: String, trim: true, default: '' },
  hsnSacCode:  { type: String, trim: true, default: '' },
  amount:      { type: Number, default: 0, min: 0 },
  gstRate:     { type: Number, default: 0 },
  cgst:        { type: Number, default: 0 },
  sgst:        { type: Number, default: 0 },
  igst:        { type: Number, default: 0 },
}, { _id: false });

/**
 * Additional charges (freight, packing, etc.)
 */
const AdditionalChargeSchema = new mongoose.Schema({
  taxableValue: { type: Number, default: 0 },
  ledgerName:   { type: String, trim: true },
  amount:       { type: Number, default: 0 },
  included:     { type: Boolean, default: false },
}, { _id: false });

/**
 * GST breakup line (auto-computed, stored for audit trail)
 */
const GSTDetailSchema = new mongoose.Schema({
  gstType:    { type: String, enum: ['CGST', 'SGST', 'IGST', 'CESS'] },
  ledgerName: { type: String, trim: true },
  rate:       { type: Number, default: 0 },
  amount:     { type: Number, default: 0 },
}, { _id: false });

/**
 * TDS line
 */
const TDSDetailSchema = new mongoose.Schema({
  ledgerName:      { type: String, trim: true },
  assessableValue: { type: Number, default: 0 },
  rate:            { type: Number, default: 0 },
  amount:          { type: Number, default: 0 },
}, { _id: false });

/**
 * TCS line
 */
const TCSDetailSchema = new mongoose.Schema({
  ledgerName:      { type: String, trim: true },
  assessableValue: { type: Number, default: 0 },
  rate:            { type: Number, default: 0 },
  amount:          { type: Number, default: 0 },
}, { _id: false });

/**
 * Attached document reference (PDF/Image uploaded via OCR or manual attach)
 */
const AttachedDocumentSchema = new mongoose.Schema({
  originalName:  { type: String },
  cloudinaryUrl: { type: String },
  cloudinaryId:  { type: String },
  mimeType:      { type: String },
  sizeBytes:     { type: Number },
  uploadedAt:    { type: Date, default: Date.now },
}, { _id: false });

/**
 * OCR extraction metadata (stored for audit and confidence tracking)
 */
const OcrMetadataSchema = new mongoose.Schema({
  engine:          { type: String, default: 'google-vision' },
  confidence:      { type: Number, min: 0, max: 100 },
  rawText:         { type: String },
  extractedFields: { type: mongoose.Schema.Types.Mixed },
  processedAt:     { type: Date, default: Date.now },
  documentUrl:     { type: String },
  documentId:      { type: String },
}, { _id: false });

/**
 * Activity log entry (comments, status changes)
 */
const ActivityLogSchema = new mongoose.Schema({
  action:    { type: String, required: true },
  note:      { type: String, trim: true },
  performedBy: { type: String, trim: true },
  at:        { type: Date, default: Date.now },
}, { _id: false });

// ─── Counter schema for auto-increment voucher numbers ───────────────────────
const CounterSchema = new mongoose.Schema({
  _id:     { type: String, required: true }, // e.g. "SO", "SI", "CN"
  seq:     { type: Number, default: 0 },
});
export const Counter = mongoose.model('Counter', CounterSchema);

// ─── Main Sales Transaction Schema ───────────────────────────────────────────
const SalesTransactionSchema = new mongoose.Schema(
  {
    // Discriminator key: determines the document sub-type
    voucherType: {
      type: String,
      required: true,
      enum: ['sales_order', 'sales_invoice', 'credit_note'],
      index: true,
    },

    // Voucher metadata
    voucherNumber:       { type: String, unique: true, sparse: true },
    voucherNumberSeries: { type: String, default: 'Default' },
    voucherDate:         { type: Date },
    invoiceNumber:       { type: String, trim: true },
    invoiceDate:         { type: Date },

    // Ledger info
    salesLedger:         { type: String, trim: true },
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
    productLines:   { type: [ProductLineSchema], default: [] },
    salesLines:     { type: [SalesLedgerLineSchema], default: [] },

    // Additional charges
    additionalCharges: { type: [AdditionalChargeSchema], default: [] },

    // Tax details
    gstDetails:    { type: [GSTDetailSchema], default: [] },
    tdsDetails:    { type: [TDSDetailSchema], default: [] },
    tcsDetails:    { type: [TCSDetailSchema], default: [] },

    // Computed totals (stored for fast reads / reporting)
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
    linkedSalesOrder:   { type: String, trim: true },
    linkedQuotation:    { type: String, trim: true },
    linkedInvoice:      { type: String, trim: true }, // for credit notes

    // Attachments
    attachedDocuments:  { type: [AttachedDocumentSchema], default: [] },

    // OCR metadata (populated only when entryMode = 'ocr')
    ocrMetadata:        { type: OcrMetadataSchema },

    // CSV import batch ID
    csvBatchId:         { type: String, sparse: true },

    // Audit trail
    activityLog:        { type: [ActivityLogSchema], default: [] },

    // Tenant / company scope
    companyId:          { type: String, trim: true, index: true },

    // Who created/modified
    createdBy:          { type: String, trim: true },
    updatedBy:          { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: 'sales_transactions',
  }
);

// ─── Indexes for performance ──────────────────────────────────────────────────
SalesTransactionSchema.index({ voucherType: 1, status: 1, companyId: 1 });
SalesTransactionSchema.index({ partyLedger: 'text', invoiceNumber: 'text', voucherNumber: 'text' });
SalesTransactionSchema.index({ invoiceDate: -1 });
SalesTransactionSchema.index({ createdAt: -1 });

// ─── Virtual: filename for display ───────────────────────────────────────────
SalesTransactionSchema.virtual('displayName').get(function () {
  return this.invoiceNumber || this.voucherNumber || `DRAFT-${this._id}`;
});

// ─── Pre-save: auto-increment voucher number ──────────────────────────────────
SalesTransactionSchema.pre('save', async function () {
  if (this.isNew && !this.voucherNumber) {
    const prefixMap = {
      sales_order:   'SO',
      sales_invoice: 'SI',
      credit_note:   'CN',
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

const SalesTransaction = mongoose.model('SalesTransaction', SalesTransactionSchema);
export default SalesTransaction;
