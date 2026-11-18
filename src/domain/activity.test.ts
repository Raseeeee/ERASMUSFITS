import { describe, expect, it } from 'vitest';
import { activityKcal, activityWater, withActivity, type ExtraActivity } from './activity';
import { targetsForDay } from './log';
import { buildDaySummaries } from './progress';
import { computeDayTargets } from './targets';
import type { BodyProfile } from './types';

const profile: BodyProfile = {
  sex: 'male', age: 25, weightKg: 80, heightCm: 180, goal: 'maintain', activity: 'moderate', sports: [],
};
const walk60: ExtraActivity = { kind: 'walk', minutes: 60, intensity: 'light' };

describe('otra actividad', () => {
  it('kcal netas por MET × 0,75, con tope y validación', () => {
    expect(activityKcal(80, walk60)).toBe(120); // (3−1)·80·1·0,75
    expect(activityKcal(80, { kind: 'sport', minutes: 90, intensity: 'vigorous' })).toBe(630); // 7·80·1,5·0,75
    expect(activityKcal(80, { kind: 'sport', minutes: 300, intensity: 'vigorous' })).toBe(800);
    expect(activityKcal(80, { ...walk60, minutes: 0 })).toBe(0);
    expect(activityKcal(80, null)).toBe(0);
  });

  it('agua extra según duración', () => {
    expect(activityWater({ ...walk60, minutes: 20 })).toBe(0);
    expect(activityWater(walk60)).toBe(1);
    expect(activityWater({ ...walk60, minutes: 120 })).toBe(2);
  });

  it('suma kcal y carbohidratos al objetivo del día; proteína y grasa igual', () => {
    const base = computeDayTargets(profile, 'light').targets;
    const t = withActivity(base, 80, walk60);
    expect(t.kcal).toBe(base.kcal + 120);
    expect(t.carbs).toBe(base.carbs + 30);
    expect(t.protein).toBe(base.protein);
    expect(t.fat).toBe(base.fat);
    expect(t.waterGlasses).toBe(base.waterGlasses + 1);
    expect(withActivity(base, 80, null)).toBe(base);
  });

  it('también se suma sobre un override manual del tipo de día', () => {
    const base = computeDayTargets(profile, 'rest').targets;
    const t = targetsForDay(profile, 'rest', { rest: { ...base, kcal: 2000 } }, walk60);
    expect(t.kcal).toBe(2120);
  });

  it('un día ligero con otra actividad cuenta como activo', () => {
    const [plain, extra] = buildDaySummaries(
      ['2026-11-20', '2026-11-21'],
      [],
      [{ date: '2026-11-20', dayType: 'light', waterGlasses: 0 }, { date: '2026-11-21', dayType: 'light', waterGlasses: 0, extraActivity: walk60 }],
      profile,
      {},
    );
    expect(plain.active).toBe(false);
    expect(extra.active).toBe(true);
    expect(extra.extraActivity).toBe(true);
    expect(extra.targets.kcal).toBe(plain.targets.kcal + 120);
  });
});
