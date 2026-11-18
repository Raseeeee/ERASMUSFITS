import { describe, expect, it } from 'vitest';
import {
  bmi,
  bmr,
  checkOverride,
  computeAllTargets,
  computeDayTargets,
  goalAdjustment,
  isAdult,
  isGoalAllowed,
  kcalFloor,
  maintenanceKcal,
  relevantDayTypes,
  waterGlasses,
} from './targets';
import type { BodyProfile } from './types';

const male: BodyProfile = {
  sex: 'male', age: 25, weightKg: 80, heightCm: 180,
  goal: 'maintain', activity: 'moderate', sports: [],
};
const female: BodyProfile = {
  sex: 'female', age: 25, weightKg: 60, heightCm: 165,
  goal: 'maintain', activity: 'light', sports: [],
};
const unspecified: BodyProfile = { ...male, sex: 'unspecified' };

describe('BMR Mifflin-St Jeor', () => {
  it('hombre', () => expect(bmr('male', 80, 180, 25)).toBe(1805));
  it('mujer', () => expect(bmr('female', 60, 165, 25)).toBeCloseTo(1345.25));
  it('prefiero no decirlo = media de ambas fórmulas', () => {
    expect(bmr('unspecified', 80, 180, 25)).toBe((1805 + 1639) / 2);
  });
});

describe('validaciones básicas', () => {
  it('edad mínima 18', () => {
    expect(isAdult(17)).toBe(false);
    expect(isAdult(18)).toBe(true);
  });
  it('IMC', () => expect(bmi(80, 200)).toBeCloseTo(20));
  it('IMC < 18.5 no permite lose', () => {
    expect(isGoalAllowed('lose', 50, 180)).toBe(false);
    expect(isGoalAllowed('maintain', 50, 180)).toBe(true);
    expect(isGoalAllowed('lose', 80, 180)).toBe(true);
  });
});

describe('ajuste por objetivo', () => {
  it('lose −15% por defecto y máximo −25%', () => {
    expect(goalAdjustment('lose', 'gym')).toBe(-0.15);
    expect(goalAdjustment('lose', 'gym', 0.4)).toBe(-0.25);
  });
  it('maintain 0, gain +10%', () => {
    expect(goalAdjustment('maintain', 'rest')).toBe(0);
    expect(goalAdjustment('gain', 'rest')).toBe(0.1);
  });
  it('recomp por tipo de día', () => {
    expect(goalAdjustment('recomp', 'gym')).toBe(0);
    expect(goalAdjustment('recomp', 'run')).toBe(0);
    expect(goalAdjustment('recomp', 'light')).toBe(-0.05);
    expect(goalAdjustment('recomp', 'rest')).toBe(-0.1);
  });
});

describe('computeDayTargets — 4 objetivos', () => {
  it('maintain, hombre, gym: kcal y macros', () => {
    const { targets: t, warnings } = computeDayTargets(male, 'gym');
    expect(t.kcal).toBe(2798); // 1805 × 1.55
    expect(t.protein).toBe(128); // 1.6 g/kg
    expect(t.fat).toBe(78); // 25 % kcal > 0.8 g/kg
    expect(t.carbs).toBe(397); // resto
    expect(t.fiber).toBe(39);
    expect(t.saltMax).toBe(5);
    expect(t.sugarMax).toBe(70);
    expect(t.sugarIdeal).toBe(35);
    expect(t.waterGlasses).toBe(13); // ceil(2800/250)=12 +1 entreno
    expect(warnings).toEqual([]);
  });

  it('lose, hombre, descanso: −15 %, proteína 2 g/kg', () => {
    const { targets: t } = computeDayTargets({ ...male, goal: 'lose' }, 'rest');
    expect(t.kcal).toBe(1995); // 1805 × 1.3 × 0.85
    expect(t.protein).toBe(160);
  });

  it('gain, hombre, gym: +10 %, proteína 1.8 g/kg', () => {
    const { targets: t } = computeDayTargets({ ...male, goal: 'gain' }, 'gym');
    expect(t.kcal).toBe(3078);
    expect(t.protein).toBe(144);
  });

  it('recomp, hombre: rest −10 %, light −5 %, gym 0 %', () => {
    const p = { ...male, goal: 'recomp' as const };
    expect(computeDayTargets(p, 'rest').targets.kcal).toBe(2112);
    expect(computeDayTargets(p, 'light').targets.kcal).toBe(2401);
    expect(computeDayTargets(p, 'gym').targets.kcal).toBe(2798);
    expect(computeDayTargets(p, 'gym').targets.protein).toBe(160);
  });

  it('lose, mujer, descanso', () => {
    const { targets: t, warnings } = computeDayTargets({ ...female, goal: 'lose' }, 'rest');
    expect(t.kcal).toBe(1487); // 1345.25 × 1.3 × 0.85
    expect(t.protein).toBe(120);
    expect(warnings).toEqual([]);
  });

  it('maintain, no decir, descanso', () => {
    expect(computeDayTargets(unspecified, 'rest').targets.kcal).toBe(2239); // 1722 × 1.3
  });

  it('macros suman ≈ kcal', () => {
    for (const goal of ['lose', 'maintain', 'gain', 'recomp'] as const) {
      for (const p of [male, female, unspecified]) {
        const { targets: t } = computeDayTargets({ ...p, goal }, 'light');
        const sum = t.protein * 4 + t.carbs * 4 + t.fat * 9;
        expect(Math.abs(sum - t.kcal)).toBeLessThanOrEqual(15);
      }
    }
  });

  it('grasa mínima 0.8 g/kg cuando supera el 25 % de kcal', () => {
    const heavy: BodyProfile = { ...female, weightKg: 110, heightCm: 160, age: 50, goal: 'lose' };
    const { targets: t } = computeDayTargets(heavy, 'rest');
    expect(t.fat).toBe(88);
  });
});

