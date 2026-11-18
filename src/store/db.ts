import Dexie, { type EntityTable } from 'dexie';

/** Fila clave-valor para ajustes/perfil. Más tablas (comidas, pesos…) en fases siguientes. */
export interface KvRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  kv!: EntityTable<KvRow, 'key'>;

  constructor(name = 'erasmus-eats') {
    super(name);
    this.version(1).stores({ kv: 'key' });
  }
}

export const db = new AppDB();
