import Joi from 'joi';

const billAllocationSchema = Joi.object({
  billType:   Joi.string().allow('').max(100),
  billRef:    Joi.string().allow('').max(100),
  billAmount: Joi.number().default(0),
  dueDate:    Joi.date().iso().allow('', null),
});

const costCenterAllocationSchema = Joi.object({
  costCategory:     Joi.string().allow('').max(100),
  costCenter:       Joi.string().allow('').max(100),
  allocationAmount: Joi.number().default(0),
});

export const createFundFlowValidator = Joi.object({
  voucherType: Joi.string()
    .valid('cash_payment', 'bank_payment', 'contra')
    .required()
    .messages({ 'any.only': 'voucherType must be cash_payment, bank_payment, or contra' }),

  voucherNumberSeries: Joi.string().default('Default'),
  voucherDate:         Joi.date().iso().allow('', null),
  referenceNumber:     Joi.string().allow('').max(100),
  company:             Joi.string().allow('').max(200),

  partyLedger:         Joi.string().allow('').max(200),
  againstLedger:       Joi.string().allow('').max(200),
  amount:              Joi.number().min(0).default(0),
  drCrType:            Joi.string().allow('').max(100),
  ledgerGroup:         Joi.string().allow('').max(200),
  currency:            Joi.string().allow('').max(20).default('INR'),

  cashLedger:          Joi.string().allow('').max(200),
  cashAmount:          Joi.number().min(0).default(0),
  openingBalance:      Joi.number().default(0),

  bankLedger:          Joi.string().allow('').max(200),
  transType:           Joi.string().allow('').max(100),
  instNumber:          Joi.string().allow('').max(100),
  instDate:            Joi.date().iso().allow('', null),
  utr:                 Joi.string().allow('').max(100),
  ifscCode:            Joi.string().allow('').max(50),
  branchName:          Joi.string().allow('').max(200),
  bankBalance:         Joi.number().default(0),

  sourceLedger:        Joi.string().allow('').max(200),
  transferAmount:      Joi.number().min(0).default(0),
  destinationLedger:   Joi.string().allow('').max(200),
  amountReceived:      Joi.number().min(0).default(0),

  billRows:            Joi.array().items(billAllocationSchema).default([]),
  costCenters:         Joi.array().items(costCenterAllocationSchema).default([]),

  gstApplicable:       Joi.boolean().default(false),
  gstLedger:           Joi.string().allow('').max(200),
  gstRate:             Joi.number().default(0),
  tdsApplicable:       Joi.boolean().default(false),
  tdsLedger:           Joi.string().allow('').max(200),
  tdsRate:             Joi.number().default(0),

  narration:           Joi.string().allow('').max(1000).default(''),
  status:              Joi.string().valid('draft', 'pending_review', 'approved', 'rejected', 'archived').default('draft'),
  companyId:           Joi.string().max(100),
});

export const updateFundFlowValidator = createFundFlowValidator.fork(
  ['voucherType'],
  (schema) => schema.optional()
);

export const fundFlowStatusUpdateValidator = Joi.object({
  status: Joi.string()
    .valid('draft', 'pending_review', 'approved', 'rejected', 'archived')
    .required(),
  note: Joi.string().allow('').max(500),
});

export const listFundFlowQueryValidator = Joi.object({
  page:        Joi.number().integer().min(1).default(1),
  limit:       Joi.number().integer().min(1).max(100).default(20),
  status:      Joi.string().allow(''),
  voucherType: Joi.string().valid('cash_payment', 'bank_payment', 'contra'),
  search:      Joi.string().max(200).allow(''),
  dateFrom:    Joi.date().iso(),
  dateTo:      Joi.date().iso().min(Joi.ref('dateFrom')),
  partyLedger: Joi.string().max(200).allow(''),
  sortBy:      Joi.string().valid('voucherDate', 'amount', 'createdAt', 'partyLedger').default('createdAt'),
  sortOrder:   Joi.string().valid('asc', 'desc').default('desc'),
  companyId:   Joi.string().max(100),
});
