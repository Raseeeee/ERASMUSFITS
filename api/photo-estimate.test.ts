// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as photo from './photo-estimate.js';

const fetchMock = vi.fn();
const post = (body: unknown, ip = '1.1.1.1') =>
  new Request('http://x/api/photo-estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const IMG = 'aGVsbG8=';
const estimate = {
  isFood: true,
  items: [
    { name: 'Arroz', grams: 150, state: 'cooked', category: 'grain',
      per100g: { kcal: 130, p: 2.7, c: 28, f: 0.3, fiber: 0.4, sugar: 0, salt: 0 } },
  ],
};
const geminiReply = (text: string, finishReason = 'STOP') =>
  new Response(
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('GEMINI_MODEL', '');
  photo.globalLimiter.reset();
  photo.ipLimiters.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('/api/photo-estimate', () => {
  it('503 sin clave configurada', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await photo.POST(post({ image: IMG }))).status).toBe(503);
  });

  it('400 con cuerpo o imagen inválidos', async () => {
    expect((await photo.POST(post('no-json'))).status).toBe(400);
    expect((await photo.POST(post({ image: 'no<base64>' }))).status).toBe(400);
    expect((await photo.POST(post({ image: 'A'.repeat(2_000_001) }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve la estimación saneada y manda la foto como imagen JPEG', async () => {
    fetchMock.mockResolvedValueOnce(geminiReply(JSON.stringify(estimate)));
    const res = await photo.POST(post({ image: IMG, lang: 'es' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(estimate);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain(`models/${photo.DEFAULT_MODEL}:generateContent`);
    const sent = JSON.parse(String(init.body));
    expect(sent.contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: IMG });
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
  });

  it('502 si la IA no responde o devuelve algo inválido', async () => {
    fetchMock.mockResolvedValueOnce(geminiReply('', 'SAFETY'));
    expect((await photo.POST(post({ image: IMG }))).status).toBe(502);
    fetchMock.mockResolvedValueOnce(geminiReply('{"nope":1}'));
    expect((await photo.POST(post({ image: IMG }))).status).toBe(502);
    fetchMock.mockResolvedValueOnce(geminiReply('no es json'));
    expect((await photo.POST(post({ image: IMG }))).status).toBe(502);
  });

  it('429 de Gemini (cuota agotada) → rate_limited', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 429, message: 'quota', status: 'RESOURCE_EXHAUSTED' } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect((await photo.POST(post({ image: IMG }))).status).toBe(429);
  });

  it('limita las peticiones por IP', async () => {
    fetchMock.mockImplementation(async () => geminiReply(JSON.stringify(estimate)));
    for (let i = 0; i < photo.PER_IP_MAX; i++) expect((await photo.POST(post({ image: IMG }))).status).toBe(200);
    expect((await photo.POST(post({ image: IMG }))).status).toBe(429);
    expect((await photo.POST(post({ image: IMG }, '2.2.2.2'))).status).toBe(200);
  });
});
