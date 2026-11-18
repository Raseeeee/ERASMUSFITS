import Dexie, { type EntityTable } from 'dexie';
import type { Food } from '../domain/foods';
import { defaultMealForHour, type DayRecord, type LogEntry } from '../domain/log';
import type { WeightEntry } from '../domain/progress';

/** Fila clave-valor para ajustes/perfil. */
export interface KvRow {
  key: string;
  value: unknown;
}

/** Caché local de búsquedas externas (OFF/USDA) para no repetir peticiones y funcionar offline. */
export interface FoodCacheRow {
  key: string;
  foods: Food[];
  fetchedAt: number;
}

export class AppDB extends Dexie {
  foodCache!: EntityTable<FoodCacheRow, 'key'>;
  weights!: EntityTable<WeightEntry, 'date'>;
  kv!: EntityTable<KvRow, 'key'>;
  entries!: EntityTable<LogEntry, 'id'>;
  days!: EntityTable<DayRecord, 'date'>;
  myFoods!: EntityTable<Food, 'id'>;

  constructor(name = 'erasmus-eats') {
    super(name);
    this.version(1).stores({ kv: 'key' });
    this.version(2).stores({
      kv: 'key',
      entries: 'id, date, createdAt',
      days: 'date',
      myFoods: 'id, overridesId',
    });
    // v3: comidas del día y copia del alimento en cada entrada.
    this.version(3)
      .stores({ entries: 'id, date, createdAt, [date+meal]' })
      .upgrade(async (tx) => {
        const mine = new Map((await tx.table<Food, string>('myFoods').toArray()).map((f) => [f.id, f]));
        await tx
          .table<LogEntry, string>('entries')
          .toCollection()
          .modify((e) => {
            if (!e.meal) e.meal = defaultMealForHour(new Date(e.createdAt).getHours());
            if (!e.food) {
              // Solo alimentos míos: los de la semilla se resuelven al editar (evita cargar la semilla al arrancar).
              const f = mine.get(e.foodId);
              if (f) e.food = f;
            }
          });
      });
    // v4: caché de búsquedas externas.
    this.version(4).stores({ foodCache: 'key, fetchedAt' });
    // v5: pesos (uno por fecha).
    this.version(5).stores({ weights: 'date' });
  }
}

export const db = new AppDB();
