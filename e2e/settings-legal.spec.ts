import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { seedOnboarded } from './helpers';

test.describe('ajustes, privacidad y créditos', () => {
  test('la bienvenida enlaza la política de privacidad', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Tus datos se guardan solo en este dispositivo.')).toBeVisible();
    await page.getByRole('link', { name: 'Política de privacidad' }).click();
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.getByText('RGPD')).toBeVisible();
    await expect(page.getByText('No usamos cookies ni analítica')).toBeVisible();
    await page.getByRole('button', { name: '← Volver' }).click();
    await expect(page.getByRole('heading', { name: '¡Bienvenido/a!' })).toBeVisible();
  });

  test('exportar datos descarga un JSON con el perfil', async ({ page }) => {
    await seedOnboarded(page);
    await page.getByRole('link', { name: 'Ajustes' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar mis datos (JSON)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^erasmus-eats-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(json.format).toBe('erasmus-eats-export');
    expect(json.data.settings.find((r: { key: string }) => r.key === 'profile').value.weightKg).toBe(80);
    await expect(page.getByText('Copia descargada.')).toBeVisible();
  });

  test('créditos con atribución a Open Food Facts (ODbL) y USDA', async ({ page }) => {
    await seedOnboarded(page);
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await expect(page.getByText('País: ')).toContainText('Turquía');
    await expect(page.getByText('Métricas (kg, cm, g, ml)')).toBeVisible();
    await page.getByRole('link', { name: 'Créditos y licencias' }).click();
    await expect(page.getByTestId('credit-off')).toContainText('Open Database License (ODbL)');
    await expect(page.getByTestId('credit-off').getByRole('link', { name: 'Ver licencia' })).toHaveAttribute('href', /odbl/);
    await expect(page.getByTestId('credit-usda')).toContainText('dominio público');
  });

  test('borrar todo vuelve al onboarding', async ({ page }) => {
    await seedOnboarded(page);
    await page.getByRole('link', { name: 'Ajustes' }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Borrar todos mis datos' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: '¡Bienvenido/a!' })).toBeVisible();
  });
});
