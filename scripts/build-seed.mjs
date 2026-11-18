// Genera src/data/foods.seed.json a partir de una tabla compacta.
// Valores por 100 g (EU: carbohidratos disponibles, sin fibra). kcal = 4P + 4C + 9G + 2·fibra.
// sugar = azúcares LIBRES (0 en fruta entera y lácteos naturales). Fuentes: tablas BEDCA/USDA, redondeadas.
import { writeFileSync } from 'node:fs';

// id | es | en | categoría | estado | P C G fibra azúcarLibre sal | unidad es | unidad en | g/unidad | +grasa cantina (opcional)
const T = `
chicken_breast|Pechuga de pollo|Chicken breast|meat|cooked|31 0 3.6 0 0 0.2|filete|fillet|130
beef_lean|Ternera magra|Lean beef|meat|cooked|27 0 10 0 0 0.15|filete|steak|150
pork_loin|Lomo de cerdo|Pork loin|meat|cooked|27 0 8 0 0 0.15|filete|fillet|120
minced_beef|Carne picada de ternera|Minced beef|meat|cooked|26 0 15 0 0 0.2|ración|portion|125
turkey_slices|Pechuga de pavo en lonchas|Sliced turkey breast|meat|cooked|20 1.5 1.5 0 1 2.0|loncha|slice|15
egg|Huevo|Egg|egg|cooked|13 1 10 0 0 0.35|huevo|egg|60
tuna_canned|Atún al natural|Canned tuna in water|fish|cooked|26 0 1 0 0 0.9|lata|can|80
salmon|Salmón|Salmon|fish|cooked|22 0 13 0 0 0.15|filete|fillet|150
hake|Merluza|Hake|fish|cooked|18 0 1.5 0 0 0.3|filete|fillet|150
sardines_canned|Sardinas en aceite (escurridas)|Sardines in oil (drained)|fish|cooked|24 0 11 0 0 0.9|lata|can|85
rice_cooked|Arroz cocido|Cooked rice|grain|cooked|2.7 28 0.3 0.4 0 0|taza|cup|150
rice_raw|Arroz (crudo)|Rice (raw)|grain|raw|7 78 0.7 1.3 0 0|ración|portion|80
pasta_cooked|Pasta cocida|Cooked pasta|pasta|cooked|5 31 1 1.8 0 0|plato|plate|250
pasta_raw|Pasta (seca)|Pasta (dry)|pasta|raw|12.5 70 1.5 3 0 0|ración|portion|80
bulgur_cooked|Bulgur cocido|Cooked bulgur|grain|cooked|3.1 14 0.2 4.5 0 0|taza|cup|180
buckwheat_cooked|Trigo sarraceno cocido (kasza)|Cooked buckwheat (kasza)|grain|cooked|3.4 18 0.6 2.7 0 0|taza|cup|170
oats|Copos de avena|Rolled oats|grain|raw|13 58 7 10 0 0|tazón|bowl|50
bread_white|Pan blanco|White bread|bread|cooked|9 49 3 2.7 3 1.2|rebanada|slice|30
bread_whole|Pan integral|Wholemeal bread|bread|cooked|10 41 3.5 7 3 1.1|rebanada|slice|30
simit|Simit|Simit|bread|cooked|10 50 4 3 4 1.2|unidad|piece|110
potato_boiled|Patata cocida|Boiled potato|potato|cooked|2 17 0.1 1.8 0 0|unidad|piece|150
sweet_potato|Boniato asado|Baked sweet potato|potato|cooked|2 18 0.2 3.3 0 0.1|unidad|piece|150
lentils_cooked|Lentejas cocidas|Cooked lentils|legume|cooked|9 12 0.4 8 0 0|plato|plate|250
chickpeas_cooked|Garbanzos cocidos|Cooked chickpeas|legume|cooked|8.9 19 2.6 7.6 0 0|plato|plate|250
beans_canned|Alubias cocidas (bote)|Canned beans (drained)|legume|cooked|7 13 0.5 6 0 0.5|bote|jar|250
greek_yogurt|Yogur griego natural|Plain Greek yogurt|dairy|cooked|9 4 5 0 0 0.1|unidad|pot|125
yogurt_plain|Yogur natural|Plain yogurt|dairy|cooked|3.5 4.7 3.3 0 0 0.1|unidad|pot|125
quark|Quark desnatado|Low-fat quark|dairy|cooked|12 4 0.2 0 0 0.1|tarrina|tub|250
milk_semi|Leche semidesnatada|Semi-skimmed milk|dairy|cooked|3.4 4.8 1.6 0 0 0.1|vaso|glass|250
fresh_cheese_0|Queso fresco batido 0%|Fat-free fresh cheese|dairy|cooked|8 4 0.2 0 0 0.1|tarrina|tub|125
cheese_hard|Queso curado|Hard cheese|dairy|cooked|25 0.5 30 0 0 1.6|loncha|slice|20
white_cheese|Queso blanco (feta, beyaz peynir)|White cheese (feta)|dairy|cooked|14 1.5 20 0 0 2.5|porción|portion|40
banana|Plátano|Banana|fruit|raw|1.1 20 0.3 2.6 0 0|unidad|piece|120
apple|Manzana|Apple|fruit|raw|0.3 12 0.2 2.4 0 0|unidad|piece|180
orange|Naranja|Orange|fruit|raw|0.9 9 0.1 2.2 0 0|unidad|piece|150
tomato|Tomate|Tomato|vegetable|raw|0.9 2.7 0.2 1.2 0 0|unidad|piece|120
salad|Ensalada mixta|Mixed salad|salad|raw|1 3 0.2 1.8 0 0|plato|plate|150
veg_cooked|Verdura cocinada|Cooked vegetables|vegetable|cooked|2 4 0.3 3 0 0.1|ración|portion|200
broccoli_cooked|Brócoli cocido|Cooked broccoli|vegetable|cooked|2.4 4 0.4 3.3 0 0|ración|portion|150
crushed_tomato|Tomate triturado|Crushed tomatoes|vegetable|cooked|1.3 4 0.2 1.5 0 0.3|ración|portion|100
olive_oil|Aceite de oliva|Olive oil|fat|raw|0 0 100 0 0 0|cucharada|tbsp|10
butter|Mantequilla|Butter|fat|raw|0.7 0.6 81 0 0 0.05|porción|pat|10
nuts|Frutos secos (almendras, nueces)|Nuts (almonds, walnuts)|nuts|raw|20 8 52 9 0 0|puñado|handful|30
peanut_butter|Crema de cacahuete|Peanut butter|nuts|raw|25 14 50 7 3 0.5|cucharada|tbsp|16
doner_wrap|Döner de pollo (dürüm)|Chicken döner wrap|prepared|cooked|12 17 9 1.5 1 1.4|dürüm|wrap|230
kofte|Köfte|Köfte (meatballs)|prepared|cooked|17 4 18 0.5 0 1.3|ración|portion|150
pizza_margherita|Pizza margarita|Margherita pizza|prepared|cooked|11 30 10 2 2 1.3|porción|slice|110
whey|Proteína whey|Whey protein|supplement|raw|78 6 6 0 4 0.5|scoop|scoop|30
honey|Miel|Honey|sweet|raw|0.3 82 0 0 82 0|cucharadita|tsp|7
milk_chocolate|Chocolate con leche|Milk chocolate|sweet|raw|7 56 30 2 52 0.2|onza|square|10
soft_drink|Refresco azucarado|Sugary soft drink|sweet|raw|0 10.6 0 0 10.6 0|lata|can|330
`;

const r1 = (n) => Math.round(n * 10) / 10;
const foods = T.trim().split('\n').map((line) => {
  const [id, es, en, category, state, nums, ues, uen, ug, extra] = line.split('|');
  const [p, c, f, fiber, sugar, salt] = nums.split(' ').map(Number);
  const food = {
    id,
    names: { es, en },
    category,
    state,
    per100g: { kcal: Math.round(4 * p + 4 * c + 9 * f + 2 * fiber), p, c, f, fiber, sugar, salt },
    unit: { name: { es: ues, en: uen }, grams: Number(ug) },
    source: 'seed',
  };
  if (extra) food.canteenExtraFatPer100g = r1(Number(extra));
  return food;
});
writeFileSync(new URL('../src/data/foods.seed.json', import.meta.url), JSON.stringify(foods, null, 2) + '\n');
console.log(`${foods.length} foods`);
