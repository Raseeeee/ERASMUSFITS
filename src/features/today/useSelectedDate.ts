import { useSearchParams } from 'react-router';
import { isISODate, localISODate } from '../../domain/log';

/** Fecha seleccionada en `?date=YYYY-MM-DD` (por defecto, hoy en hora local). */
export function useSelectedDate(): [string, (d: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('date');
  const date = isISODate(raw) ? raw : localISODate();
  const setDate = (d: string) => setParams(d === localISODate() ? {} : { date: d }, { replace: true });
  return [date, setDate];
}
