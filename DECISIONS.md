# Decisiones

Registro de decisiones tomadas ante ambigüedades de `SPEC.md`. Formato: decisión · motivo.

## Fase 1 — Base

### Entorno y stack
- **Node.js LTS (v26)** instalado con winget porque no había Node en el equipo.
- **Versiones actuales** de las dependencias: Vite 8, React 19, React Router 8 (paquete `react-router`, sin `react-router-dom`), TypeScript 7, Tailwind 4 (plugin `@tailwindcss/vite`, sin `tailwind.config`), Vitest 5, Dexie 4, Zustand 5.
- **Prototipo** `macros-erasmus.html` movido a `docs/` como referencia; no forma parte de la app.
- **`.gitattributes` con `eol=lf`** para evitar diferencias CRLF/LF en Windows.
- El repo vive dentro de OneDrive: `node_modules` puede ralentizar la sincronización. Si molesta, excluir la carpeta de OneDrive o mover el repo fuera.

### Cálculos (`src/domain/targets.ts`)
- **Factor habitual por nivel de actividad** (no lo fija la spec): sedentaria 1.2, ligera 1.375, moderada 1.55, alta 1.725 (valores estándar). Solo se usa para el "mantenimiento estimado (semana tipo)"; los objetivos diarios usan los factores por tipo de día de la spec.
- **`recomp` en `long_endurance`**: 0 % (igual que los demás días de entreno; la spec no lo indica).
- **Déficit de `lose`**: 15 % por defecto, configurable en el perfil (`loseDeficit`) con tope 25 %. Aún no se expone en la UI.
- **Suelo de kcal** = máx(1500 hombre / 1200 mujer o no decir, 90 % del BMR). Con los factores actuales, el 90 % del BMR nunca se alcanza ni con el déficit máximo (1.3 × 0.75 = 0.975), pero se mantiene como red de seguridad para overrides.
- **IMC < 18.5 con `lose`**: la UI deshabilita la opción; si llega igualmente (datos antiguos), el cálculo usa `maintain` y muestra aviso.
- **Carbohidratos negativos** (proteína + grasa mínimas superan las kcal): se fijan a 0 y se avisa (`macrosExceedKcal`).
- **Agua**: `ceil(35 ml/kg / 250)` vasos; +1 vaso en gym y run, +2 en long_endurance.
- **Redondeo**: kcal y gramos a entero.

### Resumen de objetivos
- La spec dice "3 tipos de día" en el resumen pero define 5. Se muestran los **relevantes**: siempre descanso y ligero, más los de entreno según los deportes elegidos (gym/otros → gym; running → run; triatlón → run + long_endurance). Sin deportes: rest, light, gym.
- **Overrides manuales** por tipo de día. Avisos (se acepta el valor): proteína < 0.8 o > 3 g/kg, grasa < 0.5 g/kg, sal > 5 g, kcal > 2.5 × BMR, macros que no cuadran con las kcal (±10 %).
- **kcal por debajo del suelo no se aceptan**: se suben al suelo y se avisa. Tras 2 intentos en la sesión se muestran recursos de ayuda (SPEC §4 "nunca por debajo" y §9). El contador persistente queda para el coach en la Fase 5.
- **Cambiar el perfil borra los overrides** (se calcularon para otro cuerpo/objetivo).

### Onboarding
- **Rangos válidos**: edad 18–100, peso 35–300 kg, estatura 120–230 cm, 0–7 días/semana por deporte.
- **Erasmus**: origen y destino deben ser distintos. País activo (para recetas/precios futuros) = destino si Erasmus, nacionalidad si no.
- **Idioma** por defecto según el navegador (`es*` → es, resto → en); se guarda al elegirlo.
- **Banderas** con emoji regional; en Windows se ven como letras (ES, IT…), aceptable por ahora.
- **Rutas**: `/onboarding`, `/onboarding/profile`, `/onboarding/targets`; tras completar, pestañas `/today`, `/targets`, `/settings`.
- **Hoy** es un marcador de posición hasta la Fase 2. **Ajustes** mínimo: idioma, editar perfil, aviso médico y "borrar todos mis datos" (exportar llega en la Fase 6).

### Persistencia
- Dexie con una tabla clave-valor `kv` para ajustes/perfil. Las comidas, pesos, etc. tendrán tablas propias en las fases siguientes (nueva versión del esquema).

### Tests
- Vitest con `jsdom` + `fake-indexeddb`. Playwright con Chromium emulando Pixel 7 y locale `es-ES`.
- El E2E de onboarding cubre: camino feliz Erasmus + persistencia tras recargar, menor de 18, IMC bajo + override bajo el suelo, y cambio de idioma.

### Pendiente de la Fase 1 hacia adelante
- Nada bloqueante. Mejoras posibles: exponer `loseDeficit` en la UI, selector de banderas visual.

## Fase 2 — Registro

