import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';
import type { BodyProfile } from '../domain/types';

const profile: BodyProfile = {
  sex: 'male', age: 22, weightKg: 75, heightCm: 178,
  goal: 'recomp', activity: 'moderate', sports: [],
};

describe('appStore (Dexie)', () => {
  beforeEach(async () => {
    await useAppStore.getState().deleteAll();
  });

  it('persiste y rehidrata', async () => {
    const s = useAppStore.getState();
    await s.setLanguage('es');
    await s.setTrip({ erasmus: true, origin: 'ES', destination: 'TR' });
    await s.setProfile(profile);
    await s.completeOnboarding();
    useAppStore.setState({ language: null, trip: null, profile: null, onboarded: false, hydrated: false });
    await useAppStore.getState().hydrate();
    const r = useAppStore.getState();
    expect(r.hydrated).toBe(true);
    expect(r.language).toBe('es');
    expect(r.trip).toEqual({ erasmus: true, origin: 'ES', destination: 'TR' });
    expect(r.profile).toEqual(profile);
    expect(r.onboarded).toBe(true);
  });

  it('cambiar el perfil borra overrides', async () => {
    const s = useAppStore.getState();
    await s.setProfile(profile);
    await s.setOverride('gym', {
      kcal: 2500, protein: 150, carbs: 300, fat: 70, fiber: 35,
      saltMax: 5, sugarMax: 60, sugarIdeal: 30, waterGlasses: 12,
    });
    expect(useAppStore.getState().overrides.gym?.kcal).toBe(2500);
    await s.setProfile({ ...profile, weightKg: 76 });
    expect(useAppStore.getState().overrides).toEqual({});
  });

  it('borrar todo', async () => {
    await useAppStore.getState().setProfile(profile);
    await useAppStore.getState().deleteAll();
    await useAppStore.getState().hydrate();
    expect(useAppStore.getState().profile).toBeNull();
  });
});
