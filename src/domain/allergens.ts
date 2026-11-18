/** Alérgenos / intolerancias para filtrar la compra. Orientativo: revisa siempre la etiqueta. */
import type { Food } from './foods';

export const ALLERGENS = ['gluten', 'lactose', 'nuts', 'egg', 'fish', 'soy'] as const;
export type Allergen = (typeof ALLERGENS)[number];

const GLUTEN_FREE_GRAINS = new Set(['rice_raw', 'rice_cooked', 'buckwheat_raw', 'buckwheat_cooked', 'millet_cooked', 'quinoa_cooked', 'rice_cakes', 'cornflakes']);
const GLUTEN_EXTRA = new Set([
  'gnocchi', 'pierogi', 'manti', 'lahmacun', 'pide', 'borek', 'pizza_margherita', 'lasagna', 'burger',
  'doner_wrap', 'schnitzel', 'chicken_nuggets', 'falafel', 'biscuits', 'croissant', 'paczek', 'baklava',
  'protein_bar', 'granola', 'muesli',
]);
const LACTOSE_FREE_DAIRY = new Set(['soy_drink']);
const LACTOSE_EXTRA = new Set(['butter', 'milk_chocolate', 'ice_cream', 'whey', 'pizza_margherita', 'lasagna', 'borek', 'croissant', 'pierogi', 'manti']);
const NUTS = new Set(['nuts', 'walnuts', 'almonds', 'peanuts', 'hazelnuts', 'peanut_butter', 'choc_spread', 'baklava']);
const EGG = new Set(['egg', 'egg_whites', 'mayonnaise', 'tortilla_espanola', 'lasagna', 'schnitzel', 'croissant', 'paczek', 'pasta_cooked', 'pasta_raw']);
const SOY = new Set(['tofu', 'soy_drink']);

export function foodAllergens(food: Food): Allergen[] {
  const out: Allergen[] = [];
  const id = food.id;
  if (((food.category === 'grain' || food.category === 'pasta' || food.category === 'bread') && !GLUTEN_FREE_GRAINS.has(id)) || GLUTEN_EXTRA.has(id)) out.push('gluten');
  if ((food.category === 'dairy' && !LACTOSE_FREE_DAIRY.has(id)) || LACTOSE_EXTRA.has(id)) out.push('lactose');
  if (NUTS.has(id)) out.push('nuts');
  if (EGG.has(id)) out.push('egg');
  if (food.category === 'fish') out.push('fish');
  if (SOY.has(id)) out.push('soy');
  return out;
}
