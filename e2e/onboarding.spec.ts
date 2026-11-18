import { expect, test } from '@playwright/test';

test.describe('onboarding', () => {
  test('Erasmus ES→TR, perfil y objetivos; persiste tras recargar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: '¡Bienvenido/a!' })).toBeVisible();
    await expect(page.getByText('No es consejo médico')).toBeVisible();

    const continueBtn = page.getByRole('button', { name: 'Continuar' });
    await expect(continueBtn).toBeDisabled();
    await page.getByLabel('País de origen').selectOption('ES');
    await page.getByLabel('País de destino').selectOption('ES');
    await expect(page.getByText('El destino debe ser distinto')).toBeVisible();
    await page.getByLabel('País de destino').selectOption('TR');
    await continueBtn.click();

    await expect(page.getByRole('heading', { name: 'Tu perfil' })).toBeVisible();
    await page.getByText('Hombre', { exact: true }).click();
    await page.getByLabel('Edad').fill('25');
    await page.getByLabel('Peso (kg)').fill('80');
    await page.getByLabel('Estatura (cm)').fill('180');
    await page.getByText('Mantener', { exact: true }).click();
    await page.getByText('Moderada', { exact: true }).click();
    await page.getByRole('checkbox', { name: 'Gimnasio' }).check();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('heading', { name: 'Tus objetivos diarios' })).toBeVisible();
    await expect(page.getByTestId('target-gym-kcal')).toHaveText('2798');
    await expect(page.getByTestId('target-gym-protein')).toHaveText('128');
    await expect(page.getByTestId('target-rest-kcal')).toHaveText('2347');

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/\/today$/);

    await page.reload();
    await expect(page).toHaveURL(/\/today$/);
    await page.getByRole('link', { name: 'Objetivos' }).click();
    await expect(page.getByTestId('target-gym-kcal')).toHaveText('2798');
  });

  test('menor de 18 bloquea el avance', async ({ page }) => {
    await page.goto('/');
    await page.getByText('No', { exact: true }).click();
    await page.getByLabel('Nacionalidad').selectOption('PL');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByText('Mujer', { exact: true }).click();
    await page.getByLabel('Edad').fill('16');
    await page.getByLabel('Peso (kg)').fill('55');
    await page.getByLabel('Estatura (cm)').fill('165');
    await page.getByText('Mantener', { exact: true }).click();
    await page.getByText('Ligera', { exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '18 años' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  test('IMC bajo deshabilita perder grasa; override bajo el suelo se corrige', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('País de origen').selectOption('IT');
    await page.getByLabel('País de destino').selectOption('DE');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByText('Prefiero no decirlo', { exact: true }).click();
    await page.getByLabel('Edad').fill('22');
    await page.getByLabel('Peso (kg)').fill('52');
    await page.getByLabel('Estatura (cm)').fill('178');
    await expect(page.getByRole('radio', { name: 'Perder grasa' })).toBeDisabled();
    await page.getByText('Ganar peso / músculo', { exact: true }).click();
    await page.getByText('Sedentaria', { exact: true }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.locator('input[name="kcal"]').fill('800');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('por debajo del mínimo seguro')).toBeVisible();
    await expect(page.locator('input[name="kcal"]')).not.toHaveValue('800');
  });

  test('cambiar a inglés traduce la interfaz', async ({ page }) => {
    await page.goto('/');
    await page.getByText('English', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome!' })).toBeVisible();
    await expect(page.getByText('Are you going on Erasmus?')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
