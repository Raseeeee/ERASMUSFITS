# Erasmus+FITS

PWA móvil-primero de nutrición para estudiantes de Erasmus (o no) que quieren perder grasa, mantenerse, ganar músculo o recomponer comiendo **barato y simple** con lo que hay en el supermercado del país de destino.

Países: 🇪🇸 España · 🇮🇹 Italia · 🇩🇪 Alemania · 🇵🇱 Polonia · 🇹🇷 Turquía (cualquier combinación origen → destino, o "no voy de Erasmus"). Idiomas: español e inglés.

> No es consejo médico. Los objetivos y avisos son orientativos.

## Qué hace

- **Objetivos por tipo de día** (descanso, ligero, gimnasio, carrera, fondo largo): kcal, proteína, carbohidratos, grasa, fibra, sal, azúcares y agua, con suelos de seguridad. Se pueden editar.
- **Registro diario** por comidas (desayuno, comida, cena, snacks) con contador de lo que te queda, cocinado en casa o en cafetería, gramos o unidades, comidas editables, agua y "otra actividad".
- **Buscador de alimentos**: tus alimentos y una base curada de 173 alimentos con nombres en 6 idiomas (funciona offline), más Open Food Facts (incluido código de barras) y USDA a través de un proxy.
- **Recetas**: 60 recetas de residencia (≤ 20 min, solo placa, microondas o hervidor), con macros y coste calculados a partir de los ingredientes.
- **Compra barata**: cesta semanal optimizada (programación lineal) que cumple tus objetivos ±5 % al menor coste, con preferencias, alergias y equivalencias "de casa → local".
- **Progreso y coach**: peso, adherencia, actividad, gráficas y avisos amables. Los ajustes de kcal solo se aplican si los confirmas.
- **Privacidad**: todo se guarda en tu dispositivo (IndexedDB), sin cuentas ni analítica; puedes exportar o borrar tus datos.

## Requisitos

- Node.js 20 o superior (probado con 26).
- Para la búsqueda en USDA, una API key gratuita: <https://fdc.nal.usda.gov/api-key-signup>.

## Puesta en marcha

```bash
npm install
cp -n .env.example .env   # solo si aún no tienes .env; rellena USDA_API_KEY (y OFF_CONTACT)
npm run dev               # http://localhost:5173 (sirve también /api/*)
```

Variables de entorno (solo en el servidor; nunca con prefijo `VITE_`):

| Variable | Obligatoria | Para qué |
|---|---|---|
| `USDA_API_KEY` | Para USDA | Clave de USDA FoodData Central. Sin ella, la búsqueda USDA responde "no configurado" y lo demás funciona. |
| `OFF_CONTACT` | Recomendada | Email o URL de contacto para el User-Agent que pide Open Food Facts. |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con el proxy `/api` |
| `npm test` | Tests unitarios (Vitest): lógica, proxy, persistencia |
| `npm run test:e2e` | Tests E2E (Playwright): flujos, accesibilidad (axe), PWA offline y LCP. Construye y sirve el build de producción automáticamente. La primera vez: `npx playwright install chromium` |
| `npm run build` | Typecheck, build de producción, prerenderizado de la bienvenida y service worker → `dist/` |
| `npm run preview` | Sirve `dist/` (sin `/api`) |
| `npm run lint` | Typecheck |

Datos generados (edita la tabla del script y vuelve a ejecutarlo; no edites los JSON a mano):

```bash
node scripts/build-seed.mjs      # alimentos → src/data/foods.seed.json
node scripts/build-prices.mjs    # precios por país → src/data/prices/*.json
node scripts/build-recipes.mjs   # recetas → src/data/recipes/*.json
node scripts/build-icons.mjs     # iconos de la PWA → public/
```

## Desplegar en Vercel

1. Sube el repositorio a GitHub/GitLab e impórtalo en Vercel (<https://vercel.com/new>). `vercel.json` ya define el framework (Vite), el build (`npm run build`), la salida (`dist`), el fallback de la SPA y las cabeceras del service worker.
2. En **Settings → Environment Variables** añade `USDA_API_KEY` y `OFF_CONTACT` (Production y Preview).
3. Despliega. Las funciones de `api/*.ts` se publican solas como Vercel Functions (Node.js). `api/_lib/` no se publica.
4. Comprueba:
   - `https://<tu-dominio>/api/usda-search?q=lentils` devuelve `{"foods":[…]}`.
   - La app se puede instalar ("Añadir a pantalla de inicio") y, tras abrirla una vez, funciona sin conexión.

Con la CLI: `npm i -g vercel && vercel` (y `vercel env add USDA_API_KEY`).

> Nota sobre Open Food Facts: limita la búsqueda a 10 peticiones/min **por IP**. Con el proxy, todos los usuarios comparten la IP del servidor. Con tráfico real, conviene llamar a OFF directamente desde el navegador o usar sus volcados diarios (ver `DECISIONS.md`).

## Estructura

```
api/                 Proxy serverless (Open Food Facts, USDA) + caché y límites
src/domain/          Lógica pura con tests: objetivos, alimentos, registro, recetas, precios, optimizador, coach
src/data/            Semilla de alimentos, países, precios y recetas (JSON generados por scripts/)
src/features/*       Pantallas (onboarding, hoy, añadir comida, recetas, compra, progreso, ajustes, legal)
src/store/           Zustand + Dexie (IndexedDB)
src/i18n/            Textos es/en (ningún texto fijo en los componentes)
e2e/                 Playwright: flujos, accesibilidad, PWA y rendimiento
scripts/             Generadores de datos, iconos y prerenderizado
```

Más contexto: [`SPEC.md`](SPEC.md) (especificación), [`DECISIONS.md`](DECISIONS.md) (decisiones tomadas) y [`CLAUDE.md`](CLAUDE.md) (convenciones).

## Antes de publicar

- Completar el **responsable del tratamiento** en la política de privacidad (`privacy.sections.controller` en `src/i18n/locales/*.json`).
- Revisar los **precios** (sobre todo los de Turquía, por la inflación) y el nombre definitivo de la app.
- Para Google Play / App Store: empaquetar con Capacitor (la app ya es una PWA sin dependencias de servidor para los datos).

## Créditos

Datos de productos de [Open Food Facts](https://world.openfoodfacts.org) (ODbL) y [Open Prices](https://prices.openfoodfacts.org) (ODbL); alimentos genéricos de [USDA FoodData Central](https://fdc.nal.usda.gov) (dominio público). Detalle completo en la pantalla **Ajustes → Créditos y licencias**.
