import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedFoods } from '../data/foods';
import type { Food } from '../domain/foods';
import { CACHE_TTL_MS, clearFoodCache, searchExternal } from './externalFoods';

const food = (id: string, source: 'off' | 'usda'): Food => ({
  id, names: { es: id, en: id }, per100g: { kcal: 100, p: 1, c: 1, f: 1, fiber: 0, sugar: 0, salt: 0 },
  state: 'raw', unit: null, category: 'other', source, quality: 'complete',
});
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('searchExternal', () => {
  beforeEach(async () => {
    await clearFoodCache();
  });

  it('consulta OFF en el idioma y USDA traducido con alias', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      String(url).startsWith('/api/off') ? ok({ foods: [food('off:1', 'off')] }) : ok({ foods: [food('usda:1', 'usda')] }),
    );
    const r = await searchExternal('pechuga de pollo', 'es', seedFoods, { fetchImpl, online: true });
    expect(r.map((x) => [x.source, x.status, x.foods.length])).toEqual([['off', 'ok', 1], ['usda', 'ok', 1]]);
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe('/api/off-search?q=pechuga%20de%20pollo&lang=es');
    expect(urls[1]).toBe('/api/usda-search?q=Chicken%20breast');
  });

  it('usa la caché de IndexedDB y funciona offline con lo cacheado', async () => {
    const fetchImpl = vi.fn(async () => ok({ foods: [food('off:2', 'off')] }));
    await searchExternal('yogur', 'es', seedFoods, { fetchImpl, online: true, now: 1000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const again = await searchExternal('Yogur ', 'es', seedFoods, { fetchImpl, online: false, now: 2000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(again.every((x) => x.status === 'ok' && x.fromCache)).toBe(true);
  });

  it('la caché caduca a los 7 días', async () => {
    const fetchImpl = vi.fn(async () => ok({ foods: [] }));
    await searchExternal('pan', 'es', seedFoods, { fetchImpl, online: true, now: 0 });
    await searchExternal('pan', 'es', seedFoods, { fetchImpl, online: true, now: CACHE_TTL_MS + 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('offline sin caché, límites y clave no configurada', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      new Response('{}', { status: String(url).includes('off') ? 429 : 503 }),
    );
    expect((await searchExternal('arroz', 'es', seedFoods, { fetchImpl, online: false })).map((x) => x.status))
      .toEqual(['offline', 'offline']);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await searchExternal('arroz', 'es', seedFoods, { fetchImpl, online: true })).map((x) => x.status))
      .toEqual(['rate_limited', 'not_configured']);
  });

  it('código de barras: solo OFF producto', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL) => ok({ food: food('off:8402001012051', 'off') }));
    const r = await searchExternal('8402001012051', 'es', seedFoods, { fetchImpl, online: true });
    expect(r).toHaveLength(1);
    expect(r[0].foods[0].id).toBe('off:8402001012051');
    expect(String(fetchImpl.mock.calls[0][0])).toBe('/api/off-product?barcode=8402001012051');
  });
});
