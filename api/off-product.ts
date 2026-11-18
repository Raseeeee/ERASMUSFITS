/**
 * GET /api/off-product?barcode=8402001012051
 * Producto de Open Food Facts por código de barras. Devuelve `{ food: Food }`.
 */
import { OFF_FIELDS, isBarcode, normalizeOffProduct, type OffProduct } from '../src/domain/external';
import type { Food } from '../src/domain/foods';
import { RateLimiter, TtlCache, UpstreamError, error, fetchJson, json, userAgent } from './_lib/proxy';

export const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const CACHE_SECONDS = 7 * 86_400;

// OFF: máx. 15 lecturas de producto/min por IP; dejamos margen.
export const limiter = new RateLimiter(12, 60_000);
/** `null` = no encontrado o sin macros (también se cachea). */
export const cache = new TtlCache<Food | null>(CACHE_SECONDS * 1000);

export async function GET(request: Request): Promise<Response> {
  const barcode = new URL(request.url).searchParams.get('barcode')?.trim() ?? '';
  if (!isBarcode(barcode)) return error('bad_request', 400);

  const cached = cache.get(barcode);
  if (cached !== undefined) {
    return cached ? json({ food: cached, cached: true }, 200, CACHE_SECONDS) : error('not_found', 404);
  }

  if (!limiter.tryTake()) return error('rate_limited', 429);

  const upstream = `${OFF_PRODUCT_URL}${barcode}?fields=${OFF_FIELDS.join(',')}`;
  try {
    const data = await fetchJson<{ status?: number; product?: OffProduct }>(upstream, {
      headers: { 'user-agent': userAgent(), accept: 'application/json' },
    });
    const food = data.status === 1 && data.product ? normalizeOffProduct({ code: barcode, ...data.product }) : null;
    cache.set(barcode, food);
    return food ? json({ food }, 200, CACHE_SECONDS) : error('not_found', 404);
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 404) {
      cache.set(barcode, null);
      return error('not_found', 404);
    }
    if (e instanceof UpstreamError && e.status === 429) return error('rate_limited', 429);
    return error('upstream_error', 502);
  }
}
