import { create } from 'zustand';
import { db } from './db';
import type { BodyProfile, DayType, Language, Targets, Trip } from '../domain/types';

export type TargetOverrides = Partial<Record<DayType, Targets>>;

interface PersistedState {
  language: Language | null;
  trip: Trip | null;
  profile: BodyProfile | null;
  overrides: TargetOverrides;
  onboarded: boolean;
}

interface AppState extends PersistedState {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (l: Language) => Promise<void>;
  setTrip: (t: Trip) => Promise<void>;
  setProfile: (p: BodyProfile) => Promise<void>;
  setOverride: (d: DayType, t: Targets | null) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  deleteAll: () => Promise<void>;
}

const initial: PersistedState = {
  language: null,
  trip: null,
  profile: null,
  overrides: {},
  onboarded: false,
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
  deleteAll: async () => {
    await db.kv.clear();
    set({ ...initial, hydrated: true });
  },
}));
