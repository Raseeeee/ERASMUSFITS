import { describe, expect, it } from 'vitest';
import { clampAdjustment, evaluateCoach, visibleAlerts, type CoachInput } from './coach';
import { addDays, targetsForDay } from './log';
import {
  adherence,
  buildDaySummaries,
  dateRange,
  inactiveStreak,
  weeklyRate,
  weightNear,
  type DaySummary,
} from './progress';
import { computeDayTargets } from './targets';
import type { BodyProfile, DayType } from './types';

const profile: BodyProfile = {
  sex: 'female', age: 23, weightKg: 70, heightCm: 168, goal: 'lose', activity: 'moderate', sports: [],
};
const TODAY = '2026-11-28';

/** Días sintéticos: por defecto registrados, en objetivo, activos días alternos, agua y sal bien. */
function makeDays(n: number, f: (i: number, d: DaySummary) => Partial<DaySummary> = () => ({})): DaySummary[] {
  return dateRange(addDays(TODAY, -(n - 1)), TODAY).map((date, i) => {
    const dayType: DayType = i % 2 === 0 ? 'gym' : 'light';
    const targets = targetsForDay(profile, dayType, {});
    const base: DaySummary = {
      date, logged: true, dayType, active: dayType === 'gym', extraActivity: false, waterGlasses: targets.waterGlasses, targets,
      totals: { kcal: targets.kcal, p: targets.protein, c: targets.carbs, f: targets.fat, fiber: 25, sugar: 20, salt: 3 },
    };
    return { ...base, ...f(i, base) };
  });
}
const input = (over: Partial<CoachInput> = {}): CoachInput => ({
  goal: 'lose', today: TODAY, days: makeDays(28), weights: [], since: addDays(TODAY, -60), ...over,
});
const ids = (i: CoachInput) => evaluateCoach(i).map((a) => a.id);

describe('progreso', () => {
  it('rango de fechas, adherencia y racha inactiva', () => {
    expect(dateRange('2026-11-27', '2026-12-01')).toHaveLength(5);
    const days = makeDays(10, (i) => (i >= 6 ? { active: false, dayType: 'light' } : { active: true, dayType: 'gym' }));
    expect(inactiveStreak(days)).toBe(4);
    expect(adherence(makeDays(4, (i, d) => (i === 0 ? { totals: { ...d.totals, kcal: d.targets.kcal * 1.3 } } : {})))).toBe(0.75);
    expect(adherence(makeDays(3, () => ({ logged: false })))).toBeNull();
  });

  it('resúmenes diarios desde entradas y días guardados', () => {
    const [d] = buildDaySummaries(
      ['2026-11-20'],
      [{ id: 'a', date: '2026-11-20', meal: 'lunch', foodId: 'x', name: { es: 'x', en: 'x' }, grams: 100, context: 'home', createdAt: 0,
        nutrients: { kcal: 500, p: 30, c: 50, f: 10, fiber: 5, sugar: 2, salt: 1 } }],
      [{ date: '2026-11-20', dayType: 'run', waterGlasses: 4 }],
      profile,
      {},
    );
    expect(d).toMatchObject({ logged: true, active: true, waterGlasses: 4, dayType: 'run' });
    expect(d.totals.kcal).toBe(500);
    expect(d.targets.kcal).toBe(computeDayTargets(profile, 'run').targets.kcal);
  });

  it('peso: pesaje cercano y ritmo semanal', () => {
    const ws = [{ date: '2026-11-14', kg: 71 }, { date: '2026-11-21', kg: 70.5 }, { date: '2026-11-28', kg: 70 }];
    expect(weightNear(ws, '2026-11-28', 14)?.kg).toBe(71);
    expect(weightNear(ws, '2026-11-28', 30)).toBeNull();
    expect(weeklyRate(ws)).toBeCloseTo(-0.5);
    expect(weeklyRate([{ date: '2026-11-27', kg: 70 }, { date: '2026-11-28', kg: 69 }])).toBeNull();
  });
});

