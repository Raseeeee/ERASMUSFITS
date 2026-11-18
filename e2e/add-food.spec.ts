import { expect, test } from '@playwright/test';
import { seedOnboarded } from './helpers';

test.describe('añadir comida', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarded(page);
    await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible();
  });

  test('buscar, unidades, cantina, añadir, persistir y borrar', async ({ page }) => {
    await expect(page.getByText('Aún no has registrado nada')).toBeVisible();
    await expect(page.getByTestId('bar-kcal')).toContainText('/ 2527'); // ligero por defecto: 1805 × 1.4

    await page.getByRole('link', { name: 'Añadir comida' }).click();
    await page.getByLabel('Buscar alimento').fill('pechuga de pollo');
    await page.getByRole('button', { name: /Pechuga de pollo/ }).first().click();

    await expect(page.getByText('Valores en cocinado')).toBeVisible();
    await expect(page.getByLabel('Unidad')).toHaveValue('unit'); // filete (130 g)
    await expect(page.getByTestId('preview')).toHaveText('130 g → 203 kcal · P 40,3 · C 0 · G 4,7');
    await page.getByText('Cafetería / restaurante', { exact: true }).click();
    await expect(page.getByTestId('preview')).toHaveText('130 g → 250 kcal · P 40,3 · C 0 · G 9,9');
    await page.getByRole('button', { name: 'Añadir al día' }).click();

    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByTestId('value-kcal')).toHaveText('250');

    await page.getByRole('link', { name: 'Añadir comida' }).click();
    await page.getByLabel('Buscar alimento').fill('huevo');
    await page.getByRole('button', { name: /^Huevo/ }).click();
    await page.getByLabel('Cantidad').fill('2');
    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page.getByTestId('value-kcal')).toHaveText('425'); // + 2 × 60 g × 1.46

    await page.reload();
    await expect(page.getByTestId('value-kcal')).toHaveText('425');
    const list = page.getByRole('list', { name: 'Comidas del día' });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list).toContainText('Cafetería / restaurante');

    await page.getByRole('button', { name: 'Borrar Huevo' }).click();
    await expect(page.getByTestId('value-kcal')).toHaveText('250');
  });

  test('gramos manuales', async ({ page }) => {
    await page.getByRole('link', { name: 'Añadir comida' }).click();
    await page.getByLabel('Buscar alimento').fill('arroz cocido');
    await page.getByRole('button', { name: /Arroz cocido/ }).click();
    await page.getByLabel('Unidad').selectOption('g');
    await page.getByLabel('Cantidad').fill('200');
    await expect(page.getByTestId('preview')).toContainText('200 g →');
    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page.getByTestId('value-carbs')).toHaveText('56');
  });

  test('editar macros guarda "mío" con prioridad sobre la semilla', async ({ page }) => {
    await page.getByRole('link', { name: 'Añadir comida' }).click();
    await page.getByLabel('Buscar alimento').fill('huevo');
    await page.getByRole('button', { name: /^Huevo/ }).click();
    await page.getByRole('button', { name: 'Editar macros (guardar como mío)' }).click();
    await page.locator('input[name="p"]').fill('20');
    await page.getByRole('button', { name: 'Guardar como mío' }).click();

    await expect(page.getByText('Mío', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cambiar alimento' }).click();
    await page.getByLabel('Buscar alimento').fill('huevo');
    const results = page.getByRole('list', { name: 'Resultados' }).getByRole('listitem');
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText('Mío');
  });

  test('crear alimento nuevo desde la búsqueda', async ({ page }) => {
    await page.getByRole('link', { name: 'Añadir comida' }).click();
    await page.getByLabel('Buscar alimento').fill('barrita xyz');
    await expect(page.getByText('Sin resultados')).toBeVisible();
    await page.getByRole('button', { name: 'Crear alimento nuevo' }).click();
    await expect(page.locator('input[name="name"]')).toHaveValue('barrita xyz');
    await page.locator('input[name="p"]').fill('20');
    await page.locator('input[name="c"]').fill('40');
    await page.locator('input[name="f"]').fill('10');
    await expect(page.getByText('Calorías calculadas: 330 kcal')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar como mío' }).click();
    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page.getByTestId('value-kcal')).toHaveText('330');
  });

  test('tipo de día, agua y navegación por fechas', async ({ page }) => {
    await page.getByLabel('Tipo de día').selectOption('gym');
    await expect(page.getByTestId('bar-kcal')).toContainText('/ 2798');
    await expect(page.getByTestId('water-count')).toHaveText('0 / 13 vasos');
    await page.getByRole('button', { name: 'Añadir un vaso de agua' }).click();
    await page.getByRole('button', { name: 'Añadir un vaso de agua' }).click();
    await page.getByRole('button', { name: 'Quitar un vaso de agua' }).click();
    await expect(page.getByTestId('water-count')).toHaveText('1 / 13 vasos');

    await page.getByRole('button', { name: 'Día anterior' }).click();
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByTestId('water-count')).toHaveText('0 / 12 vasos');
    await page.getByRole('button', { name: 'Hoy', exact: true }).click();

    await page.reload();
    await expect(page.getByLabel('Tipo de día')).toHaveValue('gym');
    await expect(page.getByTestId('water-count')).toHaveText('1 / 13 vasos');
  });
});
