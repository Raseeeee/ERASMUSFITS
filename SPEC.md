# SPEC: App de nutrición para estudiantes Erasmus ("ErasmusEats", nombre provisional)

> Para Claude Code. Lee todo antes de escribir código. Trabaja por fases (sección 12), con commits pequeños, y no pases a la siguiente fase sin que pasen los tests de la actual. Si algo es ambiguo, elige un valor razonable por defecto, anótalo en `DECISIONS.md` y sigue.

## 1. Qué es
Web app (PWA, móvil primero) para estudiantes que se van de Erasmus (o no) y quieren cumplir un objetivo físico (adelgazar, mantener, engordar/ganar músculo, recomposición) comiendo barato y simple con lo que hay en el supermercado del país de destino.

Diferenciales: (1) objetivos de macros por tipo de día, (2) registro de comida con "cocinado en casa" vs "cafetería/restaurante", (3) recetas baratas y rápidas por país, (4) optimizador de compra por precio, (5) avisos si el comportamiento no encaja con el objetivo.

Alcance inicial: **5 países** (España ES, Italia IT, Alemania DE, Polonia PL, Turquía TR), cualquier combinación origen→destino entre ellos, más modo "no voy de Erasmus" (solo nacionalidad). Idiomas: **es** y **en** (i18n desde el día 1; ningún texto hardcodeado). Publicar en Google Play/App Store queda fuera de alcance por ahora, pero no tomes decisiones que lo impidan (Capacitor más adelante).

## 2. Stack
- Vite + React + TypeScript + Tailwind. React Router. `i18next` para es/en.
- Estado: Zustand. Persistencia local-first en IndexedDB (Dexie). Sin login en el MVP.
- PWA instalable (vite-plugin-pwa), funciona offline con la base local.
- Backend mínimo serverless (Cloudflare Workers o Vercel Functions) solo para: proxy a Open Food Facts y USDA FoodData Central (esconder API key de USDA, cachear, respetar límites). Variables en `.env`, nunca en el repo.
- Tests: Vitest para lógica (cálculos, optimizador, avisos), Playwright para 3 flujos críticos (onboarding, añadir comida, ver receta).
- Estructura: `src/domain` (lógica pura sin React), `src/data` (JSON semilla), `src/features/*`, `src/i18n`, `api/` (funciones serverless).

## 3. Flujo de pantallas
1. **Bienvenida**: idioma (es/en) y pregunta "¿Vas de Erasmus?".
   - Sí: país de origen y país de destino (de los 5, selector con banderas).
   - No: solo nacionalidad.
2. **Perfil**: sexo a efectos de cálculo (hombre / mujer / prefiero no decirlo → media de ambas fórmulas), edad (mínimo 18; si menor, bloquear con mensaje), peso, estatura, objetivo, actividad habitual.
   - Objetivos: `lose`, `maintain`, `gain`, `recomp`.
   - Actividad: sedentario, ligera, moderada, alta; y deportes previstos: gym, running, triatlón, otros (multi-selección) con días por semana.
3. **Resumen de objetivos**: tabla con kcal, proteína, carbos, grasa, fibra, sal, azúcares, agua para los 3 tipos de día; editable (override manual, con aviso si se sale de rangos seguros).
4. **Hoy** (pantalla principal): selector de fecha y tipo de día (`rest`, `light`, `gym`, `run`, `long_endurance`), barras de progreso (kcal, P, C, G, fibra, sal, azúcares), contador de vasos de agua (250 ml), lista de comidas del día, botón "añadir".
5. **Añadir comida**: buscador unificado (sección 5), cantidad en gramos o en unidades (filete, huevo, lata...), contexto de cocinado (`home` | `canteen`), previsualización de macros, opción de editar macros manualmente por alimento (guardar como "mío" y que tenga prioridad sobre fuentes externas).
6. **Recetas**: filtradas por país de destino, objetivo, tiempo y presupuesto; botón "añadir al día" que registra los ingredientes.
7. **Compra barata**: cesta semanal sugerida con coste total en moneda local (sección 7).
8. **Progreso**: peso semanal, adherencia, actividad, avisos activos (sección 8).
9. **Ajustes**: idioma, país, unidades, exportar/borrar datos.

