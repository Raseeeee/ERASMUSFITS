import { expect, test } from '@playwright/test';
import { seedOnboarded } from './helpers';

test.describe('PWA (build de producción)', () => {
  test('manifiesto e iconos instalables', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({ name: 'ErasmusEats', display: 'standalone', start_url: '/' });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const i of manifest.icons) expect((await request.get(i.src)).status()).toBe(200);
  });

  test('funciona offline con la base local: Hoy, añadir comida, recetas y compra', async ({ page, context }) => {
    await seedOnboarded(page);
    // Esperar a que el service worker controle la página y haya precacheado todo.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
      return reg.active?.state;
    });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible();

    await page.getByRole('link', { name: 'Añadir a comida' }).click();
    await page.getByLabel('Buscar alimento').fill('lentejas');
    await expect(page.getByRole('list', { name: 'Resultados' })).toContainText('Lentejas cocidas');
    // La búsqueda externa avisa de que no hay conexión, sin romper nada.
    await page.getByRole('button', { name: 'Buscar en Open Food Facts y USDA' }).click();
    await expect(page.getByText('Sin conexión').first()).toBeVisible();

    await page.getByRole('link', { name: 'Recetas' }).click();
    await expect(page.getByRole('list', { name: 'Recetas' }).getByRole('listitem').first()).toBeVisible();
    await page.getByRole('link', { name: 'Compra' }).click();
    await page.getByRole('button', { name: 'Calcular cesta' }).click();
    await expect(page.getByTestId('shop-total')).toBeVisible();
  });

  test('LCP < 2,5 s en móvil con CPU ×4 y red 4G lenta', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: '¡Bienvenido/a!' })).toBeVisible();
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries[entries.length - 1].startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        }),
    );
    console.log(`LCP: ${Math.round(lcp)} ms`);
    expect(lcp).toBeLessThan(2500);
  });
});
