/** Validación del onboarding (pura). */
import { isAdult, isGoalAllowed } from './targets';
import type { BodyProfile, Trip } from './types';

export const RANGES = {
  age: { min: 18, max: 100 },
  weightKg: { min: 35, max: 300 },
  heightCm: { min: 120, max: 230 },
  daysPerWeek: { min: 0, max: 7 },
} as const;

export type ProfileError =
  | 'underage'
  | 'age'
  | 'weightKg'
  | 'heightCm'
  | 'goalNotAllowed'
  | 'daysPerWeek';

const inRange = (v: number, r: { min: number; max: number }) => Number.isFinite(v) && v >= r.min && v <= r.max;

export function validateProfile(p: BodyProfile): ProfileError[] {
  const errors: ProfileError[] = [];
  if (Number.isFinite(p.age) && !isAdult(p.age)) errors.push('underage');
  else if (!inRange(p.age, RANGES.age)) errors.push('age');
  if (!inRange(p.weightKg, RANGES.weightKg)) errors.push('weightKg');
  if (!inRange(p.heightCm, RANGES.heightCm)) errors.push('heightCm');
  if (
    !errors.includes('weightKg') &&
    !errors.includes('heightCm') &&
    !isGoalAllowed(p.goal, p.weightKg, p.heightCm)
  ) {
    errors.push('goalNotAllowed');
  }
  if (p.sports.some((s) => !Number.isInteger(s.daysPerWeek) || !inRange(s.daysPerWeek, RANGES.daysPerWeek))) {
    errors.push('daysPerWeek');
  }
  return errors;
}

export function validateTrip(t: Trip): boolean {
  return t.erasmus ? t.origin !== t.destination : true;
}

/** País cuyos supermercados/recetas usamos: destino si Erasmus, si no nacionalidad. */
export function activeCountry(t: Trip) {
  return t.erasmus ? t.destination : t.nationality;
}
