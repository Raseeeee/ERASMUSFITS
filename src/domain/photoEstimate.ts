/**
 * Estimación de un plato a partir de una foto. Lógica pura: esquema que se pide a la IA,
 * saneado de su respuesta y conversión de cada ingrediente a un `Food` registrable.
 */
import { FOOD_CATEGORIES, type Food, type FoodCategory, type Nutrients } from './foods.js';

/** Ingrediente tal como lo devuelve la IA (por 100 g, más los gramos estimados en el plato). */
export interface PhotoItem {
  name: string;
  grams: number;
  state: 'raw' | 'cooked';
  category: FoodCategory;
  per100g: Nutrients;
}

export interface PhotoEstimate {
  /** false si la foto no muestra comida. */
  isFood: boolean;
  items: PhotoItem[];
}

const NUTRIENT_KEYS = ['kcal', 'p', 'c', 'f', 'fiber', 'sugar', 'salt'] as const;
const num = { type: 'number' } as const;

/** JSON Schema para las salidas estructuradas de la API (todas las claves obligatorias). */
export const PHOTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isFood', 'items'],
  properties: {
    isFood: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'state', 'category', 'per100g'],
        properties: {
          name: { type: 'string' },
          grams: num,
          state: { type: 'string', enum: ['raw', 'cooked'] },
          category: { type: 'string', enum: [...FOOD_CATEGORIES] },
          per100g: {
            type: 'object',
            additionalProperties: false,
            required: [...NUTRIENT_KEYS],
            properties: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num])),
          },
        },
      },
    },
  },
} as const;

/** Límites físicos por 100 g: lo que esté fuera se recorta. */
const MAX_PER_100G: Nutrients = { kcal: 900, p: 100, c: 100, f: 100, fiber: 60, sugar: 100, salt: 40 };
export const MAX_ITEMS = 12;
export const MAX_ITEM_GRAMS = 1500;

const clamp = (v: unknown, max: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(Math.max(n, 0), max);
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Sanea la respuesta de la IA: descarta ingredientes sin nombre o sin gramos,
 * recorta valores imposibles y hace que las kcal cuadren con los macros si se alejan mucho.
 * Devuelve null si la forma no es la esperada.
 */
export function sanitizeEstimate(raw: unknown): PhotoEstimate | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.isFood !== 'boolean' || !Array.isArray(o.items)) return null;
  const items: PhotoItem[] = [];
  for (const it of o.items.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') continue;
    const i = it as Record<string, unknown>;
    const name = typeof i.name === 'string' ? i.name.trim().slice(0, 60) : '';
    const grams = Math.round(clamp(i.grams, MAX_ITEM_GRAMS));
    if (!name || grams <= 0) continue;
    const src = (i.per100g ?? {}) as Record<string, unknown>;
    const n = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, r1(clamp(src[k], MAX_PER_100G[k]))])) as unknown as Nutrients;
    // Los macros no pueden sumar más de 100 g por 100 g.
    const total = n.p + n.c + n.f;
    if (total > 100) {
      const k = 100 / total;
      n.p = r1(n.p * k);
      n.c = r1(n.c * k);
      n.f = r1(n.f * k);
    }
    const fromMacros = Math.round(n.p * 4 + n.c * 4 + n.f * 9);
    if (Math.abs(n.kcal - fromMacros) > Math.max(25, fromMacros * 0.25)) n.kcal = fromMacros;
    n.kcal = Math.round(n.kcal);
    items.push({
      name,
      grams,
      state: i.state === 'raw' ? 'raw' : 'cooked',
      category: (FOOD_CATEGORIES as readonly string[]).includes(i.category as string)
        ? (i.category as FoodCategory)
        : 'other',
      per100g: n,
    });
  }
  return { isFood: o.isFood && items.length > 0, items };
}

/**
 * Convierte un ingrediente estimado en un `Food` (fuente "mine", calidad aproximada).
 * El nombre viene en el idioma del usuario y se copia a todos los idiomas.
 */
export function photoItemToFood(item: PhotoItem, id: string): Food {
  return {
    id,
    names: { es: item.name, en: item.name },
    per100g: item.per100g,
    state: item.state,
    unit: null,
    category: item.category,
    // La foto ya muestra el plato tal cual: no se suma grasa de cafetería otra vez.
    canteenExtraFatPer100g: 0,
    source: 'mine',
    quality: 'incomplete',
  };
}
