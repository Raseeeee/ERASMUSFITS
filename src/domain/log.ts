/** Registro diario: entradas, totales, progreso. Lógica pura. */
import type { CookingContext, LocalizedText, Nutrients } from './foods';
import { sumNutrients } from './foods';
import { computeDayTargets } from './targets';
import type { BodyProfile, DayType, Targets } from './types';

export interface LogEntry {
  id: string;
  /** Fecha local YYYY-MM-DD. */
  date: string;
  foodId: string;
  /** Copia del nombre en el momento de registrar (el alimento puede cambiar). */
  name: LocalizedText;
  grams: number;
  context: CookingContext;
  /** Nutrientes ya calculados para esos gramos y contexto. */
  nutrients: Nutrients;
  createdAt: number;
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
