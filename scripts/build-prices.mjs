// Genera src/data/prices/{ES,IT,DE,PL,TR}.json.
// pricePerKg = precio del producto TAL COMO SE COMPRA (crudo, escurrido en conservas, por litro en líquidos).
// yield = peso cocinado / peso comprado, para alimentos cuya semilla está en estado "cocinado"
//         (la pechuga se registra cocinada pero se compra cruda: 1 kg crudo → 0,75 kg cocinado).
// confidence: "verificado" solo si viene de una fuente fechada con precio por kg o de Open Prices (n ≥ 2);
//             el resto es "estimado" a partir de esas referencias y precios típicos de supermercado económico.
// Uso: node scripts/build-prices.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const DATE = '2026-11-18';

const YIELD = {
  chicken_breast: 0.75, chicken_thigh: 0.7, turkey_breast: 0.75, beef_lean: 0.7, pork_loin: 0.75,
  minced_beef: 0.75, minced_mixed: 0.75, minced_turkey: 0.75,
  hake: 0.8, cod: 0.8, pangasius: 0.8, salmon: 0.8, mackerel: 0.8,
  egg: 0.88, bratwurst: 0.9,
  // Cereales que se registran cocidos pero se compran secos (absorben agua).
  couscous_cooked: 2.5, quinoa_cooked: 2.7, millet_cooked: 2.8, barley_cooked: 2.8,
};

