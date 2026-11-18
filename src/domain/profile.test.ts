import { describe, expect, it } from 'vitest';
import { activeCountry, validateProfile, validateTrip } from './profile';
import type { BodyProfile } from './types';

const ok: BodyProfile = {
  sex: 'female', age: 21, weightKg: 62, heightCm: 168,
  goal: 'maintain', activity: 'light', sports: [{ sport: 'gym', daysPerWeek: 3 }],
};

describe('validateProfile', () => {
  it('perfil válido', () => expect(validateProfile(ok)).toEqual([]));
  it('menor de 18 bloquea', () => expect(validateProfile({ ...ok, age: 17 })).toEqual(['underage']));
  it('rangos de peso/estatura', () => {
    expect(validateProfile({ ...ok, weightKg: 10, heightCm: 300 })).toEqual(['weightKg', 'heightCm']);
    expect(validateProfile({ ...ok, age: NaN })).toEqual(['age']);
  });
  it('lose con IMC bajo no permitido', () => {
    expect(validateProfile({ ...ok, weightKg: 50, heightCm: 180, goal: 'lose' })).toEqual(['goalNotAllowed']);
  });
  it('días por semana 0–7', () => {
    expect(validateProfile({ ...ok, sports: [{ sport: 'running', daysPerWeek: 8 }] })).toEqual(['daysPerWeek']);
  });
});

describe('trip', () => {
  it('origen y destino distintos', () => {
    expect(validateTrip({ erasmus: true, origin: 'ES', destination: 'ES' })).toBe(false);
    expect(validateTrip({ erasmus: true, origin: 'ES', destination: 'TR' })).toBe(true);
    expect(validateTrip({ erasmus: false, nationality: 'PL' })).toBe(true);
  });
  it('país activo', () => {
    expect(activeCountry({ erasmus: true, origin: 'ES', destination: 'TR' })).toBe('TR');
    expect(activeCountry({ erasmus: false, nationality: 'PL' })).toBe('PL');
  });
});