### Semilla de alimentos (`src/data/foods.seed.json`)
- **51 alimentos** (los ~25 del prototipo + básicos de los 5 países: bulgur, kasza, quark, simit, beyaz peynir, etc.), con nombres **es/en**. Ampliación a 150–200 y alias it/de/pl/tr: Fase 3, como dice el plan de fases.
- Se genera con `scripts/build-seed.mjs` desde una tabla compacta; editar la tabla y ejecutar `node scripts/build-seed.mjs`.
- **Convención UE**: carbohidratos *disponibles* (sin fibra) y **kcal = 4·P + 4·C + 9·G + 2·fibra**, calculadas, nunca escritas a mano. Un test comprueba que cuadran.
- Valores redondeados de tablas tipo BEDCA/USDA; **orientativos**. Fibra, azúcares y sal no estaban en el prototipo y los he añadido yo.
- **`sugar` = azúcares libres** en la semilla curada (0 en fruta entera y lácteos naturales), para compararlo con el tope de "azúcares libres". OFF solo da azúcares totales: en la Fase 3 habrá que marcarlo o aproximarlo.
- Campo extra **`category`** (no está en el esquema de la spec) para los valores por defecto de grasa extra en cantina.

### Cantina
- **Grasa extra por categoría** (`CANTEEN_EXTRA_FAT` en `src/domain/foods.ts`, con test): carne 4, pescado 3, huevo 4, cereal 2, pasta 3, patata 5, legumbre 3, verdura 5, ensalada 6; el resto 0 (lácteos, fruta, pan, platos preparados que ya vienen cocinados así…). Si un alimento trae `canteenExtraFatPer100g`, ese valor manda.
- kcal en cantina = kcal base + 9 × grasa extra (equivale a recalcular desde macros).

### Registro
- **Tipo de día por defecto**: `light` cuando el día no tiene registro.
- Cada entrada guarda una **copia** del nombre y de los nutrientes calculados en el momento de registrar: si luego editas el alimento, el histórico no cambia.
- **Sin franjas de comida** (desayuno/comida/cena) en el MVP: una lista por día ordenada por hora de registro.
- **Barras**: kcal, P, C, G y fibra son "objetivo" (kcal, carbos y grasa se marcan en rojo si pasan del 105 %; la proteína y la fibra no); sal y azúcares son "tope" (rojo si se superan).
- **Agua**: contador de 0 a 30 vasos por día; el objetivo depende del tipo de día.
- **Fechas** en hora local (`YYYY-MM-DD`; el prototipo usaba UTC, y en Turquía, por ejemplo, eso cambia de día a medianoche UTC). La fecha va en la URL (`/today?date=…`).

### Mis alimentos
- "Editar macros" sobre un alimento crea uno **mío** con `overridesId` = id del original: en las búsquedas sale primero y **oculta** el original. Solo puede haber una corrección por alimento original (la nueva sustituye a la anterior).
- "Crear alimento nuevo" parte del texto buscado. Las kcal se calculan a partir de los macros; se rechaza P + C + G + fibra > 100 g.
- Un alimento mío tiene un solo nombre (el mismo en es y en).

### Búsqueda
- Local y offline (mío + semilla), con debounce de 300 ms. Orden: coincidencia (exacta > prefijo > palabra > contiene), luego fuente (mío > curado > OFF > USDA), luego alfabético. Normaliza acentos y letras ı/ł/ß.
- Etiqueta de fuente visible (Mío / Curado) y estado crudo/cocinado con aviso de cómo pesar.

### Tests
- `e2e/helpers.ts` siembra el perfil en IndexedDB para no repetir el onboarding en cada test.
- E2E "añadir comida": unidades, cantina, persistencia tras recargar, borrado, gramos manuales, editar macros (mío), crear alimento, tipo de día, agua y navegación por fechas.

### Comidas del día y edición (pedido tras revisar la Fase 2)
- **Cuatro comidas**: desayuno, comida, cena y **snacks** (media mañana, merienda…), en ese orden y siempre visibles aunque estén vacías. Cada una muestra su subtotal (kcal · P · C · G) y su botón "+ Añadir a …".
- **Contador "Te quedan"** arriba: kcal y P/C/G que faltan para el objetivo del tipo de día. Si te pasas, lo dice en tono neutro ("Te has pasado X kcal"), sin castigos.
- **Comida por defecto** al añadir: la de la sección desde la que entras; si no, según la hora local (5–10 desayuno, 11–12 snack, 13–16 comida, 17–19 snack, 20–4 cena).
- **Editar**: tocar una entrada abre el formulario con cantidad (en unidades si es múltiplo exacto, si no en gramos), contexto y comida; se puede cambiar el alimento, guardar o borrar.
- Cada entrada guarda una **copia del alimento** (`food`), así se puede editar aunque el alimento original cambie o venga de OFF/USDA (que no se guardan localmente).
- **Migración Dexie v3**: las entradas antiguas reciben comida según su hora de registro y la copia del alimento si existe en la semilla o en mis alimentos.

### Pendiente
- Recientes/favoritos en el buscador.

## Fase 3 — Base ampliada

