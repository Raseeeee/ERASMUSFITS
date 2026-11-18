import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '../../components/ui';
import { fmt } from '../../components/format';
import { localized } from '../../domain/foods';
import type { MealGroup, Remaining } from '../../domain/log';
import { deleteEntry } from '../../store/logRepo';

/** Contador total de lo que falta (kcal y macros). */
export function RemainingCounter({ r }: { r: Remaining }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const over = r.kcal < 0;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-mu">{t('today.remainingTitle')}</h2>
        <p className={`text-2xl font-semibold tabular-nums ${over ? 'text-wr' : ''}`} data-testid="remaining-kcal">
          {over
            ? t('today.overKcal', { value: fmt(-r.kcal, lang, 0) })
            : t('today.remainingKcal', { value: fmt(r.kcal, lang, 0) })}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(['p', 'c', 'f'] as const).map((k) => (
          <div key={k} className="rounded-lg bg-bg p-2">
            <dt className="text-xs text-mu">{t(`today.macros.${k}`)}</dt>
            <dd className={`font-semibold tabular-nums ${r[k] < 0 ? 'text-wr' : ''}`} data-testid={`remaining-${k}`}>
              {r[k] < 0
                ? t('today.overMacro', { value: fmt(-r[k], lang, 0) })
                : t('today.remainingMacro', { value: fmt(r[k], lang, 0) })}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Desayuno, comida, cena y snacks con subtotales, entradas editables y botón de añadir. */
export function MealSections({ groups, date }: { groups: MealGroup[]; date: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const line = (n: { kcal: number; p: number; c: number; f: number }) =>
    t('today.mealTotals', { kcal: n.kcal, p: fmt(n.p, lang), c: fmt(n.c, lang), f: fmt(n.f, lang) });

  return (
    <>
      {groups.map(({ meal, entries, totals }) => {
        const mealName = t(`meals.${meal}`);
        return (
          <Card key={meal}>
            <section aria-labelledby={`meal-${meal}`} data-testid={`meal-${meal}`}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h2 id={`meal-${meal}`} className="font-semibold">
                  {mealName}
                  {meal === 'snack' && <span className="ml-2 text-xs font-normal text-mu">{t('mealHints.snack')}</span>}
                </h2>
                <span className="text-sm tabular-nums text-mu" data-testid={`meal-${meal}-kcal`}>
                  {totals.kcal} {t('common.kcal')}
                </span>
              </div>
              {entries.length > 0 ? (
                <>
                  <p className="mb-1 text-xs tabular-nums text-mu" data-testid={`meal-${meal}-totals`}>
                    {line(totals)}
                  </p>
                  <ul className="divide-y divide-bd" aria-label={mealName}>
                    {entries.map((e) => {
                      const name = localized(e.name, lang);
                      return (
                        <li key={e.id} className="flex items-center gap-1">
                          <Link
                            to={`/add?date=${date}&edit=${e.id}`}
                            aria-label={t('today.editEntry', { name })}
                            className="min-h-11 min-w-0 flex-1 py-2"
                          >
                            <span className="block truncate font-medium">{name}</span>
                            <span className="block text-sm text-mu tabular-nums">
                              {t('today.entryLine', {
                                grams: e.grams,
                                context: t(`food.contexts.${e.context}`),
                                kcal: e.nutrients.kcal,
                                p: fmt(e.nutrients.p, lang),
                                c: fmt(e.nutrients.c, lang),
                                f: fmt(e.nutrients.f, lang),
                              })}
                            </span>
                          </Link>
                          <button
                            className="min-h-11 min-w-11 rounded-lg text-wr"
                            aria-label={t('today.deleteEntry', { name })}
                            onClick={() => void deleteEntry(e.id)}
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="mb-1 text-sm text-mu">{t('today.mealEmpty')}</p>
              )}
              <Link
                to={`/add?date=${date}&meal=${meal}`}
                className="mt-2 flex min-h-11 items-center justify-center rounded-lg border border-ac font-medium text-ac"
              >
                + {t('today.addToMeal', { meal: mealName.toLowerCase() })}
              </Link>
            </section>
          </Card>
        );
      })}
    </>
  );
}
