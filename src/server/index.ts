import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { routePath } from 'hono/route';
import { secureHeaders } from 'hono/secure-headers';
import { getGeminiClient } from './gemini.ts';
import { createAiRouter } from './routes/ai.ts';
import { createStravaRouter, getSessionSecretKey } from './routes/strava.ts';
import {
  type AppEnv,
  MAX_JSON_BODY_BYTES,
  createAiRateLimiter,
  createGlobalRateLimiter,
  createRequestId,
  getAllowedCorsOrigins,
  logServerEvent,
  respondToApiError,
} from './shared.ts';

export function createAppServer(): Hono<AppEnv> {
  if (!getSessionSecretKey()) {
    console.warn(
      '[server] AVISO: SESSION_SECRET não está configurada. As rotas de autenticação/sessão do Strava retornarão HTTP 503 até a configuração da variável.'
    );
  }

  const app = new Hono<AppEnv>();

  app.use(
    '*',
    secureHeaders({
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: 'same-origin-allow-popups',
      xFrameOptions: false,
    })
  );

  const allowedOrigins = getAllowedCorsOrigins();
  const isOriginAllowed = (
    origin: string | undefined,
    hostHeader: string | undefined,
    protoHeader: string | undefined
  ): boolean => {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;
    if (!hostHeader) return false;
    try {
      const originUrl = new URL(origin);
      const expectedProto = protoHeader?.split(',')[0]?.trim();
      const hostMatches = originUrl.host === hostHeader.split(',')[0]?.trim();
      const protoMatches =
        !expectedProto ||
        originUrl.protocol === `${expectedProto}:` ||
        originUrl.protocol === 'https:';
      return hostMatches && protoMatches;
    } catch {
      return false;
    }
  };

  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    const host = c.req.header('x-forwarded-host') || c.req.header('host');
    const proto = c.req.header('x-forwarded-proto');
    if (origin && !isOriginAllowed(origin, host, proto)) {
      return c.json(
        {
          ok: false,
          error: 'Origem não autorizada pela política CORS.',
          code: 'cors_forbidden',
        },
        403
      );
    }
    return next();
  });

  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const host = c.req.header('x-forwarded-host') || c.req.header('host');
        const proto = c.req.header('x-forwarded-proto');
        return origin && isOriginAllowed(origin, host, proto) ? origin : '';
      },
      credentials: true,
    })
  );

  app.use('*', async (c, next) => {
    const requestId = createRequestId(c.req.header('x-request-id'));
    c.set('requestId', requestId);

    const isApiRequest = c.req.path.startsWith('/api/') || c.req.path === '/api';
    const startedAt = isApiRequest ? Date.now() : 0;

    await next();

    c.header('X-Request-Id', requestId);
    if (isApiRequest) {
      const level = c.res.status === 503 ? 'warn' : c.res.status >= 500 ? 'error' : 'info';
      logServerEvent(level, 'api_request', {
        requestId,
        method: c.req.method,
        path: routePath(c),
        statusCode: c.res.status,
        durationMs: Date.now() - startedAt,
      });
    }
  });

  const globalRateLimiter = createGlobalRateLimiter();
  app.use('/api/*', globalRateLimiter.middleware);

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_JSON_BODY_BYTES,
      onError: (c) =>
        c.json(
          {
            ok: false,
            error: 'Payload JSON excede o limite de 2 MB.',
            code: 'payload_too_large',
          },
          413
        ),
    })
  );

  app.onError(respondToApiError);

  app.get('/api/health', (c) => {
    return c.json({
      ok: true,
      service: 'fitness-rpg-api',
      version: 'v1',
      runtime: process.env.VERCEL ? 'vercel' : 'node',
      revision: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      authMode: 'firebase-auth',
      storageMode: 'firestore',
      geminiConfigured: Boolean(getGeminiClient()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/ready', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({
      ok: true,
      authMode: 'firebase-auth',
      storageMode: 'firestore',
    });
  });

  const aiRateLimiter = createAiRateLimiter();

  // Rotas Strava OAuth 2.0 e API v3
  app.route('/', createStravaRouter());

  // Rotas Gemini IA Server-Side
  app.route('/', createAiRouter({ getGeminiClient, aiRateLimiter }));

  app.all('/api/*', (c) => {
    return c.json(
      {
        ok: false,
        error: 'Endpoint de API não encontrado.',
        code: 'api_route_not_found',
      },
      404
    );
  });

  return app;
}

let app: Hono<AppEnv> | undefined;

export async function handleApiRequest(request: Request): Promise<Response> {
  app ??= createAppServer();
  return app.fetch(request);
}
