import { useTranslation } from 'react-i18next';
import { foodName, foodQuality, type Food } from '../../domain/foods';

export const SOURCE_BADGE: Record<Food['source'], string> = {
  mine: 'bg-ac text-ac-tx',
  seed: 'border border-ac text-ac',
  off: 'border border-mu text-tx',
  usda: 'border border-mu text-tx',
};

const QUALITY_DOT: Record<string, string> = {
  curated: 'bg-ac',
  complete: 'bg-ac',
  incomplete: 'bg-wr',
};

export function SourceBadge({ food }: { food: Food }) {
  const { t } = useTranslation();
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${SOURCE_BADGE[food.source]}`}>
      {t(`food.sources.${food.source}`)}
    </span>
  );
}

/** Indicador de calidad: curado > completo > incompleto (SPEC §5). */
export function QualityBadge({ food }: { food: Food }) {
  const { t } = useTranslation();
  const q = foodQuality(food);
  if (q === 'curated') return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-mu" data-testid="quality">
      <span aria-hidden className={`inline-block size-2 rounded-full ${QUALITY_DOT[q]}`} />
      {t(`food.quality.${q}`)}
    </span>
  );
}

export function FoodRow({ food, onSelect }: { food: Food; onSelect: (f: Food) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const meta = [food.brand, food.countries?.map((c) => t(`countries.${c}`, { defaultValue: c })).join(', ')]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <button className="flex min-h-14 w-full items-center gap-2 px-3 py-2 text-left" onClick={() => onSelect(food)}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{foodName(food, lang)}</span>
          {meta && <span className="block truncate text-sm text-mu">{meta}</span>}
          <span className="block text-sm text-mu">
            {t('food.per100', { kcal: food.per100g.kcal })} · {t(`food.states.${food.state}`)}{' '}
            <QualityBadge food={food} />
          </span>
        </span>
        <SourceBadge food={food} />
      </button>
    </li>
  );
}