## 4. Cálculos (en `src/domain/targets.ts`, funciones puras con tests)
- BMR Mifflin-St Jeor: hombre `10·kg + 6.25·cm − 5·edad + 5`; mujer `… − 161`; "prefiero no decirlo" = media de ambos.
- Factor de actividad por tipo de día (sobre BMR): rest 1.30, light 1.40, gym 1.55, run 1.60, long_endurance 1.75. El factor habitual del perfil sirve para la semana tipo y el progreso.
- Ajuste calórico por objetivo: lose −15% (máx. −25%), maintain 0, gain +10%, recomp: gym/run 0%, light −5%, rest −10%.
- Suelo de seguridad: nunca objetivos por debajo de 1500 kcal (hombre) / 1200 kcal (mujer / no decir) ni por debajo del BMR en más de 10%; si el cálculo cae por debajo, usar el suelo y mostrar aviso. IMC < 18.5: no permitir objetivo `lose`.
- Proteína (g/kg): lose 2.0, recomp 2.0, gain 1.8, maintain 1.6. Grasa: máx(0.8 g/kg, 25% kcal). Carbos: resto de kcal. (4 kcal/g P y C; 9 kcal/g grasa.)
- Fibra: 14 g por cada 1000 kcal. Sal: tope 5 g/día. Azúcares libres: tope 10% de kcal (mostrar objetivo ideal 5%). Agua: 35 ml/kg en vasos de 250 ml (+1-2 vasos en días de entrenamiento).
- Todos los valores son orientativos y editables; incluye un aviso visible "no es consejo médico" en onboarding y ajustes.

## 5. Base de datos de alimentos
Un buscador único que combina, en este orden de prioridad:
1. **Mis alimentos** (macros manuales del usuario, IndexedDB).
2. **Semilla curada local** (`src/data/foods.seed.json`): ver el prototipo `macros-erasmus.html` adjunto, que tiene ~25 alimentos con macros por 100 g cocinado, unidad habitual y peso por unidad, y "grasa extra en cafetería". Ampliar a 150-200 alimentos básicos con alias en es/en/it/de/pl/tr (ej. "pechuga de pollo / chicken breast / petto di pollo / Hähnchenbrust / pierś z kurczaka / tavuk göğsü").
3. **Open Food Facts** (productos de supermercado, por texto y por código de barras). Consulta la documentación actual de su API de búsqueda y requisitos (User-Agent identificable). Normalizar a por 100 g; descartar resultados sin kcal/macros; mostrar marca y país.
4. **USDA FoodData Central** (alimentos genéricos; requiere API key gratuita). Solo en inglés: buscar con la traducción vía tabla de alias cuando exista.

Reglas: debounce 300 ms, caché en IndexedDB, resultados con etiqueta de fuente y un indicador de calidad (curado > OFF completo > OFF incompleto). Debe funcionar offline con la semilla. Normalizar por 100 g; distinguir peso crudo/cocinado (campo `state`) y avisarlo en la UI.
- Esquema `Food`: `id, names{es,en,...}, per100g{kcal,p,c,f,fiber,sugar,salt}, state(raw|cooked), unit{name{es,en},grams}, canteenExtraFatPer100g, source, barcode?`.
- Contexto cantina: `fat = f + canteenExtraFatPer100g · g/100`; kcal se recalculan desde macros. Valores por categoría, editables por el usuario y revisables con tests.
- Atribución obligatoria a Open Food Facts (licencia ODbL) en la pantalla de créditos.

## 6. Qué come una persona "normal" en su país
Archivo `src/data/countries.json` con, por país: moneda, supermercados principales, alimentos básicos habituales (top 30), y equivalencias para sustituir (ej. origen ES→destino TR: arroz/lentejas/garbanzos → bulgur, mercimek, nohut). Se usa para (a) sugerir recetas con ingredientes familiares y (b) mostrar "tu alimento de casa → equivalente local más barato".

## 7. Precios y optimizador de compra
- Datos en `src/data/prices/{ES,IT,DE,PL,TR}.json`: por alimento, `pricePerKg` en moneda local (EUR, EUR, EUR, PLN, TRY), `store` tipo (supermercado económico), `date`, `confidence` (`estimado` | `verificado`) y `source`.
- Claude Code: investiga con búsqueda web los precios típicos de supermercados económicos de cada país (p. ej. Mercadona/Lidl; Lidl/Esselunga; Aldi/Lidl; Biedronka/Lidl; BIM/A101/Migros) y contrasta con **Open Prices** (prices.openfoodfacts.org, API pública, ODbL). No hagas scraping masivo de webs de supermercados: respeta términos de uso y robots.txt. Marca todo lo no verificado como `estimado` y muestra la fecha en la UI.
- Optimizador (`src/domain/optimizer.ts`): programación lineal (p. ej. `javascript-lp-solver`) que minimiza coste semanal sujeto a los macros/kcal objetivo ±5%, límites por alimento (máx. gramos/día para evitar soluciones absurdas, variedad mínima: ≥ 8 alimentos distintos/semana), preferencias del usuario (vegetariano, alergias, excluidos) y tiempo de cocina. Salida: lista de la compra con cantidades, coste total y por día.
- Tests: casos con solución conocida; si es infactible, relajar restricciones y avisar al usuario con el motivo.

