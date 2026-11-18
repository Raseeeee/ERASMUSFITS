export const COUNTRIES = ['ES', 'IT', 'DE', 'PL', 'TR'] as const;
export type CountryCode = (typeof COUNTRIES)[number];

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const SEXES = ['male', 'female', 'unspecified'] as const;
/** Sexo a efectos de cálculo. `unspecified` = media de ambas fórmulas. */
export type Sex = (typeof SEXES)[number];

export const GOALS = ['lose', 'maintain', 'gain', 'recomp'] as const;
export type Goal = (typeof GOALS)[number];

export const DAY_TYPES = ['rest', 'light', 'gym', 'run', 'long_endurance'] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'high'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const SPORTS = ['gym', 'running', 'triathlon', 'other'] as const;
export type Sport = (typeof SPORTS)[number];

export interface SportPlan {
  sport: Sport;
  daysPerWeek: number;
}

export type Trip =
  | { erasmus: true; origin: CountryCode; destination: CountryCode }
  | { erasmus: false; nationality: CountryCode };

export interface BodyProfile {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  goal: Goal;
  activity: ActivityLevel;
  sports: SportPlan[];
  /** Déficit para `lose`, en fracción (0.15 por defecto, máx. 0.25). */
  loseDeficit?: number;
  /** Ajuste de kcal aceptado por el usuario a propuesta del coach (±500 máx.). */
  kcalAdjustment?: number;
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Tope de sal (g). */
  saltMax: number;
  /** Tope de azúcares libres (g), 10 % kcal. */
  sugarMax: number;
  /** Objetivo ideal de azúcares libres (g), 5 % kcal. */
  sugarIdeal: number;
  waterGlasses: number;
}

export type TargetWarning =
  | 'floorApplied'
  | 'loseBlockedLowBmi'
  | 'macrosExceedKcal';

export interface DayTargets {
  dayType: DayType;
  targets: Targets;
  warnings: TargetWarning[];
}
