import { describe, expect, it } from 'vitest';
import { addDays, dayTotals, isISODate, localISODate, progressRows, targetsForDay, type LogEntry } from './log';
import { computeDayTargets } from './targets';
import type { BodyProfile } from './types';

const profile: BodyProfile = {
  sex: 'male', age: 25, weightKg: 80, heightCm: 180, goal: 'maintain', activity: 'moderate', sports: [],
};
const entry = (kcal: number, p: number, salt = 0): LogEntry => ({
  id: String(Math.random()), date: '2026-11-18', foodId: 'x', name: { es: 'x', en: 'x' },
  grams: 100, context: 'home', createdAt: 0,
  nutrients: { kcal, p, c: 10, f: 5, fiber: 2, sugar: 1, salt },
});

describe('fechas locales', () => {
  it('formato YYYY-MM-DD local', () => {
    expect(localISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('sumar días cruzando mes y año', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('valida fechas', () => {
    expect(isISODate('2026-11-18')).toBe(true);
    expect(isISODate('18/11/2026')).toBe(false);
    expect(isISODate(null)).toBe(false);
  });
});

describe('totales y progreso', () => {
  it('suma entradas', () => {
    const t = dayTotals([entry(300, 20, 0.5), entry(200, 10, 1)]);
    expect(t.kcal).toBe(500);
    expect(t.p).toBe(30);
    expect(t.salt).toBe(1.5);
  });
  it('usa override si existe', () => {
    const base = computeDayTargets(profile, 'gym').targets;
    expect(targetsForDay(profile, 'gym', {})).toEqual(base);
    expect(targetsForDay(profile, 'gym', { gym: { ...base, kcal: 2600 } }).kcal).toBe(2600);
  });
  it('marca topes superados y exceso de kcal, no de proteína', () => {
    const target = targetsForDay(profile, 'rest', {});
    const rows = progressRows({ kcal: 4000, p: 300, c: 10, f: 5, fiber: 2, sugar: 100, salt: 6 }, target);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.kcal.over).toBe(true);
    expect(by.protein.over).toBe(false);
    expect(by.salt.over).toBe(true);
    expect(by.salt.kind).toBe('cap');
    expect(by.sugar.over).toBe(true);
    expect(by.fiber.over).toBe(false);
  });
});
