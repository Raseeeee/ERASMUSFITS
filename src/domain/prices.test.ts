import { describe, expect, it } from 'vitest';
import { countries, priceTables, seedFoodMap, substitutionGroups } from '../data/countries';
import { COUNTRIES } from './types';
import { costFor, costPerBasis, costPerKgLogged, equivalents, purchaseGrams, savings } from './prices';

describe('datos de países', () => {
  it('5 países con moneda, supermercados y 30 básicos existentes', () => {
    for (const c of COUNTRIES) {
      const info = countries[c];
      expect(info.supermarkets.length, c).toBeGreaterThanOrEqual(3);
      expect(info.staples, c).toHaveLength(30);
      expect(new Set(info.staples).size, c).toBe(30);
      for (const id of info.staples) expect(seedFoodMap.has(id), `${c}:${id}`).toBe(true);
    }
    expect(countries.PL.currency).toBe('PLN');
    expect(countries.TR.currency).toBe('TRY');
  });

  it('grupos de sustitución con alimentos existentes y sin solapes', () => {
    const all = Object.values(substitutionGroups).flatMap((g) => g.foods);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(seedFoodMap.has(id), id).toBe(true);
  });
});

describe('tablas de precios', () => {
  it('cada precio es de un alimento existente, positivo, con fecha, fuente y confianza', () => {
    for (const c of COUNTRIES) {
      const t = priceTables[c];
      expect(t.country).toBe(c);
      expect(t.currency).toBe(countries[c].currency);
      expect(Object.keys(t.items).length, c).toBeGreaterThanOrEqual(50);
      for (const [id, item] of Object.entries(t.items)) {
        expect(seedFoodMap.has(id), `${c}:${id}`).toBe(true);
        expect(item.pricePerKg, `${c}:${id}`).toBeGreaterThan(0);
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(['estimado', 'verificado']).toContain(item.confidence);
        expect(item.source.length).toBeGreaterThan(5);
      }
    }
  });

  it('la carne y el pescado que se registran cocinados llevan rendimiento', () => {
    for (const c of COUNTRIES) {
      for (const [id, item] of Object.entries(priceTables[c].items)) {
        const f = seedFoodMap.get(id)!;
        if ((f.category === 'meat' || f.category === 'fish') && f.state === 'cooked' && !/canned|ham|chorizo|sucuk|kielbasa|frankfurter|bratwurst|turkey_slices|surimi|herring|shrimp/.test(id)) {
          expect(item.yield, `${c}:${id}`).toBeDefined();
        }
      }
    }
  });

  it('al menos algunos precios verificados por país europeo', () => {
    for (const c of ['ES', 'IT', 'DE', 'PL', 'TR'] as const) {
      expect(Object.values(priceTables[c].items).some((i) => i.confidence === 'verificado'), c).toBe(true);
    }
  });
});

describe('cálculo de costes', () => {
  const ES = priceTables.ES;
  it('coste con rendimiento: pechuga cocinada cuesta más por kg que cruda', () => {
    const item = ES.items.chicken_breast;
    expect(costPerKgLogged(item)).toBeCloseTo(6.92 / 0.75);
    expect(costFor('chicken_breast', 150, ES)).toBeCloseTo((6.92 / 0.75) * 0.15);
    expect(purchaseGrams('chicken_breast', 150, ES)).toBe(200);
    expect(costFor('no_existe', 100, ES)).toBeNull();
  });
  it('coste por proteína y por kcal', () => {
    const lentils = seedFoodMap.get('lentils_raw')!;
    expect(costPerBasis(lentils, ES.items.lentils_raw, 'protein')).toBeCloseTo((2.2 / 240) * 100);
    const oil = seedFoodMap.get('olive_oil')!;
    expect(costPerBasis(oil, ES.items.olive_oil, 'protein')).toBeNull();
    expect(costPerBasis(oil, ES.items.olive_oil, 'kcal')).toBeCloseTo(8 / 9);
  });
});

describe('equivalencias origen → destino', () => {
  it('ES → TR: arroz → bulgur; lentejas y garbanzos → mercimek, y el garbanzo existe allí (nohut)', () => {
    const eq = equivalents(countries.ES.staples, priceTables.TR, seedFoodMap, substitutionGroups);
    const by = Object.fromEntries(eq.map((e) => [e.homeFoodId, e]));
    expect(by.rice_raw.cheapest.foodId).toBe('bulgur_raw');
    expect(by.rice_raw.same?.foodId).toBe('rice_raw');
    expect(savings(by.rice_raw)).toBeGreaterThan(0.3);
    expect(by.lentils_raw.cheapest.foodId).toBe('red_lentils_raw');
    expect(by.chickpeas_raw.same?.foodId).toBe('chickpeas_raw');
    expect(by.serrano_ham.cheapest.foodId).toBe('sucuk'); // único embutido curado con precio en TR
    expect(by.serrano_ham.same).toBeUndefined();
  });
  it('cubre las 20 combinaciones origen→destino con al menos 5 equivalencias', () => {
    for (const o of COUNTRIES) {
      for (const d of COUNTRIES) {
        if (o === d) continue;
        const eq = equivalents(countries[o].staples, priceTables[d], seedFoodMap, substitutionGroups);
        expect(eq.length, `${o}→${d}`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});
