import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, inputClass } from '../../components/ui';
import { fmt, fmtMoney } from '../../components/format';
import { countries, priceTables, seedFoodMap, substitutionGroups } from '../../data/countries';
import { seedFoods } from '../../data/foods';
import { ALLERGENS, type Allergen } from '../../domain/allergens';
import { foodName } from '../../domain/foods';
import {
  candidateFoods,
  optimizeBasket,
  weeklyTargets,
  type OptimizerResult,
  type ShoppingPreferences,
} from '../../domain/optimizer';
import { equivalents } from '../../domain/prices';
import { useAppStore } from '../../store/appStore';
import { useCountries } from '../recipes/useRecipeData';

export function ShopScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { profile, overrides, shopPrefs, setShopPrefs } = useAppStore();
  const { buyCountry, origin } = useCountries();
  const table = priceTables[buyCountry];
  const money = (v: number) => fmtMoney(v, table.currency, lang);
  const name = (id: string) => foodName(seedFoodMap.get(id)!, lang);

  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [toExclude, setToExclude] = useState('');

  const target = useMemo(() => (profile ? weeklyTargets(profile, overrides) : null), [profile, overrides]);
  const excludable = useMemo(
    () =>
      candidateFoods(seedFoods, table, {})
        .filter((f) => !(shopPrefs.excluded ?? []).includes(f.id))
        .sort((a, b) => foodName(a, lang).localeCompare(foodName(b, lang), lang)),
    [table, shopPrefs.excluded, lang],
  );
  const eq = useMemo(
    () => (origin ? equivalents(countries[origin].staples, table, seedFoodMap, substitutionGroups) : []),
    [origin, table],
  );

  if (!profile || !target) return null;

  const update = (p: Partial<ShoppingPreferences>) => {
    setResult(null);
    void setShopPrefs({ ...shopPrefs, ...p });
  };
  const toggleAllergy = (a: Allergen, on: boolean) => {
    const set = new Set(shopPrefs.allergies ?? []);
    if (on) set.add(a);
    else set.delete(a);
    update({ allergies: [...set] });
  };

  const priced = Object.values(table.items);
  const verifiedCount = priced.filter((i) => i.confidence === 'verificado').length;

  return (
    <Screen title={t('shop.title')}>
      <p className="mb-4 text-sm text-mu">{t('shop.subtitle', { country: t(`countries.${buyCountry}`) })}</p>

      <Card>
        <h2 className="mb-2 font-semibold">{t('shop.preferences')}</h2>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            className="size-5 accent-ac"
            checked={!!shopPrefs.vegetarian}
            onChange={(e) => update({ vegetarian: e.target.checked })}
          />
          {t('shop.vegetarian')}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            className="size-5 accent-ac"
            checked={!!shopPrefs.quick}
            onChange={(e) => update({ quick: e.target.checked })}
          />
          {t('shop.quick')}
        </label>
        <fieldset className="mt-2">
          <legend className="mb-1 text-sm font-medium">{t('shop.allergies')}</legend>
          <div className="flex flex-wrap gap-x-5">
            {ALLERGENS.map((a) => (
              <label key={a} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5 accent-ac"
                  checked={(shopPrefs.allergies ?? []).includes(a)}
                  onChange={(e) => toggleAllergy(a, e.target.checked)}
                />
                {t(`allergens.${a}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-2">
          <label className="mb-1 block text-sm font-medium" htmlFor="exclude">
            {t('shop.excluded')}
          </label>
          <div className="flex gap-2">
            <select id="exclude" className={inputClass} value={toExclude} onChange={(e) => setToExclude(e.target.value)}>
              <option value="">{t('shop.excludePlaceholder')}</option>
              {excludable.map((f) => (
                <option key={f.id} value={f.id}>
                  {foodName(f, lang)}
                </option>
              ))}
            </select>
            <Button
              disabled={!toExclude}
              onClick={() => {
                update({ excluded: [...(shopPrefs.excluded ?? []), toExclude] });
                setToExclude('');
              }}
            >
              {t('shop.exclude')}
            </Button>
          </div>
          {(shopPrefs.excluded ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {(shopPrefs.excluded ?? []).map((id) => (
                <li key={id}>
                  <button
                    className="min-h-11 rounded-full border border-bd px-3 text-sm"
                    aria-label={t('shop.removeExcluded', { name: name(id) })}
                    onClick={() => update({ excluded: (shopPrefs.excluded ?? []).filter((x) => x !== id) })}
                  >
                    {name(id)} ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={() => setResult(optimizeBasket(seedFoods, table, target, shopPrefs))}
        >
          {result ? t('shop.recalculate') : t('shop.calculate')}
        </Button>
      </Card>

      {result?.status === 'infeasible' && (
        <Card className="border-wr">
          <p role="alert">{t(`shop.infeasible.${result.reason}`)}</p>
        </Card>
      )}

      {result?.status === 'ok' && (
        <>
          <Card>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-bg p-3">
                <p className="text-xs text-mu">{t('shop.week')}</p>
                <p className="text-xl font-semibold tabular-nums" data-testid="shop-total">{money(result.totalCost)}</p>
              </div>
              <div className="rounded-lg bg-bg p-3">
                <p className="text-xs text-mu">{t('shop.perDay')}</p>
                <p className="text-xl font-semibold tabular-nums" data-testid="shop-per-day">{money(result.costPerDay)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-mu">
              {t('shop.totals', {
                kcal: fmt(result.totals.kcal, lang, 0),
                p: result.totals.p,
                c: result.totals.c,
                f: result.totals.f,
                tkcal: fmt(Math.round(target.kcal), lang, 0),
              })}
            </p>
            {result.relaxations.length > 0 && (
              <div className="mt-3 rounded-lg bg-wr-bg p-3 text-sm" role="status">
                <p>{t('shop.relaxations.title')}</p>
                <ul className="list-disc pl-5">
                  {result.relaxations.map((r) => (
                    <li key={r}>{t(`shop.relaxations.${r}`)}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">{t('shop.list')}</h2>
            <ul className="divide-y divide-bd" aria-label={t('shop.list')}>
              {result.items.map((i) => (
                <li key={i.foodId} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{name(i.foodId)}</span>
                    <span className="block text-xs text-mu">
                      {t('shop.buy')} {i.buyGrams >= 1000 ? `${fmt(i.buyGrams / 1000, lang, 2)} kg` : `${i.buyGrams} g`}
                      {table.items[i.foodId].yield ? ` · ${t('shop.eats', { grams: i.gramsWeek })}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(i.cost)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-mu">
              {t('shop.priceNote', {
                store: priced[0]?.store ?? '',
                verified: verifiedCount,
                total: priced.length,
                date: table.updated,
              })}
            </p>
            <p className="mt-1 text-xs text-mu">{t('shop.disclaimer')}</p>
          </Card>
        </>
      )}

      {origin && eq.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">{t('shop.equivalents', { country: t(`countries.${buyCountry}`) })}</h2>
          <p className="mb-2 text-sm text-mu">{t('shop.equivalentsHint', { origin: t(`countries.${origin}`) })}</p>
          <ul className="divide-y divide-bd" aria-label={t('shop.equivalents', { country: t(`countries.${buyCountry}`) })}>
            {eq.map((e) => (
              <li key={e.homeFoodId} className="py-2 text-sm">
                <p className="font-medium">{name(e.homeFoodId)}</p>
                <p className="text-mu">
                  {e.same ? t('shop.sameHere', { cost: money(e.same.costPerBasis) }) : t('shop.notSoldHere')}
                  {' · '}
                  {e.same && e.same.foodId === e.cheapest.foodId
                    ? t('shop.itsCheapest')
                    : t('shop.cheapest', { name: name(e.cheapest.foodId), cost: money(e.cheapest.costPerBasis) })}
                </p>
                <p className="text-xs text-mu">{t('shop.perBasis', { basis: t(`shop.basis.${e.basis}`) })}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Screen>
  );
}
