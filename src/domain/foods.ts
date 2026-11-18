/** Alimentos: esquema, escalado por cantidad/contexto y búsqueda. Lógica pura. */

export const FOOD_CATEGORIES = [
  'meat', 'fish', 'egg', 'grain', 'pasta', 'bread', 'potato', 'legume', 'dairy', 'fruit',
  'vegetable', 'salad', 'fat', 'nuts', 'prepared', 'supplement', 'sweet', 'other',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export type FoodSource = 'mine' | 'seed' | 'off' | 'usda';
export type FoodState = 'raw' | 'cooked';
export type CookingContext = 'home' | 'canteen';

export interface Nutrients {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
  /** Azúcares libres (seed curada); en fuentes externas puede ser azúcares totales. */
  sugar: number;
  salt: number;
}

export interface LocalizedText {
  es: string;
  en: string;
  [lang: string]: string;
}

export interface Food {
  id: string;
  names: LocalizedText;
  per100g: Nutrients;
  state: FoodState;
  unit: { name: LocalizedText; grams: number } | null;
  category: FoodCategory;
  /** Si falta, se usa el valor por defecto de la categoría. */
  canteenExtraFatPer100g?: number;
  source: FoodSource;
  barcode?: string;
  /** Para alimentos "míos" que corrigen a otro: id del original (lo oculta en búsquedas). */
  overridesId?: string;
}

/**
 * Grasa extra (g por 100 g) que añade la cocina de cafetería/restaurante,
 * por categoría. Revisable; el usuario puede fijar su propio valor por alimento.
 */
export const CANTEEN_EXTRA_FAT: Record<FoodCategory, number> = {
  meat: 4,
  fish: 3,
  egg: 4,
  grain: 2,
  pasta: 3,
  bread: 0,
  potato: 5,
  legume: 3,
  dairy: 0,
  fruit: 0,
  vegetable: 5,
  salad: 6,
  fat: 0,
  nuts: 0,
  prepared: 0,
  supplement: 0,
  sweet: 0,
  other: 0,
};

export const KCAL_PER_G_FAT = 9;

export function kcalFromMacros(n: Pick<Nutrients, 'p' | 'c' | 'f' | 'fiber'>): number {
  return Math.round(4 * n.p + 4 * n.c + 9 * n.f + 2 * n.fiber);
}

export function canteenExtraFat(food: Food): number {
  return food.canteenExtraFatPer100g ?? CANTEEN_EXTRA_FAT[food.category];
}

export function gramsFor(food: Food, quantity: number, unit: 'g' | 'unit'): number {
  if (unit === 'unit' && food.unit) return quantity * food.unit.grams;
  return quantity;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Nutrientes para `grams` gramos. En cantina: grasa += extra·g/100 y las kcal
 * se recalculan sumando 9 kcal por gramo de grasa extra.
 */
export function nutrientsFor(food: Food, grams: number, context: CookingContext = 'home'): Nutrients {
  const k = grams / 100;
  const n = food.per100g;
  const extraFat = context === 'canteen' ? canteenExtraFat(food) * k : 0;
  return {
    kcal: Math.round(n.kcal * k + extraFat * KCAL_PER_G_FAT),
    p: r1(n.p * k),
    c: r1(n.c * k),
    f: r1(n.f * k + extraFat),
    fiber: r1(n.fiber * k),
    sugar: r1(n.sugar * k),
    salt: Math.round(n.salt * k * 100) / 100,
  };
}

export const ZERO: Nutrients = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, sugar: 0, salt: 0 };

export function sumNutrients(list: Nutrients[]): Nutrients {
  const s = list.reduce<Nutrients>(
    (a, n) => ({
      kcal: a.kcal + n.kcal,
      p: a.p + n.p,
      c: a.c + n.c,
      f: a.f + n.f,
      fiber: a.fiber + n.fiber,
      sugar: a.sugar + n.sugar,
      salt: a.salt + n.salt,
    }),
    ZERO,
  );
  return { ...s, kcal: Math.round(s.kcal), p: r1(s.p), c: r1(s.c), f: r1(s.f), fiber: r1(s.fiber), sugar: r1(s.sugar), salt: Math.round(s.salt * 100) / 100 };
}

export function foodName(food: Food, lang: string): string {
  return food.names[lang] ?? food.names.en ?? food.names.es;
}

/** Minúsculas, sin diacríticos; incluye letras turcas/polacas/alemanas. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

const SOURCE_RANK: Record<FoodSource, number> = { mine: 0, seed: 1, off: 2, usda: 3 };

function matchScore(name: string, q: string): number {
  const n = normalize(name);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[\s(),/-]+/).some((w) => w.startsWith(q))) return 2;
  if (n.includes(q)) return 3;
  return Infinity;
}

/**
 * Búsqueda local. Prioridad: coincidencia (exacta > prefijo > palabra > contiene),
 * luego fuente (mío > semilla > OFF > USDA). Los alimentos "míos" ocultan al que corrigen.
 * Con query vacía devuelve los míos primero y luego el resto en orden alfabético.
 */
export function searchFoods(query: string, foods: Food[], lang: string, limit = 30): Food[] {
  const overridden = new Set(foods.filter((f) => f.overridesId).map((f) => f.overridesId));
  const visible = foods.filter((f) => !overridden.has(f.id));
  const q = normalize(query);
  const scored = visible
    .map((f) => ({
      f,
      score: q ? Math.min(...Object.values(f.names).map((n) => matchScore(n, q))) : 0,
    }))
    .filter((x) => x.score !== Infinity);
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      SOURCE_RANK[a.f.source] - SOURCE_RANK[b.f.source] ||
      foodName(a.f, lang).localeCompare(foodName(b.f, lang), lang),
  );
  return scored.slice(0, limit).map((x) => x.f);
}

/** Construye un alimento "mío" a partir de macros por 100 g (kcal derivadas). */
export function makeMyFood(input: {
  id: string;
  name: string;
  p: number;
  c: number;
  f: number;
  fiber?: number;
  sugar?: number;
  salt?: number;
  state: FoodState;
  category?: FoodCategory;
  canteenExtraFatPer100g?: number;
  unit?: { name: string; grams: number } | null;
  overridesId?: string;
}): Food {
  const fiber = input.fiber ?? 0;
  const food: Food = {
    id: input.id,
    names: { es: input.name, en: input.name },
    per100g: {
      kcal: kcalFromMacros({ p: input.p, c: input.c, f: input.f, fiber }),
      p: input.p,
      c: input.c,
      f: input.f,
      fiber,
      sugar: input.sugar ?? 0,
      salt: input.salt ?? 0,
    },
    state: input.state,
    unit: input.unit && input.unit.name && input.unit.grams > 0
      ? { name: { es: input.unit.name, en: input.unit.name }, grams: input.unit.grams }
      : null,
    category: input.category ?? 'other',
    source: 'mine',
  };
  if (input.canteenExtraFatPer100g !== undefined) food.canteenExtraFatPer100g = input.canteenExtraFatPer100g;
  if (input.overridesId) food.overridesId = input.overridesId;
  return food;
}
