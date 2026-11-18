/**
 * Entrada SSR solo para el build: genera el HTML estático de la bienvenida en
 * cada idioma. scripts/prerender.mjs lo inyecta en dist/index.html para que la
 * primera pantalla se pinte antes de que cargue el JavaScript (LCP en móvil).
 */
import { renderToString } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import i18n from './i18n';
import { WelcomeScreen } from './features/onboarding/WelcomeScreen';
import type { Language } from './domain/types';

export async function render(lang: Language): Promise<string> {
  await i18n.changeLanguage(lang);
  return renderToString(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <WelcomeScreen />
      </MemoryRouter>
    </I18nextProvider>,
  );
}
