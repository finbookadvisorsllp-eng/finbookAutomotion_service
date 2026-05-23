import crypto from 'crypto';

/**
 * Generate a sequential voucher number like SO-2026-0001 or SI-2026-0001
 * @param {string} prefix - e.g., 'SO', 'SI', 'CN'
 * @param {number} sequence - the sequence count
 * @returns {string}
 */
export const generateVoucherNumber = (prefix, sequence) => {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
};

/**
 * Round a number to N decimal places
 */
export const roundTo = (num, decimals = 2) =>
  Math.round((parseFloat(num) || 0) * Math.pow(10, decimals)) / Math.pow(10, decimals);

/**
 * Calculate GST breakdown from a taxable amount and rate
 * Returns { cgst, sgst, igst } based on transaction type
 */
export const calculateGST = (taxableAmount, gstRate, transactionType = 'intra') => {
  const rate = parseFloat(gstRate) || 0;
  const amount = parseFloat(taxableAmount) || 0;

  if (transactionType === 'inter') {
    const igst = roundTo((amount * rate) / 100);
    return { cgst: 0, sgst: 0, igst };
  }

  const halfRate = rate / 2;
  const cgst = roundTo((amount * halfRate) / 100);
  const sgst = roundTo((amount * halfRate) / 100);
  return { cgst, sgst, igst: 0 };
};

/**
 * Build pagination options from query params
 */
export const buildPagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build a Mongoose sort object from query params
 * e.g., sortBy=invoiceDate&sortOrder=desc
 */
export const buildSort = (query, allowedFields = []) => {
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  if (allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    return { createdAt: -1 };
  }

  return { [sortBy]: sortOrder };
};

/**
 * Strip undefined keys from an object (clean patch payloads)
 */
export const cleanObject = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/**
 * Generate a unique reference token
 */
export const generateRefToken = () => crypto.randomBytes(16).toString('hex');
