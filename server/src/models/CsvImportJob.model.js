import mongoose from 'mongoose';

/**
 * Tracks CSV bulk import jobs.
 * Each row in the CSV becomes one SalesTransaction with this batchId.
 */
const CsvImportJobSchema = new mongoose.Schema(
  {
    batchId:      { type: String, required: true, unique: true },
    voucherType:  { type: String, enum: ['sales_order', 'sales_invoice', 'credit_note'], required: true },
    filename:     { type: String },
    totalRows:    { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount:  { type: Number, default: 0 },
    errors:       [{ row: Number, message: String }],
    status:       { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    companyId:    { type: String },
    createdBy:    { type: String },
  },
  { timestamps: true }
);

const CsvImportJob = mongoose.model('CsvImportJob', CsvImportJobSchema);
export default CsvImportJob;
