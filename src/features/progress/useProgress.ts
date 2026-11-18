import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { evaluateCoach, visibleAlerts, type CoachAlert } from '../../domain/coach';
import { addDays, localISODate } from '../../domain/log';
import { buildDaySummaries, dateRange, type DaySummary, type WeightEntry } from '../../domain/progress';
import { useAppStore } from '../../store/appStore';
import { firstUseDate, listDaysRange, listEntriesRange, listWeights } from '../../store/progressRepo';

export const PROGRESS_DAYS = 28;

export interface ProgressData {
  today: string;
  days: DaySummary[];
  weights: WeightEntry[];
  alerts: CoachAlert[];
}

/** Últimos 28 días + pesos + avisos visibles del coach (null mientras carga). */
export function useProgress(): ProgressData | null {
  const { profile, overrides, dismissedAlerts, lastKcalAdjust, lowTargetAttempts } = useAppStore();
  const today = localISODate();
  const from = addDays(today, -(PROGRESS_DAYS - 1));
  const entries = useLiveQuery(() => listEntriesRange(from, today), [from, today]);
  const dayRecs = useLiveQuery(() => listDaysRange(from, today), [from, today]);
  const weights = useLiveQuery(listWeights, []);
  const since = useLiveQuery(firstUseDate, [entries?.length, dayRecs?.length, weights?.length]);

  return useMemo(() => {
    if (!profile || !entries || !dayRecs || !weights || !since) return null;
    const days = buildDaySummaries(dateRange(from, today), entries, dayRecs, profile, overrides);
    const alerts = visibleAlerts(
      evaluateCoach({ goal: profile.goal, today, days, weights, since, lastKcalAdjust, lowTargetAttempts }),
      dismissedAlerts,
      today,
    );
    return { today, days, weights, alerts };
  }, [profile, overrides, entries, dayRecs, weights, since, from, today, dismissedAlerts, lastKcalAdjust, lowTargetAttempts]);
}
