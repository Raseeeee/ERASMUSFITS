/**
 * GET /api/usda-search?q=chicken breast
 * Alimentos genéricos de USDA FoodData Central (Foundation + SR Legacy).
 * La API key se lee de USDA_API_KEY en el servidor y nunca llega al cliente.
 * El cliente traduce la búsqueda al inglés con la tabla de alias antes de llamar.
 */
import { normalizeUsdaSearch, type UsdaFood } from '../src/domain/external.js';
import type { Food } from '../src/domain/foods.js';
import { RateLimiter, TtlCache, UpstreamError, cleanQuery, error, fetchJson, json } from './_lib/proxy.js';

export const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const PAGE_SIZE = 15;
const CACHE_SECONDS = 30 * 86_400; // datos genéricos: cambian muy poco

// USDA: 1000 peticiones/hora por clave/IP; dejamos margen.
export const limiter = new RateLimiter(900, 3_600_000);
export const cache = new TtlCache<Food[]>(CACHE_SECONDS * 1000);

export async function GET(request: Request): Promise<Response> {
  const key = process.env.USDA_API_KEY?.trim();
  if (!key) return error('not_configured', 503);

  const q = cleanQuery(new URL(request.url).searchParams.get('q'));
  if (!q) return error('bad_request', 400);

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return json({ foods: cached, cached: true }, 200, CACHE_SECONDS);

  if (!limiter.tryTake()) return error('rate_limited', 429);

  const upstream = new URL(USDA_SEARCH_URL);
  upstream.searchParams.set('query', q);
  upstream.searchParams.set('dataType', 'Foundation,SR Legacy');
  upstream.searchParams.set('pageSize', String(PAGE_SIZE));
  try {
    // La clave va en cabecera (no en la URL) para que no aparezca en logs.
    const data = await fetchJson<{ foods?: UsdaFood[] }>(upstream.toString(), {
      headers: { 'x-api-key': key, accept: 'application/json' },
    });
    const foods = normalizeUsdaSearch(data);
    cache.set(cacheKey, foods);
    return json({ foods }, 200, CACHE_SECONDS);
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 429) return error('rate_limited', 429);
    return error('upstream_error', 502);
  }
}
