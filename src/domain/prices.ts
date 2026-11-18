/** Precios, coste por ración y equivalencias "alimento de casa → local más barato". Lógica pura. */
import type { Food } from './foods';
import type { CountryCode } from './types';

export type Currency = 'EUR' | 'PLN' | 'TRY';
export type PriceConfidence = 'estimado' | 'verificado';

export interface PriceItem {
  /** Precio por kg (o litro) del producto tal como se compra. */
  pricePerKg: number;
  store: string;
  date: string;
  confidence: PriceConfidence;
  source: string;
  /** Peso registrado / peso comprado (p. ej. 0.75 para carne que se registra cocinada). */
  yield?: number;
}

export interface PriceTable {
  country: CountryCode;
  currency: Currency;
  updated: string;
  items: Record<string, PriceItem>;
}

export interface CountryInfo {
  currency: Currency;
  supermarkets: string[];
  staples: string[];
}

export interface SubstitutionGroup {
  basis: 'kcal' | 'protein';
  foods: string[];
}

/** Coste por kg del alimento en el estado en que se registra (cocinado/escurrido). */
export function costPerKgLogged(item: PriceItem): number {
  return item.pricePerKg / (item.yield ?? 1);
}

export function costFor(foodId: string, gramsLogged: number, table: PriceTable): number | null {
  const item = table.items[foodId];
  return item ? (costPerKgLogged(item) * gramsLogged) / 1000 : null;
}

/** Gramos a comprar para obtener `gramsLogged` en el estado registrado. */
export function purchaseGrams(foodId: string, gramsLogged: number, table: PriceTable): number {
  return gramsLogged / (table.items[foodId]?.yield ?? 1);
}

/** Coste por 1000 kcal o por 100 g de proteína (null si no aporta). */
export function costPerBasis(food: Food, item: PriceItem, basis: 'kcal' | 'protein'): number | null {
  const perKg = costPerKgLogged(item);
  if (basis === 'kcal') {
    const kcalPerKg = food.per100g.kcal * 10;
    return kcalPerKg > 0 ? (perKg / kcalPerKg) * 1000 : null;
  }
  const proteinPerKg = food.per100g.p * 10;
  return proteinPerKg > 0 ? (perKg / proteinPerKg) * 100 : null;
}

export interface Equivalent {
  homeFoodId: string;
  basis: 'kcal' | 'protein';
  /** El mismo alimento en el país de destino, si se vende allí. */
  same?: { foodId: string; costPerBasis: number };
  /** El más barato del mismo grupo en destino (puede ser el mismo). */
  cheapest: { foodId: string; costPerBasis: number };
}

/**
 * Para cada básico del país de origen que pertenezca a un grupo de sustitución,
 * devuelve el mismo alimento en destino (si hay precio) y el más barato del grupo
 * por kcal o por proteína.
 */
export function equivalents(
  originStaples: string[],
  destination: PriceTable,
  foods: Map<string, Food>,
  groups: Record<string, SubstitutionGroup>,
): Equivalent[] {
  const out: Equivalent[] = [];
  const seen = new Set<string>();
  for (const homeId of originStaples) {
    const group = Object.values(groups).find((g) => g.foods.includes(homeId));
    if (!group || seen.has(homeId)) continue;
    seen.add(homeId);
    const priced = group.foods
      .map((id) => {
        const food = foods.get(id);
        const item = destination.items[id];
        const cost = food && item ? costPerBasis(food, item, group.basis) : null;
        return cost === null ? null : { foodId: id, costPerBasis: cost };
      })
      .filter((x): x is { foodId: string; costPerBasis: number } => x !== null)
      .sort((a, b) => a.costPerBasis - b.costPerBasis);
    if (priced.length === 0) continue;
    const same = priced.find((p) => p.foodId === homeId);
    out.push({ homeFoodId: homeId, basis: group.basis, cheapest: priced[0], ...(same ? { same } : {}) });
  }
  return out;
}

/** Ahorro relativo de cambiar al más barato (0–1), o 0 si ya es el mismo. */
export function savings(e: Equivalent): number {
  if (!e.same || e.same.foodId === e.cheapest.foodId) return 0;
  return 1 - e.cheapest.costPerBasis / e.same.costPerBasis;
}
