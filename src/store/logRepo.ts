/** Acceso a IndexedDB para el registro diario y mis alimentos. */
import { nutrientsFor, type CookingContext, type Food } from '../domain/foods';
import { emptyDay, type DayRecord, type LogEntry } from '../domain/log';
import type { DayType } from '../domain/types';
import { db } from './db';

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function getDay(date: string): Promise<DayRecord> {
  return (await db.days.get(date)) ?? emptyDay(date);
}

export async function listEntries(date: string): Promise<LogEntry[]> {
  return db.entries.where('date').equals(date).sortBy('createdAt');
}

export async function addEntry(date: string, food: Food, grams: number, context: CookingContext): Promise<LogEntry> {
  const entry: LogEntry = {
    id: newId(),
    date,
    foodId: food.id,
    name: { ...food.names },
    grams: Math.round(grams),
    context,
    nutrients: nutrientsFor(food, grams, context),
    createdAt: Date.now(),
  };
  await db.entries.add(entry);
  return entry;
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function setDayType(date: string, dayType: DayType): Promise<void> {
  const day = await getDay(date);
  await db.days.put({ ...day, dayType });
}

export const MAX_WATER_GLASSES = 30;

export async function changeWater(date: string, delta: number): Promise<number> {
  return db.transaction('rw', db.days, async () => {
    const day = await getDay(date);
    const waterGlasses = Math.min(MAX_WATER_GLASSES, Math.max(0, day.waterGlasses + delta));
    await db.days.put({ ...day, waterGlasses });
    return waterGlasses;
  });
}

export async function listMyFoods(): Promise<Food[]> {
  return db.myFoods.toArray();
}

/** Guarda un alimento "mío". Si corrige a otro, sustituye cualquier corrección previa del mismo. */
export async function saveMyFood(food: Food): Promise<Food> {
  const mine: Food = { ...food, source: 'mine' };
  await db.transaction('rw', db.myFoods, async () => {
    if (mine.overridesId) {
      await db.myFoods.where('overridesId').equals(mine.overridesId).and((f) => f.id !== mine.id).delete();
    }
    await db.myFoods.put(mine);
  });
  return mine;
}

export function newMyFoodId(): string {
  return `my-${newId()}`;
}

export async function clearLog(): Promise<void> {
  await Promise.all([db.entries.clear(), db.days.clear(), db.myFoods.clear()]);
}
