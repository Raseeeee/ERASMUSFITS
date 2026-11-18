/**
 * Búsqueda en fuentes externas con caché en IndexedDB. Nunca lanza: devuelve un
 * estado por fuente para que la UI explique qué ha pasado.
 *
 * - Open Food Facts: **directamente desde el navegador** (cada usuario usa su propia
 *   IP y su propio cupo de OFF: 10 búsquedas/min y 15 productos/min). Se usan los
 *   endpoints que permiten CORS (`cgi/search.pl` y `api/v2/product`). El navegador no
 *   deja fijar User-Agent, así que la app se identifica con `app_name`/`app_version`.
 * - USDA: a través del proxy `/api/usda-search` (necesita la API key, que no puede
 *   estar en el navegador).
 */
import { APP_ID, APP_VERSION } from '../config/app';
import { OFF_FIELDS, isBarcode, normalizeOffProduct, normalizeOffSearch, toEnglishQuery, type OffProduct } from '../domain/external';
import { normalize, type Food } from '../domain/foods';
import { RateLimiter } from '../domain/rateLimit';
import { db } from './db';

export type ExternalSource = 'off' | 'usda';
export type ExternalStatus = 'ok' | 'offline' | 'rate_limited' | 'not_configured' | 'not_found' | 'error';

export interface ExternalResult {
  source: ExternalSource;
  status: ExternalStatus;
  foods: Food[];
  fromCache?: boolean;
}

export const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
export const OFF_BASE = 'https://world.openfoodfacts.org';
const OFF_PAGE_SIZE = 20;

/** Cupos de OFF por IP; como cada navegador llama directamente, se aplican por usuario. */
export const offSearchLimiter = new RateLimiter(10, 60_000);
export const offProductLimiter = new RateLimiter(15, 60_000);

type Fetch = typeof fetch;
type Opts = { fetchImpl: Fetch; online: boolean; now: number };

function statusFrom(code: number): ExternalStatus {
  if (code === 429) return 'rate_limited';
  if (code === 503) return 'not_configured';
  if (code === 404) return 'not_found';
  return 'error';
}

/** Parámetros con los que la app se identifica ante OFF. */
function offIdentity(): Record<string, string> {
  return { app_name: APP_ID, app_version: APP_VERSION };
}

export function offSearchUrl(q: string, lang: string): string {
  const u = new URL('/cgi/search.pl', OFF_BASE);
  const params = {
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(OFF_PAGE_SIZE),
    lc: lang,
    fields: OFF_FIELDS.join(','),
    ...offIdentity(),
  };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export function offProductUrl(barcode: string): string {
  const u = new URL(`/api/v2/product/${barcode}`, OFF_BASE);
  u.searchParams.set('fields', OFF_FIELDS.join(','));
  for (const [k, v] of Object.entries(offIdentity())) u.searchParams.set(k, v);
  return u.toString();
}

async function cached(key: string, now: number): Promise<Food[] | null> {
  const row = await db.foodCache.get(key);
  return row && now - row.fetchedAt < CACHE_TTL_MS ? row.foods : null;
}

async function fetchFoods(
  source: ExternalSource,
  key: string,
  url: string,
  parse: (body: unknown) => Food[] | 'not_found',
  opts: Opts,
  limiter?: RateLimiter,
): Promise<ExternalResult> {
  const hit = await cached(key, opts.now);
  if (hit) return { source, status: 'ok', foods: hit, fromCache: true };
  if (!opts.online) return { source, status: 'offline', foods: [] };
  if (limiter && !limiter.tryTake()) return { source, status: 'rate_limited', foods: [] };
  try {
    const res = await opts.fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { source, status: statusFrom(res.status), foods: [] };
    const foods = parse(await res.json());
    if (foods === 'not_found') {
      await db.foodCache.put({ key, foods: [], fetchedAt: opts.now });
      return { source, status: 'not_found', foods: [] };
    }
    await db.foodCache.put({ key, foods, fetchedAt: opts.now });
    return { source, status: 'ok', foods };
  } catch {
    return { source, status: opts.online ? 'error' : 'offline', foods: [] };
  }
}

/**
 * Busca en OFF (texto o código de barras) y en USDA (traduciendo al inglés con
 * los alias de la semilla). USDA no se consulta para códigos de barras.
 */
export async function searchExternal(
  query: string,
  lang: string,
  aliasFoods: Food[],
  opts: Partial<Opts> = {},
): Promise<ExternalResult[]> {
  const o: Opts = {
    fetchImpl: opts.fetchImpl ?? ((...a: Parameters<Fetch>) => fetch(...a)),
    online: opts.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine),
    now: opts.now ?? Date.now(),
  };
  const q = query.trim();
  if (isBarcode(q)) {
    return [
      await fetchFoods(
        'off',
        `off:barcode:${q}`,
        offProductUrl(q),
        (b) => {
          const body = b as { status?: number; product?: OffProduct };
          const food = body.status === 1 && body.product ? normalizeOffProduct({ code: q, ...body.product }) : null;
          return food ? [food] : 'not_found';
        },
        o,
        offProductLimiter,
      ),
    ];
  }
  const en = toEnglishQuery(q, aliasFoods);
  return Promise.all([
    fetchFoods(
      'off',
      `off:${lang}:${normalize(q)}`,
      offSearchUrl(q, lang),
      (b) => normalizeOffSearch(b as { products?: OffProduct[] }),
      o,
      offSearchLimiter,
    ),
    fetchFoods(
      'usda',
      `usda:${normalize(en)}`,
      `/api/usda-search?q=${encodeURIComponent(en)}`,
      (b) => (b as { foods?: Food[] }).foods ?? [],
      o,
    ),
  ]);
}

export async function clearFoodCache(): Promise<void> {
  await db.foodCache.clear();
}