## 8. Recetas
- `src/data/recipes/{country}.json`, 12 recetas por país para empezar (4 de desayuno/snack, 8 comida/cena), pensadas para residencia: máximo 20 minutos, solo placa/microondas/hervidor, pocos ingredientes y baratas. Incluir platos locales sencillos (ej. TR: menemen, mercimek çorbası, bulgur pilavı con pollo; IT: pasta con atún y tomate; PL: ensalada de arroz con atún, kasza con huevo; DE: Quark con avena y fruta; ES: arroz con huevo y atún, lentejas rápidas).
- Esquema: `id, country, title{es,en}, tags(objetivo, vegetariano, alto en proteína), minutes, servings, ingredients[{foodId, grams}], steps{es,en}`. Macros y coste se calculan a partir de los ingredientes y precios, nunca se escriben a mano.
- Orden de sugerencias: encaje con macros restantes del día, luego menor coste por ración.

## 9. Avisos y ajuste automático (`src/domain/coach.ts`)
Reglas evaluadas diariamente y al registrar el peso semanal; cada aviso tiene `id`, gravedad, texto i18n y se puede descartar:
- Objetivo `lose`/`recomp` y 7 días sin actividad registrada → aviso aunque cumpla macros; con 4-5 días, aviso suave.
- Cumple macros pero el peso no se mueve en la dirección esperada durante 2 semanas → proponer ajuste de ±100-150 kcal con confirmación del usuario (nunca automático).
- Ritmo de pérdida mayor del 1% del peso por semana durante 2 semanas → aviso de que va demasiado rápido y proponer subir kcal.
- Proteína < 80% del objetivo 4 días seguidos; agua < 50% varios días; sal/azúcar por encima del tope repetidamente.
- Tono amable y no culpabilizador. Sin mensajes de ayuno, "compensar" ni castigar. Si el usuario introduce objetivos muy bajos de forma repetida, mostrar recursos de ayuda en lugar de aceptar.

## 10. Privacidad, legal y UX
- Datos personales (peso, estatura) = datos de salud en RGPD: guardar solo en local en el MVP; política de privacidad y aviso claro; botón "exportar" y "borrar todo".
- Cookies/analítica: ninguna analítica sin consentimiento; si se añade, solo una opción respetuosa (p. ej. Plausible) con banner.
- Accesibilidad: contraste AA, tamaños táctiles ≥ 44 px, soporte de modo oscuro.
- Rendimiento: LCP < 2.5 s en móvil; bundle inicial < 250 KB gz.

## 11. Preparado para monetizar (sin implementarlo aún)
- Feature flags en `src/config/flags.ts`: `premium`, `affiliate`, `ads`. Todo desactivado en el MVP.
- Plan previsto freemium: gratis = registro, macros, 1 país, 3 recetas/día; premium = optimizador completo, todos los países, historial y exportación.
- Estructura lista para añadir pagos (Stripe) y cuentas (Supabase Auth) sin reescribir el dominio.

## 12. Fases y criterios de aceptación
1. **Base**: proyecto, i18n es/en, onboarding completo, cálculos con tests (casos para hombre/mujer/no-decir, 4 objetivos, suelos de seguridad).
2. **Registro**: pantalla Hoy, tipos de día, añadir comida con semilla local, gramos/unidades, casa/cantina, macros manuales, agua, persistencia.
3. **Base ampliada**: proxy serverless, OFF + USDA, alias multilingües, caché, indicadores de fuente.
4. **Países, precios y recetas**: datos de los 5 países, recetas, optimizador y pantalla de compra.
5. **Progreso y avisos**: peso semanal, reglas del coach, gráficas.
6. **Pulido**: PWA offline, accesibilidad, créditos/atribución, política de privacidad, README con cómo desplegar.

Entrega por fase: app funcionando (`npm run dev`), tests en verde (`npm test`), nota breve de qué falta y decisiones tomadas en `DECISIONS.md`.

## 13. Cómo empezar
Crea el repo, el `CLAUDE.md` con un resumen de este documento (stack, comandos, convenciones: lógica pura en `domain`, textos solo en `i18n`, sin claves en el repo), y arranca la fase 1. Pídeme las API keys que necesites (USDA) en el momento en que la fase 3 las requiera.
