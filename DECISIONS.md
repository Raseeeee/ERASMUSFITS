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
