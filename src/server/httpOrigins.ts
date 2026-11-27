export const PORT = Number(process.env.PORT || 3000);

const VALID_HOST_HEADER_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/i;
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

function parseHttpOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      return url.origin;
    }
  } catch {
    return undefined;
  }
}

export function getAppBaseUrl(): string {
  const configured = parseHttpOrigin(process.env.APP_URL?.trim());
  if (configured) return configured;
  const productionUrl =
    process.env.VERCEL_ENV === 'production' ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  const vercelUrl = (productionUrl || process.env.VERCEL_URL || process.env.VERCEL_BRANCH_URL)?.trim();
  const normalized = vercelUrl && !/^https?:\/\//i.test(vercelUrl) ? `https://${vercelUrl}` : vercelUrl;
  return parseHttpOrigin(normalized) ?? `http://localhost:${PORT}`;
}

export function getAllowedCorsOrigins(): Set<string> {
  const origins = new Set<string>([getAppBaseUrl()]);

  for (const vercelCandidate of [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]) {
    const trimmed = vercelCandidate?.trim();
    if (!trimmed) continue;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const origin = parseHttpOrigin(normalized);
    if (origin) origins.add(origin);
  }

  const extra = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  for (const raw of extra) {
    const origin = parseHttpOrigin(raw.trim());
    if (origin) origins.add(origin);
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add(`http://localhost:${PORT}`);
    origins.add(`http://127.0.0.1:${PORT}`);
  }
  return origins;
}

export function getAllowedAuthHosts(): string[] {
  const hosts = new Set<string>();
  for (const origin of getAllowedCorsOrigins()) {
    try {
      hosts.add(new URL(origin).host.toLowerCase());
    } catch {
      // ignore invalid origin
    }
  }
  return [...hosts];
}

function buildOriginFromHostHeader(
  rawHost: string | null,
  rawProto: string | null
): string | undefined {
  const host = rawHost?.split(',')[0]?.trim();
  if (!host || !VALID_HOST_HEADER_RE.test(host)) return undefined;
  try {
    const parsedHost = new URL(`https://${host}`);
    const isLoopback = LOOPBACK_HOSTNAMES.has(parsedHost.hostname.toLowerCase());
    const forwardedProto = rawProto?.split(',')[0]?.trim().toLowerCase();
    const proto =
      forwardedProto === 'http' || forwardedProto === 'https'
        ? forwardedProto
        : isLoopback
          ? 'http'
          : 'https';
    return parseHttpOrigin(`${proto}://${host}`);
  } catch {
    return undefined;
  }
}

export function resolveRequestOrigin(headers: Headers, requestUrl?: string): string {
  const allowedOrigins = getAllowedCorsOrigins();

  const forwardedOrigin = buildOriginFromHostHeader(
    headers.get('x-forwarded-host'),
    headers.get('x-forwarded-proto')
  );
  if (forwardedOrigin && allowedOrigins.has(forwardedOrigin)) {
    return forwardedOrigin;
  }

  const hostOrigin = buildOriginFromHostHeader(
    headers.get('host'),
    headers.get('x-forwarded-proto')
  );
  if (hostOrigin && allowedOrigins.has(hostOrigin)) {
    return hostOrigin;
  }

  if (requestUrl) {
    const reqOrigin = parseHttpOrigin(requestUrl);
    if (reqOrigin && allowedOrigins.has(reqOrigin)) {
      return reqOrigin;
    }
  }

  return getAppBaseUrl();
}
