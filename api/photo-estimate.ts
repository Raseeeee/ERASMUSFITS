/**
 * POST /api/photo-estimate  { image: <JPEG en base64>, lang: "es" | "en" }
 * Estima los ingredientes, gramos y nutrientes de un plato a partir de una foto con Gemini.
 * La clave se lee de GEMINI_API_KEY en el servidor y nunca llega al cliente.
 * La foto no se guarda: se reenvía a la API y se descarta.
 */
import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { PHOTO_SCHEMA, sanitizeEstimate } from '../src/domain/photoEstimate.js';
import { RateLimiter, cleanLang, error, json } from './_lib/proxy.js';

/** Modelo por defecto (barato y con visión); se puede cambiar con GEMINI_MODEL sin tocar código. */
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
/** ~1,5 MB de base64 (el cliente reduce la foto a 1024 px antes de enviarla). */
const MAX_IMAGE_CHARS = 2_000_000;

// Coste y cuota controlados: límite por IP y límite global por instancia.
export const PER_IP_MAX = 10;
const PER_IP_WINDOW = 3_600_000;
export const globalLimiter = new RateLimiter(300, 3_600_000);
export const ipLimiters = new Map<string, RateLimiter>();

function ipAllowed(ip: string): boolean {
  let l = ipLimiters.get(ip);
  if (!l) {
    if (ipLimiters.size > 5000) ipLimiters.clear();
    l = new RateLimiter(PER_IP_MAX, PER_IP_WINDOW);
    ipLimiters.set(ip, l);
  }
  return l.tryTake();
}

const LANG_NAME: Record<string, string> = { es: 'Spanish', en: 'English' };

const SYSTEM = `You estimate the nutrition of a meal from a single photo for a calorie-tracking app.
List each distinct food or ingredient you can see as a separate item (for example: rice, chicken, salad, sauce, bread).
For each item give:
- name: short and generic, in the requested language (e.g. "Arroz blanco", "Pechuga de pollo a la plancha").
- grams: your best estimate of the edible weight on the plate, using the plate, cutlery and hands for scale.
- state: "cooked" or "raw", as it appears.
- category: the closest one from the list.
- per100g: typical values per 100 g of that food as served (kcal, protein p, carbohydrates c, fat f, fiber, free sugars sugar, salt in grams).
Include visible oil, dressings and sauces as their own items when they add meaningful calories.
Be realistic, not conservative: typical home or canteen portions. If the photo does not show food, return isFood false and no items.`;

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return error('not_configured', 503);
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  let body: { image?: unknown; lang?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return error('bad_request', 400);
  }
  const image = typeof body.image === 'string' ? body.image : '';
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) return error('bad_request', 400);
  const lang = cleanLang(typeof body.lang === 'string' ? body.lang : null);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!ipAllowed(ip) || !globalLimiter.tryTake()) return error('rate_limited', 429);

  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 50_000 } });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: image } },
            { text: `Language for names: ${LANG_NAME[lang] ?? 'English'}.` },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: PHOTO_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 4096,
      },
    });
    const text = response.text;
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const estimate = sanitizeEstimate(parsed);
    if (!estimate) return error('upstream_error', 502);
    return json(estimate);
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return error('rate_limited', 429);
    return error('upstream_error', 502);
  }
}
