/**
 * Cliente del proxy `/api/*` con caché en IndexedDB. Nunca lanza: devuelve un
 * estado por fuente para que la UI explique qué ha pasado.
 */
import { isBarcode, toEnglishQuery } from '../domain/external';
import { normalize, type Food } from '../domain/foods';
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

type Fetch = typeof fetch;

function statusFrom(code: number): ExternalStatus {
  if (code === 429) return 'rate_limited';
  if (code === 503) return 'not_configured';
  if (code === 404) return 'not_found';
  return 'error';
}

async function cached(key: string, now: number): Promise<Food[] | null> {
  const row = await db.foodCache.get(key);
  return row && now - row.fetchedAt < CACHE_TTL_MS ? row.foods : null;
}

async function fetchFoods(
  source: ExternalSource,
  key: string,
  url: string,
  pick: (body: { foods?: Food[]; food?: Food }) => Food[],
  opts: { fetchImpl: Fetch; online: boolean; now: number },
): Promise<ExternalResult> {
  const hit = await cached(key, opts.now);
  if (hit) return { source, status: 'ok', foods: hit, fromCache: true };
  if (!opts.online) return { source, status: 'offline', foods: [] };
  try {
    const res = await opts.fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { source, status: statusFrom(res.status), foods: [] };
    const foods = pick(await res.json());
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
  opts: Partial<{ fetchImpl: Fetch; online: boolean; now: number }> = {},
): Promise<ExternalResult[]> {
  const o = {
    fetchImpl: opts.fetchImpl ?? ((...a: Parameters<Fetch>) => fetch(...a)),
    online: opts.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine),
    now: opts.now ?? Date.now(),
  };
  const q = query.trim();
  if (isBarcode(q)) {
    return [
      await fetchFoods('off', `off:barcode:${q}`, `/api/off-product?barcode=${q}`, (b) => (b.food ? [b.food] : []), o),
    ];
  }
  const en = toEnglishQuery(q, aliasFoods);
  return Promise.all([
    fetchFoods(
      'off',
      `off:${lang}:${normalize(q)}`,
      `/api/off-search?q=${encodeURIComponent(q)}&lang=${lang}`,
      (b) => b.foods ?? [],
      o,
    ),
    fetchFoods('usda', `usda:${normalize(en)}`, `/api/usda-search?q=${encodeURIComponent(en)}`, (b) => b.foods ?? [], o),
  ]);
}

export async function clearFoodCache(): Promise<void> {
  await db.foodCache.clear();
}
