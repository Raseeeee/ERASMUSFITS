/** Exportar todos los datos del usuario (RGPD: portabilidad). */
import { db } from './db';

export const EXPORT_FORMAT = 'erasmus-eats-export';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

/** Todas las tablas con datos del usuario. La caché de búsquedas externas no se exporta. */
export async function exportAll(now = new Date()): Promise<ExportFile> {
  const [kv, entries, days, myFoods, weights] = await Promise.all([
    db.kv.toArray(),
    db.entries.toArray(),
    db.days.toArray(),
    db.myFoods.toArray(),
    db.weights.toArray(),
  ]);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    data: { settings: kv, entries, days, myFoods, weights },
  };
}

export function exportFileName(now = new Date()): string {
  return `erasmus-eats-${now.toISOString().slice(0, 10)}.json`;
}

/** Descarga el JSON en el navegador. */
export async function downloadExport(): Promise<void> {
  const file = await exportAll();
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
