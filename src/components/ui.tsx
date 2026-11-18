import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-4">
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mb-4 rounded-xl border border-bd bg-card p-4 ${className}`}>{children}</section>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' };

export function Button({ variant = 'secondary', className = '', ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-ac text-ac-tx border-ac',
    secondary: 'bg-bg text-tx border-bd',
    danger: 'bg-wr-bg text-wr border-wr',
  }[variant];
  return (
    <button
      className={`min-h-11 rounded-lg border px-4 font-medium disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    />
  );
}

export const inputClass =
  'min-h-11 w-full rounded-lg border border-bd bg-bg px-3 text-tx aria-[invalid=true]:border-wr';

export function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string | null;
  help?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || help ? descId : undefined })}
      {(error || help) && (
        <p id={descId} className={`mt-1 text-sm ${error ? 'text-wr' : 'text-mu'}`} role={error ? 'alert' : undefined}>
          {error ?? help}
        </p>
      )}
    </div>
  );
}

/** Grupo de opciones tipo radio con botones grandes (≥44 px). */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  isDisabled,
  name,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  isDisabled?: (v: T) => boolean;
  name: string;
}) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value === o.value;
          const disabled = isDisabled?.(o.value) ?? false;
          return (
            <label
              key={o.value}
              className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-3 ${
                checked ? 'border-ac bg-ac text-ac-tx' : 'border-bd bg-bg'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''} has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ac`}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={o.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Disclaimer() {
  const { t } = useTranslation();
  return (
    <aside className="mb-4 rounded-xl border border-bd bg-card p-3 text-sm" aria-label={t('disclaimer.title')}>
      <strong>{t('disclaimer.title')}.</strong> <span className="text-mu">{t('disclaimer.body')}</span>
    </aside>
  );
}

const FLAGS: Record<string, string> = { ES: '🇪🇸', IT: '🇮🇹', DE: '🇩🇪', PL: '🇵🇱', TR: '🇹🇷' };
export const flag = (code: string) => FLAGS[code] ?? '';
