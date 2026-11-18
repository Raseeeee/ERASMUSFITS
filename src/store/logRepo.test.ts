import { beforeEach, describe, expect, it } from 'vitest';
import { seedFoods } from '../data/foods';
import { makeMyFood } from '../domain/foods';
import { useAppStore } from './appStore';
import {
  addEntry,
  changeWater,
  deleteEntry,
  getDay,
  listEntries,
  listMyFoods,
  saveMyFood,
  setDayType,
} from './logRepo';

const chicken = seedFoods.find((f) => f.id === 'chicken_breast')!;
const D = '2026-11-18';

describe('logRepo (Dexie)', () => {
  beforeEach(async () => {
    await useAppStore.getState().deleteAll();
  });

  it('día por defecto: ligero y 0 vasos', async () => {
    expect(await getDay(D)).toEqual({ date: D, dayType: 'light', waterGlasses: 0 });
  });

  it('añade, lista por fecha y borra entradas', async () => {
    const e = await addEntry(D, chicken, 130, 'canteen');
    await addEntry('2026-11-19', chicken, 100, 'home');
    expect(e.nutrients.f).toBeCloseTo(4.7 + 5.2, 1);
    expect(e.name.es).toBe('Pechuga de pollo');
    const list = await listEntries(D);
    expect(list).toHaveLength(1);
    expect(list[0].context).toBe('canteen');
    await deleteEntry(e.id);
    expect(await listEntries(D)).toHaveLength(0);
  });

  it('tipo de día y agua persisten y el agua no baja de 0', async () => {
    await setDayType(D, 'gym');
    expect(await changeWater(D, 1)).toBe(1);
    expect(await changeWater(D, 1)).toBe(2);
    expect(await changeWater(D, -5)).toBe(0);
    await changeWater(D, 3);
    expect(await getDay(D)).toEqual({ date: D, dayType: 'gym', waterGlasses: 3 });
  });

  it('mis alimentos: una sola corrección por alimento original', async () => {
    await saveMyFood(makeMyFood({ id: 'my-a', name: 'Pollo v1', p: 30, c: 0, f: 3, state: 'cooked', overridesId: 'chicken_breast' }));
    await saveMyFood(makeMyFood({ id: 'my-b', name: 'Pollo v2', p: 32, c: 0, f: 2, state: 'cooked', overridesId: 'chicken_breast' }));
    await saveMyFood(makeMyFood({ id: 'my-c', name: 'Barrita', p: 20, c: 40, f: 10, state: 'raw' }));
    const mine = await listMyFoods();
    expect(mine.map((f) => f.id).sort()).toEqual(['my-b', 'my-c']);
  });

  it('borrar todo limpia también el registro', async () => {
    await addEntry(D, chicken, 100, 'home');
    await saveMyFood(makeMyFood({ id: 'my-x', name: 'X', p: 1, c: 1, f: 1, state: 'raw' }));
    await useAppStore.getState().deleteAll();
    expect(await listEntries(D)).toHaveLength(0);
    expect(await listMyFoods()).toHaveLength(0);
  });
});
