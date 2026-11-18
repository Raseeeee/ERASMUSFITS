# ErasmusEats (nombre provisional)

PWA móvil-primero de nutrición para estudiantes Erasmus (o no): objetivos de macros por tipo de día, registro casa/cantina, recetas baratas por país, optimizador de compra por precio y avisos de coherencia con el objetivo. Especificación completa en `SPEC.md`; prototipo original en `docs/macros-erasmus.html`. Decisiones tomadas en `DECISIONS.md`.

Países: ES, IT, DE, PL, TR (origen→destino cualquiera, o modo "no voy de Erasmus"). Idiomas: es, en.

## Stack
Vite + React + TypeScript + Tailwind v4 · React Router · i18next · Zustand · Dexie (IndexedDB, local-first, sin login) · vite-plugin-pwa · Vitest (lógica) · Playwright (3 flujos: onboarding, añadir comida, ver receta) · `api/` serverless solo como proxy a Open Food Facts / USDA.

## Comandos
- `npm run dev` — servidor de desarrollo
- `npm test` — tests unitarios (Vitest)
- `npm run test:e2e` — tests Playwright (proyecto `mobile-chrome` contra dev; proyecto `pwa` contra el build: offline y LCP)
- `npm run build` — typecheck + build de producción + prerender de la bienvenida (`scripts/prerender.mjs`) + service worker
- `npm run lint` — typecheck (`tsc --noEmit`)

## Estructura
- `src/domain` — lógica pura, sin React ni I/O. Todo cálculo va aquí y con tests (`*.test.ts` al lado).
- `src/data` — JSON semilla (alimentos, países, precios, recetas).
- `src/features/*` — pantallas/funcionalidades React.
- `src/i18n` — recursos es/en. **Ningún texto visible hardcodeado** en componentes: siempre `t('...')`.
- `src/store` — Zustand + persistencia Dexie.
- `src/config/flags.ts` — feature flags (premium, affiliate, ads), todo desactivado.
- `api/` — funciones serverless (Vercel, firma `GET(Request)`): `off-search`, `off-product`, `usda-search`. Compartido en `api/_lib/`. En dev las sirve `vite-plugins/api-dev.ts` dentro de `npm run dev`.
- `scripts/build-seed.mjs`, `build-prices.mjs`, `build-recipes.mjs` — generan los JSON de `src/data` (alimentos, precios por país, recetas). Edita la tabla del script y ejecútalo con `node scripts/<script>`; no edites los JSON a mano.

## Convenciones
- Sin claves ni secretos en el repo: `.env` (ignorado). Variables: `USDA_API_KEY` (obligatoria para USDA), `OFF_CONTACT` (opcional, contacto para el User-Agent de OFF). Nunca con prefijo `VITE_`.
- Macros y coste de recetas se calculan siempre (nunca se escriben). Precios: `pricePerKg` del producto tal como se compra + `yield` si se registra cocinado.
- Tests E2E nunca llaman a APIs reales: simular `/api/*` con `page.route`.
- OFF: no buscar mientras se escribe (10 búsquedas/min por IP); la búsqueda externa es explícita.
- Trabajo por fases (SPEC §12). Commits pequeños. No pasar de fase sin tests en verde.
- Ambigüedad → elegir valor razonable, anotarlo en `DECISIONS.md`.
- Accesibilidad: objetivos táctiles ≥ 44 px, contraste AA, modo oscuro. `e2e/a11y.spec.ts` audita todas las pantallas con axe: añade cada pantalla nueva ahí.
- Rendimiento: rutas con `React.lazy` salvo la bienvenida; no importes la semilla ni datos pesados desde módulos de arranque (store, db, App). LCP < 2,5 s lo vigila `e2e/pwa.spec.ts`.
- Gráficas: color `--color-chart` (validado), una serie por gráfica, tooltip + tabla alternativa.
- Tono amable, sin mensajes de ayuno/castigo. Aviso "no es consejo médico" en onboarding y ajustes.
