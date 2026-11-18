import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { isBarcode, rankExternal } from '../../domain/external';
import type { Food } from '../../domain/foods';
import type { ExternalResult } from '../../store/externalFoods';
import { FoodRow } from './FoodRow';

export type ExternalState =
  | { phase: 'idle' }
  | { phase: 'loading'; query: string }
  | { phase: 'done'; query: string; results: ExternalResult[] };

/** Bloque de búsqueda en Open Food Facts + USDA (acción explícita: OFF no permite buscar mientras se escribe). */
export function ExternalResults({
  query,
  state,
  country,
  excludeIds,
  onSearch,
  onSelect,
}: {
  query: string;
  state: ExternalState;
  country?: string;
  excludeIds: Set<string>;
  onSearch: () => void;
  onSelect: (f: Food) => void;
}) {
  const { t } = useTranslation();
  const q = query.trim();
  const barcode = isBarcode(q);
  const canSearch = barcode || q.length >= 3;
  const current = state.phase !== 'idle' && state.query === q;
  const results = current && state.phase === 'done' ? state.results : [];
  const foods = rankExternal(results.map((r) => r.foods), country, excludeIds);
  const problems = results.filter((r) => r.status !== 'ok');
  const sources = new Set(foods.map((f) => f.source));

  return (
    <section aria-labelledby="external-title" className="mb-4">
      <h2 id="external-title" className="mb-1 font-semibold">{t('food.external.title')}</h2>
      <p className="mb-2 text-sm text-mu">{t('food.external.hint')}</p>
      <Button
        className="mb-3 w-full"
        disabled={!canSearch || (current && state.phase === 'loading')}
        onClick={onSearch}
      >
        {current && state.phase === 'loading'
          ? t('food.external.loading')
          : barcode
            ? t('food.external.barcodeButton')
            : t('food.external.searchButton')}
      </Button>

      {problems.length > 0 && (
        <ul className="mb-2 text-sm text-mu" role="status">
          {problems.map((p) => (
            <li key={p.source}>{t(`food.external.status.${p.status}`, { source: t(`food.sources.${p.source}`) })}</li>
          ))}
        </ul>
      )}
      {current && state.phase === 'done' && foods.length === 0 && problems.length === 0 && (
        <p className="mb-2 text-sm text-mu">{t('food.external.none')}</p>
      )}
      {foods.length > 0 && (
        <>
          <ul
            className="mb-2 divide-y divide-bd rounded-xl border border-bd bg-card"
            aria-label={t('food.external.title')}
          >
            {foods.map((f) => (
              <FoodRow key={f.id} food={f} onSelect={onSelect} />
            ))}
          </ul>
          <p className="text-xs text-mu">
            {sources.has('off') && (
              <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">
                {t('food.attribution.off')}
              </a>
            )}{' '}
            {sources.has('usda') && <span>{t('food.attribution.usda')}</span>}
          </p>
        </>
      )}
    </section>
  );
}