### Proxy serverless (`api/`)
- **Vercel Functions** con firma web (`export function GET(request: Request)`), porque la spec ya fija la carpeta `api/`. Utilidades compartidas en `api/_lib/` (Vercel no publica como función lo que empieza por `_`).
- Endpoints: `GET /api/off-search?q=&lang=`, `GET /api/off-product?barcode=`, `GET /api/usda-search?q=`. Devuelven `Food` ya normalizados (la lógica de normalización es pura, en `src/domain/external.ts`, y se comparte con el cliente y los tests).
- **En desarrollo** no hace falta la CLI de Vercel: `vite-plugins/api-dev.ts` sirve `api/*.ts` dentro de `npm run dev` y carga `USDA_API_KEY` y `OFF_CONTACT` de `.env` solo en Node (sin prefijo `VITE_`, así nunca llegan al bundle del cliente).
- **Clave de USDA** solo en el servidor y enviada en la cabecera `X-Api-Key` (no en la URL, para que no salga en logs). Sin clave → 503 `not_configured` y la UI lo explica.
- **Caché**: en memoria por instancia (OFF 7 días, USDA 30 días) + cabeceras `s-maxage`/`stale-while-revalidate` para la CDN + caché en IndexedDB en el cliente (7 días, tabla `foodCache`, Dexie v4). Así funciona offline con lo ya buscado.
- **Límites**: OFF permite 10 búsquedas/min y 15 lecturas de producto/min por IP; USDA 1000/h. El proxy aplica 10/min, 12/min y 900/h por instancia y responde 429 antes de pasarse. **Ojo en producción**: todas las peticiones salen desde la IP del servidor, así que el límite de OFF se comparte entre todos los usuarios. Cuando haya tráfico real conviene: (a) llamar a OFF directamente desde el navegador (cada usuario usa su IP; OFF admite CORS) y dejar el proxy solo para USDA, o (b) usar los volcados diarios de OFF. Queda anotado para la Fase 6.
- **User-Agent** de OFF: `ErasmusEats/0.1 (OFF_CONTACT)`. OFF pide un email de contacto; no he puesto el tuyo. Define `OFF_CONTACT` en `.env` / Vercel con el contacto que quieras usar; sin él se envía `ErasmusEats/0.1`.

### Open Food Facts
- La búsqueda por texto usa **Search-a-licious** (`search.openfoodfacts.org/search`), que es lo que OFF recomienda ahora (la v2 no tiene búsqueda por texto y `cgi/search.pl` es legacy). Está en beta: si cambia, solo hay que tocar `api/off-search.ts`.
- **Búsqueda explícita**: OFF prohíbe usar su búsqueda "mientras escribes". El debounce de 300 ms de la spec se aplica a la búsqueda **local**; la externa se lanza con Enter o con el botón "Buscar en Open Food Facts y USDA".
- Normalización: descarta productos sin kcal o sin alguno de P/C/G, o con P + C + G > 101 g. kcal de `energy-kcal_100g` o, si falta, de kJ / 4,184. Sal de `salt_100g` o sodio × 2,5. Se queda la primera marca; los países se traducen a ISO (ES, IT, DE, PL, TR y algunos más).
- **Calidad**: `complete` si trae fibra, azúcares y sal; `incomplete` si falta alguno (cuenta como 0 y se avisa). Orden en la UI: curado/mío → completos (primero los vendidos en tu país de destino, OFF antes que USDA) → incompletos.
- **Azúcares**: OFF y USDA dan azúcares **totales**; se marcan con `sugarIsTotal` y la UI lo avisa al seleccionarlos. Siguen sumando al tope de azúcares libres (estimación conservadora).
- Estado `raw` por defecto ("tal como se vende"): en OFF casi todo se pesa tal cual sale del envase.
- **Código de barras**: si escribes 8, 12, 13 o 14 dígitos, se busca el producto. El escáner con cámara queda para más adelante (BarcodeDetector o Capacitor).

### USDA FoodData Central
- Solo `Foundation` y `SR Legacy` (genéricos, sin marcas, que ya cubre OFF).
- Carbohidratos "by difference" − fibra = carbohidratos disponibles (convención UE de la semilla). Sodio mg × 2,5 / 1000 = sal g. kcal de 1008 o Atwater (2048/2047); si no hay, desde macros.
- Estado `cooked` si la descripción dice cooked/boiled/roasted…; categoría deducida de `foodCategory` para la grasa extra en cantina.
- **Traducción**: USDA solo está en inglés. Si la búsqueda coincide (exacta o por prefijo) con un alias de la semilla en cualquier idioma, se usa su nombre en inglés ("mercimek" → "Lentils (dry)"); si no, se envía tal cual.
- Los nombres de USDA se muestran en inglés (no hay traducción fiable).

### Semilla y alias
- **173 alimentos** con nombres en **es/en/it/de/pl/tr** (antes 51 en es/en), incluidos básicos y platos típicos de los 5 países (kasza, twaróg, pierogi, sucuk, mantı, lahmacun, börek, currywurst, schnitzel, paella, tortilla…). Las unidades siguen en es/en, como dice el esquema de la spec.
- Sin alcohol por ahora: sus kcal (7 kcal/g) no encajan en la fórmula de macros de la semilla.
- Búsqueda local: a igual coincidencia, los básicos van antes que los platos preparados y dulces, y después los nombres más cortos ("pollo" → pechuga antes que nuggets).

### Entradas de fuentes externas
- Los productos de OFF/USDA no se guardan como alimentos locales: al añadirlos, la entrada guarda una copia (`food`), así que se pueden editar después aunque no haya conexión. Si quieres corregir uno, "Editar macros" lo guarda como tuyo y oculta el original.

