import { beforeEach, describe, expect, it, vi } from 'vitest';
import offFixture from '../domain/__fixtures__/off-search.json';
import { seedFoods } from '../data/foods';
import type { Food } from '../domain/foods';
import {
  CACHE_TTL_MS,
  clearFoodCache,
  offProductLimiter,
  offSearchLimiter,
  offSearchUrl,
  searchExternal,
} from './externalFoods';

const usdaFood: Food = {
  id: 'usda:1', names: { es: 'x', en: 'x' }, per100g: { kcal: 100, p: 1, c: 1, f: 1, fiber: 0, sugar: 0, salt: 0 },
  state: 'raw', unit: null, category: 'other', source: 'usda', quality: 'complete',
};
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
/** OFF (cgi/search.pl) responde con `products`. */
const offBody = { count: 4, products: offFixture.hits };

const router = (urls: string[] = []) =>
  vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    urls.push(u);
    if (u.startsWith('https://world.openfoodfacts.org/cgi/search.pl')) return ok(offBody);
    if (u.startsWith('https://world.openfoodfacts.org/api/v2/product/')) return ok({ status: 1, product: offFixture.hits[2] });
    return ok({ foods: [usdaFood] });
  });

describe('searchExternal', () => {
  beforeEach(async () => {
    await clearFoodCache();
    offSearchLimiter.reset();
    offProductLimiter.reset();
  });

  it('OFF directo desde el navegador (identificado) y USDA por el proxy traducido con alias', async () => {
    const urls: string[] = [];
    const r = await searchExternal('pechuga de pollo', 'es', seedFoods, { fetchImpl: router(urls), online: true });
    expect(r.map((x) => [x.source, x.status, x.foods.length])).toEqual([['off', 'ok', 4], ['usda', 'ok', 1]]);
    const off = new URL(urls[0]);
    expect(off.origin).toBe('https://world.openfoodfacts.org');
    expect(off.pathname).toBe('/cgi/search.pl');
    expect(off.searchParams.get('search_terms')).toBe('pechuga de pollo');
    expect(off.searchParams.get('lc')).toBe('es');
    expect(off.searchParams.get('app_name')).toBe('InternationalFits');
    expect(off.searchParams.get('json')).toBe('1');
    expect(urls[1]).toBe('/api/usda-search?q=Chicken%20breast');
  });

  it('URL de búsqueda incluye los campos necesarios', () => {
    expect(new URL(offSearchUrl('pan', 'en')).searchParams.get('fields')).toContain('nutriments');
  });

  it('usa la caché de IndexedDB y funciona offline con lo cacheado', async () => {
    const fetchImpl = router();
    await searchExternal('yogur', 'es', seedFoods, { fetchImpl, online: true, now: 1000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const again = await searchExternal('Yogur ', 'es', seedFoods, { fetchImpl, online: false, now: 2000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(again.every((x) => x.status === 'ok' && x.fromCache)).toBe(true);
  });

  it('la caché caduca a los 7 días', async () => {
    const fetchImpl = router();
    await searchExternal('pan', 'es', seedFoods, { fetchImpl, online: true, now: 0 });
    await searchExternal('pan', 'es', seedFoods, { fetchImpl, online: true, now: CACHE_TTL_MS + 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('respeta el cupo de OFF por usuario (10 búsquedas/min) sin llamar a OFF', async () => {
    const urls: string[] = [];
    const fetchImpl = router(urls);
    for (let i = 0; i < 10; i++) await searchExternal(`busqueda ${i}`, 'es', seedFoods, { fetchImpl, online: true });
    const r = await searchExternal('otra mas', 'es', seedFoods, { fetchImpl, online: true });
    expect(r[0]).toMatchObject({ source: 'off', status: 'rate_limited' });
    expect(urls.filter((u) => u.includes('openfoodfacts')).length).toBe(10);
    expect(r[1].status).toBe('ok'); // USDA sigue funcionando
  });

  it('offline sin caché, OFF 429 y USDA sin clave', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      new Response('{}', { status: String(url).includes('openfoodfacts') ? 429 : 503 }),
    );
    expect((await searchExternal('arroz', 'es', seedFoods, { fetchImpl, online: false })).map((x) => x.status))
      .toEqual(['offline', 'offline']);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await searchExternal('arroz', 'es', seedFoods, { fetchImpl, online: true })).map((x) => x.status))
      .toEqual(['rate_limited', 'not_configured']);
  });

  it('código de barras: producto de OFF directo; no encontrado se cachea', async () => {
    const urls: string[] = [];
    const r = await searchExternal('8402001012051', 'es', seedFoods, { fetchImpl: router(urls), online: true });
    expect(r).toHaveLength(1);
    expect(r[0].foods[0]).toMatchObject({ id: 'off:8402001012051', brand: 'Hacendado' });
    expect(urls[0]).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8402001012051\?/);

    const missing = vi.fn(async (_u: RequestInfo | URL) => ok({ status: 0 }));
    expect((await searchExternal('12345678', 'es', seedFoods, { fetchImpl: missing, online: true }))[0].status).toBe('not_found');
    await searchExternal('12345678', 'es', seedFoods, { fetchImpl: missing, online: true });
    expect(missing).toHaveBeenCalledTimes(1);
  });
});
