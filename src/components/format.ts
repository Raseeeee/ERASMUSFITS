/** Formato de números según idioma (máx. 1 decimal por defecto). */
export function fmt(n: number, lang: string, maxDecimals = 1): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: maxDecimals }).format(n);
}

/** Importe en moneda local según idioma (p. ej. "2,05 €", "14,53 TRY"). */
export function fmtMoney(amount: number, currency: string, lang: string): string {
  return new Intl.NumberFormat(lang, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}