### Tests
- Normalizadores probados con respuestas reales recortadas (`src/domain/__fixtures__/`), obtenidas con una sola consulta a cada API.
- Proxy: validación, caché, límites, 429/502/503, User-Agent y que la clave nunca aparece en la URL ni en la respuesta.
- E2E con el proxy simulado (`page.route`): no se llama a OFF/USDA reales al ejecutar los tests.

### Seguridad de la clave (tras la Fase 3)
- La clave de USDA y `OFF_CONTACT` acabaron por error en `.env.example`, que git sí sube (no llegó a commitearse). Se copiaron a `.env` (ignorado) y `.env.example` volvió a ser una plantilla vacía con `OFF_CONTACT=` documentado. Comprobado que la clave no está en ningún archivo seguido por git ni en `dist/`.

## Fase 4 — Países, precios y recetas

### Países (`src/data/countries.json`)
- Por país: moneda, supermercados principales y **30 básicos** (ids de la semilla).
- **Equivalencias**: en vez de escribir a mano las 20 combinaciones origen→destino, se definen **grupos de sustitución** (almidones, panes, legumbres, lácteos proteicos, yogures/leches, quesos, carne, embutido, pescado, grasas) y se calculan solas: para cada básico de tu país de origen, se muestra si se vende en destino y la alternativa más barata del mismo grupo, **por 1000 kcal** (almidones, panes, grasas) o **por 100 g de proteína** (el resto). Ejemplo ES→TR: arroz → bulgur; lentejas → mercimek (lenteja roja); garbanzos → existen allí (nohut), pero la lenteja roja es más barata.
- Las recetas con ≥ 50 % de ingredientes que son básicos de tu país de origen llevan la etiqueta "Ingredientes de casa". Puedes ver las recetas de cualquier país; los precios siempre son los del país donde compras.

### Precios (`src/data/prices/{ES,IT,DE,PL,TR}.json`, generados con `scripts/build-prices.mjs`)
- **`pricePerKg` es del producto tal como se compra** (crudo, en seco, escurrido en conservas, por litro en líquidos). Campo extra **`yield`** (peso registrado / peso comprado) para lo que la semilla registra cocinado: carne ~0,7–0,75; pescado 0,8; huevo 0,88 (cáscara); cuscús/quinoa/mijo/cebada ~2,5–2,8 (absorben agua). La lista de la compra dice cuánto **comprar** (crudo/en seco), no cuánto comer.
- **Fuentes**: búsqueda web con artículos y folletos fechados (El Confidencial, oct-2026, comparativa Mercadona/Lidl; lidl.it, nov-2026; folletos de Lidl IT; Biedronka, nov-2026; aktüel de BİM/A101, nov-2026) y **Open Prices** (API pública, ODbL). Se marca `verificado` solo si hay un precio por kg con fecha (o una mediana de Open Prices con n ≥ 2); lo demás es `estimado`, coherente con esas referencias. En la UI se muestran la fecha, la tienda y cuántos precios están verificados.
- Open Prices tiene poca cobertura de productos frescos sin código de barras y su filtro por país no funciona en la API: se pidieron 8 categorías (fruta, verdura, pollo, huevos) y se filtró por país en local. Solo se usaron medianas con n ≥ 2. No se ha hecho scraping de webs de supermercados.
- **Turquía**: con la inflación, los precios en TRY caducan rápido; conviene revisarlos cada 1–2 meses (`node scripts/build-prices.mjs` tras editar la tabla).
- Unos 50–80 alimentos con precio por país: los básicos y los ingredientes de las recetas. Un test comprueba que todas las recetas tienen todos sus ingredientes con precio.

### Recetas (`src/data/recipes/{país}.json`, generadas con `scripts/build-recipes.mjs`)
- 12 por país (4 desayuno/snack + 8 comida/cena), ≤ 20 min, solo placa/microondas/hervidor, ≤ 6 ingredientes, con platos locales (menemen, mercimek çorbası, kısır, pasta e ceci, kasza z jajkiem, Pellkartoffeln mit Quark, arroz con huevo y atún…).
- **Ingredientes en crudo/seco** cuando se compran así (arroz, pasta, bulgur, lenteja roja…), para que macros y coste cuadren con lo que se compra; legumbre "de bote" (escurrida) donde es lo habitual.
- Macros y coste **se calculan** (nunca se escriben). Sal, especias, limón y hierbas no se cuentan.
- Campos extra frente al esquema de la spec: `kind` (desayuno/comida) y `equipment`. Las etiquetas nutricionales también **se calculan**: vegetariana (sin carne ni pescado), alta en proteína (≥ 20 g y ≥ 25 % de las kcal) y objetivos (lose ≤ 600 kcal y ≥ 20 % de proteína; gain ≥ 450 kcal en comida o ≥ 350 en desayuno; recomp ≥ 25 % de proteína). Las etiquetas manuales (`tags`) solo describen ("local").
- **Orden de sugerencias**: encaje con lo que queda hoy (premia cubrir la proteína pendiente y penaliza pasarse de kcal o grasa), en tramos de 0,1, y luego el coste por ración.
- "Añadir al día" registra **cada ingrediente** como una entrada (escalado por las raciones que comes) en la comida elegida; así se pueden editar uno a uno.

