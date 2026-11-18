import { describe, expect, it } from 'vitest';
import { seedFoods } from '../data/foods';
import {
  CANTEEN_EXTRA_FAT,
  FOOD_CATEGORIES,
  canteenExtraFat,
  gramsFor,
  kcalFromMacros,
  makeMyFood,
  normalize,
  nutrientsFor,
  searchFoods,
  sumNutrients,
  type Food,
} from './foods';

const chicken = seedFoods.find((f) => f.id === 'chicken_breast')!;
const egg = seedFoods.find((f) => f.id === 'egg')!;

describe('semilla curada', () => {
  it('150–200 alimentos con ids únicos', () => {
    expect(seedFoods.length).toBeGreaterThanOrEqual(150);
    expect(seedFoods.length).toBeLessThanOrEqual(200);
    expect(new Set(seedFoods.map((f) => f.id)).size).toBe(seedFoods.length);
  });
  it('esquema válido y valores plausibles', () => {
    for (const f of seedFoods) {
      for (const l of ['es', 'en', 'it', 'de', 'pl', 'tr']) expect(f.names[l]?.trim(), `${f.id}.${l}`).toBeTruthy();
      expect(f.unit?.name.es && f.unit?.name.en, f.id).toBeTruthy();
      expect(FOOD_CATEGORIES, f.id).toContain(f.category);
      expect(['raw', 'cooked'], f.id).toContain(f.state);
      expect(f.source).toBe('seed');
      const { p, c, f: fat, fiber, sugar, salt, kcal } = f.per100g;
      for (const v of [p, c, fat, fiber, sugar, salt]) expect(v, f.id).toBeGreaterThanOrEqual(0);
      expect(p + c + fat + fiber, f.id).toBeLessThanOrEqual(100.5);
      expect(sugar, f.id).toBeLessThanOrEqual(c + 0.01);
      expect(kcal, f.id).toBe(kcalFromMacros(f.per100g));
      if (f.unit) expect(f.unit.grams, f.id).toBeGreaterThan(0);
    }
  });
});

describe('grasa extra en cantina por categoría', () => {
  it('valores por defecto revisables', () => {
    expect(CANTEEN_EXTRA_FAT.meat).toBe(4);
    expect(CANTEEN_EXTRA_FAT.salad).toBe(6);
    expect(CANTEEN_EXTRA_FAT.dairy).toBe(0);
    expect(CANTEEN_EXTRA_FAT.prepared).toBe(0);
  });
  it('el valor propio del alimento tiene prioridad', () => {
    expect(canteenExtraFat(chicken)).toBe(4);
    expect(canteenExtraFat({ ...chicken, canteenExtraFatPer100g: 1 })).toBe(1);
  });
});

describe('nutrientsFor', () => {
  it('casa: escala por gramos', () => {
    const n = nutrientsFor(chicken, 200, 'home');
    expect(n).toEqual({ kcal: 312, p: 62, c: 0, f: 7.2, fiber: 0, sugar: 0, salt: 0.4 });
  });
  it('cantina: fat = f + extra·g/100 y kcal recalculadas', () => {
    const n = nutrientsFor(chicken, 200, 'canteen');
    expect(n.f).toBe(15.2);
    expect(n.kcal).toBe(312 + 72);
    expect(n.p).toBe(62);
  });
  it('unidades a gramos', () => {
    expect(gramsFor(egg, 2, 'unit')).toBe(120);
    expect(gramsFor(egg, 50, 'g')).toBe(50);
    expect(gramsFor({ ...egg, unit: null }, 2, 'unit')).toBe(2);
  });
  it('suma de nutrientes', () => {
    const s = sumNutrients([nutrientsFor(chicken, 100), nutrientsFor(egg, 60)]);
    expect(s.p).toBe(38.8);
    expect(s.kcal).toBe(156 + 88); // huevo 146 kcal/100 g × 0.6
  });
});

describe('búsqueda', () => {
  it('normaliza acentos y letras turcas/polacas', () => {
    expect(normalize('  Plátano ')).toBe('platano');
    expect(normalize('Köfte')).toBe('kofte');
    expect(normalize('kırmızı')).toBe('kirmizi');
    expect(normalize('Pierś ŁOSOŚ')).toBe('piers losos');
  });
  it('encuentra por nombre en es o en, prefijo primero', () => {
    expect(searchFoods('pollo', seedFoods, 'es').slice(0, 2).map((f) => f.id)).toContain('chicken_breast');
    expect(searchFoods('pechuga de pollo', seedFoods, 'es')[0].id).toBe('chicken_breast');
    expect(searchFoods('chicken', seedFoods, 'en').map((f) => f.id)).toContain('chicken_breast');
    expect(searchFoods('platano', seedFoods, 'es')[0].id).toBe('banana');
    expect(searchFoods('arroz', seedFoods, 'es').slice(0, 2).map((f) => f.id).sort()).toEqual(['rice_cooked', 'rice_raw']);
    expect(searchFoods('zzzz', seedFoods, 'es')).toEqual([]);
  });
  it('alias multilingües (it/de/pl/tr)', () => {
    expect(searchFoods('tavuk göğsü', seedFoods, 'es')[0].id).toBe('chicken_breast');
    expect(searchFoods('Hähnchenbrust', seedFoods, 'es')[0].id).toBe('chicken_breast');
    expect(searchFoods('piers z kurczaka', seedFoods, 'es')[0].id).toBe('chicken_breast');
    expect(searchFoods('petto di pollo', seedFoods, 'es')[0].id).toBe('chicken_breast');
    expect(searchFoods('mercimek', seedFoods, 'es').map((f) => f.id)).toContain('lentils_raw');
    expect(searchFoods('kasza gryczana', seedFoods, 'es')[0].id).toMatch(/^buckwheat/);
  });
  it('a igual coincidencia, básicos antes que platos preparados', () => {
    const ids = searchFoods('pollo', seedFoods, 'es').map((f) => f.id);
    expect(ids.indexOf('chicken_breast')).toBeLessThan(ids.indexOf('doner_wrap'));
    expect(ids.indexOf('chicken_breast')).toBeLessThan(ids.indexOf('chicken_nuggets'));
  });
  it('mis alimentos tienen prioridad y ocultan al que corrigen', () => {
    const mine: Food = makeMyFood({
      id: 'my-1', name: 'Huevo de mi granja', p: 14, c: 1, f: 9, state: 'cooked', overridesId: 'egg',
    });
    const r = searchFoods('huevo', [...seedFoods, mine], 'es');
    expect(r[0].id).toBe('my-1');
    expect(r.map((f) => f.id)).not.toContain('egg');
  });
  it('mismo nivel de coincidencia: mío antes que semilla', () => {
    const mine = makeMyFood({ id: 'my-2', name: 'Pechuga casera', p: 30, c: 0, f: 2, state: 'cooked' });
    const r = searchFoods('pechuga', [...seedFoods, mine], 'es');
    expect(r[0].id).toBe('my-2');
  });
});

describe('makeMyFood', () => {
  it('kcal derivadas de macros y unidad opcional', () => {
    const f = makeMyFood({ id: 'x', name: 'Barrita', p: 20, c: 40, f: 10, fiber: 5, state: 'raw', unit: { name: 'barrita', grams: 50 } });
    expect(f.per100g.kcal).toBe(80 + 160 + 90 + 10);
    expect(f.unit?.grams).toBe(50);
    expect(f.source).toBe('mine');
    expect(makeMyFood({ id: 'y', name: 'A', p: 1, c: 1, f: 1, state: 'raw', unit: { name: '', grams: 0 } }).unit).toBeNull();
  });
});
