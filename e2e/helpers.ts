import type { Page } from '@playwright/test';

export const DEFAULT_PROFILE = {
  sex: 'male', age: 25, weightKg: 80, heightCm: 180,
  goal: 'maintain', activity: 'moderate', sports: [] as { sport: string; daysPerWeek: number }[],
};

/** Filas que se escriben tal cual en las tablas de IndexedDB. */
export interface SeedData {
  profile?: Partial<typeof DEFAULT_PROFILE> & { goal?: string };
  entries?: unknown[];
  days?: unknown[];
  weights?: unknown[];
}

/** Salta el onboarding escribiendo el perfil (y datos opcionales) directamente en IndexedDB. */
export async function seedOnboarded(page: Page, data: SeedData = {}) {
  await page.goto('/');
  await page.waitForURL(/\/onboarding/);
  await page.evaluate(
    ({ profile, entries, days, weights }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('erasmus-fits');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['kv', 'entries', 'days', 'weights'], 'readwrite');
          const kv = tx.objectStore('kv');
          kv.put({ key: 'language', value: 'es' });
          kv.put({ key: 'trip', value: { erasmus: true, origin: 'ES', destination: 'TR' } });
          kv.put({ key: 'profile', value: profile });
          kv.put({ key: 'overrides', value: {} });
          kv.put({ key: 'onboarded', value: true });
          for (const e of entries) tx.objectStore('entries').put(e);
          for (const d of days) tx.objectStore('days').put(d);
          for (const w of weights) tx.objectStore('weights').put(w);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    {
      profile: { ...DEFAULT_PROFILE, ...data.profile },
      entries: data.entries ?? [],
      days: data.days ?? [],
      weights: data.weights ?? [],
    },
  );
  await page.goto('/today');
}
