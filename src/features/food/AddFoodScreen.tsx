import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Card, Field, Screen, Segmented, inputClass } from '../../components/ui';
import { fmt } from '../../components/format';
import { useDebounced } from '../../components/useDebounced';
import { seedFoods } from '../../data/foods';
import {
  canteenExtraFat,
  foodName,
  gramsFor,
  localized,
  nutrientsFor,
  searchFoods,
  type CookingContext,
  type Food,
} from '../../domain/foods';
import { MEALS, defaultMealForHour, isMeal, type Meal } from '../../domain/log';
import { addEntry, deleteEntry, getEntry, listMyFoods, updateEntry } from '../../store/logRepo';
import { useSelectedDate } from '../today/useSelectedDate';
import { MyFoodEditor } from './MyFoodEditor';

const SOURCE_BADGE: Record<Food['source'], string> = {
  mine: 'bg-ac text-ac-tx',
  seed: 'border border-ac text-ac',
  off: 'border border-bd text-mu',
  usda: 'border border-bd text-mu',
};

export function AddFoodScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [date] = useSelectedDate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const mealParam = params.get('meal');

  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 300);
  const [selected, setSelected] = useState<Food | null>(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<'g' | 'unit'>('g');
  const [context, setContext] = useState<CookingContext>('home');
  const [editor, setEditor] = useState<null | { base?: Food }>(null);
  const [meal, setMeal] = useState<Meal>(isMeal(mealParam) ? mealParam : defaultMealForHour(new Date().getHours()));

  // Modo edición: carga la entrada una sola vez y rellena el formulario.
  const entry = useLiveQuery(() => (editId ? getEntry(editId).then((e) => e ?? null) : null), [editId]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  useEffect(() => {
    if (!entry || entry.id === loadedId) return;
    setLoadedId(entry.id);
    const food = entry.food ?? seedFoods.find((f) => f.id === entry.foodId);
    if (!food) return;
    setSelected(food);
    setContext(entry.context);
    setMeal(entry.meal);
    if (food.unit && entry.grams % food.unit.grams === 0) {
      setUnit('unit');
      setQty(String(entry.grams / food.unit.grams));
    } else {
      setUnit('g');
      setQty(String(entry.grams));
    }
  }, [entry, loadedId]);
  const editing = !!editId;
  const backToToday = () => navigate(`/today?date=${date}`);

  const myFoods = useLiveQuery(listMyFoods, []) ?? [];
  const results = useMemo(
    () => searchFoods(debounced, [...myFoods, ...seedFoods], lang, 30),
    [debounced, myFoods, lang],
  );

  function select(food: Food) {
    setSelected(food);
    setEditor(null);
    if (food.unit) {
      setUnit('unit');
      setQty('1');
    } else {
      setUnit('g');
      setQty('100');
    }
  }

  const quantity = Number(qty.replace(',', '.'));
  const grams = selected && quantity > 0 ? gramsFor(selected, quantity, unit) : 0;
  const preview = selected && grams > 0 ? nutrientsFor(selected, grams, context) : null;

  async function add() {
    if (!selected || !preview) return;
    if (editId) await updateEntry(editId, selected, { grams, context, meal });
    else await addEntry(date, meal, selected, grams, context);
    backToToday();
  }

  async function remove() {
    if (!editId) return;
    await deleteEntry(editId);
    backToToday();
  }

  const title = editing ? t('food.editTitle') : t('food.addTitle');

  if (editing && entry === null) {
    return (
      <Screen title={title}>
        <p className="mb-3 text-mu">{t('food.entryNotFound')}</p>
        <Button onClick={backToToday}>{t('common.back')}</Button>
      </Screen>
    );
  }

  if (editing && (entry === undefined || (entry && loadedId !== entry.id))) return null;

  if (editor) {
    return (
      <Screen title={title}>
        <MyFoodEditor
          base={editor.base}
          initialName={editor.base ? '' : query}
          onSaved={select}
          onCancel={() => setEditor(null)}
        />
      </Screen>
    );
  }

  if (selected) {
    return (
      <Screen title={title}>
        <Card>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold">{foodName(selected, lang)}</h2>
            <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${SOURCE_BADGE[selected.source]}`}>
              {t(`food.sources.${selected.source}`)}
            </span>
          </div>
          <p className="mb-3 rounded-lg bg-bg p-2 text-sm" role="note">
            {t(`food.stateHint.${selected.state}`)}
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label={t('food.quantity')}>
                {(a) => (
                  <input
                    {...a}
                    name="quantity"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className={inputClass}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <div className="flex-1">
              <Field label={t('food.unit')}>
                {(a) => (
                  <select {...a} className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value as 'g' | 'unit')}>
                    <option value="g">{t('food.grams')}</option>
                    {selected.unit && (
                      <option value="unit">
                        {t('food.unitOption', { name: localized(selected.unit.name, lang), grams: selected.unit.grams })}
                      </option>
                    )}
                  </select>
                )}
              </Field>
            </div>
          </div>
          <Segmented
            name="context"
            legend={t('food.context')}
            value={context}
            options={(['home', 'canteen'] as const).map((c) => ({ value: c, label: t(`food.contexts.${c}`) }))}
            onChange={setContext}
          />
          {context === 'canteen' && canteenExtraFat(selected) > 0 && (
            <p className="-mt-1 mb-3 text-sm text-mu">{t('food.canteenHint', { fat: canteenExtraFat(selected) })}</p>
          )}
          <Segmented
            name="meal"
            legend={t('food.meal')}
            value={meal}
            options={MEALS.map((m) => ({ value: m, label: t(`meals.${m}`) }))}
            onChange={setMeal}
          />
          <p className="mb-3 font-medium tabular-nums" data-testid="preview" aria-live="polite">
            {preview &&
              t('food.preview', {
                grams: Math.round(grams),
                kcal: preview.kcal,
                p: fmt(preview.p, lang),
                c: fmt(preview.c, lang),
                f: fmt(preview.f, lang),
              })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="flex-1" disabled={!preview} onClick={add}>
              {editing ? t('food.saveChanges') : t('food.add')}
            </Button>
            <Button onClick={() => setSelected(null)}>{t('food.change')}</Button>
          </div>
          <Button className="mt-2 w-full" onClick={() => setEditor({ base: selected })}>
            {t('food.editMacros')}
          </Button>
          {editing && (
            <Button variant="danger" className="mt-2 w-full" onClick={remove}>
              {t('food.deleteEntry')}
            </Button>
          )}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={title}>
      <Field label={t('food.search')}>
        {(a) => (
          <input
            {...a}
            type="search"
            autoFocus
            className={inputClass}
            placeholder={t('food.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </Field>
      {results.length === 0 && debounced.trim() !== '' && (
        <p className="mb-3 text-mu">{t('food.noResults', { q: debounced })}</p>
      )}
      <ul className="mb-4 divide-y divide-bd rounded-xl border border-bd bg-card" aria-label={t('food.results')}>
        {results.map((f) => (
          <li key={f.id}>
            <button className="flex min-h-14 w-full items-center gap-2 px-3 py-2 text-left" onClick={() => select(f)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{foodName(f, lang)}</span>
                <span className="block text-sm text-mu">
                  {t('food.per100', { kcal: f.per100g.kcal })} · {t(`food.states.${f.state}`)}
                </span>
              </span>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${SOURCE_BADGE[f.source]}`}>
                {t(`food.sources.${f.source}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button className="w-full" onClick={() => setEditor({})}>
        {t('food.createNew')}
      </Button>
    </Screen>
  );
}
