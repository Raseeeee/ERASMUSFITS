import { expect, test } from '@playwright/test';
import { seedOnboarded } from './helpers';

test.describe('añadir comida', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarded(page);
    await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible();
  });

  test('por comidas: unidades, cantina, subtotales, faltantes, persistir y borrar', async ({ page }) => {
    for (const meal of ['Desayuno', 'Comida', 'Cena', 'Snacks']) {
      await expect(page.getByRole('heading', { name: meal })).toBeVisible();
    }
    await expect(page.getByTestId('bar-kcal')).toContainText('/ 2527'); // ligero por defecto: 1805 × 1.4
    await expect(page.getByTestId('remaining-kcal')).toHaveText('2527 kcal');

    await page.getByRole('link', { name: 'Añadir a comida' }).click();
    await page.getByLabel('Buscar alimento').fill('pechuga de pollo');
    await page.getByRole('button', { name: /Pechuga de pollo/ }).first().click();

    await expect(page.getByText('Valores en cocinado')).toBeVisible();
    await expect(page.getByLabel('Unidad')).toHaveValue('unit'); // filete (130 g)
    await expect(page.getByRole('radio', { name: 'Comida' })).toBeChecked(); // viene de "Añadir a comida"
    await expect(page.getByTestId('preview')).toHaveText('130 g → 203 kcal · P 40,3 · C 0 · G 4,7');
    await page.getByText('Cafetería / restaurante', { exact: true }).click();
    await expect(page.getByTestId('preview')).toHaveText('130 g → 250 kcal · P 40,3 · C 0 · G 9,9');
    await page.getByRole('button', { name: 'Añadir al día' }).click();

    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByTestId('meal-lunch-kcal')).toHaveText('250 kcal');
    await expect(page.getByTestId('meal-lunch-totals')).toHaveText('250 kcal · P 40,3 · C 0 · G 9,9');
    await expect(page.getByTestId('remaining-kcal')).toHaveText('2277 kcal');

    await page.getByRole('link', { name: 'Añadir a desayuno' }).click();
    await page.getByLabel('Buscar alimento').fill('huevo');
    await page.getByRole('button', { name: /^Huevo/ }).click();
    await page.getByLabel('Cantidad').fill('2');
    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page.getByTestId('meal-breakfast-kcal')).toHaveText('175 kcal'); // 2 × 60 g × 1.46
    await expect(page.getByTestId('value-kcal')).toHaveText('425');
    await expect(page.getByTestId('remaining-p')).toHaveText('72 g'); // 128 − 40.3 − 15.6

    await page.reload();
    await expect(page.getByTestId('value-kcal')).toHaveText('425');
    await expect(page.getByRole('list', { name: 'Comida' })).toContainText('Cafetería / restaurante');
    await expect(page.getByTestId('meal-dinner')).toContainText('Nada registrado');

    await page.getByRole('button', { name: 'Borrar Huevo' }).click();
    await expect(page.getByTestId('value-kcal')).toHaveText('250');
    await expect(page.getByTestId('meal-breakfast-kcal')).toHaveText('0 kcal');
  });

  test('editar una comida registrada: cantidad, contexto y comida', async ({ page }) => {
    await page.getByRole('link', { name: 'Añadir a comida' }).click();
    await page.getByLabel('Buscar alimento').fill('pechuga de pollo');
    await page.getByRole('button', { name: /Pechuga de pollo/ }).first().click();
    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page.getByTestId('meal-lunch-kcal')).toHaveText('203 kcal');

    await page.getByRole('link', { name: 'Editar Pechuga de pollo' }).click();
    await expect(page.getByRole('heading', { name: 'Editar comida' })).toBeVisible();
    await expect(page.getByLabel('Cantidad')).toHaveValue('1');
    await expect(page.getByLabel('Unidad')).toHaveValue('unit');
    await page.getByLabel('Cantidad').fill('2');
    await page.getByText('Cena', { exact: true }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByTestId('meal-dinner-kcal')).toHaveText('406 kcal'); // 260 g × 1.56
    await expect(page.getByTestId('meal-lunch-kcal')).toHaveText('0 kcal');
    await expect(page.getByTestId('value-kcal')).toHaveText('406');

    await page.getByRole('link', { name: 'Editar Pechuga de pollo' }).click();
    await page.getByText('Cafetería / restaurante', { exact: true }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByTestId('meal-dinner-kcal')).toHaveText('499 kcal'); // 405.6 + 10.4 g grasa × 9

    await page.getByRole('link', { name: 'Editar Pechuga de pollo' }).click();
    await page.getByRole('button', { name: 'Borrar de este día' }).click();
    await expect(page.getByTestId('value-kcal')).toHaveText('0');
  });

  test('gramos manuales y edición en gramos', async ({ page }) => {
    await page.getByRole('link', { name: 'Añadir a cena' }).click();
    await page.getByLabel('Buscar alimento').fill('arroz cocido');
    await page.getByRole('button', { name: /Arroz cocido/ }).click();
    await page.getByLabel('Unidad').selectOption('g');
    await page.getByLabel('Cantidad').fill('200');
    await expect(page.getByTestId('preview')).toContainText('200 g →');
    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page.getByTestId('value-carbs')).toHaveText('56');

    await page.getByRole('link', { name: 'Editar Arroz cocido' }).click();
    await expect(page.getByLabel('Unidad')).toHaveValue('g');
    await expect(page.getByLabel('Cantidad')).toHaveValue('200');
  });

  test('editar macros guarda "mío" con prioridad sobre la semilla', async ({ page }) => {
    await page.getByRole('link', { name: 'Añadir a desayuno' }).click();
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
    await page.getByRole('link', { name: 'Añadir a snacks' }).click();
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
    await expect(page.getByTestId('meal-snack-kcal')).toHaveText('330 kcal');
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
