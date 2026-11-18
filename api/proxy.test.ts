// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usdaFixture from '../src/domain/__fixtures__/usda-search.json';
import { RateLimiter, TtlCache, cleanQuery } from './_lib/proxy.js';
import * as usdaSearch from './usda-search.js';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  usdaSearch.cache.clear();
  usdaSearch.limiter.reset();
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
});

describe('GET /api/usda-search', () => {
  it('503 si no hay clave configurada', async () => {
    vi.stubEnv('USDA_API_KEY', '');
    expect((await usdaSearch.GET(new Request('http://x/api/usda-search?q=chicken'))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400 sin consulta válida', async () => {
    vi.stubEnv('USDA_API_KEY', 'k');
    expect((await usdaSearch.GET(new Request('http://x/api/usda-search?q=a'))).status).toBe(400);
  });

  it('envía la clave en cabecera, nunca en la URL ni en la respuesta', async () => {
    vi.stubEnv('USDA_API_KEY', 'secret-test-key');
    fetchMock.mockResolvedValueOnce(ok(usdaFixture));
    const res = await usdaSearch.GET(new Request('http://x/api/usda-search?q=chicken%20breast'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=');
    const text = await res.text();
    expect(text).not.toContain('secret-test-key');
    expect(JSON.parse(text).foods[0].source).toBe('usda');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('secret-test-key');
    expect(String(url)).toContain('dataType=Foundation%2CSR+Legacy');
    expect(init.headers['x-api-key']).toBe('secret-test-key');
  });

  it('caché: la misma búsqueda no vuelve a llamar a USDA', async () => {
    vi.stubEnv('USDA_API_KEY', 'k');
    fetchMock.mockResolvedValueOnce(ok(usdaFixture));
    await usdaSearch.GET(new Request('http://x/api/usda-search?q=Lentils'));
    const res = await usdaSearch.GET(new Request('http://x/api/usda-search?q=lentils'));
    expect((await res.json()).cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('502 si USDA falla y 429 si limita', async () => {
    vi.stubEnv('USDA_API_KEY', 'k');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect((await usdaSearch.GET(new Request('http://x/api/usda-search?q=rice'))).status).toBe(502);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }));
    expect((await usdaSearch.GET(new Request('http://x/api/usda-search?q=pasta'))).status).toBe(429);
  });
});
