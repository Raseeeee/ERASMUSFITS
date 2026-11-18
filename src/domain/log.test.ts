import { describe, expect, it } from 'vitest';
import { seedFoods } from '../data/foods';
import { nutrientsFor } from './foods';
import {
  addDays, dayTotals, defaultMealForHour, editEntry, groupByMeal, isISODate, localISODate,
  progressRows, remaining, targetsForDay, type LogEntry,
} from './log';
import { computeDayTargets } from './targets';
import type { BodyProfile } from './types';

const profile: BodyProfile = {
  sex: 'male', age: 25, weightKg: 80, heightCm: 180, goal: 'maintain', activity: 'moderate', sports: [],
};
const entry = (kcal: number, p: number, salt = 0): LogEntry => ({
  id: String(Math.random()), date: '2026-11-18', meal: 'lunch', foodId: 'x', name: { es: 'x', en: 'x' },
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

describe('comidas del día', () => {
  it('comida por defecto según la hora', () => {
    expect(defaultMealForHour(8)).toBe('breakfast');
    expect(defaultMealForHour(11)).toBe('snack');
    expect(defaultMealForHour(14)).toBe('lunch');
    expect(defaultMealForHour(18)).toBe('snack');
    expect(defaultMealForHour(21)).toBe('dinner');
    expect(defaultMealForHour(2)).toBe('dinner');
  });
  it('agrupa en orden fijo, con subtotales y grupos vacíos', () => {
    const a = { ...entry(300, 20), meal: 'lunch' as const };
    const b = { ...entry(100, 5), meal: 'lunch' as const };
    const c = { ...entry(200, 10), meal: 'breakfast' as const };
    const g = groupByMeal([a, b, c]);
    expect(g.map((x) => x.meal)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(g[1].entries).toHaveLength(2);
    expect(g[1].totals.kcal).toBe(400);
    expect(g[2].entries).toHaveLength(0);
    expect(g[2].totals.kcal).toBe(0);
  });
  it('faltantes (negativo si se pasa)', () => {
    const target = targetsForDay(profile, 'gym', {});
    const r = remaining({ kcal: 2000, p: 140, c: 300, f: 50, fiber: 0, sugar: 0, salt: 0 }, target);
    expect(r).toEqual({ kcal: 798, p: -12, c: 97, f: 28 });
  });
  it('editar entrada recalcula nutrientes y conserva id y fecha', () => {
    const chicken = seedFoods.find((f) => f.id === 'chicken_breast')!;
    const e = { ...entry(0, 0), meal: 'lunch' as const };
    const edited = editEntry(e, chicken, { grams: 200, context: 'canteen', meal: 'dinner' });
    expect(edited.id).toBe(e.id);
    expect(edited.date).toBe(e.date);
    expect(edited.meal).toBe('dinner');
    expect(edited.nutrients).toEqual(nutrientsFor(chicken, 200, 'canteen'));
    expect(edited.food?.id).toBe('chicken_breast');
  });
});