### Optimizador (`src/domain/optimizer.ts`, `javascript-lp-solver` 1.x)
- Programación lineal entera mixta: gramos por semana de cada alimento con precio, binaria "entra o no en la cesta". Minimiza el coste.
- **Objetivo semanal** = suma de los 7 días de una **semana tipo** (días de entreno según tus deportes; el resto, ligeros), con tus overrides de objetivos.
- **Restricciones**: kcal, P, C y G a ±5 %; máximo por alimento y día (p. ej. carne 250 g, verdura 200 g, cereal en seco 150 g, aceite 35 g…); topes por grupo (legumbre seca ≤ 120 g/día, de bote ≤ 350, grasas ≤ 35, frutos secos ≤ 50); mínimo de 150 g/semana si un alimento entra (50 g en aceites); **≥ 8 alimentos distintos**; **fruta + verdura ≥ 400 g/día** (≥ 150 de fruta y ≥ 200 de verdura, recomendación OMS). Sin estos límites la solución óptima eran 2,8 kg de tomate triturado y casi todo legumbre seca.
- Solo categorías básicas (sin platos preparados, dulces, suplementos ni bebidas).
- **Preferencias**: vegetariana, alergias (gluten, lactosa, frutos secos, huevo, pescado, soja; tabla orientativa en `src/domain/allergens.ts`), alimentos excluidos y "solo cocina rápida" (sin legumbre seca). Se guardan en IndexedDB.
- **Si no hay solución**, relaja por pasos y lo dice: macros ±10 % (kcal siguen ±5 %) → variedad 5 → fruta/verdura 200 g → solo kcal y proteína. Si aun así no hay, explica si es por pocos alimentos o por las restricciones.
- Rendimiento: < 50 ms por cesta en los 5 países (tests con límite de 8 s).
- La lista se redondea a 50 g hacia arriba y se calcula el coste de lo que compras (por eso el total puede ser algo mayor que el óptimo teórico).

### UI y navegación
- Pestañas: **Hoy · Recetas · Compra · Ajustes**. "Objetivos" se abre desde Ajustes (y en el onboarding).
- Recetas, detalle y Compra se cargan bajo demanda (`React.lazy`): el bundle inicial se mantiene en ~170 KB gz.
- El plan freemium (3 recetas/día en gratis) no se aplica: `flags.premium` está desactivado.

### Pendiente
- Fase 5: el coach debería usar también las recetas para sugerir cómo cubrir la proteína que falta.
- Los precios de Turquía necesitan revisión frecuente.

## Fase 5 — Progreso y avisos

### Datos
- **Peso**: tabla `weights` (Dexie v5), uno por fecha, 35–300 kg, con un decimal. Se recomienda pesarse una vez por semana, pero se admite cualquier fecha (no futura).
- **El último pesaje actualiza el peso del perfil**, así que los objetivos (BMR, proteína g/kg, agua) se recalculan solos. Se conservan los overrides manuales.
- **"Actividad registrada"** = días marcados en Hoy como gimnasio, carrera o fondo largo, **o con la casilla «He hecho otra actividad»** (añadida tras revisar la Fase 5).
- Resúmenes de los **últimos 28 días** (comidas, tipo de día, agua, objetivos de cada día) calculados en `src/domain/progress.ts`.

### Reglas del coach (`src/domain/coach.ts`, umbrales en `RULES`)
- Las reglas sobre comida solo miran **días completos (antes de hoy) y registrados**: no hay alarmas por días sin apuntar ni por el día en curso.
- **Inactividad** (lose/recomp): días seguidos sin entreno contando desde hoy; ≥ 7 → aviso, 4–6 → sugerencia suave. No cuentan los días anteriores al primer uso de la app (un usuario nuevo no recibe "7 días sin actividad").
- **Meseta / deriva** (2 semanas): requiere pesajes a ~14 días (±3), ≥ 10 días registrados de 14 y ≥ 80 % de ellos dentro de ±10 % de las kcal. lose: si no ha bajado ≥ 0,2 kg → propone −150; gain: si no ha subido ≥ 0,2 kg → +150; maintain/recomp: si cambia > 1 kg → ∓100. Tras aceptar un ajuste, no propone otro hasta pasados 14 días.
- **Demasiado rápido**: pérdida > 1 % del peso en cada una de las 2 últimas semanas (pesajes a ~7 y ~14 días) → aviso y propone +150. Tiene prioridad sobre la meseta.
- **Proteína** < 80 % del objetivo 4 días seguidos; **agua** < 50 % en ≥ 3 de los últimos 7 días registrados; **sal** > 5 g y **azúcares** > tope en ≥ 3 de 7.
- **Objetivos muy bajos repetidos**: el contador de intentos por debajo del suelo ahora se guarda (antes era por sesión); con ≥ 2, aviso con recursos de ayuda (médico, servicio de salud de la universidad, asociaciones de TCA) en lugar de aceptar el valor.
- **Ajustes de kcal**: nunca automáticos. El usuario pulsa "Aplicar ±X kcal/día"; se guarda en `profile.kcalAdjustment` (acumulado, ±500 máx.), se suma antes del suelo de seguridad (que se sigue respetando) y se ve en Objetivos con un botón para quitarlo. No afecta a los días con override manual.
- **Descartar** oculta un aviso 7 días; si el problema sigue, vuelve.
- Severidad `warning` (inactividad ≥ 7 días, demasiado rápido, recursos de ayuda) o `info`, siempre con icono y etiqueta además del color. Tono amable: sin ayuno, "compensar" ni castigos.
- En Hoy aparece un acceso "Tienes N avisos del coach" cuando hay alguno.

