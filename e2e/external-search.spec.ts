import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { normalizeUsdaSearch, type UsdaFood } from '../src/domain/external';
import { seedOnboarded } from './helpers';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../src/domain/__fixtures__/${name}`, import.meta.url), 'utf8'));
const offSearch = fixture('off-search.json');
const usdaSearch = fixture('usda-search.json');

/** OFF se llama directamente desde el navegador: hay que responder con CORS. */
const OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl**';
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v2/product/**';
const CORS = { 'access-control-allow-origin': '*' };
const usdaFoods = normalizeUsdaSearch(usdaSearch as { foods: UsdaFood[] });

test.describe('búsqueda externa (OFF directo + USDA por proxy, simulados)', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarded(page);
  });

  test('Enter busca fuera, muestra fuente, calidad, marca y atribución; se puede añadir', async ({ page }) => {
    const calls: string[] = [];
    await page.route(OFF_SEARCH, (route) => {
      calls.push(route.request().url());
      return route.fulfill({ json: { products: offSearch.hits }, headers: CORS });
    });
    await page.route('**/api/usda-search**', (route) => {
      calls.push(route.request().url());
      return route.fulfill({ json: { foods: usdaFoods } });
    });

    await page.getByRole('link', { name: 'Añadir a desayuno' }).click();
    await page.getByLabel('Buscar alimento').fill('yogur griego');
    // La búsqueda local no llama a la red mientras se escribe.
    await expect(page.getByRole('list', { name: 'Resultados' })).toContainText('Yogur griego natural');
    expect(calls).toHaveLength(0);

    await page.getByLabel('Buscar alimento').press('Enter');
    const external = page.getByRole('list', { name: 'Supermercado y bases externas' });
    await expect(external).toContainText('Hacendado');
    await expect(external).toContainText('España');
    await expect(external).toContainText('Datos incompletos');
    await expect(external).toContainText('Open Food Facts');
    await expect(external).toContainText('USDA');
    await expect(page.getByText('Datos de Open Food Facts (licencia ODbL).')).toBeVisible();
    const off = calls.find((u) => u.startsWith('https://world.openfoodfacts.org/cgi/search.pl'))!;
    expect(new URL(off).searchParams.get('search_terms')).toBe('yogur griego');
    expect(new URL(off).searchParams.get('app_name')).toBe('ErasmusFITS');
    expect(calls.some((u) => u.includes('usda-search?q=Plain%20Greek%20yogurt'))).toBe(true); // traducido con alias

    await external.getByRole('button', { name: /Yogur griego ligero/ }).click();
    await expect(page.getByText('Los azúcares de este producto son totales')).toBeVisible();
    await expect(page.getByText('Faltan fibra, azúcares o sal')).toBeVisible();
    await page.getByLabel('Cantidad').fill('125');
    await page.getByRole('button', { name: 'Añadir al día' }).click();
    await expect(page.getByTestId('meal-breakfast-kcal')).toHaveText('60 kcal'); // 48 × 1.25

    // Se puede editar aunque el alimento venga de OFF (copia guardada en la entrada).
    await page.getByRole('link', { name: 'Editar Yogur griego ligero' }).click();
    await expect(page.getByLabel('Cantidad')).toHaveValue('125');
  });

  test('avisa si OFF limita peticiones o USDA no está configurado', async ({ page }) => {
    await page.route(OFF_SEARCH, (route) => route.fulfill({ status: 429, json: {}, headers: CORS }));
    await page.route('**/api/usda-search**', (route) => route.fulfill({ status: 503, json: { error: 'not_configured' } }));
    await page.getByRole('link', { name: 'Añadir a comida' }).click();
    await page.getByLabel('Buscar alimento').fill('lentejas');
    await page.getByRole('button', { name: 'Buscar en Open Food Facts y USDA' }).click();
    await expect(page.getByText('Open Food Facts está recibiendo muchas búsquedas')).toBeVisible();
    await expect(page.getByText('USDA no está configurado en el servidor')).toBeVisible();
    // Los locales siguen disponibles.
    await expect(page.getByRole('list', { name: 'Resultados' })).toContainText('Lentejas cocidas');
  });

  test('código de barras consulta solo el producto de OFF', async ({ page }) => {
    let usdaCalled = false;
    await page.route(OFF_PRODUCT, (route) => route.fulfill({ json: { status: 1, product: offSearch.hits[2] }, headers: CORS }));
    await page.route('**/api/usda-search**', (route) => {
      usdaCalled = true;
      return route.fulfill({ json: { foods: [] } });
    });
    await page.getByRole('link', { name: 'Añadir a snacks' }).click();
    await page.getByLabel('Buscar alimento').fill('8402001012051');
    await page.getByRole('button', { name: 'Buscar código de barras' }).click();
    await expect(page.getByRole('list', { name: 'Supermercado y bases externas' })).toContainText('Hacendado');
    expect(usdaCalled).toBe(false);
  });
});
