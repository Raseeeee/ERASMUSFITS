import Dexie from 'dexie';
import { AppDB } from './db';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedFoods } from '../data/foods';
import { makeMyFood } from '../domain/foods';
import { useAppStore } from './appStore';
import {
  addEntry,
  changeWater,
  deleteEntry,
  getDay,
  getEntry,
  updateEntry,
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
    const e = await addEntry(D, 'lunch', chicken, 130, 'canteen');
    await addEntry('2026-11-19', 'dinner', chicken, 100, 'home');
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
    await addEntry(D, 'snack', chicken, 100, 'home');
    await saveMyFood(makeMyFood({ id: 'my-x', name: 'X', p: 1, c: 1, f: 1, state: 'raw' }));
    await useAppStore.getState().deleteAll();
    expect(await listEntries(D)).toHaveLength(0);
    expect(await listMyFoods()).toHaveLength(0);
  });
});

describe('editar entrada', () => {
  beforeEach(async () => {
    await useAppStore.getState().deleteAll();
  });

  it('cambia gramos, contexto y comida; guarda copia del alimento', async () => {
    const e = await addEntry(D, 'lunch', chicken, 130, 'home');
    expect((await getEntry(e.id))?.food?.id).toBe('chicken_breast');
    const u = await updateEntry(e.id, chicken, { grams: 200, context: 'canteen', meal: 'dinner' });
    const stored = await getEntry(e.id);
    expect(stored).toEqual(u);
    expect(stored?.grams).toBe(200);
    expect(stored?.meal).toBe('dinner');
    expect(stored?.nutrients.f).toBe(15.2);
    expect(await listEntries(D)).toHaveLength(1);
  });
});

describe('migración v2 → v3', () => {
  it('asigna comida por hora y copia mis alimentos (los de la semilla se resuelven al editar)', async () => {
    const name = 'migration-test';
    const old = new Dexie(name);
    old.version(1).stores({ kv: 'key' });
    old.version(2).stores({ kv: 'key', entries: 'id, date, createdAt', days: 'date', myFoods: 'id, overridesId' });
    await old.open();
    await old.table('entries').add({
      id: 'old-1', date: D, foodId: 'egg', name: { es: 'Huevo', en: 'Egg' }, grams: 60, context: 'home',
      nutrients: { kcal: 88, p: 7.8, c: 0.6, f: 6, fiber: 0, sugar: 0, salt: 0.2 },
      createdAt: new Date(2026, 10, 18, 8, 30).getTime(),
    });
    await old.table('myFoods').add(makeMyFood({ id: 'my-old', name: 'Mío', p: 10, c: 10, f: 1, state: 'raw' }));
    await old.table('entries').add({
      id: 'old-2', date: D, foodId: 'my-old', name: { es: 'Mío', en: 'Mío' }, grams: 100, context: 'home',
      nutrients: { kcal: 89, p: 10, c: 10, f: 1, fiber: 0, sugar: 0, salt: 0 },
      createdAt: new Date(2026, 10, 18, 21, 0).getTime(),
    });
    old.close();

    const db = new AppDB(name);
    const e = await db.entries.get('old-1');
    expect(e?.meal).toBe('breakfast');
    expect(e?.food).toBeUndefined(); // semilla: se busca al abrir la edición
    const mine = await db.entries.get('old-2');
    expect(mine?.meal).toBe('dinner');
    expect(mine?.food?.id).toBe('my-old');
    db.close();
    await Dexie.delete(name);
  });
});
