import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { visitorSession } from '../middleware/auth.js';
import { body, params, uuidParam, validate } from '../middleware/core.js';
import { createLimiter } from '../middleware/rateLimit.js';
import { AppError, badRequest, unauthorized } from '../utils/errors.js';
import { cleanLine } from '../utils/text.js';
import { getVisitorConversation, handleChat, type ChatRequest } from './chatService.js';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt'] as const;

export const chatRequestSchema = z.strictObject({
  message: z
    .string()
    .max(2000, 'Messages can be at most 2000 characters')
    .transform((s) => cleanLine(s))
    .refine((s) => s.length >= 1, 'Message cannot be empty'),
  conversationId: z.uuid().optional(),
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),
  clientMessageId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  context: z.strictObject({ listingId: z.uuid().optional() }).optional(),
  /** Resident or visitor: shapes how answers are framed (e.g. NIS and bus routes vs tours and airport transfers). */
  audience: z.enum(['resident', 'visitor']).optional(),
});

export function chatRoutes(ctx: AppContext) {
  const r = Router();
  const limiter = createLimiter(ctx.config.RATE_LIMIT_WINDOW_MS, ctx.config.CHAT_RATE_LIMIT_MAX, true);

  /** Explicitly start an anonymous session (the chat endpoint also mints one on first use). */
  r.post('/session', visitorSession(ctx, { mint: true }), (req, res) => {
    res.json({ visitorToken: req.issuedVisitorToken?.token ?? null, expiresAt: req.issuedVisitorToken?.expiresAt ?? null, existing: !req.issuedVisitorToken });
  });

  r.post('/', visitorSession(ctx, { mint: true }), limiter, validate({ body: chatRequestSchema }), async (req, res) => {
    if (!ctx.llm.available && ctx.config.PUBLIC_CHAT_REQUIRES_LLM) {
      throw new AppError(503, 'ASSISTANT_UNAVAILABLE', 'AI Bajan answers are coming soon. The assistant is being connected to its AI model.');
    }
    const input = body<ChatRequest>(req);
    if (input.conversationId && req.issuedVisitorToken) {
      // A conversation id without a valid visitor token cannot be continued (ownership unknown).
      throw badRequest('Your chat session has expired. Please start a new conversation.');
    }
    const result = await handleChat(ctx, input, req.visitorId!, req.requestId);
    res.json({ ...result, ...(req.issuedVisitorToken ? { visitorToken: req.issuedVisitorToken.token, visitorTokenExpiresAt: req.issuedVisitorToken.expiresAt } : {}) });
  });

  r.get('/conversations/:id', visitorSession(ctx, { mint: false }), validate({ params: uuidParam }), async (req, res) => {
    if (!req.visitorId) throw unauthorized('A valid visitor session is required.');
    res.json(await getVisitorConversation(ctx, params<{ id: string }>(req).id, req.visitorId));
  });

  return r;
}

/**
 * Admin test console: same pipeline as the public chat, available even while the public chat is
 * disabled, so answers can be evaluated before launch. Each admin gets their own test conversations.
 */
export function adminChatTestRoutes(ctx: AppContext) {
  const r = Router();
  r.post('/test', validate({ body: chatRequestSchema }), async (req, res) => {
    const input = body<ChatRequest>(req);
    const result = await handleChat(ctx, input, `admin-test-${req.admin!.id}`, req.requestId);
    res.json({ ...result, llmConfigured: ctx.llm.available });
  });
  return r;
}
