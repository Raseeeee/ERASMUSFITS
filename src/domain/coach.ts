/**
 * Avisos y ajuste automático (SPEC §9). Reglas puras evaluadas a diario y al
 * registrar el peso. Tono amable: nunca ayuno, "compensar" ni castigos. Los
 * ajustes de kcal se PROPONEN; solo se aplican si el usuario confirma.
 */
import {
  adherence,
  daysBetween,
  inactiveStreak,
  sortWeights,
  weightNear,
  type DaySummary,
  type WeightEntry,
} from './progress';
import { addDays } from './log';
import type { Goal } from './types';

export type AlertId =
  | 'inactivity'
  | 'inactivitySoft'
  | 'plateau'
  | 'weightDrift'
  | 'tooFast'
  | 'lowProtein'
  | 'lowWater'
  | 'highSalt'
  | 'highSugar'
  | 'helpResources';

export type Severity = 'info' | 'warning';

export interface CoachAlert {
  id: AlertId;
  severity: Severity;
  /** Valores para el texto i18n. */
  params?: Record<string, number>;
  /** Propuesta que requiere confirmación del usuario. */
  action?: { type: 'adjustKcal'; delta: number };
}

export interface CoachInput {
  goal: Goal;
  today: string;
  /** Resúmenes diarios en orden ascendente, idealmente los últimos 28 días hasta hoy. */
  days: DaySummary[];
  weights: WeightEntry[];
  /** Primer día de uso (no se cuentan días anteriores como "inactivos"). */
  since: string;
  /** Fecha del último ajuste de kcal aceptado (para esperar a que haga efecto). */
  lastKcalAdjust?: string | null;
  /** Veces que el usuario ha intentado objetivos por debajo del suelo de seguridad. */
  lowTargetAttempts?: number;
}

export const RULES = {
  inactivityDays: 7,
  inactivitySoftDays: 4,
  plateauWindowDays: 14,
  plateauMinLoggedDays: 10,
  plateauMinAdherence: 0.8,
  plateauMinChangeKg: 0.2,
  driftKg: 1,
  adjustKcal: 150,
  driftAdjustKcal: 100,
  tooFastWeeklyPct: 0.01,
  lowProteinRatio: 0.8,
  lowProteinDays: 4,
  lowWaterRatio: 0.5,
  repeatedDays: 3,
  repeatedWindow: 7,
  helpAfterLowAttempts: 2,
} as const;

/** Días completos (antes de hoy) dentro de la lista. */
function completed(input: CoachInput): DaySummary[] {
  return input.days.filter((d) => d.date < input.today && d.date >= input.since);
}

