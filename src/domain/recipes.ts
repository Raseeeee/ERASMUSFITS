/**
 * Recetas: macros y coste SIEMPRE calculados a partir de ingredientes y precios
 * (SPEC §8). Etiquetas derivadas, filtros y orden de sugerencias. Lógica pura.
 */
import { nutrientsFor, sumNutrients, type Food, type LocalizedText, type Nutrients } from './foods';
import type { Remaining } from './log';
import { costFor, type PriceTable } from './prices';
import type { CountryCode, Goal } from './types';

export type RecipeKind = 'breakfast' | 'main';
export type Equipment = 'stove' | 'microwave' | 'kettle';

export interface Recipe {
  id: string;
  country: CountryCode;
  kind: RecipeKind;
  title: LocalizedText;
  /** Etiquetas descriptivas ("local"…). Las nutricionales se calculan. */
  tags: string[];
  minutes: number;
  servings: number;
  equipment: Equipment[];
  ingredients: { foodId: string; grams: number }[];
  steps: { es: string[]; en: string[] };
}

export interface RecipeInfo {
  recipe: Recipe;
  perServing: Nutrients;
  /** null si falta el precio de algún ingrediente. */
  costPerServing: number | null;
  missingPrices: string[];
  vegetarian: boolean;
  highProtein: boolean;
  goals: Goal[];
}

const MEAT_FISH = new Set(['meat', 'fish']);

export function recipeNutrients(recipe: Recipe, foods: Map<string, Food>): { total: Nutrients; perServing: Nutrients } {
  const parts = recipe.ingredients.map((i) => {
    const f = foods.get(i.foodId);
    if (!f) throw new Error(`Ingrediente desconocido: ${i.foodId}`);
    return nutrientsFor(f, i.grams, 'home');
  });
  const total = sumNutrients(parts);
  const k = 1 / recipe.servings;
  const perServing = sumNutrients([
    {
      kcal: total.kcal * k,
      p: total.p * k,
      c: total.c * k,
      f: total.f * k,
      fiber: total.fiber * k,
      sugar: total.sugar * k,
      salt: total.salt * k,
    },
  ]);
  return { total, perServing };
}

export function recipeCost(recipe: Recipe, table: PriceTable): { total: number | null; perServing: number | null; missing: string[] } {
  let total = 0;
  const missing: string[] = [];
  for (const i of recipe.ingredients) {
    const c = costFor(i.foodId, i.grams, table);
    if (c === null) missing.push(i.foodId);
    else total += c;
  }
  if (missing.length) return { total: null, perServing: null, missing };
  return { total, perServing: total / recipe.servings, missing };
}

export function isVegetarian(recipe: Recipe, foods: Map<string, Food>): boolean {
  return recipe.ingredients.every((i) => !MEAT_FISH.has(foods.get(i.foodId)?.category ?? ''));
}

/** Alta en proteína: ≥ 20 g por ración y ≥ 25 % de las kcal. */
export function isHighProtein(n: Nutrients): boolean {
  return n.p >= 20 && (n.p * 4) / Math.max(n.kcal, 1) >= 0.25;
}

/**
 * Objetivos a los que encaja una ración (orientativo):
 * lose ≤ 600 kcal y ≥ 20 % proteína; gain ≥ 450 kcal (comida) o ≥ 350 (desayuno);
 * recomp ≥ 25 % proteína; maintain siempre.
 */
export function recipeGoals(n: Nutrients, kind: RecipeKind): Goal[] {
  const proteinShare = (n.p * 4) / Math.max(n.kcal, 1);
  const goals: Goal[] = ['maintain'];
  if (n.kcal <= 600 && proteinShare >= 0.2) goals.push('lose');
  if (n.kcal >= (kind === 'main' ? 450 : 350)) goals.push('gain');
  if (proteinShare >= 0.25) goals.push('recomp');
  return goals;
}

export function recipeInfo(recipe: Recipe, foods: Map<string, Food>, table: PriceTable): RecipeInfo {
  const { perServing } = recipeNutrients(recipe, foods);
  const cost = recipeCost(recipe, table);
  return {
    recipe,
    perServing,
    costPerServing: cost.perServing,
    missingPrices: cost.missing,
    vegetarian: isVegetarian(recipe, foods),
    highProtein: isHighProtein(perServing),
    goals: recipeGoals(perServing, recipe.kind),
  };
}

export interface RecipeFilter {
  goal?: Goal;
  maxMinutes?: number;
  maxCostPerServing?: number;
  vegetarian?: boolean;
  kind?: RecipeKind;
}

export function filterRecipes<T extends RecipeInfo>(list: T[], f: RecipeFilter): T[] {
  return list.filter(
    (r) =>
      (!f.goal || r.goals.includes(f.goal)) &&
      (f.maxMinutes === undefined || r.recipe.minutes <= f.maxMinutes) &&
      (f.maxCostPerServing === undefined || (r.costPerServing !== null && r.costPerServing <= f.maxCostPerServing)) &&
      (!f.vegetarian || r.vegetarian) &&
      (!f.kind || r.recipe.kind === f.kind),
  );
}

/**
 * Encaje con lo que queda del día (mayor = mejor): premia cubrir la proteína que
 * falta y penaliza pasarse de kcal o grasa. Sin restantes (día lleno o pasado),
 * prima la ración más ligera.
 */
export function fitScore(n: Nutrients, rem: Remaining): number {
  if (rem.kcal <= 0) return -n.kcal / 1000;
  const protein = rem.p > 0 ? Math.min(n.p, rem.p) / rem.p : 0;
  const kcalOver = Math.max(0, n.kcal - rem.kcal) / rem.kcal;
  const fatOver = rem.f > 0 ? Math.max(0, n.f - rem.f) / rem.f : n.f > 0 ? 1 : 0;
  const carbOver = rem.c > 0 ? Math.max(0, n.c - rem.c) / rem.c : 0;
  return protein - 2 * kcalOver - fatOver - 0.5 * carbOver;
}

/** Orden de sugerencias: encaje con macros restantes (en tramos de 0,1) y luego menor coste por ración. */
export function sortSuggestions<T extends RecipeInfo>(list: T[], rem: Remaining): T[] {
  const bucket = (r: RecipeInfo) => Math.round(fitScore(r.perServing, rem) * 10);
  return [...list].sort(
    (a, b) =>
      bucket(b) - bucket(a) ||
      (a.costPerServing ?? Infinity) - (b.costPerServing ?? Infinity) ||
      a.recipe.id.localeCompare(b.recipe.id),
  );
}

/** Ingredientes a registrar al comer `servingsEaten` raciones. */
export function ingredientsForServings(recipe: Recipe, servingsEaten: number): { foodId: string; grams: number }[] {
  const k = servingsEaten / recipe.servings;
  return recipe.ingredients.map((i) => ({ foodId: i.foodId, grams: Math.round(i.grams * k) }));
}
