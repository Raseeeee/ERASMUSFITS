// Genera src/data/foods.seed.json a partir de una tabla compacta.
// Valores por 100 g (UE: carbohidratos disponibles, sin fibra). kcal = 4P + 4C + 9G + 2·fibra.
// sugar = azúcares LIBRES (0 en fruta entera y lácteos naturales; sí en zumos, miel, dulces).
// Fuentes: tablas BEDCA/USDA/etiquetas típicas, redondeadas. Valores orientativos.
// Uso: node scripts/build-seed.mjs
import { writeFileSync } from 'node:fs';

// id | es | en | it | de | pl | tr | categoría | estado | P C G fibra azúcarLibre sal | unidad es | unidad en | g/unidad | +grasa cantina (opcional)
const T = `
chicken_breast|Pechuga de pollo|Chicken breast|Petto di pollo|Hähnchenbrust|Pierś z kurczaka|Tavuk göğsü|meat|cooked|31 0 3.6 0 0 0.2|filete|fillet|130
chicken_thigh|Muslo de pollo (sin piel)|Chicken thigh (skinless)|Coscia di pollo|Hähnchenschenkel|Udko z kurczaka|Tavuk but|meat|cooked|26 0 9 0 0 0.25|muslo|thigh|120
turkey_breast|Pechuga de pavo|Turkey breast|Petto di tacchino|Putenbrust|Pierś z indyka|Hindi göğsü|meat|cooked|30 0 2 0 0 0.15|filete|fillet|130
beef_lean|Ternera magra|Lean beef|Manzo magro|Mageres Rindfleisch|Chuda wołowina|Yağsız dana eti|meat|cooked|27 0 10 0 0 0.15|filete|steak|150
pork_loin|Lomo de cerdo|Pork loin|Lonza di maiale|Schweinelende|Schab wieprzowy|Domuz fileto|meat|cooked|27 0 8 0 0 0.15|filete|fillet|120
minced_beef|Carne picada de ternera|Minced beef|Macinato di manzo|Rinderhackfleisch|Mielona wołowina|Dana kıyma|meat|cooked|26 0 15 0 0 0.2|ración|portion|125
minced_turkey|Carne picada de pavo|Minced turkey|Macinato di tacchino|Putenhackfleisch|Mielony indyk|Hindi kıyma|meat|cooked|27 0 8 0 0 0.2|ración|portion|125
minced_mixed|Carne picada mixta|Mixed minced meat|Macinato misto|Gemischtes Hackfleisch|Mięso mielone mieszane|Karışık kıyma|meat|cooked|24 0 18 0 0 0.2|ración|portion|125
turkey_slices|Pechuga de pavo en lonchas|Sliced turkey breast|Fesa di tacchino a fette|Putenbrust Aufschnitt|Polędwica z indyka|Hindi füme|meat|cooked|20 1.5 1.5 0 1 2.0|loncha|slice|15
ham_cooked|Jamón cocido|Cooked ham|Prosciutto cotto|Kochschinken|Szynka gotowana|Jambon|meat|cooked|19 1 3 0 1 2.0|loncha|slice|15
serrano_ham|Jamón serrano|Cured ham|Prosciutto crudo|Rohschinken|Szynka dojrzewająca|Kurutulmuş jambon|meat|cooked|30 0 12 0 0 4.5|loncha|slice|15
chorizo|Chorizo|Chorizo|Chorizo|Chorizo|Chorizo|Chorizo sosis|meat|cooked|24 2 32 0 0 3.5|loncha|slice|10
sucuk|Sucuk|Sucuk (spiced sausage)|Salsiccia sucuk|Sucuk (Knoblauchwurst)|Kiełbasa sucuk|Sucuk|meat|cooked|22 1 32 0 0 3.2|loncha|slice|10
kielbasa|Salchicha polaca (kiełbasa)|Polish sausage (kiełbasa)|Salsiccia polacca|Polnische Wurst|Kiełbasa|Polonya sosisi|meat|cooked|14 2 26 0 1 2.2|ración|portion|100
frankfurter|Salchicha tipo Frankfurt|Frankfurter sausage|Würstel|Wiener Würstchen|Parówka|Sosis|meat|cooked|12 2 24 0 1 2.0|unidad|piece|50
bratwurst|Bratwurst|Bratwurst|Bratwurst|Bratwurst|Biała kiełbasa (bratwurst)|Bratwurst sosis|meat|cooked|14 1 25 0 0 1.8|unidad|piece|100
egg|Huevo|Egg|Uovo|Ei|Jajko|Yumurta|egg|cooked|13 1 10 0 0 0.35|huevo|egg|60
egg_whites|Claras de huevo|Egg whites|Albumi|Eiklar|Białka jaj|Yumurta akı|egg|cooked|11 0.7 0.2 0 0 0.4|clara|white|33
tuna_canned|Atún al natural|Canned tuna in water|Tonno al naturale|Thunfisch im eigenen Saft|Tuńczyk w sosie własnym|Ton balığı (konserve)|fish|cooked|26 0 1 0 0 0.9|lata|can|80
tuna_oil|Atún en aceite (escurrido)|Canned tuna in oil (drained)|Tonno sott'olio|Thunfisch in Öl|Tuńczyk w oleju|Yağlı ton balığı|fish|cooked|26 0 8 0 0 0.9|lata|can|56
salmon|Salmón|Salmon|Salmone|Lachs|Łosoś|Somon|fish|cooked|22 0 13 0 0 0.15|filete|fillet|150
hake|Merluza|Hake|Nasello|Seehecht|Morszczuk|Berlam|fish|cooked|18 0 1.5 0 0 0.3|filete|fillet|150
cod|Bacalao fresco|Cod|Merluzzo|Kabeljau|Dorsz|Morina|fish|cooked|23 0 1 0 0 0.2|filete|fillet|150
pangasius|Panga|Pangasius|Pangasio|Pangasius|Panga|Panga|fish|cooked|17 0 3 0 0 0.2|filete|fillet|150
mackerel|Caballa|Mackerel|Sgombro|Makrele|Makrela|Uskumru|fish|cooked|24 0 18 0 0 0.25|filete|fillet|120
herring_pickled|Arenque en vinagre|Pickled herring|Aringa marinata|Bismarckhering|Śledź marynowany|Ringa turşusu|fish|cooked|14 8 15 0 6 2.5|ración|portion|80
shrimp|Gambas cocidas|Cooked prawns|Gamberi cotti|Garnelen gekocht|Krewetki gotowane|Haşlanmış karides|fish|cooked|24 0 1 0 0 0.6|ración|portion|100
sardines_canned|Sardinas en aceite (escurridas)|Sardines in oil (drained)|Sardine sott'olio|Sardinen in Öl|Sardynki w oleju|Sardalya konservesi|fish|cooked|24 0 11 0 0 0.9|lata|can|85
surimi|Surimi (palitos de cangrejo)|Surimi crab sticks|Bastoncini di surimi|Surimi-Sticks|Paluszki surimi|Yengeç çubuğu|fish|cooked|8 14 1 0 5 1.6|unidad|stick|15
rice_cooked|Arroz cocido|Cooked rice|Riso cotto|Gekochter Reis|Ryż gotowany|Haşlanmış pirinç|grain|cooked|2.7 28 0.3 0.4 0 0|taza|cup|150
rice_raw|Arroz (crudo)|Rice (raw)|Riso crudo|Reis (roh)|Ryż (suchy)|Pirinç (çiğ)|grain|raw|7 78 0.7 1.3 0 0|ración|portion|80
pasta_cooked|Pasta cocida|Cooked pasta|Pasta cotta|Gekochte Nudeln|Makaron gotowany|Haşlanmış makarna|pasta|cooked|5 31 1 1.8 0 0|plato|plate|250
pasta_raw|Pasta (seca)|Pasta (dry)|Pasta secca|Nudeln (trocken)|Makaron (suchy)|Makarna (çiğ)|pasta|raw|12.5 70 1.5 3 0 0|ración|portion|80
couscous_cooked|Cuscús cocido|Cooked couscous|Cuscus cotto|Couscous gekocht|Kuskus gotowany|Haşlanmış kuskus|grain|cooked|3.8 22 0.2 1.4 0 0|taza|cup|160
quinoa_cooked|Quinoa cocida|Cooked quinoa|Quinoa cotta|Quinoa gekocht|Komosa ryżowa gotowana|Haşlanmış kinoa|grain|cooked|4.4 18 1.9 2.8 0 0|taza|cup|185
bulgur_cooked|Bulgur cocido|Cooked bulgur|Bulgur cotto|Gekochter Bulgur|Bulgur gotowany|Haşlanmış bulgur|grain|cooked|3.1 14 0.2 4.5 0 0|taza|cup|180
bulgur_raw|Bulgur (crudo)|Bulgur (dry)|Bulgur crudo|Bulgur (trocken)|Bulgur (suchy)|Bulgur (çiğ)|grain|raw|12 64 1.3 12 0 0|ración|portion|70
buckwheat_cooked|Trigo sarraceno cocido (kasza)|Cooked buckwheat (kasza)|Grano saraceno cotto|Gekochter Buchweizen|Kasza gryczana gotowana|Haşlanmış karabuğday|grain|cooked|3.4 18 0.6 2.7 0 0|taza|cup|170
buckwheat_raw|Trigo sarraceno (crudo)|Buckwheat groats (dry)|Grano saraceno crudo|Buchweizen (roh)|Kasza gryczana (sucha)|Karabuğday (çiğ)|grain|raw|13 62 3.4 10 0 0|ración|portion|70
millet_cooked|Mijo cocido|Cooked millet|Miglio cotto|Hirse gekocht|Kasza jaglana gotowana|Haşlanmış darı|grain|cooked|3.5 22 1 1.3 0 0|taza|cup|175
barley_cooked|Cebada perlada cocida|Cooked pearl barley|Orzo perlato cotto|Perlgraupen gekocht|Kasza jęczmienna gotowana|Haşlanmış arpa|grain|cooked|2.3 25 0.4 3.8 0 0|taza|cup|157
oats|Copos de avena|Rolled oats|Fiocchi d'avena|Haferflocken|Płatki owsiane|Yulaf ezmesi|grain|raw|13 58 7 10 0 0|tazón|bowl|50
cornflakes|Copos de maíz|Cornflakes|Fiocchi di mais|Cornflakes|Płatki kukurydziane|Mısır gevreği|grain|raw|7 81 0.9 3 8 1.1|tazón|bowl|30
muesli|Muesli sin azúcar|Muesli (no added sugar)|Muesli senza zucchero|Müsli ohne Zucker|Musli bez cukru|Şekersiz müsli|grain|raw|10 58 7 9 0 0.1|tazón|bowl|50
granola|Granola|Granola|Granola|Knuspermüsli|Granola|Granola|grain|raw|9 60 17 7 20 0.3|tazón|bowl|45
rice_cakes|Tortitas de arroz|Rice cakes|Gallette di riso|Reiswaffeln|Wafle ryżowe|Pirinç patlağı|grain|raw|8 78 3 4 0 0.5|unidad|piece|8
bread_white|Pan blanco|White bread|Pane bianco|Weißbrot|Chleb pszenny|Beyaz ekmek|bread|cooked|9 49 3 2.7 3 1.2|rebanada|slice|30
bread_whole|Pan integral|Wholemeal bread|Pane integrale|Vollkornbrot|Chleb razowy|Tam buğday ekmeği|bread|cooked|10 41 3.5 7 3 1.1|rebanada|slice|30
bread_rye|Pan de centeno|Rye bread|Pane di segale|Roggenbrot|Chleb żytni|Çavdar ekmeği|bread|cooked|8.5 44 1.7 6 2 1.3|rebanada|slice|40
toast_bread|Pan de molde|Sliced sandwich bread|Pancarrè|Toastbrot|Chleb tostowy|Tost ekmeği|bread|cooked|8 47 4 3 5 1.1|rebanada|slice|25
bread_roll|Panecillo|Bread roll|Panino|Brötchen|Bułka|Sandviç ekmeği|bread|cooked|9 52 2 3 2 1.2|unidad|piece|50
pita|Pan de pita|Pita bread|Pane pita|Pitabrot|Chlebek pita|Pide ekmeği|bread|cooked|9 53 1.2 2.2 1 1.0|unidad|piece|60
tortilla_wrap|Tortilla de trigo|Wheat tortilla wrap|Piadina|Weizentortilla|Tortilla pszenna|Lavaş|bread|cooked|8.5 48 7 3 2 1.3|unidad|piece|60
pretzel|Pretzel (Brezel)|Pretzel|Brezel|Brezel|Precel|Pretzel|bread|cooked|9 55 2.5 2.5 1 2.0|unidad|piece|90
simit|Simit|Simit|Simit|Simit|Simit|Simit|bread|cooked|10 50 4 3 4 1.2|unidad|piece|110
potato_boiled|Patata cocida|Boiled potato|Patata lessa|Salzkartoffeln|Ziemniaki gotowane|Haşlanmış patates|potato|cooked|2 17 0.1 1.8 0 0|unidad|piece|150
sweet_potato|Boniato asado|Baked sweet potato|Patata dolce al forno|Gebackene Süßkartoffel|Pieczony batat|Fırında tatlı patates|potato|cooked|2 18 0.2 3.3 0 0.1|unidad|piece|150
fries|Patatas fritas|French fries|Patatine fritte|Pommes frites|Frytki|Patates kızartması|potato|cooked|3.4 38 15 3.8 0 0.8|ración|portion|150|0
gnocchi|Ñoquis|Gnocchi|Gnocchi|Gnocchi|Kopytka|Patates mantısı (gnocchi)|potato|cooked|3.5 32 0.6 1.6 0 1.1|ración|portion|200
lentils_cooked|Lentejas cocidas|Cooked lentils|Lenticchie cotte|Gekochte Linsen|Soczewica gotowana|Haşlanmış mercimek|legume|cooked|9 12 0.4 8 0 0|plato|plate|250
lentils_raw|Lentejas (crudas)|Lentils (dry)|Lenticchie secche|Linsen (trocken)|Soczewica (sucha)|Mercimek (çiğ)|legume|raw|24 48 1 11 0 0|ración|portion|70
red_lentils_raw|Lentejas rojas (crudas)|Red lentils (dry)|Lenticchie rosse secche|Rote Linsen (trocken)|Soczewica czerwona (sucha)|Kırmızı mercimek (çiğ)|legume|raw|25 50 1.5 10 0 0|ración|portion|70
chickpeas_cooked|Garbanzos cocidos|Cooked chickpeas|Ceci cotti|Gekochte Kichererbsen|Ciecierzyca gotowana|Haşlanmış nohut|legume|cooked|8.9 19 2.6 7.6 0 0|plato|plate|250
chickpeas_raw|Garbanzos (crudos)|Chickpeas (dry)|Ceci secchi|Kichererbsen (trocken)|Ciecierzyca (sucha)|Nohut (çiğ)|legume|raw|20 47 6 15 0 0|ración|portion|70
beans_canned|Alubias cocidas (bote)|Canned beans (drained)|Fagioli in scatola|Bohnen aus der Dose|Fasola z puszki|Konserve fasulye|legume|cooked|7 13 0.5 6 0 0.5|bote|jar|250
beans_white_raw|Alubias blancas (crudas)|White beans (dry)|Fagioli cannellini secchi|Weiße Bohnen (trocken)|Fasola biała (sucha)|Kuru fasulye (çiğ)|legume|raw|22 40 1.5 18 0 0|ración|portion|70
kidney_beans_canned|Alubias rojas (bote)|Canned kidney beans|Fagioli rossi in scatola|Kidneybohnen (Dose)|Czerwona fasola z puszki|Barbunya konservesi|legume|cooked|7 14 0.5 6 0 0.6|bote|jar|250
green_peas|Guisantes|Green peas|Piselli|Erbsen|Groszek zielony|Bezelye|legume|cooked|5 10 0.4 5 0 0|ración|portion|150
tofu|Tofu|Tofu|Tofu|Tofu|Tofu|Tofu|legume|raw|12 1.5 7 1 0 0.02|ración|portion|100
hummus|Hummus|Hummus|Hummus|Hummus|Hummus|Humus|prepared|cooked|8 12 10 6 0 0.9|cucharada|tbsp|30
greek_yogurt|Yogur griego natural|Plain Greek yogurt|Yogurt greco bianco|Griechischer Joghurt natur|Jogurt grecki naturalny|Süzme yoğurt|dairy|cooked|9 4 5 0 0 0.1|unidad|pot|125
yogurt_plain|Yogur natural|Plain yogurt|Yogurt bianco|Naturjoghurt|Jogurt naturalny|Yoğurt|dairy|cooked|3.5 4.7 3.3 0 0 0.1|unidad|pot|125
skyr|Skyr natural|Plain skyr|Skyr bianco|Skyr natur|Skyr naturalny|Sade skyr|dairy|cooked|11 4 0.2 0 0 0.1|unidad|pot|150
quark|Quark desnatado|Low-fat quark|Quark magro|Magerquark|Twarożek chudy (quark)|Az yağlı kuark|dairy|cooked|12 4 0.2 0 0 0.1|tarrina|tub|250
twarog|Queso fresco tipo twaróg|Farmer's cheese (twaróg)|Formaggio fresco tipo twaróg|Speisequark (Twaróg)|Twaróg półtłusty|Taze peynir (twaróg)|dairy|cooked|18 3.5 4 0 0 0.1|porción|portion|100
cottage_cheese|Queso cottage|Cottage cheese|Fiocchi di latte|Hüttenkäse|Serek wiejski|Lor peyniri|dairy|cooked|12 3 4 0 0 0.8|tarrina|tub|200
fresh_cheese_0|Queso fresco batido 0%|Fat-free fresh cheese|Formaggio fresco magro|Frischkäse 0 %|Serek homogenizowany 0%|Yağsız taze peynir|dairy|cooked|8 4 0.2 0 0 0.1|tarrina|tub|125
milk_semi|Leche semidesnatada|Semi-skimmed milk|Latte parzialmente scremato|Fettarme Milch|Mleko 2%|Yarım yağlı süt|dairy|cooked|3.4 4.8 1.6 0 0 0.1|vaso|glass|250
milk_whole|Leche entera|Whole milk|Latte intero|Vollmilch|Mleko 3,2%|Tam yağlı süt|dairy|cooked|3.3 4.7 3.6 0 0 0.1|vaso|glass|250
milk_skim|Leche desnatada|Skimmed milk|Latte scremato|Magermilch|Mleko 0,5%|Yağsız süt|dairy|cooked|3.4 4.9 0.2 0 0 0.1|vaso|glass|250
kefir|Kéfir|Kefir|Kefir|Kefir|Kefir|Kefir|dairy|cooked|3.4 4 1.5 0 0 0.1|vaso|glass|250
ayran|Ayran|Ayran|Ayran|Ayran|Ayran|Ayran|dairy|cooked|1.7 2 1.5 0 0 0.6|vaso|glass|250
soy_drink|Bebida de soja sin azúcar|Unsweetened soy drink|Bevanda di soia senza zucchero|Sojadrink ungesüßt|Napój sojowy niesłodzony|Şekersiz soya sütü|dairy|raw|3.3 0.5 1.8 0.6 0 0.1|vaso|glass|250
coffee_milk|Café con leche|Coffee with milk|Caffellatte|Milchkaffee|Kawa z mlekiem|Sütlü kahve|dairy|cooked|1.7 2.4 0.8 0 0 0.05|taza|cup|200
coffee_black|Café solo|Black coffee|Caffè espresso|Schwarzer Kaffee|Kawa czarna|Sade kahve (Türk kahvesi)|other|cooked|0.1 0.3 0 0 0 0|taza pequeña|small cup|60
tea_black|Té negro (sin azúcar)|Black tea (unsweetened)|Tè nero|Schwarzer Tee|Herbata czarna|Çay (siyah çay)|other|cooked|0 0.3 0 0 0 0|vaso de té|tea glass|100
tea_green|Té verde (sin azúcar)|Green tea (unsweetened)|Tè verde|Grüner Tee|Herbata zielona|Yeşil çay|other|cooked|0 0.2 0 0 0 0|taza|cup|200
chamomile_tea|Manzanilla (infusión)|Chamomile tea|Camomilla|Kamillentee|Rumianek (napar)|Papatya çayı|other|cooked|0 0.2 0 0 0 0|taza|cup|200
mint_tea|Poleo menta (infusión)|Mint tea|Tisana alla menta|Pfefferminztee|Herbata miętowa|Nane çayı|other|cooked|0 0.2 0 0 0 0|taza|cup|200
herbal_tea|Infusión de hierbas|Herbal tea|Tisana|Kräutertee|Herbata ziołowa|Bitki çayı|other|cooked|0 0.2 0 0 0 0|taza|cup|200
cheese_hard|Queso curado|Hard cheese|Formaggio stagionato|Hartkäse|Ser żółty|Kaşar peyniri|dairy|cooked|25 0.5 30 0 0 1.6|loncha|slice|20
white_cheese|Queso blanco (feta, beyaz peynir)|White cheese (feta)|Formaggio feta|Feta|Ser feta|Beyaz peynir|dairy|cooked|14 1.5 20 0 0 2.5|porción|portion|40
mozzarella|Mozzarella|Mozzarella|Mozzarella|Mozzarella|Mozzarella|Mozzarella|dairy|cooked|18 1 17 0 0 0.5|bola|ball|125
parmesan|Parmesano|Parmesan|Parmigiano|Parmesan|Parmezan|Parmesan peyniri|dairy|cooked|33 0 28 0 0 1.6|cucharada|tbsp|10
banana|Plátano|Banana|Banana|Banane|Banan|Muz|fruit|raw|1.1 20 0.3 2.6 0 0|unidad|piece|120
apple|Manzana|Apple|Mela|Apfel|Jabłko|Elma|fruit|raw|0.3 12 0.2 2.4 0 0|unidad|piece|180
pear|Pera|Pear|Pera|Birne|Gruszka|Armut|fruit|raw|0.4 12 0.1 3.1 0 0|unidad|piece|170
orange|Naranja|Orange|Arancia|Orange|Pomarańcza|Portakal|fruit|raw|0.9 9 0.1 2.2 0 0|unidad|piece|150
mandarin|Mandarina|Mandarin|Mandarino|Mandarine|Mandarynka|Mandalina|fruit|raw|0.8 10 0.3 1.8 0 0|unidad|piece|80
kiwi|Kiwi|Kiwi|Kiwi|Kiwi|Kiwi|Kivi|fruit|raw|1.1 10 0.5 3 0 0|unidad|piece|75
grapes|Uvas|Grapes|Uva|Weintrauben|Winogrona|Üzüm|fruit|raw|0.7 16 0.2 0.9 0 0|racimo|bunch|150
strawberries|Fresas|Strawberries|Fragole|Erdbeeren|Truskawki|Çilek|fruit|raw|0.7 6 0.3 2 0 0|ración|portion|150
blueberries|Arándanos|Blueberries|Mirtilli|Heidelbeeren|Borówki|Yaban mersini|fruit|raw|0.7 12 0.3 2.4 0 0|ración|portion|125
frozen_berries|Frutos rojos congelados|Frozen mixed berries|Frutti di bosco surgelati|TK-Beerenmischung|Mrożone owoce leśne|Dondurulmuş orman meyvesi|fruit|raw|1 7 0.4 4 0 0|ración|portion|100
peach|Melocotón|Peach|Pesca|Pfirsich|Brzoskwinia|Şeftali|fruit|raw|0.9 9 0.3 1.5 0 0|unidad|piece|150
plum|Ciruela|Plum|Prugna|Pflaume|Śliwka|Erik|fruit|raw|0.7 10 0.3 1.4 0 0|unidad|piece|60
watermelon|Sandía|Watermelon|Anguria|Wassermelone|Arbuz|Karpuz|fruit|raw|0.6 7.5 0.2 0.4 0 0|tajada|slice|300
melon|Melón|Melon|Melone|Honigmelone|Melon|Kavun|fruit|raw|0.8 7 0.2 0.9 0 0|tajada|slice|200
dates|Dátiles|Dates|Datteri|Datteln|Daktyle|Hurma|fruit|raw|2.5 66 0.4 8 0 0|unidad|piece|8
raisins|Pasas|Raisins|Uvetta|Rosinen|Rodzynki|Kuru üzüm|fruit|raw|3 76 0.5 4 0 0.03|puñado|handful|30
avocado|Aguacate|Avocado|Avocado|Avocado|Awokado|Avokado|fruit|raw|2 2 15 7 0 0|unidad|piece|150
orange_juice|Zumo de naranja|Orange juice|Succo d'arancia|Orangensaft|Sok pomarańczowy|Portakal suyu|other|raw|0.7 9 0.2 0.2 8.5 0|vaso|glass|200
tomato|Tomate|Tomato|Pomodoro|Tomate|Pomidor|Domates|vegetable|raw|0.9 2.7 0.2 1.2 0 0|unidad|piece|120
cucumber|Pepino|Cucumber|Cetriolo|Gurke|Ogórek|Salatalık|vegetable|raw|0.7 2.5 0.1 0.5 0 0|unidad|piece|200
bell_pepper|Pimiento|Bell pepper|Peperone|Paprika|Papryka|Biber|vegetable|raw|1 4.5 0.3 1.8 0 0|unidad|piece|150
onion|Cebolla|Onion|Cipolla|Zwiebel|Cebula|Soğan|vegetable|raw|1.1 7.5 0.1 1.7 0 0|unidad|piece|110
carrot|Zanahoria|Carrot|Carota|Karotte|Marchew|Havuç|vegetable|raw|0.9 7 0.2 2.8 0 0.1|unidad|piece|80
zucchini|Calabacín|Courgette|Zucchina|Zucchini|Cukinia|Kabak|vegetable|raw|1.2 2.2 0.3 1 0 0|unidad|piece|200
eggplant|Berenjena|Aubergine|Melanzana|Aubergine|Bakłażan|Patlıcan|vegetable|raw|1 3 0.2 3 0 0|unidad|piece|250
spinach|Espinacas|Spinach|Spinaci|Spinat|Szpinak|Ispanak|vegetable|raw|2.9 1.4 0.4 2.2 0 0.2|ración|portion|100
mushrooms|Champiñones|Mushrooms|Funghi champignon|Champignons|Pieczarki|Mantar|vegetable|raw|3 0.5 0.3 1 0 0|ración|portion|100
cabbage|Col (repollo)|Cabbage|Cavolo cappuccio|Weißkohl|Kapusta|Lahana|vegetable|raw|1.3 4 0.1 2.5 0 0|ración|portion|150
sauerkraut|Chucrut|Sauerkraut|Crauti|Sauerkraut|Kapusta kiszona|Lahana turşusu|vegetable|cooked|1 1.5 0.2 2.5 0 1.5|ración|portion|150
pickled_cucumber|Pepinillos en vinagre|Pickled gherkins|Cetriolini sott'aceto|Gewürzgurken|Ogórki kiszone|Salatalık turşusu|vegetable|raw|0.5 1.5 0.2 1 0 2.5|unidad|piece|30
lettuce|Lechuga|Lettuce|Lattuga|Kopfsalat|Sałata|Marul|salad|raw|1.4 2 0.2 1.3 0 0|ración|portion|80
salad|Ensalada mixta|Mixed salad|Insalata mista|Gemischter Salat|Sałatka mieszana|Karışık salata|salad|raw|1 3 0.2 1.8 0 0|plato|plate|150
veg_cooked|Verdura cocinada|Cooked vegetables|Verdure cotte|Gekochtes Gemüse|Warzywa gotowane|Pişmiş sebze|vegetable|cooked|2 4 0.3 3 0 0.1|ración|portion|200
frozen_veg_mix|Verduras congeladas (mezcla)|Frozen mixed vegetables|Verdure miste surgelate|TK-Gemüsemischung|Mrożona mieszanka warzyw|Dondurulmuş karışık sebze|vegetable|cooked|3 8 0.5 4 0 0.1|ración|portion|150
broccoli_cooked|Brócoli cocido|Cooked broccoli|Broccoli cotti|Gekochter Brokkoli|Brokuł gotowany|Haşlanmış brokoli|vegetable|cooked|2.4 4 0.4 3.3 0 0|ración|portion|150
cauliflower_cooked|Coliflor cocida|Cooked cauliflower|Cavolfiore cotto|Blumenkohl gekocht|Kalafior gotowany|Haşlanmış karnabahar|vegetable|cooked|1.8 2.5 0.4 2.3 0 0|ración|portion|150
green_beans|Judías verdes|Green beans|Fagiolini|Grüne Bohnen|Fasolka szparagowa|Taze fasulye|vegetable|cooked|1.8 4 0.2 3 0 0|ración|portion|150
corn_canned|Maíz dulce (lata)|Sweetcorn (canned)|Mais in scatola|Mais (Dose)|Kukurydza konserwowa|Konserve mısır|vegetable|cooked|3 14 1.5 3 2 0.5|lata|can|140
beetroot_cooked|Remolacha cocida|Cooked beetroot|Barbabietola cotta|Rote Bete gekocht|Burak gotowany|Haşlanmış pancar|vegetable|cooked|1.7 8 0.2 2 0 0.2|unidad|piece|100
crushed_tomato|Tomate triturado|Crushed tomatoes|Passata di pomodoro|Passierte Tomaten|Passata pomidorowa|Domates püresi|vegetable|cooked|1.3 4 0.2 1.5 0 0.3|ración|portion|100
olive_oil|Aceite de oliva|Olive oil|Olio d'oliva|Olivenöl|Oliwa z oliwek|Zeytinyağı|fat|raw|0 0 100 0 0 0|cucharada|tbsp|10
sunflower_oil|Aceite de girasol|Sunflower oil|Olio di girasole|Sonnenblumenöl|Olej słonecznikowy|Ayçiçek yağı|fat|raw|0 0 100 0 0 0|cucharada|tbsp|10
butter|Mantequilla|Butter|Burro|Butter|Masło|Tereyağı|fat|raw|0.7 0.6 81 0 0 0.05|porción|pat|10
mayonnaise|Mayonesa|Mayonnaise|Maionese|Mayonnaise|Majonez|Mayonez|fat|raw|1 1.5 75 0 1 1.3|cucharada|tbsp|15
olives|Aceitunas|Olives|Olive|Oliven|Oliwki|Zeytin|fat|raw|1 1 15 3 0 3|ración|portion|30
nuts|Frutos secos (almendras, nueces)|Nuts (almonds, walnuts)|Frutta secca (mandorle, noci)|Nüsse (Mandeln, Walnüsse)|Orzechy (migdały, włoskie)|Kuruyemiş (badem, ceviz)|nuts|raw|20 8 52 9 0 0|puñado|handful|30
walnuts|Nueces|Walnuts|Noci|Walnüsse|Orzechy włoskie|Ceviz|nuts|raw|15 7 65 7 0 0|puñado|handful|30
almonds|Almendras|Almonds|Mandorle|Mandeln|Migdały|Badem|nuts|raw|21 9 50 12 0 0|puñado|handful|30
peanuts|Cacahuetes|Peanuts|Arachidi|Erdnüsse|Orzeszki ziemne|Yer fıstığı|nuts|raw|26 12 49 8 0 0|puñado|handful|30
hazelnuts|Avellanas|Hazelnuts|Nocciole|Haselnüsse|Orzechy laskowe|Fındık|nuts|raw|15 7 61 10 0 0|puñado|handful|30
sunflower_seeds|Pipas de girasol peladas|Sunflower seeds|Semi di girasole|Sonnenblumenkerne|Pestki słonecznika|Ay çekirdeği içi|nuts|raw|21 11 51 9 0 0|puñado|handful|30
peanut_butter|Crema de cacahuete|Peanut butter|Burro di arachidi|Erdnussbutter|Masło orzechowe|Fıstık ezmesi|nuts|raw|25 14 50 7 3 0.5|cucharada|tbsp|16
tahini|Tahini|Tahini|Tahina|Tahin|Tahini|Tahin|nuts|raw|17 10 54 9 0 0.1|cucharada|tbsp|15
doner_wrap|Döner de pollo (dürüm)|Chicken döner wrap|Kebab di pollo (piadina)|Hähnchen-Döner Dürüm|Kebab z kurczakiem (wrap)|Tavuk döner dürüm|prepared|cooked|12 17 9 1.5 1 1.4|dürüm|wrap|230
kofte|Köfte|Köfte (meatballs)|Polpette (köfte)|Köfte (Frikadellen)|Klopsiki (köfte)|Köfte|prepared|cooked|17 4 18 0.5 0 1.3|ración|portion|150
lahmacun|Lahmacun|Lahmacun|Lahmacun|Lahmacun|Lahmacun|Lahmacun|prepared|cooked|11 33 8 2.5 1 1.5|unidad|piece|140
pide|Pide de carne|Turkish pide (meat)|Pide turca alla carne|Türkische Pide mit Fleisch|Pide z mięsem|Kıymalı pide|prepared|cooked|12 30 9 1.8 1 1.2|porción|portion|150
borek|Börek de queso|Cheese börek|Börek al formaggio|Käse-Börek|Börek z serem|Peynirli börek|prepared|cooked|10 28 16 1.2 1 1.1|porción|portion|120
manti|Mantı|Mantı (Turkish dumplings)|Mantı (ravioli turchi)|Mantı (türkische Teigtaschen)|Mantı (tureckie pierożki)|Mantı|prepared|cooked|9 22 7 1.5 0 0.9|plato|plate|250
falafel|Falafel|Falafel|Falafel|Falafel|Falafel|Falafel|prepared|cooked|13 27 18 5 0 0.9|unidad|piece|17
pierogi|Pierogi (ruskie)|Pierogi (potato and cheese)|Pierogi|Piroggen|Pierogi ruskie|Pierogi (Polonya mantısı)|prepared|cooked|7 30 5 1.8 1 0.9|unidad|piece|40
schnitzel|Escalope empanado (schnitzel)|Breaded schnitzel|Cotoletta impanata|Wiener Schnitzel|Kotlet schabowy|Şinitzel|prepared|cooked|20 12 14 0.7 0 1.0|unidad|piece|150
currywurst|Currywurst|Currywurst|Currywurst|Currywurst|Currywurst|Currywurst|prepared|cooked|11 9 20 0.5 6 2.0|ración|portion|200
pizza_margherita|Pizza margarita|Margherita pizza|Pizza margherita|Pizza Margherita|Pizza margherita|Margarita pizza|prepared|cooked|11 30 10 2 2 1.3|porción|slice|110
lasagna|Lasaña|Lasagne|Lasagne|Lasagne|Lasagne|Lazanya|prepared|cooked|8 13 7 1 1 0.9|ración|portion|250
paella|Paella|Paella|Paella|Paella|Paella|Paella|prepared|cooked|7 20 5 1 0 0.8|plato|plate|300
tortilla_espanola|Tortilla de patatas|Spanish omelette|Frittata di patate|Spanische Tortilla|Tortilla hiszpańska|İspanyol omleti|prepared|cooked|6 12 10 1.3 0 0.7|porción|portion|120
burger|Hamburguesa (con pan)|Hamburger (in bun)|Hamburger|Hamburger|Hamburger|Hamburger|prepared|cooked|13 24 10 1.5 4 1.2|unidad|piece|200
chicken_nuggets|Nuggets de pollo|Chicken nuggets|Crocchette di pollo|Chicken Nuggets|Nuggetsy z kurczaka|Tavuk nugget|prepared|cooked|15 17 15 1 1 1.3|unidad|piece|18
whey|Proteína whey|Whey protein|Proteine whey|Whey-Protein|Białko serwatkowe|Whey protein tozu|supplement|raw|78 6 6 0 4 0.5|scoop|scoop|30
protein_bar|Barrita de proteínas|Protein bar|Barretta proteica|Proteinriegel|Baton proteinowy|Protein bar|supplement|raw|33 35 13 6 10 0.5|unidad|bar|60
honey|Miel|Honey|Miele|Honig|Miód|Bal|sweet|raw|0.3 82 0 0 82 0|cucharadita|tsp|7
sugar|Azúcar|Sugar|Zucchero|Zucker|Cukier|Şeker|sweet|raw|0 100 0 0 100 0|cucharadita|tsp|5
jam|Mermelada|Jam|Marmellata|Konfitüre|Dżem|Reçel|sweet|raw|0.4 60 0.1 1 55 0|cucharada|tbsp|20
choc_spread|Crema de cacao y avellanas|Chocolate hazelnut spread|Crema spalmabile alle nocciole|Nuss-Nougat-Creme|Krem czekoladowo-orzechowy|Kakaolu fındık kreması|sweet|raw|6 57 31 3.4 56 0.1|cucharada|tbsp|15
milk_chocolate|Chocolate con leche|Milk chocolate|Cioccolato al latte|Vollmilchschokolade|Czekolada mleczna|Sütlü çikolata|sweet|raw|7 56 30 2 52 0.2|onza|square|10
dark_chocolate|Chocolate negro 70%|Dark chocolate 70%|Cioccolato fondente 70%|Zartbitterschokolade 70 %|Czekolada gorzka 70%|Bitter çikolata %70|sweet|raw|8 34 41 11 28 0|onza|square|10
biscuits|Galletas tipo María|Plain biscuits|Biscotti secchi|Butterkekse|Herbatniki|Bisküvi|sweet|raw|7 74 12 2.5 22 0.6|unidad|biscuit|6
croissant|Cruasán|Croissant|Cornetto|Croissant|Rogalik francuski|Kruvasan|sweet|cooked|8 43 21 2.5 10 1.0|unidad|piece|60
paczek|Pączek (berlina)|Doughnut (pączek)|Bombolone|Krapfen|Pączek|Dolgulu tatlı çörek|sweet|cooked|6 48 18 1.5 15 0.4|unidad|piece|70
baklava|Baklava|Baklava|Baklava|Baklava|Baklawa|Baklava|sweet|cooked|6 50 25 2 35 0.3|porción|portion|40
ice_cream|Helado|Ice cream|Gelato|Eiscreme|Lody|Dondurma|sweet|raw|3.5 24 11 0.5 20 0.2|bola|scoop|60
soft_drink|Refresco azucarado|Sugary soft drink|Bibita zuccherata|Limonade (gezuckert)|Napój gazowany słodzony|Şekerli gazlı içecek|sweet|raw|0 10.6 0 0 10.6 0|lata|can|330
crisps|Patatas fritas de bolsa|Potato crisps|Patatine in busta|Kartoffelchips|Chipsy ziemniaczane|Cips|other|raw|6 50 33 4 0 1.3|bolsa|bag|40
ketchup|Kétchup|Ketchup|Ketchup|Ketchup|Keczup|Ketçap|other|raw|1.2 24 0.1 0.8 20 1.8|cucharada|tbsp|15
`;

const LANGS = ['es', 'en', 'it', 'de', 'pl', 'tr'];
const r1 = (n) => Math.round(n * 10) / 10;
const foods = T.trim().split('\n').map((line) => {
  const cols = line.split('|');
  if (cols.length < 13) throw new Error(`Línea incompleta: ${line}`);
  const [id, ...rest] = cols;
  const names = Object.fromEntries(LANGS.map((l, i) => [l, rest[i]]));
  const [category, state, nums, ues, uen, ug, extra] = rest.slice(LANGS.length);
  const [p, c, f, fiber, sugar, salt] = nums.split(' ').map(Number);
  const food = {
    id,
    names,
    category,
    state,
    per100g: { kcal: Math.round(4 * p + 4 * c + 9 * f + 2 * fiber), p, c, f, fiber, sugar, salt },
    unit: { name: { es: ues, en: uen }, grams: Number(ug) },
    source: 'seed',
  };
  if (extra !== undefined && extra !== '') food.canteenExtraFatPer100g = r1(Number(extra));
  return food;
});
writeFileSync(new URL('../src/data/foods.seed.json', import.meta.url), JSON.stringify(foods, null, 2) + '\n');
console.log(`${foods.length} foods`);
