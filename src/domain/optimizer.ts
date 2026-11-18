/**
 * Optimizador de compra semanal (SPEC §7): programación lineal entera mixta que
 * minimiza el coste sujeto a kcal y macros ±5 %, límites por alimento, variedad
 * mínima, fruta/verdura mínima y preferencias. Si no hay solución, relaja por
 * pasos y devuelve qué se ha relajado. Lógica pura.
 */
import solver, { type Model } from 'javascript-lp-solver';
import { foodAllergens, type Allergen } from './allergens';
import type { Food, FoodCategory } from './foods';
import { targetsForDay } from './log';
import { costPerKgLogged, type PriceTable } from './prices';
import type { BodyProfile, DayType, Targets } from './types';

export interface MacroTargets {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface ShoppingPreferences {
  vegetarian?: boolean;
  allergies?: Allergen[];
  excluded?: string[];
  /** Solo alimentos rápidos (excluye legumbres secas que requieren remojo/cocción larga). */
  quick?: boolean;
}

export type Relaxation = 'macrosWidened' | 'varietyReduced' | 'fruitVegReduced' | 'onlyKcalProtein';

export interface ShoppingItem {
  foodId: string;
  /** Gramos/semana en el estado registrado (cocinado, escurrido…). */
  gramsWeek: number;
  /** Gramos a comprar (crudo/en seco), redondeados hacia arriba a 50 g. */
  buyGrams: number;
  cost: number;
}

export type OptimizerResult =
  | {
      status: 'ok';
      items: ShoppingItem[];
      totalCost: number;
      costPerDay: number;
      totals: MacroTargets;
      relaxations: Relaxation[];
    }
  | { status: 'infeasible'; reason: 'tooFewFoods' | 'noSolution'; candidates: number };

/** Categorías que se usan para la cesta (sin platos preparados, dulces ni suplementos). */
const BASKET_CATEGORIES = new Set<FoodCategory>([
  'meat', 'fish', 'egg', 'grain', 'pasta', 'bread', 'potato', 'legume', 'dairy', 'fruit', 'vegetable', 'salad', 'fat', 'nuts',
]);
const FRUIT_VEG = new Set<FoodCategory>(['fruit', 'vegetable', 'salad']);
/** Legumbres secas: remojo/cocción larga, fuera en modo rápido. */
const LONG_COOK = new Set(['lentils_raw', 'chickpeas_raw', 'beans_white_raw']);

/** Máximo de gramos/día por categoría (estado registrado) para evitar soluciones absurdas. */
export const MAX_G_PER_DAY: Record<string, number> = {
  meat: 250, fish: 250, egg: 180, grain: 150, pasta: 150, bread: 200, potato: 500, legume: 120,
  dairy: 500, fruit: 250, vegetable: 200, salad: 200, fat: 35, nuts: 40,
};
/** Excepciones por alimento. */
export const MAX_G_PER_DAY_FOOD: Record<string, number> = {
  cheese_hard: 60, white_cheese: 80, mozzarella: 125, parmesan: 20, butter: 20, olives: 40,
  couscous_cooked: 400, millet_cooked: 400, barley_cooked: 400, quinoa_cooked: 400,
  lentils_cooked: 350, chickpeas_cooked: 350, beans_canned: 350, kidney_beans_canned: 350, green_peas: 250,
  quark: 400, skyr: 400, twarog: 300, cottage_cheese: 300, greek_yogurt: 300,
  tuna_canned: 120, sardines_canned: 120, serrano_ham: 50, chorizo: 40, sucuk: 40, kielbasa: 80, bratwurst: 100,
  sauerkraut: 150, pickled_cucumber: 80, oats: 100, onion: 100, crushed_tomato: 150, potato_boiled: 400,
};

/** Topes conjuntos por grupo (g/día, estado registrado). */
export const GROUP_MAX_G_PER_DAY: { id: string; max: number; foods: (f: Food) => boolean }[] = [
  { id: 'dryLegumes', max: 120, foods: (f) => f.category === 'legume' && f.state === 'raw' && f.id !== 'tofu' },
  { id: 'cannedLegumes', max: 350, foods: (f) => f.category === 'legume' && f.state === 'cooked' },
  { id: 'fats', max: 35, foods: (f) => f.category === 'fat' },
  { id: 'nuts', max: 50, foods: (f) => f.category === 'nuts' },
];
export const FRUIT_G_PER_DAY = 150;
export const VEG_G_PER_DAY = 200;
/** Mínimo semanal si un alimento entra en la cesta (para que la variedad sea real). */
export const MIN_G_WEEK = 150;
export const MIN_G_WEEK_FOOD: Record<string, number> = {
  olive_oil: 50, sunflower_oil: 50, butter: 50, olives: 100, parmesan: 50, cheese_hard: 100,
  walnuts: 100, almonds: 100, peanuts: 100, hazelnuts: 100, sunflower_seeds: 100, nuts: 100, peanut_butter: 100,
};

export const MIN_DISTINCT = 8;
export const FRUIT_VEG_G_PER_DAY = 400;
export const TOLERANCE = 0.05;

export function maxPerDay(f: Food): number {
  return MAX_G_PER_DAY_FOOD[f.id] ?? MAX_G_PER_DAY[f.category] ?? 0;
}

export function candidateFoods(foods: Food[], table: PriceTable, prefs: ShoppingPreferences = {}): Food[] {
  const excluded = new Set(prefs.excluded ?? []);
  const allergies = new Set(prefs.allergies ?? []);
  return foods.filter(
    (f) =>
      table.items[f.id] &&
      BASKET_CATEGORIES.has(f.category) &&
      maxPerDay(f) > 0 &&
      !excluded.has(f.id) &&
      !(prefs.vegetarian && (f.category === 'meat' || f.category === 'fish')) &&
      !(prefs.quick && LONG_COOK.has(f.id)) &&
      !foodAllergens(f).some((a) => allergies.has(a)),
  );
}

/**
 * Semana tipo: días de entreno según deportes (gym/otros → gym, running → run,
 * triatlón → un long_endurance y el resto run), hasta 7; el resto, días ligeros.
 */
export function typicalWeek(profile: BodyProfile): DayType[] {
  const days: DayType[] = [];
  for (const s of profile.sports) {
    for (let i = 0; i < s.daysPerWeek; i++) {
      if (s.sport === 'triathlon') days.push(i === 0 ? 'long_endurance' : 'run');
      else if (s.sport === 'running') days.push('run');
      else days.push('gym');
    }
  }
  const week = days.slice(0, 7);
  while (week.length < 7) week.push('light');
  return week;
}

export function weeklyTargets(profile: BodyProfile, overrides: Partial<Record<DayType, Targets>> = {}): MacroTargets {
  return typicalWeek(profile)
    .map((d) => targetsForDay(profile, d, overrides))
    .reduce(
      (a, t) => ({ kcal: a.kcal + t.kcal, p: a.p + t.protein, c: a.c + t.carbs, f: a.f + t.fat }),
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
}

export interface Rules {
  macroTol: number;
  minDistinct: number;
  fruitVegPerDay: number;
  onlyKcalProtein: boolean;
}

const LADDER: { rules: Rules; relaxations: Relaxation[] }[] = [
  { rules: { macroTol: TOLERANCE, minDistinct: MIN_DISTINCT, fruitVegPerDay: FRUIT_VEG_G_PER_DAY, onlyKcalProtein: false }, relaxations: [] },
  { rules: { macroTol: 0.1, minDistinct: MIN_DISTINCT, fruitVegPerDay: FRUIT_VEG_G_PER_DAY, onlyKcalProtein: false }, relaxations: ['macrosWidened'] },
  { rules: { macroTol: 0.1, minDistinct: 5, fruitVegPerDay: FRUIT_VEG_G_PER_DAY, onlyKcalProtein: false }, relaxations: ['macrosWidened', 'varietyReduced'] },
  { rules: { macroTol: 0.1, minDistinct: 5, fruitVegPerDay: 200, onlyKcalProtein: false }, relaxations: ['macrosWidened', 'varietyReduced', 'fruitVegReduced'] },
  { rules: { macroTol: 0.1, minDistinct: 3, fruitVegPerDay: 0, onlyKcalProtein: true }, relaxations: ['varietyReduced', 'fruitVegReduced', 'onlyKcalProtein'] },
];

/** Unidades del modelo: x = cientos de gramos por semana (estado registrado). */
function buildModel(cands: Food[], table: PriceTable, target: MacroTargets, r: Rules): Model {
  const constraints: Model['constraints'] = {};
  const variables: Model['variables'] = {};
  const binaries: Record<string, 1> = {};
  const band = (v: number, tol: number) => ({ min: v * (1 - tol), max: v * (1 + tol) });

  constraints.kcal = band(target.kcal, TOLERANCE);
  if (r.onlyKcalProtein) constraints.p = { min: target.p * 0.9 };
  else {
    constraints.p = band(target.p, r.macroTol);
    constraints.c = band(target.c, r.macroTol);
    constraints.f = band(target.f, r.macroTol);
  }
  if (r.fruitVegPerDay > 0) constraints.fruitVeg = { min: (r.fruitVegPerDay * 7) / 100 };
  if (r.fruitVegPerDay >= FRUIT_VEG_G_PER_DAY) {
    constraints.fruit = { min: (FRUIT_G_PER_DAY * 7) / 100 };
    constraints.veg = { min: (VEG_G_PER_DAY * 7) / 100 };
  }
  for (const g of GROUP_MAX_G_PER_DAY) constraints[`grp_${g.id}`] = { max: (g.max * 7) / 100 };
  constraints.distinct = { min: r.minDistinct };

  for (const f of cands) {
    const x = `x_${f.id}`;
    const y = `y_${f.id}`;
    const n = f.per100g;
    const cost = (costPerKgLogged(table.items[f.id]) / 10) * 1; // coste por 100 g registrados
    const maxUnits = (maxPerDay(f) * 7) / 100;
    const minUnits = (MIN_G_WEEK_FOOD[f.id] ?? MIN_G_WEEK) / 100;
    variables[x] = {
      cost,
      kcal: n.kcal,
      p: n.p,
      c: n.c,
      f: n.f,
      [`ub_${f.id}`]: 1,
      [`lb_${f.id}`]: 1,
      ...(FRUIT_VEG.has(f.category) ? { fruitVeg: 1 } : {}),
      ...(f.category === 'fruit' ? { fruit: 1 } : {}),
      ...(f.category === 'vegetable' || f.category === 'salad' ? { veg: 1 } : {}),
      ...Object.fromEntries(GROUP_MAX_G_PER_DAY.filter((g) => g.foods(f)).map((g) => [`grp_${g.id}`, 1])),
    };
    // x ≤ max·y  y  x ≥ min·y  (y = 1 si el alimento entra en la cesta)
    variables[y] = { [`ub_${f.id}`]: -maxUnits, [`lb_${f.id}`]: -minUnits, distinct: 1 };
    constraints[`ub_${f.id}`] = { max: 0 };
    constraints[`lb_${f.id}`] = { min: 0 };
    binaries[y] = 1;
  }

  return {
    optimize: 'cost',
    opType: 'min',
    constraints,
    variables,
    binaries,
    options: { tolerance: 0.02, timeout: 4000 },
  };
}

export function optimizeBasket(
  foods: Food[],
  table: PriceTable,
  target: MacroTargets,
  prefs: ShoppingPreferences = {},
): OptimizerResult {
  const cands = candidateFoods(foods, table, prefs);
  if (cands.length < 3) return { status: 'infeasible', reason: 'tooFewFoods', candidates: cands.length };

  for (const step of LADDER) {
    if (step.rules.minDistinct > cands.length) continue;
    const solved = solveStep(cands, table, target, step.rules);
    if (solved) return { ...solved, relaxations: step.relaxations };
  }
  return { status: 'infeasible', reason: 'noSolution', candidates: cands.length };
}

/** Resuelve un paso con reglas fijas; null si no hay solución. */
export function solveStep(
  cands: Food[],
  table: PriceTable,
  target: MacroTargets,
  rules: Rules,
): Omit<Extract<OptimizerResult, { status: 'ok' }>, 'relaxations'> | null {
  {
    const res = solver.Solve(buildModel(cands, table, target, rules)) as Record<string, number | boolean | undefined>;
    if (!res.feasible) return null;

    const items: ShoppingItem[] = [];
    for (const f of cands) {
      const units = Number(res[`x_${f.id}`] ?? 0);
      if (units <= 1e-6) continue;
      const gramsWeek = Math.round(units * 100);
      const yieldF = table.items[f.id].yield ?? 1;
      const buyGrams = Math.ceil(gramsWeek / yieldF / 50) * 50;
      items.push({ foodId: f.id, gramsWeek, buyGrams, cost: (table.items[f.id].pricePerKg * buyGrams) / 1000 });
    }
    items.sort((a, b) => b.cost - a.cost);
    const totals = cands.reduce(
      (a, f) => {
        const u = Number(res[`x_${f.id}`] ?? 0);
        return { kcal: a.kcal + f.per100g.kcal * u, p: a.p + f.per100g.p * u, c: a.c + f.per100g.c * u, f: a.f + f.per100g.f * u };
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    const totalCost = items.reduce((a, i) => a + i.cost, 0);
    return {
      status: 'ok',
      items,
      totalCost,
      costPerDay: totalCost / 7,
      totals: { kcal: Math.round(totals.kcal), p: Math.round(totals.p), c: Math.round(totals.c), f: Math.round(totals.f) },
    };
  }
}
