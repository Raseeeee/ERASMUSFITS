import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { seedOnboarded } from './helpers';

/** WCAG 2.1 A/AA: sin violaciones graves ni críticas (contraste AA incluido). */
async function audit(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = bad.map((v) => `${name}: ${v.id} (${v.impact}) → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(report, report.join('\n')).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accesibilidad (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test('onboarding', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: '¡Bienvenido/a!' })).toBeVisible();
      await audit(page, 'welcome');
      await page.getByLabel('País de origen').selectOption('ES');
      await page.getByLabel('País de destino').selectOption('TR');
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('heading', { name: 'Tu perfil' })).toBeVisible();
      await audit(page, 'profile');
    });

    test('pantallas principales', async ({ page }) => {
      test.setTimeout(120_000); // 10 pantallas con axe
      await seedOnboarded(page);
      const screens: [string, string][] = [
        ['/today', 'Hoy'],
        ['/add?meal=lunch', 'Añadir comida'],
        ['/recipes', 'Recetas'],
        ['/recipes/tr_menemen', 'Menemen'],
        ['/shop', 'Compra barata'],
        ['/progress', 'Progreso'],
        ['/targets', 'Tus objetivos diarios'],
        ['/settings', 'Ajustes'],
        ['/privacy', 'Política de privacidad'],
        ['/credits', 'Créditos y licencias'],
      ];
      for (const [path, heading] of screens) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
        await audit(page, path);
      }
    });

    test('objetivos táctiles ≥ 44 px en Hoy', async ({ page }) => {
      await seedOnboarded(page);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('button, a, select, input:not([type=checkbox]):not([type=radio]):not(.sr-only)')]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 44 && r.width > 0)
          .map(({ el }) => `${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`),
      );
      expect(small).toEqual([]);
    });
  });
}
