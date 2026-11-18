import { describe, expect, it } from 'vitest';
import { priceTables, seedFoodMap } from '../data/countries';
import { allRecipes, recipesByCountry } from '../data/recipes';
import { nutrientsFor } from './foods';
import {
  filterRecipes,
  fitScore,
  ingredientsForServings,
  isHighProtein,
  recipeCost,
  recipeGoals,
  recipeInfo,
  recipeNutrients,
  sortSuggestions,
  type Recipe,
} from './recipes';
import { COUNTRIES } from './types';

describe('datos de recetas (SPEC §8)', () => {
  it('12 por país: 4 desayuno/snack y 8 comida/cena, ids únicos', () => {
    for (const c of COUNTRIES) {
      const list = recipesByCountry[c];
      expect(list, c).toHaveLength(12);
      expect(list.filter((r) => r.kind === 'breakfast'), c).toHaveLength(4);
      expect(list.filter((r) => r.kind === 'main'), c).toHaveLength(8);
      expect(list.every((r) => r.country === c)).toBe(true);
    }
    expect(new Set(allRecipes.map((r) => r.id)).size).toBe(allRecipes.length);
  });

  it('aptas para residencia: ≤ 20 min, solo placa/microondas/hervidor, pocos ingredientes', () => {
    for (const r of allRecipes) {
      expect(r.minutes, r.id).toBeLessThanOrEqual(20);
      expect(r.ingredients.length, r.id).toBeLessThanOrEqual(6);
      for (const e of r.equipment) expect(['stove', 'microwave', 'kettle']).toContain(e);
      expect(r.steps.es.length, r.id).toBe(r.steps.en.length);
      expect(r.steps.es.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.title.es && r.title.en, r.id).toBeTruthy();
    }
  });

  it('todos los ingredientes existen y tienen precio en su país', () => {
    for (const r of allRecipes) {
      for (const i of r.ingredients) {
        expect(seedFoodMap.has(i.foodId), `${r.id}:${i.foodId}`).toBe(true);
        expect(i.grams, `${r.id}:${i.foodId}`).toBeGreaterThan(0);
      }
      expect(recipeCost(r, priceTables[r.country]).missing, r.id).toEqual([]);
    }
  });

  it('cada país tiene recetas vegetarianas y altas en proteína', () => {
    for (const c of COUNTRIES) {
      const infos = recipesByCountry[c].map((r) => recipeInfo(r, seedFoodMap, priceTables[c]));
      expect(infos.some((i) => i.vegetarian), c).toBe(true);
      expect(infos.some((i) => i.highProtein), c).toBe(true);
      expect(infos.filter((i) => i.goals.includes('lose')).length, c).toBeGreaterThanOrEqual(3);
    }
  });

  it('platos locales pedidos en la spec', () => {
    const ids = allRecipes.map((r) => r.id);
    for (const id of ['tr_menemen', 'tr_mercimek_corbasi', 'tr_bulgur_pilavi_tavuk', 'it_pasta_tonno_pomodoro',
      'pl_salatka_ryz_tunczyk', 'pl_kasza_jajko', 'de_quark_hafer_apfel', 'es_arroz_huevo_atun', 'es_lentejas_rapidas']) {
      expect(ids).toContain(id);
    }
  });
});

const tiny: Recipe = {
  id: 'x', country: 'ES', kind: 'main', title: { es: 'x', en: 'x' }, tags: [], minutes: 10, servings: 2,
  equipment: ['stove'],
  ingredients: [{ foodId: 'chicken_breast', grams: 200 }, { foodId: 'rice_raw', grams: 100 }],
  steps: { es: ['a', 'b'], en: ['a', 'b'] },
};

