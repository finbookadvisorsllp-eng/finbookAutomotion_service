import jwt from 'jsonwebtoken';
import { sendUnauthorized, sendForbidden } from '../utils/apiResponse.js';

/**
 * Verify JWT and attach decoded user to req.user.
 * Expected header: Authorization: Bearer <token>
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Access token required');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = decoded;
    next();
  } catch (err) {
    return sendUnauthorized(res, 'Invalid or expired token');
  }
};

/**
 * Role-based access control middleware factory.
 * Usage: authorize('admin', 'accountant')
 */
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return sendUnauthorized(res);
  if (!roles.includes(req.user.role)) {
    return sendForbidden(res, `Access denied. Required roles: ${roles.join(', ')}`);
  }
  next();
};

/**
 * Optional auth — sets req.user if token present, proceeds regardless.
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev_secret');
    } catch (_) { /* no-op */ }
  }
  next();
};
