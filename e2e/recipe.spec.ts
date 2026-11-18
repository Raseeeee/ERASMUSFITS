import { expect, test } from '@playwright/test';
import { seedOnboarded } from './helpers';

test.describe('recetas y compra (Erasmus ES → TR)', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarded(page);
  });

  test('ver receta: lista del país de destino, detalle con macros y coste, añadir al día', async ({ page }) => {
    await page.getByRole('link', { name: 'Recetas' }).click();
    await expect(page.getByRole('heading', { name: 'Recetas' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Recetas' });
    await expect(list.getByRole('listitem').first()).toBeVisible();

    // Filtros: desayuno + vegetariana
    await page.getByRole('radio', { name: 'Desayuno / snack' }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Vegetariana' }).check();
    await expect(list.getByRole('listitem')).toHaveCount(4);

    await page.getByTestId('recipe-tr_menemen').click();
    await expect(page.getByRole('heading', { name: 'Menemen' })).toBeVisible();
    await expect(page.getByTestId('recipe-macros')).toContainText('Por ración: 403 kcal');
    await expect(page.getByTestId('recipe-cost')).toContainText('TRY');
    await expect(page.getByText('Precios en Turquía')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Ingredientes' }).getByRole('listitem')).toHaveCount(5);
    await expect(page.getByRole('radio', { name: 'Desayuno' })).toBeChecked();

    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByRole('list', { name: 'Desayuno' }).getByRole('listitem')).toHaveCount(5);
    const kcal = Number((await page.getByTestId('meal-breakfast-kcal').textContent())!.replace(/\D/g, ''));
    expect(Math.abs(kcal - 403)).toBeLessThanOrEqual(3); // redondeo por ingrediente
  });

  test('ver recetas de mi país de origen marca ingredientes de casa', async ({ page }) => {
    await page.getByRole('link', { name: 'Recetas' }).click();
    await page.getByLabel('Recetas de').selectOption('ES');
    await page.getByRole('checkbox', { name: 'Solo las que encajan con mi objetivo' }).uncheck();
    await expect(page.getByTestId('recipe-es_arroz_huevo_atun')).toContainText('Ingredientes de casa');
  });

  test('compra barata: cesta semanal en liras y equivalencias desde España', async ({ page }) => {
    await page.getByRole('link', { name: 'Compra' }).click();
    await expect(page.getByRole('heading', { name: 'Compra barata' })).toBeVisible();
    const eq = page.getByRole('list', { name: 'De casa a Turquía' });
    await expect(eq).toContainText('Arroz (crudo)');
    await expect(eq).toContainText('Más barato: Bulgur (crudo)');

    await page.getByRole('button', { name: 'Calcular cesta' }).click();
    await expect(page.getByTestId('shop-total')).toContainText('TRY');
    const items = page.getByRole('list', { name: 'Lista de la compra' }).getByRole('listitem');
    expect(await items.count()).toBeGreaterThanOrEqual(8);

    // Preferencias: vegetariana recalcula sin carne ni pescado
    await page.getByRole('checkbox', { name: 'Vegetariana' }).check();
    await page.getByRole('button', { name: 'Calcular cesta' }).click();
    await expect(page.getByRole('list', { name: 'Lista de la compra' })).not.toContainText('Pechuga');
    await expect(page.getByRole('list', { name: 'Lista de la compra' })).not.toContainText('Muslo');
  });
});
