// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import offFixture from '../src/domain/__fixtures__/off-search.json';
import usdaFixture from '../src/domain/__fixtures__/usda-search.json';
import { RateLimiter, TtlCache, cleanQuery, userAgent } from './_lib/proxy';
import * as offSearch from './off-search';
import * as offProduct from './off-product';
import * as usdaSearch from './usda-search';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  for (const m of [offSearch, offProduct, usdaSearch]) {
    m.cache.clear();
    m.limiter.reset();
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('utilidades', () => {
  it('TtlCache caduca y respeta el máximo', () => {
    let now = 0;
    const c = new TtlCache<number>(1000, 2, () => now);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // expulsa 'a'
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    now = 1001;
    expect(c.get('b')).toBeUndefined();
  });
  it('RateLimiter de ventana deslizante', () => {
    let now = 0;
    const l = new RateLimiter(2, 1000, () => now);
    expect(l.tryTake()).toBe(true);
    expect(l.tryTake()).toBe(true);
    expect(l.tryTake()).toBe(false);
    now = 1000;
    expect(l.tryTake()).toBe(true);
  });
  it('limpia la consulta', () => {
    expect(cleanQuery('  yogur   griego ')).toBe('yogur griego');
    expect(cleanQuery('a')).toBeNull();
    expect(cleanQuery(null)).toBeNull();
  });
  it('User-Agent identificable, contacto opcional por entorno', () => {
    expect(userAgent({})).toBe('ErasmusEats/0.1');
    expect(userAgent({ OFF_CONTACT: 'app@example.com' })).toBe('ErasmusEats/0.1 (app@example.com)');
  });
});

describe('GET /api/off-search', () => {
  it('400 sin consulta válida', async () => {
    expect((await offSearch.GET(new Request('http://x/api/off-search?q=a'))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('llama a Search-a-licious con User-Agent y devuelve alimentos normalizados', async () => {
    fetchMock.mockResolvedValueOnce(ok(offFixture));
    const res = await offSearch.GET(new Request('http://x/api/off-search?q=yogur%20griego&lang=es'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=');
    const body = await res.json();
    expect(body.foods).toHaveLength(4);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('search.openfoodfacts.org/search');
    expect(String(url)).toContain('langs=es%2Cen');
    expect(init.headers['user-agent']).toMatch(/^ErasmusEats\//);
  });

  it('segunda búsqueda igual sale de caché', async () => {
    fetchMock.mockResolvedValueOnce(ok(offFixture));
    await offSearch.GET(new Request('http://x/api/off-search?q=Yogur&lang=es'));
    const res = await offSearch.GET(new Request('http://x/api/off-search?q=yogur&lang=es'));
    expect((await res.json()).cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429 al superar 10 búsquedas/min sin llamar a OFF', async () => {
    fetchMock.mockImplementation(async () => ok({ hits: [] }));
    for (let i = 0; i < 10; i++) await offSearch.GET(new Request(`http://x/api/off-search?q=q${i}x`));
    const res = await offSearch.GET(new Request('http://x/api/off-search?q=otra'));
    expect(res.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('502 si OFF falla', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect((await offSearch.GET(new Request('http://x/api/off-search?q=pan'))).status).toBe(502);
  });
});

describe('GET /api/off-product', () => {
  it('400 si no es código de barras', async () => {
    expect((await offProduct.GET(new Request('http://x/api/off-product?barcode=abc'))).status).toBe(400);
  });
  it('producto encontrado', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 1, product: offFixture.hits[2] }));
    const res = await offProduct.GET(new Request('http://x/api/off-product?barcode=8402001012051'));
    expect(res.status).toBe(200);
    expect((await res.json()).food.brand).toBe('Hacendado');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/product/8402001012051');
  });
  it('404 cacheado si no existe', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 0 }));
    expect((await offProduct.GET(new Request('http://x/api/off-product?barcode=12345678'))).status).toBe(404);
    expect((await offProduct.GET(new Request('http://x/api/off-product?barcode=12345678'))).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/usda-search', () => {
  it('503 si no hay clave configurada', async () => {
    vi.stubEnv('USDA_API_KEY', '');
    expect((await usdaSearch.GET(new Request('http://x/api/usda-search?q=chicken'))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía la clave en cabecera, nunca en la URL ni en la respuesta', async () => {
    vi.stubEnv('USDA_API_KEY', 'secret-test-key');
    fetchMock.mockResolvedValueOnce(ok(usdaFixture));
    const res = await usdaSearch.GET(new Request('http://x/api/usda-search?q=chicken%20breast'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('secret-test-key');
    expect(JSON.parse(text).foods[0].source).toBe('usda');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('secret-test-key');
    expect(String(url)).toContain('dataType=Foundation%2CSR+Legacy');
    expect(init.headers['x-api-key']).toBe('secret-test-key');
  });
});
