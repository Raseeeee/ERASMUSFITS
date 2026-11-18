import { beforeEach, describe, expect, it } from 'vitest';
import { seedFoods } from '../data/foods';
import { useAppStore } from './appStore';
import { exportAll, exportFileName } from './backup';
import { db } from './db';
import { addEntry } from './logRepo';
import { saveWeight } from './progressRepo';

describe('exportar datos', () => {
  beforeEach(async () => {
    await useAppStore.getState().deleteAll();
  });

  it('incluye ajustes, comidas, días, mis alimentos y pesos; no la caché externa', async () => {
    await useAppStore.getState().setProfile({
      sex: 'female', age: 21, weightKg: 60, heightCm: 165, goal: 'maintain', activity: 'light', sports: [],
    });
    await addEntry('2026-11-18', 'lunch', seedFoods[0], 100, 'home');
    await saveWeight('2026-11-18', 60);
    await db.foodCache.put({ key: 'off:es:x', foods: [], fetchedAt: 0 });

    const file = await exportAll(new Date('2026-11-18T10:00:00Z'));
    expect(file.format).toBe('erasmus-eats-export');
    expect(file.exportedAt).toBe('2026-11-18T10:00:00.000Z');
    expect(file.data.entries).toHaveLength(1);
    expect(file.data.weights).toEqual([{ date: '2026-11-18', kg: 60 }]);
    expect((file.data.settings as { key: string }[]).map((r) => r.key)).toContain('profile');
    expect(Object.keys(file.data)).not.toContain('foodCache');
    expect(exportFileName(new Date('2026-11-18T10:00:00Z'))).toBe('erasmus-eats-2026-11-18.json');
  });

  it('borrar todo deja la base vacía, incluido el indicador de onboarding', async () => {
    await useAppStore.getState().completeOnboarding();
    expect(localStorage.getItem('ee.onboarded')).toBe('1');
    await useAppStore.getState().deleteAll();
    const file = await exportAll();
    expect(Object.values(file.data).every((t) => t.length === 0)).toBe(true);
    expect(localStorage.getItem('ee.onboarded')).toBeNull();
  });
});
