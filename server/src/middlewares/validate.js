import { sendError } from '../utils/apiResponse.js';

/**
 * Joi validation middleware factory.
 * Usage: validate(schema, 'body' | 'query' | 'params')
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return sendError(res, 'Validation failed', 422, messages);
  }

  // Handle read-only req.query (common in some Node/Express versions)
  if (target === 'query') {
    Object.keys(req.query).forEach(key => delete req.query[key]);
    Object.assign(req.query, value);
  } else {
    req[target] = value;
  }
  
  next();
};

export default validate;
