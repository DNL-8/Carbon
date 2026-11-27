import crypto from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  type AuthenticatedUser,
  authenticateRequest,
} from './authSession.ts';
import { ApiHttpError } from './apiError.ts';
import { getAllowedCorsOrigins, getAppBaseUrl } from './httpOrigins.ts';

export { getAllowedCorsOrigins, getAppBaseUrl, PORT } from './httpOrigins.ts';

export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;
export const GLOBAL_RATE_LIMIT_WINDOW_MS = 60_000;
export const GLOBAL_RATE_LIMIT_MAX = 120;
export const AI_RATE_LIMIT_WINDOW_MS = 60_000;
export const AI_RATE_LIMIT_MAX = 10;
export const MAX_AI_CONTEXT_CHARS = 12_000;

export interface AppEnv {
  Variables: {
    authUser?: AuthenticatedUser;
    requestId?: string;
  };
}

export function logServerEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  meta: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...meta,
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function getStravaRedirectUri(): string {
  return `${getAppBaseUrl()}/auth/strava/callback`;
}

export function toContentfulStatus(
  code: number,
  fallback: ContentfulStatusCode = 500
): ContentfulStatusCode {
  if (Number.isInteger(code) && code >= 200 && code <= 599 && code !== 204 && code !== 304) {
    return code as ContentfulStatusCode;
  }
  return fallback;
}

export async function readJsonBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const raw = await c.req.text();
  if (!raw.trim()) return {};
  const contentType = c.req.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !/^application\/(?:json|[a-z0-9.+-]+\+json)$/.test(contentType)) {
    throw new ApiHttpError(415, 'Envie o corpo com Content-Type: application/json.', 'unsupported_media_type');
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_JSON_BODY_BYTES) {
    throw new ApiHttpError(413, 'Payload JSON excede o limite de 2 MB.', 'payload_too_large');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiHttpError(400, 'Corpo JSON inválido ou malformado.', 'invalid_json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiHttpError(400, 'O corpo JSON deve ser um objeto.', 'invalid_json_body');
  }
  return parsed as Record<string, unknown>;
}

export function sendInternalError(
  c: Context<AppEnv>,
  err: unknown,
  contextLabel: string,
  fallbackMessage: string,
  requestId?: string
): Response {
  logServerEvent('error', 'http_internal_error', {
    requestId: requestId ?? c.get('requestId'),
    context: contextLabel,
    errorType: err instanceof Error ? err.name : 'UnknownError',
  });
  return c.json({ ok: false, error: fallbackMessage, code: 'internal_server_error' }, 500);
}

export function respondToApiError(err: unknown, c: Context<AppEnv>): Response {
  const context = `${c.req.method} ${routePath(c)}`;
  if (!(err instanceof ApiHttpError)) {
    return sendInternalError(c, err, context, 'Erro interno do servidor.');
  }
  if (err.statusCode >= 500) {
    logServerEvent(err.statusCode === 503 ? 'warn' : 'error', 'api_dependency_error', {
      requestId: c.get('requestId'),
      context,
      statusCode: err.statusCode,
      code: err.code,
    });
  }
  return c.json({
    ok: false,
    error: err.statusCode >= 500 ? 'Serviço temporariamente indisponível.' : err.message,
    code: err.code,
  }, toContentfulStatus(err.statusCode));
}

export function getClientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return c.req.header('x-real-ip') || 'unknown';
}

export const requireAuthSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  try {
    const user = await authenticateRequest(c, getAllowedCorsOrigins());
    c.set('authUser', user);
    return next();
  } catch (err) {
    if (err instanceof ApiHttpError) {
      return c.json(
        { ok: false, error: err.message, code: err.code },
        toContentfulStatus(err.statusCode, 401)
      );
    }
    return c.json(
      { ok: false, error: 'Autenticação obrigatória.', code: 'unauthenticated' },
      401
    );
  }
};

export const requireAuthSessionAllowUnverified: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  try {
    const user = await authenticateRequest(c, getAllowedCorsOrigins(), { allowUnverified: true });
    c.set('authUser', user);
    return next();
  } catch (err) {
    if (err instanceof ApiHttpError) {
      return c.json(
        { ok: false, error: err.message, code: err.code },
        toContentfulStatus(err.statusCode, 401)
      );
    }
    return c.json(
      { ok: false, error: 'Autenticação obrigatória.', code: 'unauthenticated' },
      401
    );
  }
};

export interface AiRateLimiter {
  middleware: MiddlewareHandler<AppEnv>;
  consume: (c: Context<AppEnv>) => Promise<Response | null>;
}