const COUNTRIES = {
  ES: {
    currency: 'EUR',
    store: 'Mercadona / Lidl',
    estimatedSource: 'Estimación a partir de precios de Mercadona y Lidl publicados en 2026',
    prices: `
chicken_breast 6.92 | verificado | Lidl, 1 kg de pechugas (El Confidencial, 2026-10-12) | 2026-10-12
chicken_thigh 4.5
turkey_breast 8
pork_loin 6.5
minced_mixed 7.58 | verificado | Lidl, carne picada 500 g a 3,79 € (El Confidencial, 2026-10-12) | 2026-10-12
minced_beef 10
egg 4.17 | verificado | Mercadona, docena a 3,00 € ≈ 720 g (El Confidencial, 2026-10-12) | 2026-10-12
tuna_canned 19
sardines_canned 13
hake 8
cod 10
salmon 14
mackerel 7
serrano_ham 15
ham_cooked 9
chorizo 9
rice_raw 1.09 | verificado | Lidl, arroz 1 kg (El Confidencial, 2026-10-12) | 2026-10-12
pasta_raw 1.6
couscous_cooked 2.5
quinoa_cooked 7
bulgur_raw 3.5
oats 1.8
bread_white 1.6
bread_whole 2.5
toast_bread 2.6
tortilla_wrap 2.8
potato_boiled 0.52 | verificado | Lidl, bolsa de 3 kg a 1,55 € (El Confidencial, 2026-10-12) | 2026-10-12
sweet_potato 2
lentils_raw 2.2
red_lentils_raw 3.5
chickpeas_raw 2.3
lentils_cooked 2.3
chickpeas_cooked 3
beans_canned 3
green_peas 2
yogurt_plain 1.6
greek_yogurt 2.5
fresh_cheese_0 3.2
cottage_cheese 6
skyr 6
milk_semi 0.84 | verificado | Lidl, pack de 6 L a 5,04 € (El Confidencial, 2026-10-12) | 2026-10-12
milk_whole 0.95
kefir 2.5
cheese_hard 10
white_cheese 9
mozzarella 6
banana 2.3
apple 2.3
orange 1.5
mandarin 2
pear 2.2
frozen_berries 6
tomato 1.29 | verificado | Lidl, tomates 1 kg (El Confidencial, 2026-10-12) | 2026-10-12
cucumber 1.5
bell_pepper 2.5
onion 3.01 | verificado | Open Prices, mediana de 2 precios en España (ODbL) | 2026-01-16
carrot 1.19 | verificado | Lidl, zanahorias 1 kg (El Confidencial, 2026-10-12) | 2026-10-12
zucchini 1.8
eggplant 2
spinach 2
lettuce 2.5
cabbage 1.2
mushrooms 3
frozen_veg_mix 2
broccoli_cooked 2.5
corn_canned 3
crushed_tomato 1.2
olive_oil 8
sunflower_oil 1.8
butter 9
olives 4
walnuts 9
almonds 10
peanuts 4
peanut_butter 6
tofu 7
`,
  },
  IT: {
    currency: 'EUR',
    store: 'Lidl / Eurospin',
    estimatedSource: 'Stima basata su prezzi Lidl Italia e volantini 2026',
    prices: `
chicken_breast 5.99 | verificado | Lidl Italia, petto di pollo intero al kg (lidl.it, 2026-11-17) | 2026-11-17
chicken_thigh 4.5
turkey_breast 9
pork_loin 7
minced_beef 9
minced_mixed 7
egg 4.2
tuna_canned 16
sardines_canned 12
cod 9
hake 9
salmon 18
mackerel 10
ham_cooked 12
serrano_ham 20
rice_raw 1.65 | verificado | Lidl Italia, riso parboiled 2 kg a 3,29 € (tabella premi Lidl, 2026-08) | 2026-08-31
pasta_raw 1.4
couscous_cooked 2.5
bulgur_raw 4
oats 2.4
bread_white 2.5
bread_whole 3.5
toast_bread 2.8
tortilla_wrap 4
potato_boiled 1.2
sweet_potato 2.5
lentils_raw 3.5
chickpeas_raw 3
lentils_cooked 3
chickpeas_cooked 3.7 | verificado | Lidl Italia, ceci 230 g a 0,85 € (tabella premi Lidl, 2026-09) | 2026-09-30
beans_canned 3
green_peas 2.5
yogurt_plain 2.5
greek_yogurt 4
cottage_cheese 6
milk_semi 1.2
cheese_hard 12
parmesan 18
mozzarella 7
white_cheese 10
banana 1.9
apple 2.2
pear 2.5
orange 1.8
mandarin 2.2
kiwi 3
frozen_berries 8
tomato 3.18 | verificado | Open Prices, mediana de 2 precios en Italia (ODbL) | 2026-09-05
cucumber 1.8
bell_pepper 3
onion 1.5
carrot 1.58 | verificado | Open Prices, mediana de 2 precios en Italia (ODbL) | 2026-09-05
zucchini 2.5
eggplant 2.5
spinach 2.5
lettuce 3
cabbage 1.5
mushrooms 4
frozen_veg_mix 2.5
broccoli_cooked 3
corn_canned 4
crushed_tomato 1.5
olive_oil 9
sunflower_oil 2
butter 10
olives 6
walnuts 12
almonds 14
peanuts 6
peanut_butter 8
`,
  },
  DE: {
    currency: 'EUR',
    store: 'Aldi / Lidl',
    estimatedSource: 'Schätzung auf Basis von Aldi- und Lidl-Preisen 2026',
    prices: `
chicken_breast 9
chicken_thigh 4.5
turkey_breast 11
pork_loin 9
minced_beef 10
minced_mixed 7.5
egg 3.7
tuna_canned 12.4
sardines_canned 10
cod 10
pangasius 8
salmon 18
mackerel 9
ham_cooked 10
bratwurst 7
rice_raw 1.8
pasta_raw 1.6
couscous_cooked 2.5
bulgur_raw 3
buckwheat_raw 4
millet_cooked 3.5
oats 1.2
bread_white 2.5
bread_whole 3.5
bread_rye 3
toast_bread 2
bread_roll 3.5
tortilla_wrap 4
potato_boiled 1.2
sweet_potato 3
lentils_raw 3.5
red_lentils_raw 4
chickpeas_raw 3.5
lentils_cooked 2.8
chickpeas_cooked 2.8
beans_canned 2.8
kidney_beans_canned 3
green_peas 2.2
tofu 6
quark 2.4
skyr 2.9
yogurt_plain 1.5
greek_yogurt 3.5
cottage_cheese 5
milk_semi 1
kefir 2
cheese_hard 9
white_cheese 9
mozzarella 6.3
banana 1.29 | verificado | Open Prices, mediana de 25 precios en Alemania (ODbL) | 2026-11-14
apple 1.99 | verificado | Open Prices, mediana de 8 precios en Alemania (ODbL) | 2026-08-25
pear 2.5
orange 2.5
mandarin 2.8
frozen_berries 6
tomato 2.29 | verificado | Open Prices, mediana de 5 precios en Alemania (ODbL) | 2026-10-24
cucumber 1.7
bell_pepper 4
onion 1.3
carrot 1.79 | verificado | Open Prices, mediana de 5 precios en Alemania (ODbL) | 2026-07-22
zucchini 2.5
spinach 2
lettuce 2.5
cabbage 1.2
sauerkraut 1.5
pickled_cucumber 3
mushrooms 4
beetroot_cooked 2.5
frozen_veg_mix 2
broccoli_cooked 2.5
corn_canned 3.5
crushed_tomato 1.3
olive_oil 9
sunflower_oil 2
butter 8
walnuts 12
almonds 11
peanuts 5
sunflower_seeds 5
peanut_butter 6
`,
  },
  PL: {
    currency: 'PLN',
    store: 'Biedronka / Lidl',
    estimatedSource: 'Szacunek na podstawie cen Biedronki i Lidla 2026',
    prices: `
chicken_breast 14.99 | verificado | Biedronka, filet z piersi kurczaka od 5.11.2026 (warszawawpigulce.pl) | 2026-11-05
chicken_thigh 12
turkey_breast 30
pork_loin 22
minced_beef 40
minced_mixed 25
egg 15
tuna_canned 50
sardines_canned 53
cod 45
salmon 80
mackerel 30
ham_cooked 35
kielbasa 30
frankfurter 25
rice_raw 6
pasta_raw 8
couscous_cooked 12
bulgur_raw 14
buckwheat_raw 9
millet_cooked 10
barley_cooked 6
oats 6
bread_white 7
bread_rye 10
bread_whole 12
toast_bread 10
bread_roll 12
tortilla_wrap 15
potato_boiled 3
sweet_potato 9
lentils_raw 14
red_lentils_raw 12
chickpeas_raw 12
chickpeas_cooked 17
beans_canned 17
green_peas 10
twarog 20
cottage_cheese 15
skyr 20
yogurt_plain 9
greek_yogurt 12.5
milk_semi 3.5
kefir 4
cheese_hard 35
white_cheese 35
mozzarella 24
butter 35
banana 6
apple 3
pear 6
orange 6
mandarin 7
frozen_berries 18
tomato 9
cucumber 8
bell_pepper 14
onion 4
carrot 3
zucchini 8
cabbage 3
sauerkraut 6
pickled_cucumber 12
mushrooms 12
beetroot_cooked 5
spinach 10
frozen_veg_mix 9
broccoli_cooked 12
corn_canned 15
crushed_tomato 7
sunflower_oil 9
olive_oil 45
walnuts 45
almonds 50
peanuts 20
sunflower_seeds 18
peanut_butter 25
tofu 30
`,
  },
  TR: {
    currency: 'TRY',
    store: 'BİM / A101 / Şok',
    estimatedSource: 'BİM/A101 2026 fiyatlarına dayalı tahmin',
    prices: `
chicken_breast 190
chicken_thigh 110
turkey_breast 260
minced_beef 650
beef_lean 750
egg 94
tuna_canned 800
sucuk 700
rice_raw 63 | verificado | Efsane Yasemin pirinç 1 kg, 7-13 Kasım 2026 aktüel (onedio.com) | 2026-11-07
pasta_raw 40
couscous_cooked 60
bulgur_raw 32 | verificado | Saban pilavlık bulgur 1 kg, 7-13 Kasım 2026 aktüel (onedio.com) | 2026-11-07
oats 110
bread_white 75
bread_whole 110
simit 136
tortilla_wrap 165
potato_boiled 25
lentils_raw 70
red_lentils_raw 65
chickpeas_raw 75
beans_white_raw 90
chickpeas_cooked 80
beans_canned 80
yogurt_plain 50
greek_yogurt 120
ayran 40
kefir 70
milk_semi 44.5
cottage_cheese 100
white_cheese 300
cheese_hard 450
butter 500
banana 90
apple 40
orange 35
mandarin 35
tomato 35
cucumber 35
bell_pepper 50
onion 20
carrot 20
zucchini 30
eggplant 40
spinach 40
frozen_veg_mix 120
crushed_tomato 60
olive_oil 450
sunflower_oil 90
olives 250
walnuts 500
hazelnuts 600
peanut_butter 300
`,
  },
};

mkdirSync(new URL('../src/data/prices/', import.meta.url), { recursive: true });
for (const [code, c] of Object.entries(COUNTRIES)) {
  const items = {};
  for (const raw of c.prices.trim().split('\n')) {
    const [head, confidence, source, date] = raw.split('|').map((s) => s?.trim());
    const [id, price] = head.split(/\s+/);
    const item = {
      pricePerKg: Number(price),
      store: c.store,
      date: date ?? DATE,
      confidence: confidence ?? 'estimado',
      source: source ?? c.estimatedSource,
    };
    if (YIELD[id]) item.yield = YIELD[id];
    if (items[id]) throw new Error(`${code}: precio duplicado para ${id}`);
    items[id] = item;
  }
  const out = { country: code, currency: c.currency, updated: DATE, items };
  writeFileSync(new URL(`../src/data/prices/${code}.json`, import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log(code, Object.keys(items).length, 'precios');
}