export function evaluateCoach(input: CoachInput): CoachAlert[] {
  const alerts: CoachAlert[] = [];
  const done = completed(input);
  const lastWeek = done.slice(-RULES.repeatedWindow).filter((d) => d.logged);

  // 1. Actividad (lose/recomp): días seguidos sin entreno registrado.
  if (input.goal === 'lose' || input.goal === 'recomp') {
    const used = input.days.filter((d) => d.date >= input.since && d.date <= input.today);
    const streak = inactiveStreak(used);
    if (streak >= RULES.inactivityDays) alerts.push({ id: 'inactivity', severity: 'warning', params: { days: streak } });
    else if (streak >= RULES.inactivitySoftDays) alerts.push({ id: 'inactivitySoft', severity: 'info', params: { days: streak } });
  }

  // 2. Peso: ritmo demasiado rápido (> 1 %/semana dos semanas seguidas).
  const ws = sortWeights(input.weights);
  const latest = ws[ws.length - 1];
  let tooFast = false;
  if (latest) {
    const w1 = weightNear(ws, latest.date, 7);
    const w2 = weightNear(ws, latest.date, 14);
    if (w1 && w2 && w1.date !== latest.date && w2.date !== w1.date) {
      const loss1 = (w2.kg - w1.kg) / w2.kg;
      const loss2 = (w1.kg - latest.kg) / w1.kg;
      if (loss1 > RULES.tooFastWeeklyPct && loss2 > RULES.tooFastWeeklyPct) {
        tooFast = true;
        alerts.push({
          id: 'tooFast',
          severity: 'warning',
          params: { pct: Math.round(((loss1 + loss2) / 2) * 1000) / 10 },
          action: { type: 'adjustKcal', delta: RULES.adjustKcal },
        });
      }
    }
  }

  // 3. Cumple macros pero el peso no va en la dirección esperada (2 semanas).
  const canAdjust = !input.lastKcalAdjust || daysBetween(input.lastKcalAdjust, input.today) >= RULES.plateauWindowDays;
  if (!tooFast && latest && canAdjust) {
    const start = weightNear(ws, latest.date, RULES.plateauWindowDays);
    const windowDays = done.filter((d) => d.date > addDays(input.today, -RULES.plateauWindowDays - 1));
    const loggedDays = windowDays.filter((d) => d.logged).length;
    const adh = adherence(windowDays);
    if (start && start.date !== latest.date && loggedDays >= RULES.plateauMinLoggedDays && adh !== null && adh >= RULES.plateauMinAdherence) {
      const change = latest.kg - start.kg;
      const kg = Math.round(Math.abs(change) * 10) / 10;
      if (input.goal === 'lose' && change > -RULES.plateauMinChangeKg) {
        alerts.push({ id: 'plateau', severity: 'info', params: { kg }, action: { type: 'adjustKcal', delta: -RULES.adjustKcal } });
      } else if (input.goal === 'gain' && change < RULES.plateauMinChangeKg) {
        alerts.push({ id: 'plateau', severity: 'info', params: { kg }, action: { type: 'adjustKcal', delta: RULES.adjustKcal } });
      } else if ((input.goal === 'maintain' || input.goal === 'recomp') && Math.abs(change) > RULES.driftKg) {
        alerts.push({
          id: 'weightDrift',
          severity: 'info',
          params: { kg, up: change > 0 ? 1 : 0 },
          action: { type: 'adjustKcal', delta: change > 0 ? -RULES.driftAdjustKcal : RULES.driftAdjustKcal },
        });
      }
    }
  }

  // 4. Proteína < 80 % del objetivo 4 días seguidos (registrados).
  const lastN = done.slice(-RULES.lowProteinDays);
  if (
    lastN.length === RULES.lowProteinDays &&
    lastN.every((d) => d.logged && d.totals.p < d.targets.protein * RULES.lowProteinRatio)
  ) {
    alerts.push({ id: 'lowProtein', severity: 'info', params: { days: RULES.lowProteinDays } });
  }

  // 5. Agua < 50 % varios días; sal/azúcar por encima del tope repetidamente.
  const count = (pred: (d: DaySummary) => boolean) => lastWeek.filter(pred).length;
  const water = count((d) => d.waterGlasses < d.targets.waterGlasses * RULES.lowWaterRatio);
  if (water >= RULES.repeatedDays) alerts.push({ id: 'lowWater', severity: 'info', params: { days: water } });
  const salt = count((d) => d.totals.salt > d.targets.saltMax);
  if (salt >= RULES.repeatedDays) alerts.push({ id: 'highSalt', severity: 'info', params: { days: salt } });
  const sugar = count((d) => d.totals.sugar > d.targets.sugarMax);
  if (sugar >= RULES.repeatedDays) alerts.push({ id: 'highSugar', severity: 'info', params: { days: sugar } });

  // 6. Objetivos muy bajos de forma repetida: recursos de ayuda.
  if ((input.lowTargetAttempts ?? 0) >= RULES.helpAfterLowAttempts) {
    alerts.push({ id: 'helpResources', severity: 'warning' });
  }

  return alerts;
}

/** Oculta los avisos descartados hace menos de `days` días. */
export function visibleAlerts(
  alerts: CoachAlert[],
  dismissed: Record<string, string>,
  today: string,
  days = 7,
): CoachAlert[] {
  return alerts.filter((a) => {
    const when = dismissed[a.id];
    return !when || daysBetween(when, today) >= days;
  });
}

/** Ajuste de kcal acumulado permitido (±500). */
export const MAX_KCAL_ADJUSTMENT = 500;
export function clampAdjustment(total: number): number {
  return Math.max(-MAX_KCAL_ADJUSTMENT, Math.min(MAX_KCAL_ADJUSTMENT, total));
}
