/**
 * Gráficas SVG de una sola serie (sin leyenda: el título la nombra). Un eje,
 * cuadrícula discreta, línea de 2 px, marcadores ≥ 8 px con anillo de superficie,
 * barras con 2 px de separación y extremo redondeado, tooltip al pasar/enfocar
 * cada marca y tabla alternativa (accesibilidad).
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fmt } from '../../components/format';

const W = 340;
const PAD = { top: 16, right: 44, bottom: 22, left: 36 };

function shortDate(iso: string, lang: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
}

/** Ticks "bonitos" entre min y max (3–5). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function Tooltip({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.max(60, text.length * 6.4 + 12);
  const tx = Math.min(Math.max(x - w / 2, 2), W - w - 2);
  return (
    <g pointerEvents="none">
      <rect x={tx} y={Math.max(y - 30, 0)} width={w} height={22} rx={4} fill="var(--color-tx)" />
      <text x={tx + w / 2} y={Math.max(y - 30, 0) + 15} textAnchor="middle" fontSize={11} fill="var(--color-card)">
        {text}
      </text>
    </g>
  );
}

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  const { t } = useTranslation();
  return (
    <details className="mt-2 text-sm">
      <summary className="min-h-11 cursor-pointer py-2 text-mu">{t('progress.showTable')}</summary>
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{head.map((h) => <th key={h} className="py-1 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-bd">
              {r.map((c, j) => <td key={j} className="py-1 tabular-nums">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// ---- Peso: línea ---------------------------------------------------------------

export function WeightChart({ points, title }: { points: { date: string; kg: number }[]; title: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const H = 170;
  const kgs = points.map((p) => p.kg);
  const lo = Math.floor(Math.min(...kgs) - 0.5);
  const hi = Math.ceil(Math.max(...kgs) + 0.5);
  const ticks = niceTicks(lo, hi, 3);
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const x = (d: string) =>
    points.length === 1 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((Date.parse(d) - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((hi - kg) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={title} data-testid="weight-chart">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--color-bd)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--color-mu)">{fmt(v, lang)}</text>
          </g>
        ))}
        <text x={PAD.left} y={H - 4} fontSize={10} fill="var(--color-mu)">{shortDate(points[0].date, lang)}</text>
        {points.length > 1 && (
          <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize={10} fill="var(--color-mu)">{shortDate(last.date, lang)}</text>
        )}
        <path d={path} fill="none" stroke="var(--color-chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(p.date)} cy={y(p.kg)} r={4} fill="var(--color-chart)" stroke="var(--color-card)" strokeWidth={2} />
            <circle
              cx={x(p.date)}
              cy={y(p.kg)}
              r={12}
              fill="transparent"
              role="img"
              tabIndex={0}
              aria-label={`${shortDate(p.date, lang)}: ${fmt(p.kg, lang)} kg`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
        {/* etiqueta directa solo en el último valor */}
        <text x={x(last.date) + 8} y={y(last.kg) + 4} fontSize={11} fontWeight={600} fill="var(--color-tx)">
          {fmt(last.kg, lang)}
        </text>
        {hover !== null && (
          <Tooltip x={x(points[hover].date)} y={y(points[hover].kg)} text={`${shortDate(points[hover].date, lang)} · ${fmt(points[hover].kg, lang)} kg`} />
        )}
      </svg>
      <TableView
        caption={title}
        head={[t('progress.date'), t('progress.weightKg')]}
        rows={points.map((p) => [shortDate(p.date, lang), fmt(p.kg, lang)])}
      />
    </figure>
  );
}

// ---- kcal diarias: barras con marca de objetivo ----------------------------------

export interface KcalBar {
  date: string;
  kcal: number | null; // null = sin registro
  target: number;
}

export function KcalChart({ bars, title }: { bars: KcalBar[]; title: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [hover, setHover] = useState<number | null>(null);
  const H = 170;
  const max = Math.max(...bars.map((b) => Math.max(b.kcal ?? 0, b.target))) * 1.1;
  const ticks = niceTicks(0, max, 3);
  const top = ticks[ticks.length - 1] > max ? ticks[ticks.length - 1] : max;
  const innerW = W - PAD.left - PAD.right;
  const slot = innerW / bars.length;
  const bw = Math.max(slot - 2, 2); // 2 px de separación
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);
  const base = y(0);
  const label = (b: KcalBar) =>
    b.kcal === null
      ? `${shortDate(b.date, lang)} · ${t('progress.notLogged')}`
      : `${shortDate(b.date, lang)} · ${b.kcal} / ${b.target} kcal`;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={title} data-testid="kcal-chart">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--color-bd)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--color-mu)">{fmt(v, lang, 0)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x0 = PAD.left + i * slot + 1;
          const h = b.kcal ? base - y(b.kcal) : 0;
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={b.date}>
              {b.kcal ? (
                <path
                  d={`M${x0},${base} V${base - h + r} Q${x0},${base - h} ${x0 + r},${base - h} H${x0 + bw - r} Q${x0 + bw},${base - h} ${x0 + bw},${base - h + r} V${base} Z`}
                  fill="var(--color-chart)"
                />
              ) : (
                <circle cx={x0 + bw / 2} cy={base - 3} r={2} fill="var(--color-mu)" />
              )}
              {/* objetivo del día */}
              <line x1={x0 - 1} x2={x0 + bw + 1} y1={y(b.target)} y2={y(b.target)} stroke="var(--color-tx)" strokeWidth={2} strokeDasharray="3 2" />
              <rect
                x={x0 - 1}
                y={PAD.top}
                width={slot}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                role="img"
                tabIndex={0}
                aria-label={label(b)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        <text x={PAD.left} y={H - 4} fontSize={10} fill="var(--color-mu)">{shortDate(bars[0].date, lang)}</text>
        <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize={10} fill="var(--color-mu)">{shortDate(bars[bars.length - 1].date, lang)}</text>
        {hover !== null && (
          <Tooltip x={PAD.left + hover * slot + slot / 2} y={y(Math.max(bars[hover].kcal ?? 0, bars[hover].target))} text={label(bars[hover])} />
        )}
      </svg>
      <p className="mt-1 flex items-center gap-2 text-xs text-mu">
        <svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke="var(--color-tx)" strokeWidth="2" strokeDasharray="3 2" /></svg>
        {t('progress.targetLine')}
      </p>
      <TableView
        caption={title}
        head={[t('progress.date'), t('progress.kcalEaten'), t('progress.kcalTarget')]}
        rows={bars.map((b) => [shortDate(b.date, lang), b.kcal ?? '—', b.target])}
      />
    </figure>
  );
}

// ---- Actividad: franja de días ----------------------------------------------------

export function ActivityStrip({ days }: { days: { date: string; active: boolean }[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <ol className="flex gap-0.5" aria-label={t('progress.activityStrip')} data-testid="activity-strip">
      {days.map((d) => (
        <li
          key={d.date}
          title={`${shortDate(d.date, lang)}: ${d.active ? t('progress.active') : t('progress.inactive')}`}
          aria-label={`${shortDate(d.date, lang)}: ${d.active ? t('progress.active') : t('progress.inactive')}`}
          className={`h-6 flex-1 rounded ${d.active ? 'bg-chart' : 'border border-bd'}`}
        />
      ))}
    </ol>
  );
}
