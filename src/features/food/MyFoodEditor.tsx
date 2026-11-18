import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Segmented, inputClass } from '../../components/ui';
import {
  canteenExtraFat,
  foodName,
  kcalFromMacros,
  makeMyFood,
  localized,
  type Food,
  type FoodState,
} from '../../domain/foods';
import { newMyFoodId, saveMyFood } from '../../store/logRepo';

type NumField = 'p' | 'c' | 'f' | 'fiber' | 'sugar' | 'salt' | 'canteenFat' | 'unitGrams';
const NUM_FIELDS: NumField[] = ['p', 'c', 'f', 'fiber', 'sugar', 'salt', 'canteenFat'];

/** Crea o corrige un alimento con macros propios. Se guarda como "mío" y tiene prioridad. */
export function MyFoodEditor({
  base,
  initialName = '',
  onSaved,
  onCancel,
}: {
  base?: Food;
  initialName?: string;
  onSaved: (f: Food) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [name, setName] = useState(base ? foodName(base, lang) : initialName);
  const [state, setState] = useState<FoodState>(base?.state ?? 'cooked');
  const [unitName, setUnitName] = useState(base?.unit ? localized(base.unit.name, lang) : '');
  const [nums, setNums] = useState<Record<NumField, string>>({
    p: String(base?.per100g.p ?? ''),
    c: String(base?.per100g.c ?? ''),
    f: String(base?.per100g.f ?? ''),
    fiber: String(base?.per100g.fiber ?? ''),
    sugar: String(base?.per100g.sugar ?? ''),
    salt: String(base?.per100g.salt ?? ''),
    canteenFat: String(base ? canteenExtraFat(base) : 0),
    unitGrams: String(base?.unit?.grams ?? ''),
  });

  const n = (k: NumField) => {
    const v = Number(nums[k].replace(',', '.'));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const kcal = kcalFromMacros({ p: n('p'), c: n('c'), f: n('f'), fiber: n('fiber') });
  const tooMuch = n('p') + n('c') + n('f') + n('fiber') > 100;
  const valid = name.trim() !== '' && !tooMuch;

  async function save() {
    if (!valid) return;
    const isMine = base?.source === 'mine';
    const food = makeMyFood({
      id: isMine ? base!.id : newMyFoodId(),
      name: name.trim(),
      p: n('p'),
      c: n('c'),
      f: n('f'),
      fiber: n('fiber'),
      sugar: Math.min(n('sugar'), n('c')),
      salt: n('salt'),
      state,
      category: base?.category,
      canteenExtraFatPer100g: n('canteenFat'),
      unit: { name: unitName.trim(), grams: n('unitGrams') },
      overridesId: base ? (isMine ? base.overridesId : base.id) : undefined,
    });
    onSaved(await saveMyFood(food));
  }

  const numInput = (k: NumField, label: string) => (
    <label key={k} className="mb-3 block text-sm">
      <span className="mb-1 block">{label}</span>
      <input
        name={k}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        className={inputClass}
        value={nums[k]}
        onChange={(e) => setNums((x) => ({ ...x, [k]: e.target.value }))}
      />
    </label>
  );

  return (
    <Card>
      <h2 className="mb-3 font-semibold">{t('food.myFoodTitle')}</h2>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block">{t('food.fields.name')}</span>
        <input name="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <Segmented
        name="state"
        legend={t('food.fields.state')}
        value={state}
        options={(['cooked', 'raw'] as const).map((s) => ({ value: s, label: t(`food.states.${s}`) }))}
        onChange={setState}
      />
      <div className="grid grid-cols-2 gap-x-3">
        {NUM_FIELDS.map((k) => numInput(k, t(`food.fields.${k}`)))}
        <label className="mb-3 block text-sm">
          <span className="mb-1 block">{t('food.fields.unitName')}</span>
          <input name="unitName" className={inputClass} value={unitName} onChange={(e) => setUnitName(e.target.value)} />
        </label>
        {numInput('unitGrams', t('food.fields.unitGrams'))}
      </div>
      <p className="mb-3 text-sm text-mu" aria-live="polite">{t('food.kcalAuto', { kcal })}</p>
      {tooMuch && (
        <p role="alert" className="mb-3 text-sm text-wr">
          {t('food.invalidMacros')}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="primary" disabled={!valid} onClick={save}>
          {t('food.saveMine')}
        </Button>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </Card>
  );
}
