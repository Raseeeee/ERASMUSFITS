import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented, inputClass } from '../../components/ui';
import {
  ACTIVITY_KINDS,
  INTENSITIES,
  MAX_MINUTES,
  activityKcal,
  activityWater,
  type ExtraActivity,
} from '../../domain/activity';
import { setExtraActivity } from '../../store/logRepo';

const DEFAULT: ExtraActivity = { kind: 'walk', minutes: 30, intensity: 'moderate' };

/** "He hecho otra actividad": cuenta como día activo y sube el objetivo de ese día. */
export function ExtraActivityControl({
  date,
  value: stored,
  weightKg,
}: {
  date: string;
  value: ExtraActivity | null | undefined;
  weightKg: number;
}) {
  const { t } = useTranslation();
  // Estado optimista: la UI responde al instante y se guarda en IndexedDB en segundo plano.
  const [value, setValue] = useState<ExtraActivity | null>(stored ?? null);
  useEffect(() => setValue(stored ?? null), [stored, date]);
  const [minutes, setMinutes] = useState(String(stored?.minutes ?? DEFAULT.minutes));
  useEffect(() => setMinutes(String(stored?.minutes ?? DEFAULT.minutes)), [stored?.minutes, date]);

  const save = (a: ExtraActivity | null) => {
    setValue(a);
    void setExtraActivity(date, a);
  };
  const on = !!value;
  const m = Number(minutes);
  const minutesOk = Number.isFinite(m) && m > 0 && m <= MAX_MINUTES;

  return (
    <div className="mt-3 border-t border-bd pt-3">
      <label className="flex min-h-11 items-center gap-2 font-medium">
        <input
          type="checkbox"
          className="size-5 accent-ac"
          checked={on}
          onChange={(e) => save(e.target.checked ? DEFAULT : null)}
        />
        {t('activity.toggle')}
      </label>
      {!on && <p className="text-xs text-mu">{t('activity.hint')}</p>}
      {on && value && (
        <div className="mt-2">
          <div className="grid grid-cols-2 items-end gap-3">
            <label className="block text-sm font-medium">
              {t('activity.kind')}
              <select
                className={`${inputClass} mt-1`}
                value={value.kind}
                onChange={(e) => save({ ...value, kind: e.target.value as ExtraActivity['kind'] })}
              >
                {ACTIVITY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`activity.kinds.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              {t('activity.minutes')}
              <input
                name="activityMinutes"
                className={`${inputClass} mt-1`}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_MINUTES}
                value={minutes}
                aria-invalid={!minutesOk}
                onChange={(e) => {
                  setMinutes(e.target.value);
                  const n = Number(e.target.value);
                  if (n > 0 && n <= MAX_MINUTES) save({ ...value, minutes: Math.round(n) });
                }}
              />
            </label>
          </div>
          <div className="mt-3">
            <Segmented
              name={`intensity-${date}`}
              legend={t('activity.intensity')}
              value={value.intensity}
              options={INTENSITIES.map((i) => ({ value: i, label: t(`activity.intensities.${i}`) }))}
              onChange={(intensity) => save({ ...value, intensity })}
            />
          </div>
          <p className="text-sm text-mu" data-testid="activity-extra" aria-live="polite">
            {t('activity.effect', { kcal: activityKcal(weightKg, value), glasses: activityWater(value) })}
          </p>
        </div>
      )}
    </div>
  );
}