export function createGlobalRateLimiter(
  maxRequests: number = GLOBAL_RATE_LIMIT_MAX,
  windowMs: number = GLOBAL_RATE_LIMIT_WINDOW_MS
): AiRateLimiter {
  const buckets = new Map<string, { count: number; resetAtMs: number }>();

  const consume = async (c: Context<AppEnv>): Promise<Response | null> => {
    const now = Date.now();
    if (buckets.size >= 5000) {
      for (const [k, bucket] of buckets) {
        if (bucket.resetAtMs <= now) buckets.delete(k);
      }
      while (buckets.size >= 5000) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey === undefined) break;
        buckets.delete(oldestKey);
      }
    }

    const key = getClientIp(c);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAtMs <= now) {
      bucket = { count: 0, resetAtMs: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const resetSec = Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000));
    const remaining = Math.max(0, maxRequests - bucket.count);
    c.header('RateLimit-Limit', String(maxRequests));
    c.header('RateLimit-Remaining', String(remaining));
    c.header('RateLimit-Reset', String(resetSec));

    if (bucket.count > maxRequests) {
      c.header('Retry-After', String(resetSec));
      return c.json(
        {
          ok: false,
          error: `Limite global de requisições atingido (${maxRequests}/min). Aguarde alguns instantes.`,
          code: 'rate_limit_exceeded',
        },
        429
      );
    }
    return null;
  };

  const middleware: MiddlewareHandler<AppEnv> = async (c, next) => {
    const limitedResponse = await consume(c);
    if (limitedResponse) return limitedResponse;
    return next();
  };

  return { middleware, consume };
}

export function createAiRateLimiter(
  maxRequests: number = AI_RATE_LIMIT_MAX,
  windowMs: number = AI_RATE_LIMIT_WINDOW_MS
): AiRateLimiter {
  const buckets = new Map<string, { count: number; resetAtMs: number }>();

  const consume = async (c: Context<AppEnv>): Promise<Response | null> => {
    const allowedUid = process.env.AI_ALLOWED_UID?.trim();
    if (allowedUid && c.get('authUser')?.uid !== allowedUid) {
      return c.json({ ok: false, error: 'A IA está reservada à conta autorizada.', code: 'ai_forbidden' }, 403);
    }
    const redisUrl = process.env.AI_RATE_LIMIT_REDIS_URL?.trim();
    const redisToken = process.env.AI_RATE_LIMIT_REDIS_TOKEN?.trim();
    let count: number;
    let resetSec: number;
    if (redisUrl || redisToken) {
      try {
        if (!redisUrl || !redisToken || new URL(redisUrl).protocol !== 'https:') {
          throw new Error('Configuração inválida');
        }
        const key = c.get('authUser')?.uid || getClientIp(c);
        const hash = crypto.createHash('sha256').update(key).digest('hex');
        const result = await fetch(redisUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(2_000),
          redirect: 'error',
          body: JSON.stringify([
            'EVAL',
            "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return {n, redis.call('PTTL', KEYS[1])}",
            1, `fitness-rpg:ai:${hash}`, windowMs,
          ]),
        });
        if (!result.ok) throw new Error('Limitador indisponível');
        const body = await result.json() as { result?: [number, number] };
        count = body.result?.[0] ?? NaN;
        const ttl = body.result?.[1] ?? NaN;
        if (!Number.isSafeInteger(count) || count <= 0 || !Number.isSafeInteger(ttl) || ttl < 0) {
          throw new Error('Resposta do limitador inválida');
        }
        resetSec = Math.max(1, Math.ceil(ttl / 1000));
      } catch {
        return c.json({ ok: false, error: 'Controle de uso da IA indisponível.', code: 'ai_limit_unavailable' }, 503);
      }
    } else {
      ({ count, resetSec } = consumeLocal(c));
    }
    const remaining = Math.max(0, maxRequests - count);
    c.header('RateLimit-Limit', String(maxRequests));
    c.header('RateLimit-Remaining', String(remaining));
    c.header('RateLimit-Reset', String(resetSec));

    if (count > maxRequests) {
      c.header('Retry-After', String(resetSec));
      return c.json({
        ok: false,
        error: `Limite de requisições à IA atingido (${maxRequests}/min). Aguarde alguns instantes.`,
        code: 'rate_limit_exceeded',
      }, 429);
    }
    return null;
  };

  function consumeLocal(c: Context<AppEnv>) {
    const now = Date.now();
    // Remove buckets expirados e limita o crescimento da memória em tráfego intenso.
    if (buckets.size >= 5000) {
      for (const [k, bucket] of buckets) {
        if (bucket.resetAtMs <= now) buckets.delete(k);
      }
      while (buckets.size >= 5000) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey === undefined) break;
        buckets.delete(oldestKey);
      }
    }

    const key = c.get('authUser')?.uid || getClientIp(c);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAtMs <= now) {
      bucket = { count: 0, resetAtMs: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    return { count: bucket.count, resetSec: Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000)) };
  }

  const middleware: MiddlewareHandler<AppEnv> = async (c, next) => {
    const limitedResponse = await consume(c);
    if (limitedResponse) return limitedResponse;
    return next();
  };

  return { middleware, consume };
}

export function createRequestId(incomingId: string | undefined): string {
  return typeof incomingId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingId)
    ? incomingId
    : crypto.randomUUID();
}
