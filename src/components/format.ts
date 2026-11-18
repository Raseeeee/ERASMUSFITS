/** Formato de números según idioma (máx. 1 decimal por defecto). */
export function fmt(n: number, lang: string, maxDecimals = 1): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: maxDecimals }).format(n);
}
