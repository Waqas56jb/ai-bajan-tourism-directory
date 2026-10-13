/**
 * Vercel serverless entry. All routes are rewritten here (see vercel.json).
 * The Express app is created lazily once per function instance and reused across invocations.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/app.js';
import { createContext } from '../src/app/createContext.js';
import { ConfigError } from '../src/config/env.js';

let app: ReturnType<typeof createApp> | null = null;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    app ??= createApp(createContext());
  } catch (err) {
    // ConfigError lists missing/invalid variable NAMES only — never values.
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: { code: 'CONFIG_ERROR', message: err instanceof ConfigError ? err.message : 'Server configuration error' },
      }),
    );
    return;
  }
  return app(req as never, res as never);
}
