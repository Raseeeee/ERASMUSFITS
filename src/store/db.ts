import Dexie, { type EntityTable } from 'dexie';
import type { Food } from '../domain/foods';
import type { DayRecord, LogEntry } from '../domain/log';

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
  }
}

export const db = new AppDB();
