import { cleanLine } from '../utils/text.js';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';
import { AppError, fromDatabaseError, validationError } from '../utils/errors.js';
import { logger, scrub } from '../utils/logger.js';
import type { Database } from '../database/db.js';

/** Accept a caller-supplied request id only if it is short and harmless; otherwise mint one. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export function formatZodIssues(error: z.ZodError) {
  return error.issues.slice(0, 50).map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
}

/** Validate body/query/params with zod. Unknown body keys are rejected (strict schemas) to stop mass assignment. */
export function validate(schemas: { body?: ZodType; query?: ZodType; params?: ZodType }): RequestHandler {
  return (req, _res, next) => {
    const out: NonNullable<Request['validated']> = {};
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const parsed = schema.safeParse(part === 'body' ? (req.body ?? {}) : req[part]);
      if (!parsed.success) return next(validationError(formatZodIssues(parsed.error)));
      out[part] = parsed.data;
    }
    req.validated = out;
    next();
  };
}

export const body = <T>(req: Request) => req.validated?.body as T;
export const query = <T>(req: Request) => req.validated?.query as T;
export const params = <T>(req: Request) => req.validated?.params as T;

export const notFoundHandler: RequestHandler = (req, _res, next) =>
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path.slice(0, 120)}`));

/**
 * Central error handler. Clients get { error: { code, message, requestId, details? } } — never a
 * stack trace or raw database message. 5xx errors are logged and recorded in error_events.
 */
export function errorHandler(db?: Database) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let appErr: AppError;
    const e = err as { type?: string; status?: number; code?: string };
    if (err instanceof AppError) appErr = err;
    else if (e?.type === 'entity.parse.failed') appErr = new AppError(400, 'MALFORMED_JSON', 'Request body is not valid JSON.');
    else if (e?.type === 'entity.too.large') appErr = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    else if (e?.code === 'LIMIT_FILE_SIZE') appErr = new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file is too large.');
    else if (e?.code === 'AUTH_UNAVAILABLE') appErr = new AppError(503, 'AUTH_UNAVAILABLE', 'Authentication service is temporarily unavailable.');
    else appErr = fromDatabaseError(err) ?? new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.', undefined, false);

    if (appErr.status >= 500) {
      logger.error({ err, requestId: req.requestId, route: req.path }, 'request failed');
      if (db) {
        db.query(
          `insert into ${db.t('error_events')} (category, severity, code, message, route, request_id) values ($1,$2,$3,$4,$5,$6)`,
          ['api', appErr.status >= 503 ? 'warning' : 'error', appErr.code, scrub((err as Error)?.message ?? '').slice(0, 500), req.path.slice(0, 200), req.requestId],
        ).catch(() => undefined);
      }
    }
    res.status(appErr.status).json({
      error: {
        code: appErr.code,
        message: appErr.message,
        requestId: req.requestId,
        ...(appErr.details !== undefined && appErr.status < 500 ? { details: appErr.details } : {}),
      },
    });
  };
}

// ------------------------------------------------------------------ shared query schemas
export const uuidParam = z.object({ id: z.uuid('Invalid id') });

export const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Free-text search parameter: control/zero-width characters removed (Postgres rejects NUL bytes). */
export const searchText = (max = 120) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => cleanLine(s).slice(0, max));

/** Comma list → array, for ?ids=a,b style filters. */
export const csv = <T extends ZodType>(inner: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.length <= 2000 ? v.split(',').map((x) => x.trim()).filter(Boolean) : v),
    z.array(inner).max(100),
  );
