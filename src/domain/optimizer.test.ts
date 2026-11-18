import { describe, expect, it } from 'vitest';
import { priceTables, seedFoodMap } from '../data/countries';
import { seedFoods } from '../data/foods';
import { foodAllergens } from './allergens';
import type { Food } from './foods';
import {
  FRUIT_VEG_G_PER_DAY,
  MIN_DISTINCT,
  candidateFoods,
  optimizeBasket,
  solveStep,
  typicalWeek,
  weeklyTargets,
  type MacroTargets,
  type Rules,
} from './optimizer';
import type { PriceTable } from './prices';
import { COUNTRIES, type BodyProfile } from './types';

const food = (id: string, category: Food['category'], p: number, c: number, f: number): Food => ({
  id, names: { es: id, en: id }, category, state: 'raw', unit: null, source: 'seed',
  per100g: { kcal: Math.round(4 * p + 4 * c + 9 * f), p, c, f, fiber: 0, sugar: 0, salt: 0 },
});
const price = (pricePerKg: number) => ({ pricePerKg, store: 't', date: '2026-11-18', confidence: 'estimado' as const, source: 'test' });

describe('caso con solución conocida', () => {
  // Proteína pura barata y cara, carbohidrato puro y grasa pura.
  const P = food('quark', 'dairy', 25, 0, 1); // 109 kcal/100 g
  const P2 = food('skyr', 'dairy', 25, 0, 1); // igual pero 3× más caro
  const C = food('potato_boiled', 'potato', 0, 80, 0); // 320 kcal/100 g
  const F = food('olive_oil', 'fat', 0, 0, 100); // 900 kcal/100 g
  const table: PriceTable = {
    country: 'ES', currency: 'EUR', updated: '2026-11-18',
    items: { quark: price(10), skyr: price(30), potato_boiled: price(2), olive_oil: price(5) },
  };
  const target: MacroTargets = { kcal: 7350, p: 500, c: 1000, f: 150 };
  const rules: Rules = { macroTol: 0.05, minDistinct: 1, fruitVegPerDay: 0, onlyKcalProtein: false };

  it('minimiza coste llevando cada macro a su mínimo y sin usar el alimento caro', () => {
    const r = solveStep([P, P2, C, F], table, target, rules)!;
    expect(r).not.toBeNull();
    const by = Object.fromEntries(r.items.map((i) => [i.foodId, i.gramsWeek]));
    expect(by.skyr).toBeUndefined();
    expect(by.quark).toBeCloseTo(1900, -1); // p = 475 (−5 %)
    expect(by.potato_boiled).toBeCloseTo(1188, -1); // c = 950
    expect(by.olive_oil).toBeCloseTo(124, -1); // f = 142.5
    expect(r.totals.kcal).toBeGreaterThanOrEqual(Math.floor(7350 * 0.95));
    expect(r.totals.kcal).toBeLessThanOrEqual(Math.ceil(7350 * 1.05));
  });

  it('la variedad mínima obliga a usar más alimentos aunque cueste más', () => {
    const r = solveStep([P, P2, C, F], table, target, { ...rules, minDistinct: 4 })!;
    expect(r.items.map((i) => i.foodId).sort()).toEqual(['olive_oil', 'potato_boiled', 'quark', 'skyr']);
  });

  it('infactible si los macros son imposibles con los límites', () => {
    expect(solveStep([P, C], table, { kcal: 100000, p: 10000, c: 1000, f: 150 }, rules)).toBeNull();
  });

  it('relaja por pasos y avisa del motivo', () => {
    const r = optimizeBasket([P, P2, C, F], table, target);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.relaxations).toContain('varietyReduced');
      expect(r.relaxations).toContain('fruitVegReduced');
    }
    expect(optimizeBasket([P, C], table, target)).toEqual({ status: 'infeasible', reason: 'tooFewFoods', candidates: 2 });
  });
});

const profile: BodyProfile = {
  sex: 'male', age: 22, weightKg: 75, heightCm: 178, goal: 'maintain', activity: 'moderate',
  sports: [{ sport: 'gym', daysPerWeek: 3 }],
};

describe('semana tipo y objetivos semanales', () => {
  it('días de entreno según deportes; resto ligeros', () => {
    expect(typicalWeek(profile)).toEqual(['gym', 'gym', 'gym', 'light', 'light', 'light', 'light']);
    expect(typicalWeek({ ...profile, sports: [{ sport: 'triathlon', daysPerWeek: 2 }, { sport: 'gym', daysPerWeek: 7 }] }))
      .toEqual(['long_endurance', 'run', 'gym', 'gym', 'gym', 'gym', 'gym']);
  });
  it('suma de 7 días', () => {
    const w = weeklyTargets(profile);
    expect(w.kcal).toBeGreaterThan(7 * 2000);
    expect(w.p).toBe(7 * Math.round(1.6 * 75));
  });
});

describe('cesta real por país', () => {
  const target = weeklyTargets(profile);

  for (const c of COUNTRIES) {
    it(`${c}: solución estricta (±5 %, ≥ ${MIN_DISTINCT} alimentos, fruta/verdura) en poco tiempo`, () => {
      const t0 = Date.now();
      const r = optimizeBasket(seedFoods, priceTables[c], target);
      const ms = Date.now() - t0;
      expect(r.status).toBe('ok');
      if (r.status !== 'ok') return;
      expect(ms).toBeLessThan(8000);
      expect(r.relaxations).toEqual([]);
      expect(r.items.length).toBeGreaterThanOrEqual(MIN_DISTINCT);
      for (const k of ['kcal', 'p', 'c', 'f'] as const) {
        expect(r.totals[k], k).toBeGreaterThanOrEqual(target[k] * 0.95 - 1);
        expect(r.totals[k], k).toBeLessThanOrEqual(target[k] * 1.05 + 1);
      }
      const fv = r.items
        .filter((i) => ['fruit', 'vegetable', 'salad'].includes(seedFoodMap.get(i.foodId)!.category))
        .reduce((a, i) => a + i.gramsWeek, 0);
      expect(fv).toBeGreaterThanOrEqual(FRUIT_VEG_G_PER_DAY * 7 - 5);
      expect(r.totalCost).toBeGreaterThan(0);
      expect(r.costPerDay).toBeCloseTo(r.totalCost / 7);
      for (const i of r.items) expect(i.buyGrams % 50).toBe(0);
    }, 20000);
  }

  it('vegetariano y sin gluten ni lactosa respetan las preferencias', () => {
    const r = optimizeBasket(seedFoods, priceTables.ES, target, { vegetarian: true, allergies: ['gluten', 'lactose'] });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    for (const i of r.items) {
      const f = seedFoodMap.get(i.foodId)!;
      expect(['meat', 'fish']).not.toContain(f.category);
      expect(foodAllergens(f)).not.toContain('gluten');
      expect(foodAllergens(f)).not.toContain('lactose');
    }
  }, 20000);

  it('excluidos y modo rápido', () => {
    const cands = candidateFoods(seedFoods, priceTables.TR, { excluded: ['bulgur_raw'], quick: true });
    const ids = cands.map((f) => f.id);
    expect(ids).not.toContain('bulgur_raw');
    expect(ids).not.toContain('lentils_raw');
    expect(ids).toContain('red_lentils_raw');
  });
});
