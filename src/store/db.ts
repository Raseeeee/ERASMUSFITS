import Dexie, { type EntityTable } from 'dexie';
import type { Food } from '../domain/foods';
import { defaultMealForHour, type DayRecord, type LogEntry } from '../domain/log';
import { seedFoods } from '../data/foods';

/** Fila clave-valor para ajustes/perfil. */
export interface KvRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
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
              const f = mine.get(e.foodId) ?? seedFoods.find((s) => s.id === e.foodId);
              if (f) e.food = f;
            }
          });
      });
  }
}

export const db = new AppDB();
