import { describe, expect, it } from 'vitest';
import offSearch from './__fixtures__/off-search.json';
import usdaSearch from './__fixtures__/usda-search.json';
import { seedFoods } from '../data/foods';
import {
  isBarcode,
  normalizeOffProduct,
  normalizeOffSearch,
  normalizeUsdaFood,
  normalizeUsdaSearch,
  toEnglishQuery,
  usdaCategory,
  type OffProduct,
  type UsdaFood,
} from './external';
import { foodQuality } from './foods';

describe('Open Food Facts', () => {
  const foods = normalizeOffSearch(offSearch as { hits: OffProduct[] });

  it('descarta productos sin kcal/macros', () => {
    expect(foods.map((f) => f.id)).not.toContain('off:0000000000001');
    expect(foods).toHaveLength(4);
  });

  it('normaliza por 100 g con marca, país y calidad', () => {
    const hacendado = foods.find((f) => f.barcode === '8402001012051')!;
    expect(hacendado).toMatchObject({
      id: 'off:8402001012051',
      source: 'off',
      brand: 'Hacendado',
      countries: ['ES'],
      state: 'raw',
      sugarIsTotal: true,
      quality: 'incomplete', // falta fibra
    });
    expect(hacendado.names.es).toBe('Yogur griego ligero');
    expect(hacendado.per100g).toEqual({ kcal: 48, p: 5.8, c: 3.8, f: 1.6, fiber: 0, sugar: 3.8, salt: 0.16 });

    const onei = foods.find((f) => f.barcode === '7502209113275')!;
    expect(onei.quality).toBe('complete');
    expect(onei.countries).toBeUndefined(); // México no está en la tabla
    expect(foodQuality(onei)).toBe('complete');
  });

  it('kcal desde kJ y marca como texto separado por comas', () => {
    const kj = foods.find((f) => f.barcode === '0000000000002')!;
    expect(kj.per100g.kcal).toBe(100);
    expect(kj.brand).toBe('Brand A');
    expect(kj.names.es).toBe('Energy in kJ only');
  });

  it('sal desde sodio y rechaza macros incoherentes', () => {
    const p = normalizeOffProduct({
      code: '12345678', product_name: 'X',
      nutriments: { 'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1, sodium_100g: 0.4 },
    });
    expect(p?.per100g.salt).toBe(1);
    expect(normalizeOffProduct({
      code: '1', product_name: 'Y',
      nutriments: { 'energy-kcal_100g': 100, proteins_100g: 60, carbohydrates_100g: 60, fat_100g: 1 },
    })).toBeNull();
  });

  it('detecta códigos de barras', () => {
    expect(isBarcode('8402001012051')).toBe(true);
    expect(isBarcode('12345678')).toBe(true);
    expect(isBarcode('1234')).toBe(false);
    expect(isBarcode('yogur')).toBe(false);
  });
});

describe('USDA FoodData Central', () => {
  const foods = normalizeUsdaSearch(usdaSearch as { foods: UsdaFood[] });

  it('normaliza: carbos disponibles, sodio→sal, estado y categoría', () => {
    const roasted = foods.find((f) => f.id === 'usda:171075')!;
    expect(roasted).toMatchObject({ source: 'usda', state: 'cooked', category: 'meat', quality: 'complete' });
    expect(roasted.per100g).toEqual({ kcal: 197, p: 29.8, c: 0, f: 7.8, fiber: 0, sugar: 0, salt: 0.18 });
    expect(roasted.names.en).toContain('Chicken');
  });

  it('resta la fibra de los carbohidratos por diferencia', () => {
    const f = normalizeUsdaFood({
      fdcId: 1, description: 'Lentils, mature seeds, cooked, boiled', foodCategory: 'Legumes and Legume Products',
      foodNutrients: [
        { nutrientId: 1003, value: 9 }, { nutrientId: 1004, value: 0.4 }, { nutrientId: 1005, value: 20.1 },
        { nutrientId: 1079, value: 7.9 }, { nutrientId: 1008, value: 116 },
      ],
    })!;
    expect(f.per100g.c).toBe(12.2);
    expect(f.per100g.fiber).toBe(7.9);
    expect(f.category).toBe('legume');
    expect(f.state).toBe('cooked');
  });

  it('descarta sin macros y calcula kcal si faltan', () => {
    expect(normalizeUsdaFood({ fdcId: 2, description: 'X', foodNutrients: [{ nutrientId: 1003, value: 1 }] })).toBeNull();
    const f = normalizeUsdaFood({
      fdcId: 3, description: 'Raw thing',
      foodNutrients: [{ nutrientId: 1003, value: 10 }, { nutrientId: 1004, value: 10 }, { nutrientId: 1005, value: 10 }],
    })!;
    expect(f.per100g.kcal).toBe(170);
    expect(f.state).toBe('raw');
  });

  it('categorías', () => {
    expect(usdaCategory('Finfish and Shellfish Products')).toBe('fish');
    expect(usdaCategory(undefined)).toBe('other');
  });
});

describe('traducción para USDA con alias', () => {
  it('usa el nombre inglés de la semilla si coincide un alias', () => {
    expect(toEnglishQuery('pechuga de pollo', seedFoods)).toBe('Chicken breast');
    expect(toEnglishQuery('Garbanzos', seedFoods)).toBe('Cooked chickpeas');
    expect(toEnglishQuery('quinoa', seedFoods)).toBe('quinoa');
    expect(toEnglishQuery('ab', seedFoods)).toBe('ab');
  });
});
