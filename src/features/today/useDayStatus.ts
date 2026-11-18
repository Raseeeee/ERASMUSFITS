import { useLiveQuery } from 'dexie-react-hooks';
import { dayTotals, emptyDay, remaining, targetsForDay, type Remaining } from '../../domain/log';
import { getDay, listEntries } from '../../store/logRepo';
import { useAppStore } from '../../store/appStore';

/** Lo que queda del día `date` (kcal y macros), o null mientras carga o sin perfil. */
export function useRemaining(date: string): Remaining | null {
  const { profile, overrides } = useAppStore();
  const day = useLiveQuery(() => getDay(date), [date]);
  const entries = useLiveQuery(() => listEntries(date), [date]);
  if (!profile || !entries) return null;
  const t = targetsForDay(profile, (day ?? emptyDay(date)).dayType, overrides);
  return remaining(dayTotals(entries), t);
}
