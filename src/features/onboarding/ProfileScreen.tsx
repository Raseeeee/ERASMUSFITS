import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Card, Disclaimer, Field, Screen, Segmented, inputClass } from '../../components/ui';
import { RANGES, validateProfile, type ProfileError } from '../../domain/profile';
import { bmi, isGoalAllowed } from '../../domain/targets';
import {
  ACTIVITY_LEVELS,
  GOALS,
  SEXES,
  SPORTS,
  type ActivityLevel,
  type BodyProfile,
  type Goal,
  type Sex,
  type Sport,
} from '../../domain/types';
import { useAppStore } from '../../store/appStore';

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile: saved, setProfile } = useAppStore();

  const [sex, setSex] = useState<Sex | null>(saved?.sex ?? null);
  const [age, setAge] = useState(saved ? String(saved.age) : '');
  const [weight, setWeight] = useState(saved ? String(saved.weightKg) : '');
  const [height, setHeight] = useState(saved ? String(saved.heightCm) : '');
  const [goal, setGoal] = useState<Goal | null>(saved?.goal ?? null);
  const [activity, setActivity] = useState<ActivityLevel | null>(saved?.activity ?? null);
  const [sports, setSports] = useState<Partial<Record<Sport, number>>>(
    Object.fromEntries((saved?.sports ?? []).map((s) => [s.sport, s.daysPerWeek])),
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));
  const draft: BodyProfile = {
    sex: sex ?? 'unspecified',
    age: num(age),
    weightKg: num(weight),
    heightCm: num(height),
    goal: goal ?? 'maintain',
    activity: activity ?? 'sedentary',
    sports: Object.entries(sports).map(([sport, d]) => ({ sport: sport as Sport, daysPerWeek: d ?? 0 })),
  };
  const errors = validateProfile(draft);
  const has = (e: ProfileError) => errors.includes(e);
  const complete = !!sex && !!goal && !!activity;
  const valid = complete && errors.length === 0;

  const bodyOk = !has('weightKg') && !has('heightCm');
  const loseAllowed = !bodyOk || isGoalAllowed('lose', draft.weightKg, draft.heightCm);

  const rangeMsg = (k: keyof typeof RANGES) => t('profile.outOfRange', RANGES[k]);
  const show = (k: string) => touched[k];

  async function onContinue() {
    if (!valid) return;
    await setProfile(draft);
    navigate('/onboarding/targets');
  }

  const numberField = (
    key: 'age' | 'weightKg' | 'heightCm',
    label: string,
    value: string,
    set: (v: string) => void,
    error: string | null,
  ) => (
    <Field label={label} error={show(key) ? error : null}>
      {(a) => (
        <input
          {...a}
          name={key}
          className={inputClass}
          type="number"
          inputMode="decimal"
          min={RANGES[key].min}
          max={RANGES[key].max}
          value={value}
          onChange={(e) => set(e.target.value)}
          onBlur={() => setTouched((x) => ({ ...x, [key]: true }))}
        />
      )}
    </Field>
  );

  return (
    <Screen title={t('profile.title')}>
      <Card>
        <Segmented
          name="sex"
          legend={t('profile.sex')}
          value={sex}
          options={SEXES.map((s) => ({ value: s, label: t(`profile.sexes.${s}`) }))}
          onChange={setSex}
        />
        <p className="-mt-1 mb-3 text-sm text-mu">{t('profile.sexHelp')}</p>
        {numberField('age', t('profile.age'), age, setAge, has('underage') ? null : has('age') ? rangeMsg('age') : null)}
        {has('underage') && (
          <p role="alert" className="mb-3 rounded-lg bg-wr-bg p-3 text-sm text-wr">
            {t('profile.underage')}
          </p>
        )}
        {numberField('weightKg', t('profile.weight'), weight, setWeight, has('weightKg') ? rangeMsg('weightKg') : null)}
        {numberField('heightCm', t('profile.height'), height, setHeight, has('heightCm') ? rangeMsg('heightCm') : null)}
      </Card>

      <Card>
        <Segmented
          name="goal"
          legend={t('profile.goal')}
          value={goal}
          options={GOALS.map((g) => ({ value: g, label: t(`profile.goals.${g}`) }))}
          onChange={setGoal}
          isDisabled={(g) => g === 'lose' && !loseAllowed}
        />
        {!loseAllowed && (
          <p role="status" className="mb-3 text-sm text-mu">
            {t('profile.loseBlocked', { bmi: bmi(draft.weightKg, draft.heightCm).toFixed(1) })}
          </p>
        )}
        <Segmented
          name="activity"
          legend={t('profile.activity')}
          value={activity}
          options={ACTIVITY_LEVELS.map((a) => ({ value: a, label: t(`profile.activities.${a}`) }))}
          onChange={setActivity}
        />
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('profile.sports')}</legend>
          {SPORTS.map((s) => {
            const checked = sports[s] !== undefined;
            return (
              <div key={s} className="mb-2 flex items-center gap-3">
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-ac"
                    checked={checked}
                    onChange={(e) =>
                      setSports((x) => {
                        const n = { ...x };
                        if (e.target.checked) n[s] = 3;
                        else delete n[s];
                        return n;
                      })
                    }
                  />
                  {t(`profile.sportsList.${s}`)}
                </label>
                {checked && (
                  <label className="flex items-center gap-2 text-sm">
                    {t('profile.daysPerWeek')}
                    <input
                      type="number"
                      className={`${inputClass} w-20`}
                      min={0}
                      max={7}
                      value={sports[s]}
                      aria-invalid={(sports[s] ?? 0) > 7 || (sports[s] ?? 0) < 0}
                      onChange={(e) => setSports((x) => ({ ...x, [s]: Number(e.target.value) }))}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </fieldset>
      </Card>

      <Disclaimer />
      <div className="flex gap-2">
        <Button onClick={() => navigate('/onboarding')}>{t('common.back')}</Button>
        <Button variant="primary" className="flex-1" disabled={!valid} onClick={onContinue}>
          {t('common.continue')}
        </Button>
      </div>
    </Screen>
  );
}
