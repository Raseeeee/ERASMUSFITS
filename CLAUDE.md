# ErasmusEats (nombre provisional)

PWA móvil-primero de nutrición para estudiantes Erasmus (o no): objetivos de macros por tipo de día, registro casa/cantina, recetas baratas por país, optimizador de compra por precio y avisos de coherencia con el objetivo. Especificación completa en `SPEC.md`; prototipo original en `docs/macros-erasmus.html`. Decisiones tomadas en `DECISIONS.md`.

Países: ES, IT, DE, PL, TR (origen→destino cualquiera, o modo "no voy de Erasmus"). Idiomas: es, en.

## Stack
Vite + React + TypeScript + Tailwind v4 · React Router · i18next · Zustand · Dexie (IndexedDB, local-first, sin login) · vite-plugin-pwa · Vitest (lógica) · Playwright (3 flujos: onboarding, añadir comida, ver receta) · `api/` serverless solo como proxy a Open Food Facts / USDA.

## Comandos
- `npm run dev` — servidor de desarrollo
- `npm test` — tests unitarios (Vitest)
- `npm run test:e2e` — tests Playwright
- `npm run build` — typecheck + build de producción
- `npm run lint` — typecheck (`tsc --noEmit`)

## Estructura
- `src/domain` — lógica pura, sin React ni I/O. Todo cálculo va aquí y con tests (`*.test.ts` al lado).
- `src/data` — JSON semilla (alimentos, países, precios, recetas).
- `src/features/*` — pantallas/funcionalidades React.
- `src/i18n` — recursos es/en. **Ningún texto visible hardcodeado** en componentes: siempre `t('...')`.
- `src/store` — Zustand + persistencia Dexie.
- `src/config/flags.ts` — feature flags (premium, affiliate, ads), todo desactivado.
- `api/` — funciones serverless.

## Convenciones
- Sin claves ni secretos en el repo: `.env` (ignorado) y `.env.example` con nombres vacíos.
- Trabajo por fases (SPEC §12). Commits pequeños. No pasar de fase sin tests en verde.
- Ambigüedad → elegir valor razonable, anotarlo en `DECISIONS.md`.
- Accesibilidad: objetivos táctiles ≥ 44 px, contraste AA, modo oscuro.
- Tono amable, sin mensajes de ayuno/castigo. Aviso "no es consejo médico" en onboarding y ajustes.
