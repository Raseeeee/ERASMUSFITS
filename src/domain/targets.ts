/**
 * Cálculo de objetivos nutricionales (SPEC §4). Funciones puras.
 * Todos los valores son orientativos; no es consejo médico.
 */
import type {
  ActivityLevel,
  BodyProfile,
  DayTargets,
  DayType,
  Goal,
  Sex,
  Sport,
  TargetWarning,
  Targets,
} from './types';

export const MIN_AGE = 18;
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Factor de actividad por tipo de día, sobre BMR. */
export const DAY_FACTORS: Record<DayType, number> = {
  rest: 1.3,
  light: 1.4,
  gym: 1.55,
  run: 1.6,
  long_endurance: 1.75,
};

/** Factor habitual (semana tipo / progreso). Valores estándar de Mifflin/Harris. */
export const HABITUAL_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

export const DEFAULT_LOSE_DEFICIT = 0.15;
export const MAX_LOSE_DEFICIT = 0.25;

/** Ajuste calórico de `recomp` por tipo de día. */
export const RECOMP_ADJUST: Record<DayType, number> = {
  rest: -0.1,
  light: -0.05,
  gym: 0,
  run: 0,
  long_endurance: 0,
};

export const PROTEIN_PER_KG: Record<Goal, number> = {
  lose: 2.0,
  recomp: 2.0,
  gain: 1.8,
  maintain: 1.6,
};

export const KCAL_FLOOR: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  unspecified: 1200,
};

export const SALT_MAX_G = 5;
export const FIBER_PER_1000_KCAL = 14;
export const WATER_ML_PER_KG = 35;
export const GLASS_ML = 250;
export const EXTRA_WATER_GLASSES: Record<DayType, number> = {
  rest: 0,
  light: 0,
  gym: 1,
  run: 1,
  long_endurance: 2,
};

export function bmrMale(kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + 5;
}

export function bmrFemale(kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age - 161;
}

/** Mifflin-St Jeor. `unspecified` = media de ambas fórmulas. */
export function bmr(sex: Sex, kg: number, cm: number, age: number): number {
  if (sex === 'male') return bmrMale(kg, cm, age);
  if (sex === 'female') return bmrFemale(kg, cm, age);
  return (bmrMale(kg, cm, age) + bmrFemale(kg, cm, age)) / 2;
}

export function bmi(kg: number, cm: number): number {
  const m = cm / 100;
  return kg / (m * m);
}

export function isAdult(age: number): boolean {
  return age >= MIN_AGE;
}

/** IMC < 18.5 no permite objetivo `lose`. */
export function isGoalAllowed(goal: Goal, kg: number, cm: number): boolean {
  return !(goal === 'lose' && bmi(kg, cm) < 18.5);
}

/** Suelo de kcal: máx(suelo por sexo, 90 % del BMR). */
export function kcalFloor(sex: Sex, bmrValue: number): number {
  return Math.max(KCAL_FLOOR[sex], bmrValue * 0.9);
}

export function goalAdjustment(goal: Goal, dayType: DayType, loseDeficit = DEFAULT_LOSE_DEFICIT): number {
  switch (goal) {
    case 'lose':
      return -Math.min(Math.max(loseDeficit, 0), MAX_LOSE_DEFICIT);
    case 'maintain':
      return 0;
    case 'gain':
      return 0.1;
    case 'recomp':
      return RECOMP_ADJUST[dayType];
  }
}

export function maintenanceKcal(p: BodyProfile): number {
  return Math.round(bmr(p.sex, p.weightKg, p.heightCm, p.age) * HABITUAL_FACTORS[p.activity]);
}

