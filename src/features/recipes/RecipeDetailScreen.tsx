import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Card, Screen, Segmented, inputClass } from '../../components/ui';
import { fmt, fmtMoney } from '../../components/format';
import { priceTables, seedFoodMap } from '../../data/countries';
import { allRecipes } from '../../data/recipes';
import { foodName } from '../../domain/foods';
import { MEALS, defaultMealForHour, localISODate, type Meal } from '../../domain/log';
import { costFor } from '../../domain/prices';
import { ingredientsForServings, recipeInfo } from '../../domain/recipes';
import { addEntries } from '../../store/logRepo';
import { Badge } from './RecipesScreen';
import { useCountries } from './useRecipeData';

export function RecipeDetailScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id } = useParams();
  const navigate = useNavigate();
  const { buyCountry } = useCountries();
  const table = priceTables[buyCountry];
  const recipe = allRecipes.find((r) => r.id === id);
  const [servings, setServings] = useState('1');
  const [meal, setMeal] = useState<Meal>(() =>
    recipe?.kind === 'breakfast' ? 'breakfast' : defaultMealForHour(new Date().getHours()),
  );

  if (!recipe) {
    return (
      <Screen title={t('recipes.title')}>
        <p className="mb-3 text-mu">{t('recipes.notFound')}</p>
        <Link to="/recipes" className="text-ac underline">{t('recipes.back')}</Link>
      </Screen>
    );
  }

  const info = recipeInfo(recipe, seedFoodMap, table);
  const n = Number(servings.replace(',', '.'));
  const valid = Number.isFinite(n) && n > 0 && n <= 10;
  const items = recipe.ingredients.map((i) => ({ ...i, item: table.items[i.foodId] }));
  const verified = items.filter((i) => i.item?.confidence === 'verificado').length;
  const confidence = verified === 0 ? 'estimado' : verified === items.length ? 'verificado' : 'mixed';
  const latest = items.map((i) => i.item?.date ?? '').sort().pop() ?? table.updated;
  const money = (v: number) => fmtMoney(v, table.currency, lang);
  const title = recipe.title[lang] ?? recipe.title.en;

  async function add() {
    if (!valid || !recipe) return;
    const toLog = ingredientsForServings(recipe, n).map((i) => ({ food: seedFoodMap.get(i.foodId)!, grams: i.grams }));
    const date = localISODate();
    await addEntries(date, meal, toLog);
    navigate(`/today?date=${date}`);
  }

  return (
    <Screen title={title}>
      <Link to="/recipes" className="mb-3 inline-flex min-h-11 items-center text-ac underline">
        ← {t('recipes.back')}
      </Link>
      <Card>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Badge>{t('recipes.minutes', { n: recipe.minutes })}</Badge>
          <Badge>{t('recipes.servings', { count: recipe.servings })}</Badge>
          {recipe.equipment.map((e) => (
            <Badge key={e}>{t(`recipes.equipment.${e}`)}</Badge>
          ))}
          {info.vegetarian && <Badge>{t('recipes.vegetarian')}</Badge>}
          {info.highProtein && <Badge>{t('recipes.highProtein')}</Badge>}
        </div>
        <p className="font-medium tabular-nums" data-testid="recipe-macros">
          {t('recipes.perServing', {
            kcal: info.perServing.kcal,
            p: fmt(info.perServing.p, lang, 0),
            c: fmt(info.perServing.c, lang, 0),
            f: fmt(info.perServing.f, lang, 0),
          })}
        </p>
        <p className="font-medium tabular-nums" data-testid="recipe-cost">
          {info.costPerServing === null
            ? t('recipes.noPrice')
            : t('recipes.costPerServing', { cost: money(info.costPerServing) })}
        </p>
        <p className="mt-1 text-xs text-mu">
          {t('recipes.priceNote', {
            country: t(`countries.${buyCountry}`),
            store: table.items[recipe.ingredients[0].foodId]?.store ?? '',
            confidence: t(`recipes.confidence.${confidence}`),
            date: latest,
          })}
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t('recipes.ingredients')}</h2>
        <ul className="divide-y divide-bd" aria-label={t('recipes.ingredients')}>
          {items.map((i) => {
            const food = seedFoodMap.get(i.foodId)!;
            const c = costFor(i.foodId, i.grams, table);
            return (
              <li key={i.foodId} className="flex justify-between gap-2 py-2 text-sm">
                <span>
                  {foodName(food, lang)} <span className="text-mu">· {i.grams} g</span>
                </span>
                <span className="tabular-nums text-mu">{c === null ? '—' : money(c)}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-mu">{t('recipes.notCounted')}</p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t('recipes.steps')}</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {(recipe.steps[lang as 'es' | 'en'] ?? recipe.steps.en).map((s, k) => (
            <li key={k}>{s}</li>
          ))}
        </ol>
      </Card>

      <Card>
        <label className="mb-3 block text-sm font-medium">
          {t('recipes.servingsEaten')}
          <input
            name="servings"
            className={`${inputClass} mt-1`}
            type="number"
            inputMode="decimal"
            min={0.5}
            max={10}
            step={0.5}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </label>
        <Segmented
          name="meal"
          legend={t('food.meal')}
          value={meal}
          options={MEALS.map((m) => ({ value: m, label: t(`meals.${m}`) }))}
          onChange={setMeal}
        />
        <Button variant="primary" className="w-full" disabled={!valid} onClick={add}>
          {t('recipes.addToDay')}
        </Button>
      </Card>
    </Screen>
  );
}
