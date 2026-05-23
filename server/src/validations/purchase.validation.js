import Joi from 'joi';

// ─── Reusable sub-schemas ────────────────────────────────────────────────────

const purchaseProductLineSchema = Joi.object({
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

const purchaseLedgerLineSchema = Joi.object({
  srNo:           Joi.number().required(),
  purchaseLedger: Joi.string().allow('').max(200),
  description:    Joi.string().allow('').max(500).default(''),
  hsnSacCode:     Joi.string().allow('').max(20).default(''),
  amount:         Joi.number().min(0).default(0),
  gstRate:        Joi.number().min(0).max(100).default(0),
});

const purchaseAdditionalChargeSchema = Joi.object({
  taxableValue: Joi.number().default(0),
  ledgerName:   Joi.string().allow('').max(200),
  amount:       Joi.number().default(0),
  included:     Joi.boolean().default(false),
});

const purchaseTdsDetailSchema = Joi.object({
  ledgerName:      Joi.string().allow('').max(200),
  assessableValue: Joi.number().default(0),
  rate:            Joi.number().min(0).max(100).default(0),
  amount:          Joi.number().default(0),
});

const purchaseTcsDetailSchema = Joi.object({
  ledgerName:      Joi.string().allow('').max(200),
  assessableValue: Joi.number().default(0),
  rate:            Joi.number().min(0).max(100).default(0),
  amount:          Joi.number().default(0),
});

// ─── Main Purchase Transaction Validator ─────────────────────────────────────

export const createPurchaseValidator = Joi.object({
  voucherType: Joi.string()
    .valid('purchase_order', 'purchase_invoice', 'debit_note')
    .required()
    .messages({ 'any.only': 'voucherType must be purchase_order, purchase_invoice, or debit_note' }),

  voucherNumberSeries: Joi.string().default('Default'),
  voucherDate:         Joi.date().iso().allow('', null),
  invoiceNumber:       Joi.string().allow('').max(100),
  invoiceDate:         Joi.date().iso().allow('', null),
  poNumber:            Joi.string().allow('').max(100),

  purchaseLedger:      Joi.string().allow('').max(200),
  gstRegistration:     Joi.string().allow('').max(200),
  partyGstin:          Joi.string().allow('').max(20).uppercase(),
  partyLedger:         Joi.string().allow('').max(200),
  consigneeLedger:     Joi.string().allow('').max(200).default('Same as Party'),

  entryMode: Joi.string().valid('manual', 'ocr', 'csv').default('manual'),
  entryTab:  Joi.string().valid('with_item', 'without_item').default('with_item'),

  productLines: Joi.when('entryTab', {
    is: 'with_item',
    then: Joi.array().items(purchaseProductLineSchema).min(1).required()
           .messages({ 'array.min': 'At least one product line is required for With Item mode' }),
    otherwise: Joi.array().items(purchaseProductLineSchema).default([]),
  }),

  purchaseLines: Joi.when('entryTab', {
    is: 'without_item',
    then: Joi.array().items(purchaseLedgerLineSchema).min(1).required()
           .messages({ 'array.min': 'At least one purchase line is required for Without Item mode' }),
    otherwise: Joi.array().items(purchaseLedgerLineSchema).default([]),
  }),

  additionalCharges: Joi.array().items(purchaseAdditionalChargeSchema).default([]),
  tdsDetails:        Joi.array().items(purchaseTdsDetailSchema).default([]),
  tcsDetails:        Joi.array().items(purchaseTcsDetailSchema).default([]),

  narration:         Joi.string().allow('').max(1000).default(''),
  status:            Joi.string().valid('draft', 'pending_review', 'approved', 'rejected', 'archived').default('draft'),

  linkedPurchaseOrder: Joi.string().allow('').max(100),
  linkedInvoice:       Joi.string().allow('').max(100),

  companyId:         Joi.string().max(100),
});

export const updatePurchaseValidator = createPurchaseValidator.fork(
  ['voucherType'],
  (schema) => schema.optional()
);

export const purchaseStatusUpdateValidator = Joi.object({
  status: Joi.string()
    .valid('draft', 'pending_review', 'approved', 'rejected', 'archived')
    .required(),
  note: Joi.string().allow('').max(500),
});

export const listPurchaseQueryValidator = Joi.object({
  page:        Joi.number().integer().min(1).default(1),
  limit:       Joi.number().integer().min(1).max(100).default(20),
  status:      Joi.string().allow(''),
  voucherType: Joi.string().valid('purchase_order', 'purchase_invoice', 'debit_note'),
  search:      Joi.string().max(200).allow(''),
  dateFrom:    Joi.date().iso(),
  dateTo:      Joi.date().iso().min(Joi.ref('dateFrom')),
  partyLedger: Joi.string().max(200).allow(''),
  sortBy:      Joi.string().valid('invoiceDate', 'voucherDate', 'grandTotal', 'createdAt', 'partyLedger').default('createdAt'),
  sortOrder:   Joi.string().valid('asc', 'desc').default('desc'),
  companyId:   Joi.string().max(100),
});