describe('reglas del coach', () => {
  it('sin problemas → sin avisos', () => {
    expect(ids(input())).toEqual([]);
  });

  it('lose/recomp: 7 días sin actividad → aviso; 4–5 → aviso suave; aunque cumpla macros', () => {
    const inactive = (from: number) =>
      makeDays(28, (i) => (i >= from ? { active: false, dayType: 'light' } : i === from - 1 ? { active: true, dayType: 'gym' } : {}));
    expect(evaluateCoach(input({ days: inactive(21) }))[0]).toMatchObject({ id: 'inactivity', severity: 'warning', params: { days: 7 } });
    expect(evaluateCoach(input({ days: inactive(24) }))[0]).toMatchObject({ id: 'inactivitySoft', severity: 'info', params: { days: 4 } });
    expect(ids(input({ days: inactive(26) }))).toEqual([]);
    expect(ids(input({ days: inactive(21), goal: 'gain' }))).toEqual([]);
    // un usuario nuevo no tiene "7 días sin actividad"
    expect(ids(input({ days: inactive(0), since: addDays(TODAY, -2) }))).toEqual([]);
  });

  it('lose: cumple macros y el peso no baja en 2 semanas → propone −150 kcal', () => {
    const weights = [{ date: '2026-11-14', kg: 70 }, { date: '2026-11-21', kg: 70.1 }, { date: '2026-11-28', kg: 70 }];
    const a = evaluateCoach(input({ weights }));
    expect(a).toEqual([{ id: 'plateau', severity: 'info', params: { kg: 0 }, action: { type: 'adjustKcal', delta: -150 } }]);
  });

  it('gain: el peso no sube → +150; maintain: deriva > 1 kg → ∓100', () => {
    const flat = [{ date: '2026-11-14', kg: 70 }, { date: '2026-11-28', kg: 70.1 }];
    expect(evaluateCoach(input({ goal: 'gain', weights: flat }))[0].action).toEqual({ type: 'adjustKcal', delta: 150 });
    const up = [{ date: '2026-11-14', kg: 70 }, { date: '2026-11-28', kg: 71.5 }];
    expect(evaluateCoach(input({ goal: 'maintain', weights: up }))[0]).toMatchObject({
      id: 'weightDrift', params: { kg: 1.5, up: 1 }, action: { delta: -100 },
    });
    expect(ids(input({ goal: 'maintain', weights: flat }))).toEqual([]);
  });

  it('no propone ajuste si no cumple macros o registra poco', () => {
    const weights = [{ date: '2026-11-14', kg: 70 }, { date: '2026-11-28', kg: 70 }];
    const over = makeDays(28, (_i, d) => ({ totals: { ...d.totals, kcal: d.targets.kcal * 1.25 } }));
    expect(ids(input({ weights, days: over }))).not.toContain('plateau');
    const few = makeDays(28, (i) => ({ logged: i % 2 === 0 }));
    expect(ids(input({ weights, days: few }))).not.toContain('plateau');
  });

  it('espera 14 días tras un ajuste aceptado antes de proponer otro', () => {
    const weights = [{ date: '2026-11-14', kg: 70 }, { date: '2026-11-28', kg: 70 }];
    expect(ids(input({ weights, lastKcalAdjust: '2026-11-20' }))).not.toContain('plateau');
    expect(ids(input({ weights, lastKcalAdjust: '2026-11-01' }))).toContain('plateau');
  });

  it('pérdida > 1 %/semana dos semanas → demasiado rápido, propone subir kcal', () => {
    const weights = [{ date: '2026-11-14', kg: 72 }, { date: '2026-11-21', kg: 71 }, { date: '2026-11-28', kg: 70 }];
    const a = evaluateCoach(input({ weights }));
    expect(a.map((x) => x.id)).toEqual(['tooFast']);
    expect(a[0]).toMatchObject({ severity: 'warning', action: { type: 'adjustKcal', delta: 150 } });
    // solo una semana rápida → no
    const once = [{ date: '2026-11-14', kg: 71.2 }, { date: '2026-11-21', kg: 71 }, { date: '2026-11-28', kg: 70 }];
    expect(ids(input({ weights: once }))).not.toContain('tooFast');
  });

  it('proteína < 80 % 4 días seguidos (días completos, no hoy)', () => {
    const low = (from: number) => makeDays(28, (i, d) => (i >= from ? { totals: { ...d.totals, p: d.targets.protein * 0.6 } } : {}));
    expect(ids(input({ days: low(23) }))).toContain('lowProtein'); // días 23–26 completos + hoy
    expect(ids(input({ days: low(25) }))).not.toContain('lowProtein');
  });

  it('agua < 50 %, sal y azúcar sobre el tope 3+ de los últimos 7 días', () => {
    const days = makeDays(28, (i, d) =>
      i >= 22 && i <= 26 ? { waterGlasses: 1, totals: { ...d.totals, salt: 7, sugar: d.targets.sugarMax + 10 } } : {},
    );
    expect(ids(input({ days }))).toEqual(expect.arrayContaining(['lowWater', 'highSalt', 'highSugar']));
    const notLogged = makeDays(28, (i) => (i >= 22 ? { logged: false, waterGlasses: 0 } : {}));
    expect(ids(input({ days: notLogged }))).not.toContain('lowWater');
  });

  it('objetivos muy bajos repetidos → recursos de ayuda', () => {
    expect(ids(input({ lowTargetAttempts: 2 }))).toContain('helpResources');
    expect(ids(input({ lowTargetAttempts: 1 }))).not.toContain('helpResources');
  });
});

describe('descartes y ajustes', () => {
  it('un aviso descartado vuelve a los 7 días', () => {
    const a = [{ id: 'lowWater' as const, severity: 'info' as const }];
    expect(visibleAlerts(a, { lowWater: '2026-11-25' }, TODAY)).toEqual([]);
    expect(visibleAlerts(a, { lowWater: '2026-11-20' }, TODAY)).toHaveLength(1);
  });
  it('ajuste acumulado limitado a ±500 y respetando el suelo de seguridad', () => {
    expect(clampAdjustment(650)).toBe(500);
    expect(clampAdjustment(-700)).toBe(-500);
    const adjusted = computeDayTargets({ ...profile, kcalAdjustment: -150 }, 'gym').targets.kcal;
    expect(adjusted).toBe(computeDayTargets(profile, 'gym').targets.kcal - 150);
    const floor = computeDayTargets({ ...profile, weightKg: 50, heightCm: 160, age: 60, loseDeficit: 0.25, kcalAdjustment: -500 }, 'rest');
    expect(floor.targets.kcal).toBe(1200);
    expect(floor.warnings).toContain('floorApplied');
  });
});
