/**
 * Standardised API response envelope
 * { success, message, data, meta, errors }
 */

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

export const sendCreated = (res, data, message = 'Created successfully') =>
  sendSuccess(res, data, message, 201);

export const sendError = (res, message = 'Internal server error', statusCode = 500, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

export const sendNotFound = (res, resource = 'Resource') =>
  sendError(res, `${resource} not found`, 404);

export const sendBadRequest = (res, message = 'Bad request', errors = null) =>
  sendError(res, message, 400, errors);

export const sendUnauthorized = (res, message = 'Unauthorized') =>
  sendError(res, message, 401);

export const sendForbidden = (res, message = 'Forbidden') =>
  sendError(res, message, 403);

export const sendPaginated = (res, data, total, page, limit, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  return sendSuccess(res, data, message, 200, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  });
};