/** Calcula los objetivos para un tipo de día. */
export function computeDayTargets(p: BodyProfile, dayType: DayType): DayTargets {
  const warnings: TargetWarning[] = [];
  let goal = p.goal;
  if (!isGoalAllowed(goal, p.weightKg, p.heightCm)) {
    goal = 'maintain';
    warnings.push('loseBlockedLowBmi');
  }

  const base = bmr(p.sex, p.weightKg, p.heightCm, p.age);
  let kcal = base * DAY_FACTORS[dayType] * (1 + goalAdjustment(goal, dayType, p.loseDeficit));
  const floor = kcalFloor(p.sex, base);
  if (kcal < floor) {
    kcal = floor;
    warnings.push('floorApplied');
  }
  kcal = Math.round(kcal);

  const protein = PROTEIN_PER_KG[goal] * p.weightKg;
  const fat = Math.max(0.8 * p.weightKg, (0.25 * kcal) / KCAL_PER_G.fat);
  let carbs = (kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs;
  if (carbs < 0) {
    carbs = 0;
    warnings.push('macrosExceedKcal');
  }

  const targets: Targets = {
    kcal,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round((kcal / 1000) * FIBER_PER_1000_KCAL),
    saltMax: SALT_MAX_G,
    sugarMax: Math.round((0.1 * kcal) / 4),
    sugarIdeal: Math.round((0.05 * kcal) / 4),
    waterGlasses: waterGlasses(p.weightKg, dayType),
  };
  return { dayType, targets, warnings };
}

export function waterGlasses(kg: number, dayType: DayType): number {
  return Math.ceil((kg * WATER_ML_PER_KG) / GLASS_ML) + EXTRA_WATER_GLASSES[dayType];
}

const SPORT_DAY_TYPES: Record<Sport, DayType[]> = {
  gym: ['gym'],
  running: ['run'],
  triathlon: ['run', 'long_endurance'],
  other: ['gym'],
};

/**
 * Tipos de día relevantes para el resumen: descanso, ligero y los de entreno
 * según deportes previstos (gym por defecto si no hay ninguno).
 */
export function relevantDayTypes(p: Pick<BodyProfile, 'sports'>): DayType[] {
  const set = new Set<DayType>(['rest', 'light']);
  const active = p.sports.filter((s) => s.daysPerWeek > 0);
  if (active.length === 0) set.add('gym');
  for (const s of active) for (const d of SPORT_DAY_TYPES[s.sport]) set.add(d);
  const order: DayType[] = ['rest', 'light', 'gym', 'run', 'long_endurance'];
  return order.filter((d) => set.has(d));
}

export function computeAllTargets(p: BodyProfile, dayTypes: DayType[] = relevantDayTypes(p)): DayTargets[] {
  return dayTypes.map((d) => computeDayTargets(p, d));
}

// ---- Overrides manuales ----------------------------------------------------

export type OverrideIssue =
  | 'kcalBelowFloor'
  | 'kcalTooHigh'
  | 'proteinLow'
  | 'proteinHigh'
  | 'fatLow'
  | 'saltAboveMax'
  | 'macrosMismatch';

export interface OverrideCheck {
  issues: OverrideIssue[];
  /** Objetivos aceptados (kcal por debajo del suelo se sube al suelo). */
  accepted: Targets;
}

/**
 * Valida un override manual. Fuera de rango → aviso. kcal bajo el suelo de
 * seguridad no se acepta: se sube al suelo (SPEC §4 "nunca por debajo").
 */
export function checkOverride(p: BodyProfile, t: Targets): OverrideCheck {
  const issues: OverrideIssue[] = [];
  const base = bmr(p.sex, p.weightKg, p.heightCm, p.age);
  const floor = Math.round(kcalFloor(p.sex, base));
  const accepted = { ...t };
  if (t.kcal < floor) {
    issues.push('kcalBelowFloor');
    accepted.kcal = floor;
  }
  if (t.kcal > base * 2.5) issues.push('kcalTooHigh');
  if (t.protein < 0.8 * p.weightKg) issues.push('proteinLow');
  if (t.protein > 3.0 * p.weightKg) issues.push('proteinHigh');
  if (t.fat < 0.5 * p.weightKg) issues.push('fatLow');
  if (t.saltMax > SALT_MAX_G) issues.push('saltAboveMax');
  const macroKcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  if (Math.abs(macroKcal - accepted.kcal) > accepted.kcal * 0.1) issues.push('macrosMismatch');
  return { issues, accepted };
}