describe('cálculos', () => {
  it('macros por ración desde ingredientes', () => {
    const { total, perServing } = recipeNutrients(tiny, seedFoodMap);
    const chicken = nutrientsFor(seedFoodMap.get('chicken_breast')!, 200);
    const rice = nutrientsFor(seedFoodMap.get('rice_raw')!, 100);
    expect(total.kcal).toBe(chicken.kcal + rice.kcal);
    expect(perServing.p).toBeCloseTo((chicken.p + rice.p) / 2, 1);
  });

  it('coste por ración con rendimiento de la carne', () => {
    const c = recipeCost(tiny, priceTables.ES);
    expect(c.total).toBeCloseTo((6.92 / 0.75) * 0.2 + 1.09 * 0.1, 4);
    expect(c.perServing).toBeCloseTo(c.total! / 2, 6);
    const missing = recipeCost({ ...tiny, ingredients: [{ foodId: 'whey', grams: 30 }] }, priceTables.ES);
    expect(missing.total).toBeNull();
    expect(missing.missing).toEqual(['whey']);
  });

  it('etiquetas derivadas', () => {
    expect(isHighProtein({ kcal: 400, p: 35, c: 30, f: 10, fiber: 0, sugar: 0, salt: 0 })).toBe(true);
    expect(isHighProtein({ kcal: 600, p: 20, c: 90, f: 15, fiber: 0, sugar: 0, salt: 0 })).toBe(false);
    expect(recipeGoals({ kcal: 450, p: 35, c: 40, f: 12, fiber: 0, sugar: 0, salt: 0 }, 'main'))
      .toEqual(['maintain', 'lose', 'gain', 'recomp']);
    expect(recipeGoals({ kcal: 800, p: 20, c: 120, f: 25, fiber: 0, sugar: 0, salt: 0 }, 'main'))
      .toEqual(['maintain', 'gain']);
  });

  it('ingredientes escalados por raciones comidas', () => {
    expect(ingredientsForServings(tiny, 1)).toEqual([
      { foodId: 'chicken_breast', grams: 100 },
      { foodId: 'rice_raw', grams: 50 },
    ]);
  });
});

describe('filtros y orden de sugerencias', () => {
  const infos = recipesByCountry.TR.map((r) => recipeInfo(r, seedFoodMap, priceTables.TR));

  it('filtra por objetivo, tiempo, presupuesto, vegetariano y tipo', () => {
    expect(filterRecipes(infos, { vegetarian: true }).every((i) => i.vegetarian)).toBe(true);
    expect(filterRecipes(infos, { maxMinutes: 10 }).every((i) => i.recipe.minutes <= 10)).toBe(true);
    expect(filterRecipes(infos, { maxCostPerServing: 50 }).every((i) => i.costPerServing! <= 50)).toBe(true);
    expect(filterRecipes(infos, { kind: 'breakfast' })).toHaveLength(4);
    expect(filterRecipes(infos, { goal: 'lose' }).every((i) => i.goals.includes('lose'))).toBe(true);
  });

  it('con mucha proteína pendiente, primero lo que la cubre sin pasarse', () => {
    const rem = { kcal: 900, p: 60, c: 100, f: 30 };
    const first = sortSuggestions(infos, rem)[0];
    expect(first.highProtein).toBe(true);
    expect(first.perServing.kcal).toBeLessThanOrEqual(900);
  });

  it('con el día casi lleno, penaliza raciones grandes', () => {
    const light = { kcal: 200, p: 10, c: 20, f: 5, fiber: 0, sugar: 0, salt: 0 };
    const heavy = { ...light, kcal: 800, p: 40, c: 90, f: 30 };
    const rem = { kcal: 250, p: 15, c: 30, f: 8 };
    expect(fitScore(light, rem)).toBeGreaterThan(fitScore(heavy, rem));
  });

  it('a igual encaje, más barata primero', () => {
    const rem = { kcal: 0, p: 0, c: 0, f: 0 };
    const [a, b] = [infos[0], infos[1]];
    const same = { ...a.perServing };
    const sorted = sortSuggestions(
      [{ ...a, perServing: same, costPerServing: 30 }, { ...b, perServing: same, costPerServing: 10 }],
      rem,
    );
    expect(sorted[0].costPerServing).toBe(10);
  });
});
