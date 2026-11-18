/**
 * Normalización de Open Food Facts y USDA FoodData Central al esquema `Food`
 * (por 100 g). Lógica pura: la usan tanto el proxy serverless como el cliente.
 */
import { kcalFromMacros, normalize, type Food, type FoodCategory, type LocalizedText } from './foods';

const KJ_PER_KCAL = 4.184;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

// ---- Open Food Facts --------------------------------------------------------

export interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  countries_tags?: string[];
  nutriments?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Campos que pedimos a OFF (búsqueda y producto). */
export const OFF_FIELDS = [
  'code', 'product_name', 'product_name_es', 'product_name_en', 'product_name_it', 'product_name_de',
  'product_name_pl', 'product_name_tr', 'brands', 'countries_tags', 'nutriments',
];

const OFF_COUNTRY_TAGS: Record<string, string> = {
  'en:spain': 'ES', 'en:italy': 'IT', 'en:germany': 'DE', 'en:poland': 'PL', 'en:turkey': 'TR',
  'en:france': 'FR', 'en:portugal': 'PT', 'en:united-kingdom': 'GB', 'en:united-states': 'US',
};

const LANGS = ['es', 'en', 'it', 'de', 'pl', 'tr'] as const;

/**
 * Convierte un producto OFF a `Food`. Devuelve null si faltan kcal o algún
 * macro principal (SPEC §5: descartar resultados sin kcal/macros).
 */
