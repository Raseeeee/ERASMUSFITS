/**
 * Actividad extra registrada en un día, aparte del tipo de día (andar, bici,
 * deporte…). Cuenta como día activo y sube el objetivo de ese día. Lógica pura.
 */
import type { Targets } from './types';

export const ACTIVITY_KINDS = ['walk', 'cycling', 'sport', 'other'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const INTENSITIES = ['light', 'moderate', 'vigorous'] as const;
export type Intensity = (typeof INTENSITIES)[number];

export interface ExtraActivity {
  kind: ActivityKind;
  minutes: number;
  intensity: Intensity;
}

/** MET aproximados por intensidad (Compendium of Physical Activities, valores redondeados). */
export const MET: Record<Intensity, number> = { light: 3, moderate: 5, vigorous: 8 };

/** Fracción del gasto estimado que se suma al objetivo (las estimaciones por MET tienden a pasarse). */
export const EAT_BACK = 0.75;
export const MAX_EXTRA_KCAL = 800;
export const MAX_MINUTES = 600;

export function isValidActivity(a: ExtraActivity | null | undefined): a is ExtraActivity {
  return !!a && Number.isFinite(a.minutes) && a.minutes > 0 && a.minutes <= MAX_MINUTES;
}

/** kcal netas por encima del reposo: (MET − 1) × kg × horas × 0,75, con tope. */
export function activityKcal(weightKg: number, a: ExtraActivity | null | undefined): number {
  if (!isValidActivity(a)) return 0;
  const gross = (MET[a.intensity] - 1) * weightKg * (a.minutes / 60) * EAT_BACK;
  return Math.min(MAX_EXTRA_KCAL, Math.round(gross));
}

/** Vasos de agua extra: +1 desde 30 min, +2 desde 90 min. */
export function activityWater(a: ExtraActivity | null | undefined): number {
  if (!isValidActivity(a)) return 0;
  return a.minutes >= 90 ? 2 : a.minutes >= 30 ? 1 : 0;
}

/**
 * Suma la actividad extra a los objetivos del día: kcal y carbohidratos (combustible
 * de la actividad), fibra proporcional y agua. Proteína y grasa no cambian.
 */
export function withActivity(t: Targets, weightKg: number, a: ExtraActivity | null | undefined): Targets {
  const extra = activityKcal(weightKg, a);
  const water = activityWater(a);
  if (extra === 0 && water === 0) return t;
  const kcal = t.kcal + extra;
  return {
    ...t,
    kcal,
    carbs: t.carbs + Math.round(extra / 4),
    fiber: Math.round((kcal / 1000) * 14),
    sugarMax: Math.round((0.1 * kcal) / 4),
    sugarIdeal: Math.round((0.05 * kcal) / 4),
    waterGlasses: t.waterGlasses + water,
  };
}
