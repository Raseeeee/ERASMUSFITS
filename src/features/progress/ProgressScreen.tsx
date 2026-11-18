import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Screen, inputClass } from '../../components/ui';
import { fmt } from '../../components/format';
import type { CoachAlert } from '../../domain/coach';
import { isISODate, localISODate } from '../../domain/log';
import { adherence, weeklyRate } from '../../domain/progress';
import { useAppStore } from '../../store/appStore';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG, deleteWeight, saveWeight } from '../../store/progressRepo';
import { ActivityStrip, KcalChart, WeightChart } from './charts';
import { useProgress } from './useProgress';

function AlertCard({ alert }: { alert: CoachAlert }) {
  const { t } = useTranslation();
  const { dismissAlert, applyKcalAdjustment } = useAppStore();
  const today = localISODate();
  const warning = alert.severity === 'warning';
  const delta = alert.action?.delta;
  return (
    <li
      className={`rounded-xl border p-3 ${warning ? 'border-wr bg-wr-bg' : 'border-bd bg-card'}`}
      data-testid={`alert-${alert.id}`}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
        <span aria-hidden>{warning ? '⚠ ' : 'ℹ '}</span>
        {t(`coach.severity.${alert.severity}`)}
      </p>
      <p className="mb-2">{t(`coach.${alert.id}`, alert.params ?? {})}</p>
      <div className="flex flex-wrap gap-2">
        {delta !== undefined && (
          <Button variant="primary" onClick={() => void applyKcalAdjustment(delta, today)}>
            {t('coach.apply', { kcal: (delta > 0 ? '+' : '') + delta })}
          </Button>
        )}
        <Button onClick={() => void dismissAlert(alert.id, today)}>
          {delta !== undefined ? t('coach.notNow') : t('coach.dismiss')}
        </Button>
      </div>
    </li>
  );
}

export function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const data = useProgress();
  const setCurrentWeight = useAppStore((s) => s.setCurrentWeight);
  const [date, setDate] = useState(() => localISODate());
  const [kg, setKg] = useState('');
  const [touched, setTouched] = useState(false);

  if (!data) return null;
  const { days, weights, alerts, today } = data;
  const weight = Number(kg.replace(',', '.'));
  const weightOk = weight >= MIN_WEIGHT_KG && weight <= MAX_WEIGHT_KG && isISODate(date) && date <= today;
  const rate = weeklyRate(weights.slice(-5));
  const last7 = days.slice(-7);
  const adh = adherence(last7);
  const activeDays = last7.filter((d) => d.active).length;

  async function addWeight() {
    if (!weightOk) return;
    await saveWeight(date, weight);
    const latest = weights.length === 0 || date >= weights[weights.length - 1].date;
    if (latest) await setCurrentWeight(Math.round(weight * 10) / 10);
    setKg('');
    setTouched(false);
  }

  return (
    <Screen title={t('progress.title')}>
      <section aria-labelledby="coach-title" className="mb-4">
        <h2 id="coach-title" className="mb-2 font-semibold">{t('progress.alerts')}</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-mu" data-testid="no-alerts">{t('progress.noAlerts')}</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>

      <Card>
        <h2 className="mb-2 font-semibold">{t('progress.weightTitle')}</h2>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={t('progress.date')}>
              {(a) => (
                <input {...a} type="date" max={today} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
              )}
            </Field>
          </div>
          <div className="flex-1">
            <Field label={t('progress.weightKg')} error={touched && kg && !weightOk ? t('progress.weightRange', { min: MIN_WEIGHT_KG, max: MAX_WEIGHT_KG }) : null}>
              {(a) => (
                <input
                  {...a}
                  name="weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  className={inputClass}
                  value={kg}
                  onChange={(e) => setKg(e.target.value)}
                  onBlur={() => setTouched(true)}
                />
              )}
            </Field>
          </div>
        </div>
        <Button variant="primary" className="mb-3 w-full" disabled={!weightOk} onClick={addWeight}>
          {t('progress.saveWeight')}
        </Button>
        <p className="mb-2 text-sm text-mu">{t('progress.weeklyHint')}</p>
        {weights.length > 0 ? (
          <>
            {rate !== null && (
              <p className="mb-2 font-medium tabular-nums" data-testid="weight-rate">
                {t('progress.rate', { kg: (rate > 0 ? '+' : '') + fmt(rate, lang, 2) })}
              </p>
            )}
            <WeightChart points={weights.slice(-12)} title={t('progress.weightTitle')} />
            <ul className="mt-2 divide-y divide-bd text-sm" aria-label={t('progress.weightList')}>
              {[...weights].reverse().slice(0, 6).map((w) => (
                <li key={w.date} className="flex items-center justify-between">
                  <span className="tabular-nums">
                    {w.date} · {fmt(w.kg, lang)} kg
                  </span>
                  <button
                    className="min-h-11 min-w-11 text-wr"
                    aria-label={t('progress.deleteWeight', { date: w.date })}
                    onClick={() => void deleteWeight(w.date)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-mu">{t('progress.noWeights')}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">{t('progress.adherenceTitle')}</h2>
        <p className="mb-2 text-sm" data-testid="adherence">
          {adh === null ? t('progress.noLogs') : t('progress.adherence', { pct: Math.round(adh * 100) })}
        </p>
        <KcalChart
          title={t('progress.kcalTitle')}
          bars={days.slice(-14).map((d) => ({ date: d.date, kcal: d.logged ? d.totals.kcal : null, target: d.targets.kcal }))}
        />
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">{t('progress.activityTitle')}</h2>
        <p className="mb-2 text-sm" data-testid="active-days">{t('progress.activeDays', { count: activeDays })}</p>
        <ActivityStrip days={days.slice(-14)} />
        <p className="mt-2 text-xs text-mu">{t('progress.activityHint')}</p>
      </Card>
    </Screen>
  );
}
