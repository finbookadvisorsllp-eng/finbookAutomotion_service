import { sendError } from '../utils/apiResponse.js';

/**
 * Global Express error handling middleware.
 * Must be registered LAST — after all routes.
 */
const errorHandler = (err, req, res, next) => {
  // Log all errors in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', err.message);
    if (err.stack) console.error(err.stack);
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'File too large. Maximum size exceeded.', 413);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return sendError(res, 'Unexpected file field in upload.', 400);
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return sendError(res, 'Invalid resource ID format.', 400);
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 'Validation failed', 422, messages);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `Duplicate value for ${field}. Record already exists.`, 409);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid authentication token.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Authentication token has expired.', 401);
  }

  // Known operational errors (ApiError instances)
  if (err.isOperational) {
    return sendError(res, err.message, err.statusCode, err.errors);
  }

  // Unknown / programming errors — do not leak details
  console.error('💥 Unexpected error:', err);
  return sendError(res, 'An unexpected error occurred. Please try again.', 500);
};

export default errorHandler;
