import Joi from 'joi';

// ─── Reusable sub-schemas ────────────────────────────────────────────────────

const productLineSchema = Joi.object({
  srNo:            Joi.number().required(),
  stockItem:       Joi.string().allow('').max(200),
  description:     Joi.string().allow('').max(500).default(''),
  hsnSacCode:      Joi.string().allow('').max(20).default(''),
  billQuantity:    Joi.number().min(0).default(0),
  billRate:        Joi.number().min(0).default(0),
  discountPercent: Joi.number().min(0).max(100).default(0),
  amount:          Joi.number().default(0),
  rcm:             Joi.boolean().default(false),
  taxabilityType:  Joi.string().valid('Taxable', 'Exempt', 'Nil Rated', 'Non-GST').default('Taxable'),
  gstRate:         Joi.number().min(0).max(100).default(0),
});

const salesLedgerLineSchema = Joi.object({
  srNo:        Joi.number().required(),
  salesLedger: Joi.string().allow('').max(200),
  description: Joi.string().allow('').max(500).default(''),
  hsnSacCode:  Joi.string().allow('').max(20).default(''),
  amount:      Joi.number().min(0).default(0),
  gstRate:     Joi.number().min(0).max(100).default(0),
});

const additionalChargeSchema = Joi.object({
  taxableValue: Joi.number().default(0),
  ledgerName:   Joi.string().allow('').max(200),
  amount:       Joi.number().default(0),
  included:     Joi.boolean().default(false),
});

const tdsDetailSchema = Joi.object({
  ledgerName:      Joi.string().allow('').max(200),
  assessableValue: Joi.number().default(0),
  rate:            Joi.number().min(0).max(100).default(0),
  amount:          Joi.number().default(0),
});

const tcsDetailSchema = Joi.object({
  ledgerName:      Joi.string().allow('').max(200),
  assessableValue: Joi.number().default(0),
  rate:            Joi.number().min(0).max(100).default(0),
  amount:          Joi.number().default(0),
});

// ─── Main Sales Transaction Validator ────────────────────────────────────────

export const createSalesValidator = Joi.object({
  voucherType: Joi.string()
    .valid('sales_order', 'sales_invoice', 'credit_note')
    .required()
    .messages({ 'any.only': 'voucherType must be sales_order, sales_invoice, or credit_note' }),

  voucherNumberSeries: Joi.string().default('Default'),
  voucherDate:         Joi.date().iso().allow('', null),
  invoiceNumber:       Joi.string().allow('').max(100),
  invoiceDate:         Joi.date().iso().allow('', null),

  salesLedger:         Joi.string().allow('').max(200),
  gstRegistration:     Joi.string().allow('').max(200),
  partyGstin:          Joi.string().allow('').max(20).uppercase(),
  partyLedger:         Joi.string().allow('').max(200),
  consigneeLedger:     Joi.string().allow('').max(200).default('Same as Party'),

  entryMode: Joi.string().valid('manual', 'ocr', 'csv').default('manual'),
  entryTab:  Joi.string().valid('with_item', 'without_item').default('with_item'),

  productLines:      Joi.when('entryTab', {
    is: 'with_item',
    then: Joi.array().items(productLineSchema).min(1).required()
           .messages({ 'array.min': 'At least one product line is required for With Item mode' }),
    otherwise: Joi.array().items(productLineSchema).default([]),
  }),

  salesLines: Joi.when('entryTab', {
    is: 'without_item',
    then: Joi.array().items(salesLedgerLineSchema).min(1).required()
           .messages({ 'array.min': 'At least one sales line is required for Without Item mode' }),
    otherwise: Joi.array().items(salesLedgerLineSchema).default([]),
  }),

  additionalCharges: Joi.array().items(additionalChargeSchema).default([]),
  tdsDetails:        Joi.array().items(tdsDetailSchema).default([]),
  tcsDetails:        Joi.array().items(tcsDetailSchema).default([]),

  narration:         Joi.string().allow('').max(1000).default(''),
  status:            Joi.string().valid('draft', 'pending_review').default('draft'),

  linkedSalesOrder:  Joi.string().allow('').max(100),
  linkedQuotation:   Joi.string().allow('').max(100),
  linkedInvoice:     Joi.string().allow('').max(100),

  companyId:         Joi.string().max(100),
});

export const updateSalesValidator = createSalesValidator.fork(
  ['voucherType'],
  (schema) => schema.optional()
);

export const statusUpdateValidator = Joi.object({
  status: Joi.string()
    .valid('draft', 'pending_review', 'approved', 'rejected', 'archived')
    .required(),
  note: Joi.string().allow('').max(500),
});

export const listSalesQueryValidator = Joi.object({
  page:        Joi.number().integer().min(1).default(1),
  limit:       Joi.number().integer().min(1).max(100).default(20),
  status:      Joi.string().allow(''),
  voucherType: Joi.string().valid('sales_order', 'sales_invoice', 'credit_note'),
  search:      Joi.string().max(200).allow(''),
  dateFrom:    Joi.date().iso(),
  dateTo:      Joi.date().iso().min(Joi.ref('dateFrom')),
  partyLedger: Joi.string().max(200).allow(''),
  sortBy:      Joi.string().valid('invoiceDate', 'voucherDate', 'grandTotal', 'createdAt', 'partyLedger').default('createdAt'),
  sortOrder:   Joi.string().valid('asc', 'desc').default('desc'),
  companyId:   Joi.string().max(100),
});

export const csvBulkValidator = (rows) => {
  const rowSchema = Joi.object({
    invoiceNumber: Joi.string().required(),
    invoiceDate:   Joi.string().required(),
    partyLedger:   Joi.string().required(),
    partyGstin:    Joi.string().allow('').max(20),
    salesLedger:   Joi.string().allow(''),
    description:   Joi.string().allow('').max(500),
    hsnSacCode:    Joi.string().allow('').max(20),
    baseAmount:    Joi.number().required().min(0),
    gstRate:       Joi.number().min(0).max(100).default(0),
    tdsRate:       Joi.number().min(0).max(100).default(0),
    tcsRate:       Joi.number().min(0).max(100).default(0),
    narration:     Joi.string().allow('').max(500),
  });

  const errors = [];
  const valid = [];

  rows.forEach((row, idx) => {
    const { error, value } = rowSchema.validate(row, { abortEarly: false });
    if (error) {
      errors.push({
        row: idx + 2, // 1-indexed with header
        message: error.details.map((d) => d.message).join('; '),
      });
    } else {
      valid.push({ ...value, _rowIndex: idx + 2 });
    }
  });

  return { valid, errors };
};
