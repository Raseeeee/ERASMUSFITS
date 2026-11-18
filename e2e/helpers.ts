import type { Page } from '@playwright/test';

/** Salta el onboarding escribiendo el perfil directamente en IndexedDB. */
export async function seedOnboarded(page: Page) {
  await page.goto('/');
  await page.waitForURL(/\/onboarding/);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('erasmus-eats');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          const kv = tx.objectStore('kv');
          kv.put({ key: 'language', value: 'es' });
          kv.put({ key: 'trip', value: { erasmus: true, origin: 'ES', destination: 'TR' } });
          kv.put({
            key: 'profile',
            value: {
              sex: 'male', age: 25, weightKg: 80, heightCm: 180,
              goal: 'maintain', activity: 'moderate', sports: [],
            },
          });
          kv.put({ key: 'overrides', value: {} });
          kv.put({ key: 'onboarded', value: true });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto('/today');
}