describe('suelos de seguridad', () => {
  it('mujer: nunca por debajo de 1200 kcal', () => {
    const small: BodyProfile = {
      sex: 'female', age: 60, weightKg: 45, heightCm: 150,
      goal: 'lose', loseDeficit: 0.25, activity: 'sedentary', sports: [],
    };
    const r = computeDayTargets(small, 'rest');
    expect(r.targets.kcal).toBe(1200);
    expect(r.warnings).toContain('floorApplied');
  });

  it('no decir: suelo 1200 kcal', () => {
    const small: BodyProfile = {
      sex: 'unspecified', age: 70, weightKg: 47, heightCm: 152,
      goal: 'lose', loseDeficit: 0.25, activity: 'sedentary', sports: [],
    };
    const r = computeDayTargets(small, 'rest');
    expect(r.targets.kcal).toBe(1200);
    expect(r.warnings).toContain('floorApplied');
  });

  it('hombre: nunca por debajo de 1500 kcal', () => {
    const small: BodyProfile = {
      sex: 'male', age: 70, weightKg: 55, heightCm: 160,
      goal: 'lose', loseDeficit: 0.25, activity: 'sedentary', sports: [],
    };
    const r = computeDayTargets(small, 'rest');
    expect(r.targets.kcal).toBe(1500);
    expect(r.warnings).toContain('floorApplied');
  });

  it('suelo = máx(suelo por sexo, 90 % BMR)', () => {
    expect(kcalFloor('male', 1000)).toBe(1500);
    expect(kcalFloor('female', 1000)).toBe(1200);
    expect(kcalFloor('male', 2000)).toBe(1800);
  });

  it('IMC < 18.5 con lose → se calcula como maintain y avisa', () => {
    const thin: BodyProfile = { ...male, weightKg: 55, heightCm: 180, goal: 'lose' };
    const r = computeDayTargets(thin, 'gym');
    expect(r.warnings).toContain('loseBlockedLowBmi');
    expect(r.targets.kcal).toBe(computeDayTargets({ ...thin, goal: 'maintain' }, 'gym').targets.kcal);
  });
});

describe('agua', () => {
  it('35 ml/kg en vasos de 250 ml (+1-2 en entreno)', () => {
    expect(waterGlasses(60, 'rest')).toBe(9); // 2100 ml → 8.4 → 9
    expect(waterGlasses(60, 'gym')).toBe(10);
    expect(waterGlasses(60, 'long_endurance')).toBe(11);
  });
});

describe('tipos de día relevantes', () => {
  it('sin deportes: rest, light, gym', () => {
    expect(relevantDayTypes({ sports: [] })).toEqual(['rest', 'light', 'gym']);
  });
  it('running + triatlón añaden run y long_endurance', () => {
    expect(relevantDayTypes({
      sports: [{ sport: 'running', daysPerWeek: 3 }, { sport: 'triathlon', daysPerWeek: 1 }],
    })).toEqual(['rest', 'light', 'run', 'long_endurance']);
  });
  it('computeAllTargets devuelve uno por tipo', () => {
    expect(computeAllTargets(male).map((d) => d.dayType)).toEqual(['rest', 'light', 'gym']);
  });
});

describe('mantenimiento habitual', () => {
  it('BMR × factor habitual', () => {
    expect(maintenanceKcal(male)).toBe(Math.round(1805 * 1.55));
  });
});

describe('overrides manuales', () => {
  it('valores razonables sin avisos', () => {
    const { targets } = computeDayTargets(male, 'gym');
    expect(checkOverride(male, targets).issues).toEqual([]);
  });
  it('kcal bajo el suelo no se acepta: se sube al suelo', () => {
    const { targets } = computeDayTargets(male, 'gym');
    const r = checkOverride(male, { ...targets, kcal: 900 });
    expect(r.issues).toContain('kcalBelowFloor');
    expect(r.accepted.kcal).toBe(Math.round(kcalFloor('male', 1805)));
  });
  it('avisa de proteína, grasa y sal fuera de rango', () => {
    const { targets } = computeDayTargets(male, 'gym');
    const r = checkOverride(male, { ...targets, protein: 30, fat: 20, saltMax: 9 });
    expect(r.issues).toEqual(expect.arrayContaining(['proteinLow', 'fatLow', 'saltAboveMax', 'macrosMismatch']));
  });
});
