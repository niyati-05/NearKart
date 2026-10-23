import type { ErrorRequestHandler } from 'express';
import { AppError } from '../lib/app-error.js';

/**
 * Central error handler. Clients get a stable shape and no stack traces or raw
 * database errors; details are logged on the server only.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error('[nearkart-api] Unhandled error:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  });
};
