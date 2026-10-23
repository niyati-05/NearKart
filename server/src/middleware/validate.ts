import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodType } from 'zod';

function sendValidationError(res: Response, error: ZodError) {
  const details = error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details,
    },
  });
}

/**
 * Validates body/query/params against a zod schema and writes the parsed
 * (trimmed, lowercased, coerced) body back so routes use validated data.
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: unknown };

      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return sendValidationError(res, err);
      }
      next(err);
    }
  };
}

/**
 * Express 5 exposes req.query as a getter, so parsed query values are stored
 * on res.locals instead of being written back to the request.
 */
export function validateQuery<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);

    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    res.locals.query = parsed.data;
    next();
  };
}
