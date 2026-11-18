import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import { Button, Card, Screen, inputClass } from '../../components/ui';
import { fmt } from '../../components/format';
import { localized } from '../../domain/foods';
import {
  addDays,
  dayTotals,
  emptyDay,
  isISODate,
  localISODate,
  progressRows,
  targetsForDay,
  type ProgressRow,
} from '../../domain/log';
import { DAY_TYPES, type DayType } from '../../domain/types';
import { changeWater, deleteEntry, getDay, listEntries, setDayType } from '../../store/logRepo';
import { useAppStore } from '../../store/appStore';
import { useSelectedDate } from './useSelectedDate';

function Bar({ row }: { row: ProgressRow }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const unit = row.key === 'kcal' ? ` ${t('common.kcal')}` : ` ${t('common.g')}`;
  const dec = row.key === 'salt' ? 1 : 0;
  const diff = row.target - row.value;
  const label = t(`today.bars.${row.key}`);
  const note =
    row.kind === 'cap'
      ? row.over
        ? t('today.over', { value: fmt(-diff, lang, dec) })
        : t('today.underCap', { value: fmt(row.target, lang, dec) })
      : diff >= 0
        ? t('today.remaining', { value: fmt(diff, lang, dec) })
        : t('today.over', { value: fmt(-diff, lang, dec) });
  return (
    <div className="mb-2" data-testid={`bar-${row.key}`}>
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          <span data-testid={`value-${row.key}`}>{fmt(row.value, lang, dec)}</span> / {fmt(row.target, lang, dec)}
          {unit} <span className={row.over ? 'text-wr' : 'text-mu'}>({note})</span>
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded bg-bd"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={row.target}
        aria-valuenow={Math.round(row.value * 10) / 10}
      >
        <div
          className={`h-full ${row.over ? 'bg-wr' : 'bg-ac'}`}
          style={{ width: `${Math.min(100, row.ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { profile, overrides } = useAppStore();
  const [date, setDate] = useSelectedDate();

  const day = useLiveQuery(() => getDay(date), [date]) ?? emptyDay(date);
  const entries = useLiveQuery(() => listEntries(date), [date]) ?? [];

  if (!profile) return <Navigate to="/onboarding" replace />;

  const targets = targetsForDay(profile, day.dayType, overrides);
  const totals = dayTotals(entries);
  const rows = progressRows(totals, targets);
  const isToday = date === localISODate();

  return (
    <Screen title={t('today.title')}>
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Button className="px-3" aria-label={t('today.prevDay')} onClick={() => setDate(addDays(date, -1))}>
            ‹
          </Button>
          <input
            type="date"
            aria-label={t('today.date')}
            className={`${inputClass} flex-1`}
            value={date}
            onChange={(e) => isISODate(e.target.value) && setDate(e.target.value)}
          />
          <Button className="px-3" aria-label={t('today.nextDay')} onClick={() => setDate(addDays(date, 1))}>
            ›
          </Button>
          {!isToday && <Button onClick={() => setDate(localISODate())}>{t('today.goToday')}</Button>}
        </div>
        <label className="block text-sm font-medium">
          {t('today.dayType')}
          <select
            className={`${inputClass} mt-1`}
            value={day.dayType}
            onChange={(e) => void setDayType(date, e.target.value as DayType)}
          >
            {DAY_TYPES.map((d) => (
              <option key={d} value={d}>
                {t(`dayTypes.${d}`)}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mu">{t('today.progress')}</h2>
        {rows.map((r) => (
          <Bar key={r.key} row={r} />
        ))}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t('today.water')}</h2>
            <p className="tabular-nums text-mu" data-testid="water-count" aria-live="polite">
              {t('today.waterCount', { count: day.waterGlasses, target: targets.waterGlasses })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="min-w-11 px-0 text-xl"
              aria-label={t('today.removeGlass')}
              disabled={day.waterGlasses === 0}
              onClick={() => void changeWater(date, -1)}
            >
              −
            </Button>
            <Button
              variant="primary"
              className="min-w-11 px-0 text-xl"
              aria-label={t('today.addGlass')}
              onClick={() => void changeWater(date, 1)}
            >
              +
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">{t('today.meals')}</h2>
        {entries.length === 0 ? (
          <p className="mb-3 text-mu">{t('today.empty')}</p>
        ) : (
          <ul className="mb-3 divide-y divide-bd" aria-label={t('today.meals')}>
            {entries.map((e) => {
              const name = localized(e.name, lang);
              return (
                <li key={e.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    <p className="text-sm text-mu tabular-nums">
                      {t('today.entryLine', {
                        grams: e.grams,
                        context: t(`food.contexts.${e.context}`),
                        kcal: e.nutrients.kcal,
                        p: fmt(e.nutrients.p, lang),
                        c: fmt(e.nutrients.c, lang),
                        f: fmt(e.nutrients.f, lang),
                      })}
                    </p>
                  </div>
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
        )}
        <Link
          to={`/add?date=${date}`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-ac bg-ac px-4 font-medium text-ac-tx"
        >
          {t('today.addFood')}
        </Link>
      </Card>
    </Screen>
  );
}
