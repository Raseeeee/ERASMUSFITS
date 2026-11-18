import { create } from 'zustand';
import { db } from './db';
import type { BodyProfile, DayType, Language, Targets, Trip } from '../domain/types';
import type { ShoppingPreferences } from '../domain/optimizer';
import { clampAdjustment } from '../domain/coach';

export type TargetOverrides = Partial<Record<DayType, Targets>>;

interface PersistedState {
  language: Language | null;
  trip: Trip | null;
  profile: BodyProfile | null;
  overrides: TargetOverrides;
  onboarded: boolean;
  shopPrefs: ShoppingPreferences;
  /** id de aviso → fecha en que se descartó. */
  dismissedAlerts: Record<string, string>;
  lastKcalAdjust: string | null;
  lowTargetAttempts: number;
}

interface AppState extends PersistedState {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (l: Language) => Promise<void>;
  setTrip: (t: Trip) => Promise<void>;
  setProfile: (p: BodyProfile) => Promise<void>;
  setOverride: (d: DayType, t: Targets | null) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setShopPrefs: (p: ShoppingPreferences) => Promise<void>;
  dismissAlert: (id: string, date: string) => Promise<void>;
  applyKcalAdjustment: (delta: number, date: string) => Promise<void>;
  resetKcalAdjustment: () => Promise<void>;
  recordLowTargetAttempt: () => Promise<void>;
  /** Actualiza el peso del perfil (último pesaje) sin borrar los overrides. */
  setCurrentWeight: (kg: number) => Promise<void>;
  deleteAll: () => Promise<void>;
}

const initial: PersistedState = {
  language: null,
  trip: null,
  profile: null,
  overrides: {},
  onboarded: false,
  shopPrefs: {},
  dismissedAlerts: {},
  lastKcalAdjust: null,
  lowTargetAttempts: 0,
};

const KEYS = Object.keys(initial) as (keyof PersistedState)[];

async function put<K extends keyof PersistedState>(key: K, value: PersistedState[K]) {
  await db.kv.put({ key, value });
}

export const useAppStore = create<AppState>((set, get) => ({
  ...initial,
  hydrated: false,

  hydrate: async () => {
    const rows = await db.kv.bulkGet(KEYS);
    const loaded: Partial<PersistedState> = {};
    rows.forEach((r, i) => {
      if (r) (loaded as Record<string, unknown>)[KEYS[i]] = r.value;
    });
    set({ ...initial, ...loaded, hydrated: true });
  },

  setLanguage: async (language) => {
    set({ language });
    await put('language', language);
  },
  setTrip: async (trip) => {
    set({ trip });
    await put('trip', trip);
  },
  setProfile: async (profile) => {
    // Un perfil nuevo invalida los overrides manuales previos.
    set({ profile, overrides: {} });
    await Promise.all([put('profile', profile), put('overrides', {})]);
  },
  setOverride: async (day, targets) => {
    const overrides = { ...get().overrides };
    if (targets) overrides[day] = targets;
    else delete overrides[day];
    set({ overrides });
    await put('overrides', overrides);
  },
  completeOnboarding: async () => {
    set({ onboarded: true });
    await put('onboarded', true);
  },
  setShopPrefs: async (shopPrefs) => {
    set({ shopPrefs });
    await put('shopPrefs', shopPrefs);
  },
  dismissAlert: async (id, date) => {
    const dismissedAlerts = { ...get().dismissedAlerts, [id]: date };
    set({ dismissedAlerts });
    await put('dismissedAlerts', dismissedAlerts);
  },
  applyKcalAdjustment: async (delta, date) => {
    const p = get().profile;
    if (!p) return;
    const profile = { ...p, kcalAdjustment: clampAdjustment((p.kcalAdjustment ?? 0) + delta) };
    set({ profile, lastKcalAdjust: date });
    await Promise.all([put('profile', profile), put('lastKcalAdjust', date)]);
  },
  resetKcalAdjustment: async () => {
    const p = get().profile;
    if (!p) return;
    const profile = { ...p, kcalAdjustment: 0 };
    set({ profile });
    await put('profile', profile);
  },
  recordLowTargetAttempt: async () => {
    const lowTargetAttempts = get().lowTargetAttempts + 1;
    set({ lowTargetAttempts });
    await put('lowTargetAttempts', lowTargetAttempts);
  },
  setCurrentWeight: async (kg) => {
    const p = get().profile;
    if (!p) return;
    const profile = { ...p, weightKg: kg };
    set({ profile });
    await put('profile', profile);
  },
  deleteAll: async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    set({ ...initial, hydrated: true });
  },
}));
