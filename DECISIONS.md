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
