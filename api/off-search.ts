/**
 * GET /api/off-search?q=yogur&lang=es
 * Búsqueda de texto en Open Food Facts vía Search-a-licious (la búsqueda de
 * texto recomendada por OFF). Devuelve `{ foods: Food[] }` normalizados por 100 g.
 */
import { OFF_FIELDS, normalizeOffSearch, type OffProduct } from '../src/domain/external';
import type { Food } from '../src/domain/foods';
import {
  RateLimiter,
  TtlCache,
  UpstreamError,
  cleanLang,
  cleanQuery,
  error,
  fetchJson,
  json,
  userAgent,
} from './_lib/proxy';

export const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';
const PAGE_SIZE = 20;
const CACHE_SECONDS = 7 * 86_400;

// OFF: máx. 10 búsquedas/min por IP. Somos un único cliente para ellos.
export const limiter = new RateLimiter(10, 60_000);
export const cache = new TtlCache<Food[]>(CACHE_SECONDS * 1000);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = cleanQuery(url.searchParams.get('q'));
  if (!q) return error('bad_request', 400);
  const lang = cleanLang(url.searchParams.get('lang'));
  const langs = [...new Set([lang, 'en'])].join(',');

  const key = `${langs}|${q.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return json({ foods: cached, cached: true }, 200, CACHE_SECONDS);

  if (!limiter.tryTake()) return error('rate_limited', 429);

  const upstream = new URL(OFF_SEARCH_URL);
  upstream.searchParams.set('q', q);
  upstream.searchParams.set('langs', langs);
  upstream.searchParams.set('page_size', String(PAGE_SIZE));
  upstream.searchParams.set('fields', OFF_FIELDS.join(','));
  try {
    const data = await fetchJson<{ hits?: OffProduct[] }>(upstream.toString(), {
      headers: { 'user-agent': userAgent(), accept: 'application/json' },
    });
    const foods = normalizeOffSearch(data);
    cache.set(key, foods);
    return json({ foods }, 200, CACHE_SECONDS);
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 429) return error('rate_limited', 429);
    return error('upstream_error', 502);
  }
}
