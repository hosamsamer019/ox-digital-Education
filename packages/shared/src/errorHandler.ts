import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

export class HttpError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

/**
 * Detects Zod validation errors regardless of which physical copy of the `zod`
 * module created them. Each service and `@shared/utils` can resolve their own
 * `node_modules/zod`, so `instanceof ZodError` alone is not reliable across
 * package boundaries (the schema's ZodError class differs from the one imported here).
 */
export function isZodError(err: unknown): err is ZodError {
  if (err instanceof ZodError) return true;
  const candidate = err as { name?: unknown; issues?: unknown } | null;
  return Boolean(candidate && candidate.name === 'ZodError' && Array.isArray(candidate.issues));
}

/**
 * Produces a safe, structured list of validation issues (field path, code, message)
 * without echoing raw submitted values back to the client.
 */
export function formatValidationIssues(err: ZodError): Array<{ path: string; code: string; message: string }> {
  return (err.issues || []).map((issue: any) => ({
    path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? ''),
    code: String(issue.code ?? 'invalid'),
    message: String(issue.message ?? 'Invalid value')
  }));
}

export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  // 1. Request validation failures (defense in depth if a ZodError escapes a controller)
  if (isZodError(err)) {
    logger.warn('Request validation failed', { path: req.path, method: req.method });
    return res.status(400).json({
      message: 'Validation failed',
      errors: formatValidationIssues(err)
    });
  }

  // 2. Malformed JSON request bodies (express.json / body-parser)
  if (err && err.type === 'entity.parse.failed') {
    logger.warn('Malformed JSON request body', { path: req.path, method: req.method });
    return res.status(400).json({
      error: 'Malformed JSON request body',
      status: 400
    });
  }

  const statusCode = Number(err?.status || err?.statusCode) || 500;

  // 3. Deliberate client errors (e.g. HttpError 403 'Not allowed by CORS'): expected, not unhandled
  if (statusCode >= 400 && statusCode < 500) {
    logger.warn('Request rejected', {
      error: err?.message,
      status: statusCode,
      path: req.path,
      method: req.method
    });
    return res.status(statusCode).json({
      error: err?.message || 'Request rejected',
      status: statusCode
    });
  }

  // 4. Unexpected internal errors: HTTP 500 with a safe external message
  logger.error('Unhandled Exception', {
    error: err?.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
    path: req.path,
    method: req.method
  });

  const message = err?.message || 'Internal Server Error';
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' && statusCode >= 500 ? 'Internal Server Error' : message,
    status: statusCode
  });
}