### Gráficas (`src/features/progress/charts.tsx`)
- SVG propio, sin librería (la pantalla de Progreso son ~3,6 KB gz). Seguí el skill de dataviz: una sola serie por gráfica (sin leyenda; la nombra el título), un único eje, cuadrícula discreta, línea de 2 px, marcadores de 8 px con anillo de superficie, barras con 2 px de separación y extremo redondeado anclado a la base, etiqueta directa solo en el último peso, tooltip al pasar o enfocar cada marca (áreas de toque más grandes que la marca) y "Ver como tabla" en cada gráfica.
- **Color de las marcas**: el acento de la app (#17664f) no pasaba el validador como color de datos (demasiado apagado en claro y fuera de la banda de luminosidad en oscuro). Se añadió `--color-chart`: #12855f en claro y #2fa37d en oscuro, validados contra sus superficies (#ffffff / #222221).
- kcal: barras de lo comido + marca discontinua del objetivo de ese día (cambia con el tipo de día); los días sin registro llevan un punto gris en vez de barra. Actividad: franja de 14 días (relleno = entreno).

### Navegación
- Pestañas: Hoy · Recetas · Compra · **Progreso** · Ajustes.

### Pendiente
- El coach no sugiere recetas concretas para cubrir la proteína que falta (enlaza en el texto a las recetas altas en proteína).
- Las fechas de la lista de pesajes se muestran en ISO; se pueden localizar en la Fase 6.

### Otra actividad (pedido tras revisar la Fase 5)
- Casilla en Hoy, **«He hecho otra actividad»**, con tipo (andar, bici, deporte, otra), minutos (1–600) e intensidad (suave, moderada, intensa). Se guarda en el día (`DayRecord.extraActivity`) y vale para cualquier tipo de día.
- **Cuenta como día activo** para el coach (desaparece el aviso de inactividad) y para Progreso.
- **Sube el objetivo de ese día**: kcal extra = (MET − 1) × peso × horas × 0,75, con MET de 3, 5 y 8 según la intensidad (Compendium, redondeado) y un tope de 800 kcal. Se resta 1 MET porque el reposo ya está en el objetivo, y se cuenta solo el 75 % porque las estimaciones por MET suelen pasarse. Las kcal extra van a **carbohidratos**; proteína y grasa no cambian; fibra y tope de azúcares se recalculan; agua +1 vaso desde 30 min y +2 desde 90.
- Se suma también sobre un override manual del tipo de día.
- La casilla responde al instante (estado optimista) y se guarda en IndexedDB en segundo plano.

## Fase 6 — Pulido

### PWA y offline
- `vite-plugin-pwa` (2.x, compatible con Vite 8) con `registerType: 'autoUpdate'`: el service worker se actualiza solo en la siguiente visita.
- **Precaché de toda la app**, incluidas las pantallas diferidas, recetas, precios y semilla (~775 KB), así que funciona offline desde la primera visita completa. `/api/*` nunca pasa por el service worker (`NetworkOnly`): las búsquedas externas ya se cachean en IndexedDB y sin conexión la UI dice "Sin conexión".
- **Iconos** generados con `scripts/build-icons.mjs` (PNG sin dependencias: plato con un brote, 192/512, maskable y apple-touch) y favicon SVG. Son provisionales hasta tener marca.
- Manifiesto en español (`lang: es`), `display: standalone`, `orientation: portrait`, colores de la marca.

### Rendimiento (LCP < 2,5 s en móvil)
- Medido en Playwright contra el build de producción con limitación tipo Lighthouse (4G lento: 1,6 Mbps y 150 ms; CPU ×4). Inicial: **2,9 s**.
- Diagnóstico: el JS terminaba de bajar a ~1,2 s, pero no se pintaba nada hasta ~2,8 s (ejecución de React/Router/Dexie/i18next con CPU lenta, más la espera a IndexedDB).
- Cambios: todas las rutas con `React.lazy` **salvo la bienvenida** (dividirlo todo, incluidos los idiomas, empeoró a 3,2 s por la cascada de peticiones, así que los dos idiomas siguen en el bundle: ~12 KB gz); la semilla de alimentos fuera del arranque (la migración v3 ya no la importa); **bienvenida prerenderizada** en el HTML en el build (es y en, `src/prerender.tsx` + `scripts/prerender.mjs`); y los usuarios nuevos no esperan a IndexedDB para pintar.
- Resultado: **LCP ≈ 1,0–1,1 s**, vigilado por `e2e/pwa.spec.ts` (falla si pasa de 2,5 s). Bundle inicial ≈ 140 KB gz.
- El HTML prerenderizado solo se muestra en `/` y `/onboarding` y **nunca** a quien ya completó el onboarding (indicador `fits.onboarded` en `localStorage`; no es un dato sensible y se borra con "Borrar todos mis datos"). Así un usuario recurrente no ve la bienvenida un instante antes de Hoy.
- La migración v3 de Dexie ya no rellena la copia del alimento para los de la semilla: se resuelve al abrir la edición (como ya hacía la pantalla); para "mis alimentos" sí se copia.

### Accesibilidad
- `e2e/a11y.spec.ts` audita con **axe** (WCAG 2.1 A/AA) las 12 pantallas en **modo claro y oscuro**: sin violaciones graves ni críticas (contraste AA incluido), más una comprobación de objetivos táctiles ≥ 44 px en Hoy.
- Se corrigió lo que encontró axe: los puntos táctiles de las gráficas tenían `aria-label` sin rol. Ahora tienen `role="img"`, y el `<svg>` contenedor es `role="group"` para que los lectores de pantalla anuncien cada punto.
- Modo oscuro por `prefers-color-scheme` (los colores se eligieron para cada modo, no se invierten).

### Privacidad, legal y datos
- **Política de privacidad** (`/privacy`, enlazada desde la bienvenida y Ajustes): qué datos (incluidos datos de salud, art. 9 RGPD), dónde (solo en el dispositivo), qué sale (solo el texto buscado en OFF/USDA, vía proxy), sin cookies ni analítica, derechos (exportar/borrar), edad mínima y aviso médico. **El responsable del tratamiento queda pendiente** (texto marcado) hasta que se publique.
- **Créditos y licencias** (`/credits`): Open Food Facts (ODbL/DbCL), Open Prices (ODbL), USDA (dominio público), origen de la semilla, recetas y precios, Compendium MET y licencias de las librerías (MIT, Apache-2.0, Unlicense), con enlaces.
- **Exportar mis datos**: descarga un JSON (`erasmus-eats-AAAA-MM-DD.json`) con ajustes, comidas, días, mis alimentos y pesos (no la caché de búsquedas). Importar queda para más adelante.
- Sin analítica: ninguna dependencia ni petición de terceros desde el navegador.

### Ajustes
- Idioma, país (lleva a la bienvenida para cambiar Erasmus/país), perfil, objetivos, **unidades** (solo métricas: son las de los 5 países; las imperiales no aportan en este alcance), exportar, borrar todo, privacidad, créditos y versión (`__APP_VERSION__` desde `package.json`, ahora **0.9.0**: MVP completo a falta de los datos legales y la marca).

### Despliegue
- `vercel.json`: framework Vite, `npm run build`, salida `dist`, fallback de la SPA excluyendo `/api/`, `sw.js` sin caché, assets inmutables y cabeceras de seguridad básicas. Instrucciones en el README.
- **No se ha desplegado** (no hay cuenta de Vercel en este entorno): la configuración está, pero falta comprobarla en un despliegue real.

### Pendiente / siguientes pasos
- Responsable del tratamiento en la privacidad, nombre y marca definitivos.
- OFF desde el navegador si hay tráfico real (límite por IP compartido en el proxy).
- Revisar los precios (TR cada 1–2 meses).
- Importar copia de seguridad; escáner de código de barras con cámara; Capacitor para las tiendas.

## Tras el despliegue (pruebas del usuario)

### Open Food Facts directo desde el navegador
- El proxy compartía la IP del servidor y, con ella, el cupo de OFF (10 búsquedas/min por IP) entre todos los usuarios. Ahora **cada navegador llama directamente a OFF**, con su propio cupo y un limitador en el cliente (10 búsquedas y 15 productos por minuto) que avisa antes de pasarse.
- Search-a-licious **no permite CORS**: se usan `world.openfoodfacts.org/cgi/search.pl` (búsqueda) y `/api/v2/product/{código}` (código de barras), que responden con `Access-Control-Allow-Origin: *`. Comprobado desde el navegador.
- El navegador no deja fijar User-Agent: la app se identifica con `app_name` y `app_version`, como documenta OFF. `OFF_CONTACT` deja de usarse.
- El proxy `api/` queda solo para USDA (la clave no puede ir al navegador). Imports relativos con `.js` para el ESM de Vercel. Política de privacidad actualizada: OFF ve la IP del usuario, como al visitar su web.

### Nombre
- Primero **Erasmus+FITS** y después **InternationalFits**, para evitar la marca de la UE "Erasmus+" (registrada en la EUIPO). El nombre está en `src/config/app.ts`, las traducciones (`app.name`), el manifiesto y el título.
- La base IndexedDB conserva el nombre interno `erasmus-fits` y el indicador `fits.onboarded`: son invisibles y cambiarlos borraría los datos de quien ya usa la app.
- El texto "¿Vas de Erasmus?" se mantiene: es un uso descriptivo del programa, no una marca de producto.

### Té, infusiones y café
- Añadidos a la semilla (179 alimentos): té negro / çay (vaso de té de 100 ml), té verde, manzanilla, poleo menta, infusión de hierbas y café solo (taza pequeña de 60 ml), con nombres en 6 idiomas. ~1–2 kcal/100 ml; el azúcar se añade aparte con "Azúcar" (cucharadita).
- No cuentan como agua (decisión conservadora; se puede cambiar si se quiere).
- **Búsqueda**: una palabra completa pesa más que un prefijo ("té" → "Té negro" antes que "Ternera"), y a igual coincidencia gana el nombre en tu idioma frente a los alias de otros idiomas ("té" no saca "Tereyağı").

### Ensaladas en cafetería
- Antes, una ensalada en cafetería sumaba 6 g de grasa por cada 100 g. En realidad suelen servirse **sin aliñar**, así que se sobrestimaba. Ahora **ensaladas y verduras crudas no suman grasa en cafetería**; las verduras cocinadas siguen sumando 5 g/100 g (salteadas).
- Al elegir una ensalada o verdura cruda aparece un aviso: si le pones aceite, añádelo aparte ("Aceite de oliva", 1 cucharada ≈ 10 g).

### Funciones de Vercel: tsconfig propio en `api/`
- Vercel compilaba `api/*.ts` con el tsconfig de la raíz, que pide tipos de Vite, PWA y jest-dom, y daba avisos `TS2688`. Ahora `api/tsconfig.json` solo carga `node` (para `process.env`), con `moduleResolution: bundler` como el resto (NodeNext obligaría a poner `.js` en todos los imports de `src/domain`). Excluye los tests.

### Privacidad: responsable y contacto
- Responsable: Raúl Segovia. Contacto: el buzón del proyecto internationalfits1@gmail.com (`CONTACT_EMAIL` en `src/config/app.ts`), que se usa tanto para comentarios como para ejercer derechos; los textos de la política lo reciben por interpolación (`{{email}}`), así que solo se cambia en un sitio. Base legal: consentimiento; los datos de salud no salen del dispositivo. Se nombra a Vercel como proveedor de alojamiento y se añade la reclamación ante la AEPD. Fecha de la política: 2026-11-19.
- Ajustes → "Enviar comentarios o avisar de un error": `mailto:` con la versión en el asunto. Es el único canal de feedback (no hay analítica).
- Aceptación expresa: en la bienvenida hay una casilla "He leído y acepto la política de privacidad"; sin marcarla no se puede continuar. Se guarda la fecha de la política aceptada (`privacyAccepted` en el store, constante `PRIVACY_UPDATED` en `src/features/legal/privacyVersion.ts`, fuera de `LegalScreens` para no meterla en el arranque). Si la política cambia de fecha, la casilla vuelve a aparecer desmarcada.

### Logo
- Logo en `docs/logo.png`, versión **sin la bandera de la UE** (el emblema europeo tiene restricciones de uso comercial y no puede sugerir respaldo oficial; el mapa de Europa no plantea problema). Los iconos de la PWA usan solo el símbolo (globo), sin el texto, sobre fondo `#f6fafd` (también `background_color` del manifiesto); el maskable deja un 18 % de margen. `scripts/build-icons.mjs` queda obsoleto. El original es de baja resolución (~256 px el símbolo): con un SVG o PNG de ≥1024 px se regeneran más nítidos.

### Foto del plato → calorías
- Añadir comida → "Calcular desde una foto del plato". El navegador reduce la foto a ≤1024 px (JPEG 0,8) y la manda a `POST /api/photo-estimate`, que la pasa a la API de Gemini (`gemini-3.5-flash-lite` por defecto, cambiable con `GEMINI_MODEL`; razonamiento `LOW`; JSON con `PHOTO_SCHEMA` vía `responseJsonSchema`) y devuelve ingredientes con gramos y nutrientes por 100 g. La foto no se guarda.
- La respuesta se sanea en `src/domain/photoEstimate.ts` (recorte de valores imposibles, macros ≤ 100 g/100 g, kcal recalculadas si no cuadran con los macros, máx. 12 ingredientes de ≤ 1,5 kg).
- El usuario revisa: puede quitar ingredientes y cambiar gramos antes de añadirlos. Cada uno se registra como alimento propio (copia en la entrada), con calidad "aproximada" y **sin grasa extra de cafetería** (la foto ya muestra el plato tal cual).
- Coste: gratis para el usuario; lo paga el proyecto. Límite de 10 fotos/hora por IP y 300/hora por instancia. Clave en `GEMINI_API_KEY` (solo servidor); si Gemini agota la cuota (429) la app muestra "vuelve a intentarlo dentro de un rato". `maxDuration` 60 s en `vercel.json`.
- Privacidad: la sección "Qué sale de tu dispositivo" menciona a Google (API de Gemini, EE. UU.) como destinatario de la foto, y la pantalla de foto lo avisa antes de hacerla.
- Proveedor: Gemini en lugar de Claude porque de momento no hay clave de Anthropic. **El plan gratuito de Gemini no se puede usar en producción**: sus condiciones solo permiten servicios de pago para apps disponibles en el EEE, Suiza o Reino Unido, y en el gratuito Google usa el contenido para mejorar sus productos (con revisión humana). El gratuito vale para desarrollo local; antes de poner `GEMINI_API_KEY` en Vercel hay que activar la facturación del proyecto en AI Studio (misma clave). Coste orientativo con Flash-Lite: ~0,2 céntimos por foto. La política de privacidad describe ya ese uso de pago (sin entrenamiento).
