import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button, Card, Segmented, inputClass } from '../../components/ui';
import { fmt } from '../../components/format';
import { nutrientsFor, sumNutrients } from '../../domain/foods';
import { MEALS, type Meal } from '../../domain/log';
import { photoItemToFood, type PhotoEstimate } from '../../domain/photoEstimate';
import { addEntry } from '../../store/logRepo';

type Phase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; code: string }
  | { phase: 'done'; estimate: PhotoEstimate };

const MAX_SIDE = 1024;

/** Reduce la foto a ≤1024 px y la devuelve como JPEG en base64 (sin el prefijo data:). */
async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.8),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function requestEstimate(image: string, lang: string): Promise<PhotoEstimate> {
  const res = await fetch('/api/photo-estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, lang }),
  });
  const data = (await res.json().catch(() => ({}))) as PhotoEstimate & { error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? 'upstream_error');
  return data;
}

/** Foto del plato → ingredientes, gramos y nutrientes estimados, editables antes de añadirlos. */
export function PhotoEstimator({
  date,
  initialMeal,
  onDone,
  onCancel,
}: {
  date: string;
  initialMeal: Meal;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<Phase>({ phase: 'idle' });
  const [grams, setGrams] = useState<string[]>([]);
  const [included, setIncluded] = useState<boolean[]>([]);
  const [meal, setMeal] = useState<Meal>(initialMeal);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setState({ phase: 'loading' });
    try {
      const image = await toJpegBase64(file);
      const estimate = await requestEstimate(image, lang);
      setGrams(estimate.items.map((i) => String(i.grams)));
      setIncluded(estimate.items.map(() => true));
      setState({ phase: 'done', estimate });
    } catch (e) {
      const code = !navigator.onLine ? 'offline' : e instanceof Error ? e.message : 'upstream_error';
      setState({ phase: 'error', code });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const items = state.phase === 'done' ? state.estimate.items : [];
  const rows = items.map((item, i) => {
    const g = Number((grams[i] ?? '').replace(',', '.'));
    const food = photoItemToFood(item, `photo-${i}`);
    return { item, food, g, n: g > 0 ? nutrientsFor(food, g) : null };
  });
  const chosen = rows.filter((r, i) => included[i] && r.n);
  const total = sumNutrients(chosen.map((r) => r.n!));

  async function addAll() {
    for (const r of chosen) {
      await addEntry(date, meal, photoItemToFood(r.item, `photo-${crypto.randomUUID()}`), r.g, 'home');
    }
    onDone();
  }

  const picker = (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        data-testid="photo-input"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <label
        htmlFor={inputId}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-ac bg-ac px-4 font-medium text-ac-tx"
      >
        {state.phase === 'done' ? t('photo.retake') : t('photo.take')}
      </label>
    </>
  );

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">{t('photo.title')}</h2>
      <p className="mb-3 text-sm text-mu">{t('photo.intro')}</p>

      {state.phase === 'loading' ? (
        <p className="mb-3 font-medium" role="status">
          {t('photo.loading')}
        </p>
      ) : (
        <div className="mb-3">{picker}</div>
      )}

      {state.phase === 'error' && (
        <p className="mb-3 rounded-lg bg-wr-bg p-2 text-sm text-wr" role="alert">
          {t(`photo.errors.${['offline', 'rate_limited', 'not_configured'].includes(state.code) ? state.code : 'generic'}`)}
        </p>
      )}

      {state.phase === 'done' && !state.estimate.isFood && (
        <p className="mb-3 rounded-lg bg-bg p-2 text-sm" role="alert">
          {t('photo.notFood')}
        </p>
      )}

      {state.phase === 'done' && state.estimate.isFood && (
        <>
          <p className="mb-2 rounded-lg bg-bg p-2 text-sm" role="note">
            {t('photo.reviewHint')}
          </p>
          <ul className="mb-3 divide-y divide-bd rounded-xl border border-bd" aria-label={t('photo.itemsLabel')}>
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2 p-2" data-testid="photo-item">
                <input
                  type="checkbox"
                  className="size-6 shrink-0 accent-ac"
                  aria-label={t('photo.include', { name: r.item.name })}
                  checked={included[i] ?? false}
                  onChange={(e) => setIncluded((v) => v.map((x, j) => (j === i ? e.target.checked : x)))}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.item.name}</p>
                  <p className="text-sm tabular-nums text-mu">
                    {r.n ? t('photo.itemMacros', { kcal: r.n.kcal, p: fmt(r.n.p, lang), c: fmt(r.n.c, lang), f: fmt(r.n.f, lang) }) : '—'}
                  </p>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  className={`${inputClass} w-24`}
                  aria-label={t('photo.gramsOf', { name: r.item.name })}
                  value={grams[i] ?? ''}
                  onChange={(e) => setGrams((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <span aria-hidden className="text-sm text-mu">
                  g
                </span>
              </li>
            ))}
          </ul>
          <p className="mb-3 font-semibold tabular-nums" data-testid="photo-total" aria-live="polite">
            {t('photo.total', {
              kcal: total.kcal,
              p: fmt(total.p, lang),
              c: fmt(total.c, lang),
              f: fmt(total.f, lang),
              fiber: fmt(total.fiber, lang),
            })}
          </p>
          <Segmented
            name="photo-meal"
            legend={t('food.meal')}
            value={meal}
            options={MEALS.map((m) => ({ value: m, label: t(`meals.${m}`) }))}
            onChange={setMeal}
          />
          <Button variant="primary" className="mb-2 w-full" disabled={chosen.length === 0} onClick={() => void addAll()}>
            {t('photo.addAll', { count: chosen.length })}
          </Button>
        </>
      )}

      <p className="mb-3 text-xs text-mu">
        {t('photo.privacy')}{' '}
        <Link to="/privacy" className="text-ac underline">
          {t('settings.privacy')}
        </Link>
      </p>
      <Button className="w-full" onClick={onCancel}>
        {t('common.back')}
      </Button>
    </Card>
  );
}
