/** Application error with a stable machine-readable code. Messages must be safe for clients. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly expose = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const validationError = (details: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', 'Some fields are invalid.', details);
export const unauthorized = (message = 'Authentication is required.') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} was not found.`);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, details);
export const serviceUnavailable = (code: string, message: string) => new AppError(503, code, message);

/** Map PostgreSQL errors to safe client errors. Raw driver messages are never returned. */
export function fromDatabaseError(err: unknown): AppError | null {
  const e = err as { code?: string; constraint?: string };
  switch (e?.code) {
    case '23505':
      return conflict('A record with the same unique value already exists.', { constraint: e.constraint });
    case '23503':
      return conflict('This change references a record that does not exist or is still in use.', {
        constraint: e.constraint,
      });
    case '23514':
    case '23502':
    case '22P02':
    case '22001':
    case '22021':
    case '22P05':
      return badRequest('The data violates a database rule.', { constraint: e.constraint });
    case '57014':
      return new AppError(504, 'DB_TIMEOUT', 'The database took too long to respond. Please retry.');
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
    case '08000':
    case '08003':
    case '08006':
    case '53300':
      return serviceUnavailable('DB_UNAVAILABLE', 'The database is temporarily unavailable.');
    default:
      return null;
  }
}
