/** Progreso: resúmenes diarios, peso, adherencia y actividad. Lógica pura. */
import { ZERO, sumNutrients, type Nutrients } from './foods';
import { addDays, targetsForDay, type DayRecord, type LogEntry, DEFAULT_DAY_TYPE } from './log';
import type { BodyProfile, DayType, Targets } from './types';

export interface WeightEntry {
  date: string;
  kg: number;
}

export const TRAINING_DAY_TYPES: DayType[] = ['gym', 'run', 'long_endurance'];

export interface DaySummary {
  date: string;
  /** Hay al menos una comida registrada ese día. */
  logged: boolean;
  totals: Nutrients;
  targets: Targets;
  dayType: DayType;
  waterGlasses: number;
  /** Día con actividad registrada (tipo de día de entreno). */
  active: boolean;
}

/** Fechas desde `from` hasta `to` (inclusive), en orden. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function buildDaySummaries(
  dates: string[],
  entries: LogEntry[],
  days: DayRecord[],
  profile: BodyProfile,
  overrides: Partial<Record<DayType, Targets>>,
): DaySummary[] {
  const byDate = new Map<string, LogEntry[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const dayMap = new Map(days.map((d) => [d.date, d]));
  return dates.map((date) => {
    const list = byDate.get(date) ?? [];
    const rec = dayMap.get(date);
    const dayType = rec?.dayType ?? DEFAULT_DAY_TYPE;
    return {
      date,
      logged: list.length > 0,
      totals: list.length ? sumNutrients(list.map((e) => e.nutrients)) : ZERO,
      targets: targetsForDay(profile, dayType, overrides),
      dayType,
      waterGlasses: rec?.waterGlasses ?? 0,
      active: TRAINING_DAY_TYPES.includes(dayType),
    };
  });
}

/** Día "cumplido": registrado y kcal dentro de ±10 % del objetivo. */
export function onTarget(d: DaySummary, tolerance = 0.1): boolean {
  return d.logged && Math.abs(d.totals.kcal - d.targets.kcal) <= d.targets.kcal * tolerance;
}

/** % de días registrados que cumplen (null si no hay días registrados). */
export function adherence(days: DaySummary[]): number | null {
  const logged = days.filter((d) => d.logged);
  return logged.length ? logged.filter((d) => onTarget(d)).length / logged.length : null;
}

/** Días seguidos sin actividad, contando hacia atrás desde el último día de la lista. */
export function inactiveStreak(days: DaySummary[]): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0 && !days[i].active; i--) n++;
  return n;
}

export function sortWeights(ws: WeightEntry[]): WeightEntry[] {
  return [...ws].sort((a, b) => a.date.localeCompare(b.date));
}

const DAY_MS = 86_400_000;
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

/** Pesaje más cercano a `daysBack` días antes de `ref`, dentro de ±`slack` días. */
export function weightNear(ws: WeightEntry[], ref: string, daysBack: number, slack = 3): WeightEntry | null {
  let best: WeightEntry | null = null;
  let bestDiff = Infinity;
  for (const w of ws) {
    const back = daysBetween(w.date, ref);
    const diff = Math.abs(back - daysBack);
    if (diff <= slack && diff < bestDiff) {
      best = w;
      bestDiff = diff;
    }
  }
  return best;
}

/** Cambio medio por semana entre el primer y el último pesaje (null si < 7 días). */
export function weeklyRate(ws: WeightEntry[]): number | null {
  const s = sortWeights(ws);
  if (s.length < 2) return null;
  const days = daysBetween(s[0].date, s[s.length - 1].date);
  if (days < 7) return null;
  return ((s[s.length - 1].kg - s[0].kg) / days) * 7;
}
