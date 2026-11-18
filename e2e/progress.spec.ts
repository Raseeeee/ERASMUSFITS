import { expect, test } from '@playwright/test';
import { addDays, localISODate } from '../src/domain/log';
import { computeDayTargets } from '../src/domain/targets';
import type { BodyProfile } from '../src/domain/types';
import { DEFAULT_PROFILE, seedOnboarded } from './helpers';

const profile = { ...DEFAULT_PROFILE, goal: 'lose' } as BodyProfile;
const today = localISODate();

/** 20 días (hasta ayer) cumpliendo las kcal del día ligero, sin entrenar. */
function onTargetDays(n = 20) {
  const t = computeDayTargets(profile, 'light').targets;
  const entries = [];
  const days = [];
  for (let i = n; i >= 1; i--) {
    const date = addDays(today, -i);
    days.push({ date, dayType: 'light', waterGlasses: t.waterGlasses });
    entries.push({
      id: `seed-${date}`, date, meal: 'lunch', foodId: 'chicken_breast',
      name: { es: 'Comida del día', en: 'Daily food' }, grams: 100, context: 'home', createdAt: Date.parse(date),
      nutrients: { kcal: t.kcal, p: t.protein, c: t.carbs, f: t.fat, fiber: 30, sugar: 20, salt: 3 },
    });
  }
  return { entries, days };
}

test.describe('progreso y avisos del coach', () => {
  test('meseta + inactividad: avisos, ajuste confirmado y descarte', async ({ page }) => {
    await seedOnboarded(page, {
      profile: { goal: 'lose' },
      ...onTargetDays(),
      weights: [{ date: addDays(today, -14), kg: 80 }, { date: addDays(today, -7), kg: 80.1 }, { date: today, kg: 80 }],
    });

    await expect(page.getByTestId('coach-banner')).toContainText('Tienes 2 avisos del coach');
    await page.getByTestId('coach-banner').click();
    await expect(page).toHaveURL(/\/progress/);

    const inactivity = page.getByTestId('alert-inactivity');
    await expect(inactivity).toContainText('días sin registrar actividad');
    await expect(inactivity).toContainText('Aviso');
    const plateau = page.getByTestId('alert-plateau');
    await expect(plateau).toContainText('2 semanas cumpliendo tus calorías');

    // El ajuste nunca es automático: se aplica solo al confirmarlo.
    await plateau.getByRole('button', { name: 'Aplicar -150 kcal/día' }).click();
    await expect(plateau).toHaveCount(0);

    await inactivity.getByRole('button', { name: 'Entendido' }).click();
    await expect(page.getByTestId('no-alerts')).toBeVisible();

    await page.getByRole('link', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Ver objetivos' }).click();
    await expect(page.getByTestId('kcal-adjustment')).toContainText('-150 kcal/día');
    const light = computeDayTargets(profile, 'light').targets.kcal;
    await expect(page.getByTestId('target-light-kcal')).toHaveText(String(light - 150));

    // Persisten tras recargar
    await page.reload();
    await page.getByRole('link', { name: 'Hoy' }).click();
    await expect(page.getByTestId('coach-banner')).toHaveCount(0);
  });

  test('registrar peso, tendencia, gráficas y tabla', async ({ page }) => {
    await seedOnboarded(page, {
      profile: { goal: 'lose' },
      ...onTargetDays(10),
      weights: [{ date: addDays(today, -14), kg: 81 }, { date: addDays(today, -7), kg: 80.5 }],
    });
    await page.getByRole('link', { name: 'Progreso' }).click();
    await page.getByLabel('Peso (kg)').fill('80.2');
    await page.getByRole('button', { name: 'Guardar peso' }).click();

    await expect(page.getByRole('list', { name: 'Pesajes recientes' }).getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('weight-rate')).toContainText('-0,4 kg/semana');
    await expect(page.getByTestId('weight-chart')).toBeVisible();
    await expect(page.getByTestId('kcal-chart')).toBeVisible();
    await expect(page.getByTestId('adherence')).toContainText('100 %');
    await expect(page.getByTestId('active-days')).toContainText('0 días activos');

    // Tabla accesible de la gráfica de peso
    await page.getByText('Ver como tabla').first().click();
    await expect(page.getByRole('table').first()).toContainText('80,2');

    // El último pesaje actualiza el peso del perfil
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await expect(page.getByLabel('Peso (kg)')).toHaveValue('80.2');
  });

  test('pérdida demasiado rápida: propone subir kcal', async ({ page }) => {
    await seedOnboarded(page, {
      profile: { goal: 'lose' },
      weights: [{ date: addDays(today, -14), kg: 82 }, { date: addDays(today, -7), kg: 81 }, { date: today, kg: 80 }],
    });
    await page.getByRole('link', { name: 'Progreso' }).click();
    const fast = page.getByTestId('alert-tooFast');
    await expect(fast).toContainText('más del 1 % de tu peso por semana');
    await expect(fast.getByRole('button', { name: 'Aplicar +150 kcal/día' })).toBeVisible();
  });
});

test.describe('otra actividad', () => {
  test('la casilla sube el objetivo del día, cuenta como activo y quita el aviso de inactividad', async ({ page }) => {
    await seedOnboarded(page, { profile: { goal: 'lose' }, ...onTargetDays(10) });
    await expect(page.getByTestId('coach-banner')).toContainText('1 aviso');

    const light = computeDayTargets(profile, 'light').targets.kcal;
    await expect(page.getByTestId('bar-kcal')).toContainText(`/ ${light}`);
    await page.getByRole('checkbox', { name: 'He hecho otra actividad' }).check();
    // Por defecto: andar 30 min moderado → (5−1)·80·0,5·0,75 = 120 kcal
    await expect(page.getByTestId('activity-extra')).toContainText('+120 kcal');
    await expect(page.getByTestId('bar-kcal')).toContainText(`/ ${light + 120}`);

    await page.locator('input[name="activityMinutes"]').fill('60');
    await page.getByText('Intensa', { exact: true }).click();
    // 60 min intensa → 7·80·1·0,75 = 420 kcal; +1 vaso
    await expect(page.getByTestId('activity-extra')).toContainText('+420 kcal');
    await expect(page.getByTestId('bar-kcal')).toContainText(`/ ${light + 420}`);
    await expect(page.getByTestId('coach-banner')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'He hecho otra actividad' })).toBeChecked();
    await page.getByRole('link', { name: 'Progreso' }).click();
    await expect(page.getByTestId('active-days')).toContainText('1 día activo');

    await page.getByRole('link', { name: 'Hoy' }).click();
    await page.getByRole('checkbox', { name: 'He hecho otra actividad' }).uncheck();
    await expect(page.getByTestId('bar-kcal')).toContainText(`/ ${light}`);
  });
});
