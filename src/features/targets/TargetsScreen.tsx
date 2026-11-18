import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { Button, Card, Disclaimer, Screen, inputClass } from '../../components/ui';
import {
  bmr,
  checkOverride,
  computeAllTargets,
  kcalFloor,
  maintenanceKcal,
  type OverrideIssue,
} from '../../domain/targets';
import type { DayType, Targets } from '../../domain/types';
import { useAppStore } from '../../store/appStore';

const METRICS: (keyof Targets)[] = [
  'kcal', 'protein', 'carbs', 'fat', 'fiber', 'saltMax', 'sugarMax', 'sugarIdeal', 'waterGlasses',
];
/** Intentos de kcal bajo el suelo a partir de los cuales mostramos recursos de ayuda. */
const HELP_AFTER_LOW_ATTEMPTS = 2;

export function TargetsScreen({ onboarding = false }: { onboarding?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, overrides, setOverride, completeOnboarding } = useAppStore();
  const [editing, setEditing] = useState<DayType | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<OverrideIssue[]>([]);
  const [lowAttempts, setLowAttempts] = useState(0);

  const computed = useMemo(() => (profile ? computeAllTargets(profile) : []), [profile]);
  if (!profile) return <Navigate to="/onboarding/profile" replace />;

  const floor = Math.round(kcalFloor(profile.sex, bmr(profile.sex, profile.weightKg, profile.heightCm, profile.age)));
  const effective = (d: DayType, c: Targets) => overrides[d] ?? c;
  const warnings = [...new Set(computed.flatMap((d) => d.warnings))];

  function startEdit(d: DayType, current: Targets) {
    setEditing(d);
    setIssues([]);
    setDraft(Object.fromEntries(METRICS.map((m) => [m, String(current[m])])));
  }

  async function saveEdit() {
    if (!editing || !profile) return;
    const values = Object.fromEntries(METRICS.map((m) => [m, Number(draft[m]) || 0])) as unknown as Targets;
    const r = checkOverride(profile, values);
    if (r.issues.includes('kcalBelowFloor')) setLowAttempts((n) => n + 1);
    await setOverride(editing, r.accepted);
    setIssues(r.issues);
    if (r.issues.length === 0) setEditing(null);
    else setDraft(Object.fromEntries(METRICS.map((m) => [m, String(r.accepted[m])])));
  }

  async function finish() {
    await completeOnboarding();
    navigate('/today');
  }

  return (
    <Screen title={t('targets.title')}>
      <p className="mb-1 text-mu">{t('targets.subtitle')}</p>
      <p className="mb-4 text-sm text-mu">{t('targets.maintenance', { kcal: maintenanceKcal(profile) })}</p>

      {warnings.length > 0 && (
        <Card className="border-wr">
          <ul className="list-disc pl-5 text-sm" role="status">
            {warnings.map((w) => (
              <li key={w}>{t(`targets.warnings.${w}`)}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm" aria-label={t('targets.title')}>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-left">{t('targets.metric')}</th>
              {computed.map(({ dayType: d }) => (
                <th key={d} scope="col" className="p-2 text-right">
                  {t(`dayTypes.${d}`)}
                  {overrides[d] && <span className="block text-xs font-normal text-mu">{t('targets.edited')}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m} className="border-t border-bd">
                <th scope="row" className="p-2 text-left font-normal">{t(`targets.metrics.${m}`)}</th>
                {computed.map(({ dayType: d, targets: c }) => (
                  <td key={d} className="p-2 text-right tabular-nums" data-testid={`target-${d}-${m}`}>
                    {effective(d, c)[m]}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-bd">
              <td />
              {computed.map(({ dayType: d, targets: c }) => (
                <td key={d} className="p-2 text-right">
                  <Button className="px-3 text-sm" onClick={() => startEdit(d, effective(d, c))}>
                    {t('common.edit')}
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>

      {editing && (
        <Card>
          <h2 className="mb-3 font-semibold">{t('targets.editTitle', { day: t(`dayTypes.${editing}`) })}</h2>
          <div className="grid grid-cols-2 gap-x-3">
            {METRICS.map((m) => (
              <label key={m} className="mb-3 block text-sm">
                <span className="mb-1 block">{t(`targets.metrics.${m}`)}</span>
                <input
                  name={m}
                  type="number"
                  inputMode="numeric"
                  className={inputClass}
                  value={draft[m] ?? ''}
                  onChange={(e) => setDraft((x) => ({ ...x, [m]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          {issues.length > 0 && (
            <ul className="mb-3 list-disc rounded-lg bg-wr-bg p-3 pl-6 text-sm text-wr" role="alert">
              {issues.map((i) => (
                <li key={i}>{t(`targets.issues.${i}`, { floor })}</li>
              ))}
            </ul>
          )}
          {lowAttempts >= HELP_AFTER_LOW_ATTEMPTS && (
            <p className="mb-3 rounded-lg border border-bd p-3 text-sm" role="note">
              {t('targets.helpResources')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={saveEdit}>{t('common.save')}</Button>
            <Button
              onClick={async () => {
                await setOverride(editing, null);
                setEditing(null);
                setIssues([]);
              }}
            >
              {t('common.reset')}
            </Button>
            <Button onClick={() => { setEditing(null); setIssues([]); }}>{t('common.cancel')}</Button>
          </div>
        </Card>
      )}

      <Disclaimer />
      {onboarding && (
        <div className="flex gap-2">
          <Button onClick={() => navigate('/onboarding/profile')}>{t('common.back')}</Button>
          <Button variant="primary" className="flex-1" onClick={finish}>
            {t('targets.start')}
          </Button>
        </div>
      )}
    </Screen>
  );
}
