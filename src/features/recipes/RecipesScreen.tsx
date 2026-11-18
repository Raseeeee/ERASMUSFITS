import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card, Screen, Segmented, flag, inputClass } from '../../components/ui';
import { fmt, fmtMoney } from '../../components/format';
import { priceTables } from '../../data/countries';
import { localISODate } from '../../domain/log';
import { filterRecipes, sortSuggestions, type RecipeKind } from '../../domain/recipes';
import { COUNTRIES, type CountryCode } from '../../domain/types';
import { useAppStore } from '../../store/appStore';
import { useRemaining } from '../today/useDayStatus';
import { useCountries, useRecipeInfos } from './useRecipeData';

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-bd px-1.5 py-0.5 text-xs text-mu">{children}</span>;
}

export function RecipesScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const goal = useAppStore((s) => s.profile?.goal);
  const { buyCountry } = useCountries();
  const currency = priceTables[buyCountry].currency;

  const [country, setCountry] = useState<CountryCode>(buyCountry);
  const [kind, setKind] = useState<'all' | RecipeKind>('all');
  const [onlyGoal, setOnlyGoal] = useState(true);
  const [maxMinutes, setMaxMinutes] = useState<string>('');
  const [maxCost, setMaxCost] = useState('');
  const [vegetarian, setVegetarian] = useState(false);

  const infos = useRecipeInfos(country);
  const rem = useRemaining(localISODate()) ?? { kcal: 0, p: 0, c: 0, f: 0 };
  const cost = Number(maxCost.replace(',', '.'));
  const list = sortSuggestions(
    filterRecipes(infos, {
      goal: onlyGoal ? goal : undefined,
      kind: kind === 'all' ? undefined : kind,
      maxMinutes: maxMinutes ? Number(maxMinutes) : undefined,
      maxCostPerServing: maxCost.trim() && cost > 0 ? cost : undefined,
      vegetarian,
    }),
    rem,
  );

  return (
    <Screen title={t('recipes.title')}>
      <p className="mb-4 text-sm text-mu">{t('recipes.subtitle')}</p>
      <Card>
        <label className="mb-3 block text-sm font-medium">
          {t('recipes.country')}
          <select className={`${inputClass} mt-1`} value={country} onChange={(e) => setCountry(e.target.value as CountryCode)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {flag(c)} {t(`countries.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          name="kind"
          legend={t('recipes.kind')}
          value={kind}
          options={(['all', 'breakfast', 'main'] as const).map((k) => ({ value: k, label: t(`recipes.kinds.${k}`) }))}
          onChange={setKind}
        />
        <div className="grid grid-cols-2 items-end gap-3">
          <label className="block text-sm font-medium">
            {t('recipes.maxMinutes')}
            <select className={`${inputClass} mt-1`} value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)}>
              <option value="">{t('recipes.anyTime')}</option>
              {[5, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {t('recipes.minutesOption', { n })}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            {t('recipes.maxCost', { currency })}
            <input
              className={`${inputClass} mt-1`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={maxCost}
              onChange={(e) => setMaxCost(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-ac" checked={onlyGoal} onChange={(e) => setOnlyGoal(e.target.checked)} />
            {t('recipes.onlyMyGoal')}
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-ac" checked={vegetarian} onChange={(e) => setVegetarian(e.target.checked)} />
            {t('recipes.vegetarian')}
          </label>
        </div>
      </Card>

      {list.length === 0 ? (
        <p className="text-mu">{t('recipes.none')}</p>
      ) : (
        <ul className="space-y-3" aria-label={t('recipes.title')}>
          {list.map((r) => (
            <li key={r.recipe.id}>
              <Link
                to={`/recipes/${r.recipe.id}`}
                className="block rounded-xl border border-bd bg-card p-4"
                data-testid={`recipe-${r.recipe.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{r.recipe.title[lang] ?? r.recipe.title.en}</h2>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {r.costPerServing === null
                      ? t('recipes.noPrice')
                      : t('recipes.costPerServing', { cost: fmtMoney(r.costPerServing, currency, lang) })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-mu tabular-nums">
                  {t('recipes.perServing', {
                    kcal: r.perServing.kcal,
                    p: fmt(r.perServing.p, lang, 0),
                    c: fmt(r.perServing.c, lang, 0),
                    f: fmt(r.perServing.f, lang, 0),
                  })}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{t('recipes.minutes', { n: r.recipe.minutes })}</Badge>
                  <Badge>{t(`recipes.kinds.${r.recipe.kind}`)}</Badge>
                  {r.vegetarian && <Badge>{t('recipes.vegetarian')}</Badge>}
                  {r.highProtein && <Badge>{t('recipes.highProtein')}</Badge>}
                  {r.familiar && <Badge>{t('recipes.familiar')}</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