export function normalizeOffProduct(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const prot = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (!p.code || prot === undefined || carbs === undefined || fat === undefined) return null;
  const kj = num(n.energy_100g) ?? num(n['energy-kj_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / KJ_PER_KCAL : undefined);
  if (kcal === undefined) return null;
  if (prot + carbs + fat > 101) return null; // dato incoherente

  const fiber = num(n.fiber_100g);
  const sugar = num(n.sugars_100g);
  const salt = num(n.salt_100g) ?? (num(n.sodium_100g) !== undefined ? num(n.sodium_100g)! * 2.5 : undefined);

  const fallback = String(p.product_name ?? '').trim();
  const names = {} as LocalizedText;
  for (const l of LANGS) {
    const v = String(p[`product_name_${l}`] ?? '').trim();
    if (v) names[l] = v;
  }
  names.es = names.es || fallback || names.en || '';
  names.en = names.en || fallback || names.es || '';
  if (!names.es) return null;

  const brandsList = Array.isArray(p.brands) ? p.brands : String(p.brands ?? '').split(',');
  const brand = brandsList.map((b) => b.trim()).filter(Boolean)[0];
  const countries = (p.countries_tags ?? []).map((c) => OFF_COUNTRY_TAGS[c]).filter(Boolean);

  const complete = fiber !== undefined && sugar !== undefined && salt !== undefined;
  const food: Food = {
    id: `off:${p.code}`,
    names,
    per100g: {
      kcal: Math.round(kcal),
      p: r1(prot),
      c: r1(carbs),
      f: r1(fat),
      fiber: r1(fiber ?? 0),
      sugar: r1(Math.min(sugar ?? 0, carbs)),
      salt: r2(salt ?? 0),
    },
    state: 'raw',
    unit: null,
    category: 'other',
    source: 'off',
    barcode: p.code,
    quality: complete ? 'complete' : 'incomplete',
    sugarIsTotal: true,
  };
  if (brand) food.brand = brand;
  if (countries.length) food.countries = countries;
  return food;
}

export function normalizeOffSearch(res: { hits?: OffProduct[] }): Food[] {
  return (res.hits ?? []).map(normalizeOffProduct).filter((f): f is Food => f !== null);
}

/** Códigos de barras EAN-8, UPC-A (12), EAN-13 o GTIN-14. */
export function isBarcode(q: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(q.trim());
}

// ---- USDA FoodData Central --------------------------------------------------

export interface UsdaNutrient {
  nutrientId: number;
  unitName?: string;
  value?: number;
}

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  foodCategory?: string;
  foodNutrients: UsdaNutrient[];
}

export const USDA_NUTRIENTS = {
  energyKcal: 1008,
  energyAtwaterGeneral: 2047,
  energyAtwaterSpecific: 2048,
  protein: 1003,
  fat: 1004,
  carbsByDifference: 1005,
  fiber: 1079,
  sugars: 2000,
  sodium: 1093,
} as const;

const COOKED_RE = /\b(cooked|roasted|boiled|baked|grilled|fried|braised|steamed|microwaved|stewed|broiled|poached)\b/i;

const USDA_CATEGORIES: [RegExp, FoodCategory][] = [
  [/poultry|beef|pork|lamb|veal|game|sausages|luncheon/i, 'meat'],
  [/finfish|shellfish/i, 'fish'],
  [/egg/i, 'egg'],
  [/legume/i, 'legume'],
  [/cereal grains|pasta/i, 'grain'],
  [/baked products/i, 'bread'],
  [/vegetable/i, 'vegetable'],
  [/fruit/i, 'fruit'],
  [/dairy/i, 'dairy'],
  [/fats and oils/i, 'fat'],
  [/nut and seed/i, 'nuts'],
  [/sweets/i, 'sweet'],
];

export function usdaCategory(foodCategory: string | undefined): FoodCategory {
  if (!foodCategory) return 'other';
  return USDA_CATEGORIES.find(([re]) => re.test(foodCategory))?.[1] ?? 'other';
}

/**
 * Convierte un alimento USDA a `Food`. USDA da carbohidratos "por diferencia"
 * (incluyen fibra): se resta la fibra para usar carbohidratos disponibles (UE).
 * Sodio (mg) → sal (g) × 2.5.
 */
export function normalizeUsdaFood(u: UsdaFood): Food | null {
  const get = (id: number) => {
    const v = u.foodNutrients.find((x) => x.nutrientId === id)?.value;
    return num(v);
  };
  const prot = get(USDA_NUTRIENTS.protein);
  const fat = get(USDA_NUTRIENTS.fat);
  const carbsDiff = get(USDA_NUTRIENTS.carbsByDifference);
  if (prot === undefined || fat === undefined || carbsDiff === undefined) return null;
  const fiber = get(USDA_NUTRIENTS.fiber) ?? 0;
  const carbs = Math.max(0, carbsDiff - fiber);
  const sodiumMg = get(USDA_NUTRIENTS.sodium);
  const kcal =
    get(USDA_NUTRIENTS.energyKcal) ??
    get(USDA_NUTRIENTS.energyAtwaterSpecific) ??
    get(USDA_NUTRIENTS.energyAtwaterGeneral) ??
    kcalFromMacros({ p: prot, c: carbs, f: fat, fiber });

  const name = u.description.trim();
  return {
    id: `usda:${u.fdcId}`,
    names: { es: name, en: name },
    per100g: {
      kcal: Math.round(kcal),
      p: r1(prot),
      c: r1(carbs),
      f: r1(fat),
      fiber: r1(fiber),
      sugar: r1(Math.min(get(USDA_NUTRIENTS.sugars) ?? 0, carbs)),
      salt: r2(((sodiumMg ?? 0) * 2.5) / 1000),
    },
    state: COOKED_RE.test(name) ? 'cooked' : 'raw',
    unit: null,
    category: usdaCategory(u.foodCategory),
    source: 'usda',
    quality: 'complete',
    sugarIsTotal: true,
  };
}

export function normalizeUsdaSearch(res: { foods?: UsdaFood[] }): Food[] {
  return (res.foods ?? []).map(normalizeUsdaFood).filter((f): f is Food => f !== null);
}

// ---- Traducción con la tabla de alias --------------------------------------

/**
 * USDA solo está en inglés: si la búsqueda coincide con un alias de la semilla
 * (en cualquier idioma), usamos su nombre en inglés.
 */
export function toEnglishQuery(query: string, foods: Food[]): string {
  const q = normalize(query);
  if (q.length < 3) return query.trim();
  let best: { food: Food; score: number } | null = null;
  for (const f of foods) {
    for (const [lang, name] of Object.entries(f.names)) {
      if (lang === 'en') continue;
      const n = normalize(name);
      const score = n === q ? 0 : n.startsWith(q) ? 1 : -1;
      if (score >= 0 && (!best || score < best.score)) best = { food: f, score };
    }
  }
  return best ? best.food.names.en : query.trim();
}

// ---- Orden de resultados externos -------------------------------------------

const QUALITY_RANK = { curated: 0, complete: 1, incomplete: 2 } as const;
const EXTERNAL_SOURCE_RANK: Record<string, number> = { off: 0, usda: 1 };

/**
 * Une y ordena resultados de OFF y USDA: calidad (completo > incompleto),
 * luego productos vendidos en el país activo, luego OFF antes que USDA.
 * Quita duplicados y los que ya están en `excludeIds` (p. ej. corregidos por mí).
 */
export function rankExternal(lists: Food[][], country?: string, excludeIds: Set<string> = new Set()): Food[] {
  const seen = new Set<string>();
  const all: Food[] = [];
  for (const f of lists.flat()) {
    if (seen.has(f.id) || excludeIds.has(f.id)) continue;
    seen.add(f.id);
    all.push(f);
  }
  const local = (f: Food) => (country && f.countries?.includes(country) ? 0 : 1);
  return all
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) =>
        QUALITY_RANK[a.f.quality ?? 'incomplete'] - QUALITY_RANK[b.f.quality ?? 'incomplete'] ||
        local(a.f) - local(b.f) ||
        (EXTERNAL_SOURCE_RANK[a.f.source] ?? 9) - (EXTERNAL_SOURCE_RANK[b.f.source] ?? 9) ||
        a.i - b.i,
    )
    .map((x) => x.f);
}
