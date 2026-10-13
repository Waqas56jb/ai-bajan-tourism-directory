import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppContext } from './app/context.js';
import { adRoutes, featuredRoutes, publicAdRoutes } from './advertising/advertisingRoutes.js';
import { chatRoutes } from './chat/chatRoutes.js';
import { conversationAdminRoutes } from './chat/conversationAdminRoutes.js';
import { allowedOrigins } from './config/env.js';
import { adminFeedbackRoutes, publicFeedbackRoutes } from './feedback/feedbackRoutes.js';
import { documentRoutes } from './knowledge/documentRoutes.js';
import { faqRoutes, publicFaqRoutes } from './knowledge/faqRoutes.js';
import { adminListingRoutes, publicListingRoutes } from './listings/listingRoutes.js';
import { authenticateAdmin } from './middleware/auth.js';
import { errorHandler, notFoundHandler, requestId } from './middleware/core.js';
import { createLimiter } from './middleware/rateLimit.js';
import { healthRoutes } from './monitoring/healthRoutes.js';
import { analyticsRoutes, auditRoutes, monitoringRoutes, publicSettingsRoutes, settingsRoutes, syncRoutes } from './monitoring/opsRoutes.js';
import { categoryRoutes, locationRoutes, publicTaxonomyRoutes } from './taxonomy/taxonomyRoutes.js';
import { administratorRoutes, meRoutes, userRoutes } from './users/userRoutes.js';
import { adminSyncRunRoutes, internalSyncRoutes } from './sync/syncRunRoutes.js';
import { logger } from './utils/logger.js';

export function createApp(ctx: AppContext, opts: { httpLogging?: boolean } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // On Vercel requests always arrive through one proxy hop.
  const proxies = ctx.config.TRUST_PROXY || (process.env.VERCEL ? 1 : 0);
  if (proxies) app.set('trust proxy', proxies);
  app.set('query parser', 'simple');

  app.use(requestId);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  const origins = allowedOrigins();
  app.use(
    cors({
      // Explicit allowlist. Requests without an Origin header (server-to-server, curl) are allowed;
      // browsers from other origins get no CORS headers and are blocked by the browser.
      origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  if (opts.httpLogging !== false) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req as express.Request).requestId,
        customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
        // Request bodies (which can contain chat messages) are never logged.
        serializers: { req: (req) => ({ method: req.method, url: req.url?.split('?')[0], id: req.id }), res: (res) => ({ statusCode: res.statusCode }) },
      }),
    );
  }

  app.get('/', (_req, res) => {
    res.json({ name: 'AI Bajan API', version: 'v1', health: '/health/ready', api: '/api/v1' });
  });
  app.use('/health', healthRoutes(ctx));

  const api = Router();
  api.use(createLimiter(ctx.config.RATE_LIMIT_WINDOW_MS, ctx.config.RATE_LIMIT_MAX_REQUESTS));

  // Public (no authentication; published/approved content only)
  api.use('/public/listings', publicListingRoutes(ctx));
  api.use('/public/faqs', publicFaqRoutes(ctx));
  api.use('/public/ads', publicAdRoutes(ctx));
  api.use('/public/settings', publicSettingsRoutes(ctx));
  api.use('/public', publicTaxonomyRoutes(ctx));
  api.use('/chat', chatRoutes(ctx));
  api.use('/feedback', publicFeedbackRoutes(ctx));
  api.use('/internal', internalSyncRoutes(ctx));

  // Admin (verified Supabase session + active AI Bajan administrator + per-route permission)
  const admin = Router();
  admin.use(authenticateAdmin(ctx));
  admin.use('/me', meRoutes());
  admin.use('/listings', adminListingRoutes(ctx));
  admin.use('/categories', categoryRoutes(ctx));
  admin.use('/locations', locationRoutes(ctx));
  admin.use('/faqs', faqRoutes(ctx));
  admin.use('/knowledge/documents', documentRoutes(ctx));
  admin.use('/sync', adminSyncRunRoutes(ctx));
  admin.use('/sync', syncRoutes(ctx));
  admin.use('/conversations', conversationAdminRoutes(ctx));
  admin.use('/feedback', adminFeedbackRoutes(ctx));
  admin.use('/ads', adRoutes(ctx));
  admin.use('/featured', featuredRoutes(ctx));
  admin.use('/users', userRoutes(ctx));
  admin.use('/administrators', administratorRoutes(ctx));
  admin.use('/activity', auditRoutes(ctx));
  admin.use('/analytics', analyticsRoutes(ctx));
  admin.use('/monitoring', monitoringRoutes(ctx));
  admin.use('/settings', settingsRoutes(ctx));
  api.use('/admin', admin);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler(ctx.db));
  return app;
}
