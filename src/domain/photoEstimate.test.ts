import { describe, expect, it } from 'vitest';
import { MAX_ITEMS, photoItemToFood, sanitizeEstimate } from './photoEstimate';
import { nutrientsFor } from './foods';

const rice = {
  name: 'Arroz blanco',
  grams: 180,
  state: 'cooked',
  category: 'grain',
  per100g: { kcal: 130, p: 2.7, c: 28, f: 0.3, fiber: 0.4, sugar: 0, salt: 0 },
};

describe('sanitizeEstimate', () => {
  it('acepta una respuesta válida', () => {
    const e = sanitizeEstimate({ isFood: true, items: [rice] });
    expect(e).toEqual({ isFood: true, items: [{ ...rice }] });
  });

  it('rechaza formas inesperadas', () => {
    expect(sanitizeEstimate(null)).toBeNull();
    expect(sanitizeEstimate({ items: [] })).toBeNull();
    expect(sanitizeEstimate({ isFood: true, items: 'x' })).toBeNull();
  });

  it('descarta ingredientes sin nombre o sin gramos y marca isFood=false si no queda nada', () => {
    const e = sanitizeEstimate({ isFood: true, items: [{ ...rice, name: ' ' }, { ...rice, grams: 0 }] });
    expect(e).toEqual({ isFood: false, items: [] });
  });

  it('recorta valores imposibles y negativos', () => {
    const e = sanitizeEstimate({
      isFood: true,
      items: [{ ...rice, grams: 99999, per100g: { kcal: 400, p: 80, c: 80, f: -5, fiber: 0, sugar: 0, salt: 0 } }],
    })!;
    const it = e.items[0];
    expect(it.grams).toBe(1500);
    expect(it.per100g.f).toBe(0);
    expect(it.per100g.p + it.per100g.c).toBeLessThanOrEqual(100);
  });

  it('recalcula las kcal si no cuadran con los macros', () => {
    const e = sanitizeEstimate({ isFood: true, items: [{ ...rice, per100g: { ...rice.per100g, kcal: 900 } }] })!;
    expect(e.items[0].per100g.kcal).toBe(Math.round(2.7 * 4 + 28 * 4 + 0.3 * 9));
  });

  it('categoría desconocida → other; estado desconocido → cocinado; máximo de ingredientes', () => {
    const e = sanitizeEstimate({
      isFood: true,
      items: Array.from({ length: 20 }, () => ({ ...rice, category: 'pizza', state: '?' })),
    })!;
    expect(e.items).toHaveLength(MAX_ITEMS);
    expect(e.items[0].category).toBe('other');
    expect(e.items[0].state).toBe('cooked');
  });
});

describe('photoItemToFood', () => {
  it('no suma grasa de cafetería (ya está en la foto)', () => {
    const food = photoItemToFood(sanitizeEstimate({ isFood: true, items: [rice] })!.items[0], 'x');
    expect(nutrientsFor(food, 180, 'canteen')).toEqual(nutrientsFor(food, 180, 'home'));
    expect(nutrientsFor(food, 180).kcal).toBe(234);
  });
});
