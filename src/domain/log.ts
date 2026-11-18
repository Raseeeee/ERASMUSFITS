/** Registro diario: entradas, totales, progreso. Lógica pura. */
import type { CookingContext, Food, LocalizedText, Nutrients } from './foods';
import { nutrientsFor, sumNutrients } from './foods';
import { computeDayTargets } from './targets';
import type { BodyProfile, DayType, Targets } from './types';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
/** Desayuno, comida, cena y snacks (media mañana, merienda…). */
export type Meal = (typeof MEALS)[number];

export interface LogEntry {
  id: string;
  /** Fecha local YYYY-MM-DD. */
  date: string;
  meal: Meal;
  foodId: string;
  /** Copia del nombre en el momento de registrar (el alimento puede cambiar). */
  name: LocalizedText;
  /**
   * Copia del alimento al registrar: permite editar la entrada aunque el
   * alimento original cambie, se borre o venga de una fuente externa.
   */
  food?: Food;
  grams: number;
  context: CookingContext;
  /** Nutrientes ya calculados para esos gramos y contexto. */
  nutrients: Nutrients;
  createdAt: number;
}

/**
 * Comida por defecto según la hora local: 5–10 desayuno, 11–12 snack (media
 * mañana), 13–16 comida, 17–19 snack (merienda), 20–4 cena.
 */
export function defaultMealForHour(hour: number): Meal {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 13) return 'snack';
  if (hour >= 13 && hour < 17) return 'lunch';
  if (hour >= 17 && hour < 20) return 'snack';
  return 'dinner';
}

export function isMeal(s: string | null | undefined): s is Meal {
  return !!s && (MEALS as readonly string[]).includes(s);
}

export interface MealGroup {
  meal: Meal;
  entries: LogEntry[];
  totals: Nutrients;
}

/** Agrupa las entradas por comida, en orden fijo (también las vacías). */
export function groupByMeal(entries: LogEntry[]): MealGroup[] {
  return MEALS.map((meal) => {
    const list = entries.filter((e) => e.meal === meal);
    return { meal, entries: list, totals: sumNutrients(list.map((e) => e.nutrients)) };
  });
}

export interface Remaining {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

/** Lo que falta para el objetivo (negativo si se ha pasado). */
export function remaining(totals: Nutrients, t: Targets): Remaining {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(t.kcal - totals.kcal),
    p: r1(t.protein - totals.p),
    c: r1(t.carbs - totals.c),
    f: r1(t.fat - totals.f),
  };
}

/** Recalcula una entrada con nuevos gramos/contexto/comida a partir de su copia del alimento. */
export function editEntry(
  entry: LogEntry,
  food: Food,
  changes: { grams: number; context: CookingContext; meal: Meal },
): LogEntry {
  return {
    ...entry,
    ...changes,
    grams: Math.round(changes.grams),
    foodId: food.id,
    food,
    name: { ...food.names },
    nutrients: nutrientsFor(food, changes.grams, changes.context),
  };
}

export interface DayRecord {
  date: string;
  dayType: DayType;
  waterGlasses: number;
}

export const DEFAULT_DAY_TYPE: DayType = 'light';

export function emptyDay(date: string): DayRecord {
  return { date, dayType: DEFAULT_DAY_TYPE, waterGlasses: 0 };
}

export function dayTotals(entries: LogEntry[]): Nutrients {
  return sumNutrients(entries.map((e) => e.nutrients));
}

export function targetsForDay(
  profile: BodyProfile,
  dayType: DayType,
  overrides: Partial<Record<DayType, Targets>>,
): Targets {
  return overrides[dayType] ?? computeDayTargets(profile, dayType).targets;
}

export type ProgressKind = 'goal' | 'cap';

export interface ProgressRow {
  key: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'salt' | 'sugar';
  value: number;
  target: number;
  /** `goal` = conviene llegar; `cap` = tope que no conviene superar. */
  kind: ProgressKind;
  ratio: number;
  over: boolean;
}

/** Tolerancia antes de marcar como "pasado" un objetivo de tipo goal (kcal, macros). */
export const OVER_TOLERANCE = 1.05;

export function progressRows(t: Nutrients, target: Targets): ProgressRow[] {
  const row = (key: ProgressRow['key'], value: number, tgt: number, kind: ProgressKind): ProgressRow => {
    const ratio = tgt > 0 ? value / tgt : 0;
    const over = kind === 'cap' ? value > tgt : ratio > OVER_TOLERANCE && (key === 'kcal' || key === 'fat' || key === 'carbs');
    return { key, value, target: tgt, kind, ratio, over };
  };
  return [
    row('kcal', t.kcal, target.kcal, 'goal'),
    row('protein', t.p, target.protein, 'goal'),
    row('carbs', t.c, target.carbs, 'goal'),
    row('fat', t.f, target.fat, 'goal'),
    row('fiber', t.fiber, target.fiber, 'goal'),
    row('salt', t.salt, target.saltMax, 'cap'),
    row('sugar', t.sugar, target.sugarMax, 'cap'),
  ];
}

// ---- Fechas locales ---------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD en hora local (no UTC). */
export function localISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return localISODate(new Date(y, m - 1, d + days));
}

export function isISODate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}
