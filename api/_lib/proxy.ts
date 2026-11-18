/**
 * Utilidades compartidas del proxy serverless (no es una función: Vercel ignora
 * los archivos que empiezan por "_"). Caché en memoria por instancia, limitador
 * de peticiones hacia cada servicio y respuestas JSON con caché de CDN.
 */

// ---- Caché TTL -------------------------------------------------------------

export class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  constructor(
    private ttlMs: number,
    private maxEntries = 500,
    private now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: this.now() + this.ttlMs });
  }

  clear(): void {
    this.map.clear();
  }
}

export { RateLimiter } from '../../src/domain/rateLimit.js';

// ---- Respuestas ---------------------------------------------------------------

const ONE_DAY = 86_400;

export function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  headers['cache-control'] =
    status === 200 && cacheSeconds > 0
      ? `public, max-age=3600, s-maxage=${cacheSeconds}, stale-while-revalidate=${ONE_DAY}`
      : 'no-store';
  return new Response(JSON.stringify(body), { status, headers });
}

export type ProxyError = 'bad_request' | 'rate_limited' | 'upstream_error' | 'not_configured' | 'not_found';

export function error(code: ProxyError, status: number): Response {
  return json({ error: code }, status);
}

export class UpstreamError extends Error {
  constructor(public status: number) {
    super(`Upstream responded ${status}`);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new UpstreamError(res.status);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Texto de búsqueda saneado: 2–80 caracteres, sin espacios repetidos. */
export function cleanQuery(q: string | null): string | null {
  const s = (q ?? '').replace(/\s+/g, ' ').trim();
  return s.length >= 2 && s.length <= 80 ? s : null;
}

export const SUPPORTED_LANGS = ['es', 'en', 'it', 'de', 'pl', 'tr'];

export function cleanLang(l: string | null): string {
  return l && SUPPORTED_LANGS.includes(l) ? l : 'en';
}
