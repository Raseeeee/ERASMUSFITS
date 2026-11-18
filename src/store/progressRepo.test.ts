import { beforeEach, describe, expect, it } from 'vitest';
import { seedFoods } from '../data/foods';
import { useAppStore } from './appStore';
import { addEntry, setDayType } from './logRepo';
import { deleteWeight, firstUseDate, listDaysRange, listEntriesRange, listWeights, saveWeight } from './progressRepo';
import type { BodyProfile } from '../domain/types';

const profile: BodyProfile = {
  sex: 'male', age: 22, weightKg: 75, heightCm: 178, goal: 'lose', activity: 'moderate', sports: [],
};
const egg = seedFoods.find((f) => f.id === 'egg')!;

describe('progressRepo y estado del coach', () => {
  beforeEach(async () => {
    await useAppStore.getState().deleteAll();
    await useAppStore.getState().setProfile(profile);
  });

  it('pesos: uno por fecha, ordenados, con rango válido', async () => {
    await saveWeight('2026-11-21', 75.26);
    await saveWeight('2026-11-14', 76);
    await saveWeight('2026-11-21', 75.1); // sustituye
    expect(await listWeights()).toEqual([{ date: '2026-11-14', kg: 76 }, { date: '2026-11-21', kg: 75.1 }]);
    await expect(saveWeight('2026-11-22', 10)).rejects.toThrow();
    await deleteWeight('2026-11-14');
    expect(await listWeights()).toHaveLength(1);
  });

  it('consultas por rango y primer día de uso', async () => {
    await addEntry('2026-11-10', 'lunch', egg, 60, 'home');
    await addEntry('2026-11-20', 'lunch', egg, 60, 'home');
    await setDayType('2026-11-12', 'gym');
    await saveWeight('2026-11-08', 75);
    expect(await listEntriesRange('2026-11-11', '2026-11-30')).toHaveLength(1);
    expect((await listDaysRange('2026-11-01', '2026-11-30')).map((d) => d.dayType)).toEqual(['gym']);
    expect(await firstUseDate()).toBe('2026-11-08');
  });

  it('ajuste de kcal confirmado: acumulado y limitado, sin borrar overrides', async () => {
    const s = useAppStore.getState();
    await s.setOverride('rest', { kcal: 2000, protein: 150, carbs: 200, fat: 60, fiber: 28, saltMax: 5, sugarMax: 50, sugarIdeal: 25, waterGlasses: 11 });
    await s.applyKcalAdjustment(-150, '2026-11-28');
    await s.applyKcalAdjustment(-400, '2026-11-28');
    const st = useAppStore.getState();
    expect(st.profile?.kcalAdjustment).toBe(-500);
    expect(st.lastKcalAdjust).toBe('2026-11-28');
    expect(st.overrides.rest?.kcal).toBe(2000);
    await st.resetKcalAdjustment();
    expect(useAppStore.getState().profile?.kcalAdjustment).toBe(0);
  });

  it('descartes, intentos de objetivos bajos y peso actual persisten', async () => {
    const s = useAppStore.getState();
    await s.dismissAlert('lowWater', '2026-11-28');
    await s.recordLowTargetAttempt();
    await s.recordLowTargetAttempt();
    await s.setCurrentWeight(73.5);
    useAppStore.setState({ dismissedAlerts: {}, lowTargetAttempts: 0, profile: null, hydrated: false });
    await useAppStore.getState().hydrate();
    const st = useAppStore.getState();
    expect(st.dismissedAlerts).toEqual({ lowWater: '2026-11-28' });
    expect(st.lowTargetAttempts).toBe(2);
    expect(st.profile?.weightKg).toBe(73.5);
  });
});
