import type { Request } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

/**
 * In-memory rate limiters (per process). With several API instances behind a load balancer the
 * effective limit is multiplied by the instance count — use a shared store if that matters.
 */
const handler = (_req: Request, res: import('express').Response) =>
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.', requestId: _req.requestId },
  });

const keyFor = (req: Request) => req.visitorId ?? ipKeyGenerator(req.ip ?? 'unknown');

export function createLimiter(windowMs: number, limit: number, byVisitor = false) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
    ...(byVisitor ? { keyGenerator: keyFor } : {}),
  });
}
