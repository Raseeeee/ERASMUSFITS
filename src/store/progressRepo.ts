/** Pesos y consultas por rango para Progreso. */
import type { DayRecord, LogEntry } from '../domain/log';
import { localISODate } from '../domain/log';
import { sortWeights, type WeightEntry } from '../domain/progress';
import { db } from './db';

export const MIN_WEIGHT_KG = 35;
export const MAX_WEIGHT_KG = 300;

export async function saveWeight(date: string, kg: number): Promise<void> {
  if (!(kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG)) throw new Error('weight out of range');
  await db.weights.put({ date, kg: Math.round(kg * 10) / 10 });
}

export async function deleteWeight(date: string): Promise<void> {
  await db.weights.delete(date);
}

export async function listWeights(): Promise<WeightEntry[]> {
  return sortWeights(await db.weights.toArray());
}

export async function listEntriesRange(from: string, to: string): Promise<LogEntry[]> {
  return db.entries.where('date').between(from, to, true, true).toArray();
}

export async function listDaysRange(from: string, to: string): Promise<DayRecord[]> {
  return db.days.where('date').between(from, to, true, true).toArray();
}

/** Primer día con algún dato (comida, día o peso); hoy si no hay nada. */
export async function firstUseDate(): Promise<string> {
  const [e, d, w] = await Promise.all([
    db.entries.orderBy('date').first(),
    db.days.orderBy('date').first(),
    db.weights.orderBy('date').first(),
  ]);
  const dates = [e?.date, d?.date, w?.date].filter((x): x is string => !!x).sort();
  return dates[0] ?? localISODate();
}
