import { describe, expect, it } from 'vitest';
import es from './locales/es.json';
import en from './locales/en.json';
import { detectLanguage } from './index';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });
  it('ningún texto vacío', () => {
    for (const lang of [es, en]) {
      for (const k of keys(lang)) {
        const v = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], lang);
        expect(String(v).trim(), k).not.toBe('');
      }
    }
  });
  it('detecta idioma del navegador', () => {
    expect(detectLanguage('es-ES')).toBe('es');
    expect(detectLanguage('en-GB')).toBe('en');
    expect(detectLanguage('tr-TR')).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });
});
