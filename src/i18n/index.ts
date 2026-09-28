import type { CountryCode } from 'libphonenumber-js/core';

import type { DeepPartial } from '../types';
import { countryNamesEN } from './countryNames.en';
import { countryNamesFR } from './countryNames.fr';
import { en } from './en';
import { fr } from './fr';
import type { Messages } from './types';

export type { Messages };
export { en, fr };

/** Default UI language of the package. */
export const DEFAULT_LOCALE = 'fr';

const BUNDLED: Record<string, Messages> = { fr, en };
const BUNDLED_NAMES: Record<string, Partial<Record<CountryCode, string>>> = {
  fr: countryNamesFR,
  en: countryNamesEN,
};

/** `"fr-BJ"` → `"fr"`, `"EN_us"` → `"en"`. */
export function languageOf(locale: string | undefined): string {
  return (locale ?? DEFAULT_LOCALE).split(/[-_]/)[0]!.toLowerCase();
}

const mergedCache = new WeakMap<object, Map<string, Messages>>();

/**
 * Bundled messages for `locale` (FR / EN; other languages fall back to EN),
 * deep-merged with `overrides`.
 */
export function getMessages(
  locale?: string,
  overrides?: DeepPartial<Messages>
): Messages {
  const lang = languageOf(locale);
  const base = BUNDLED[lang] ?? en;
  if (!overrides) return base;
  let byLang = mergedCache.get(overrides);
  if (!byLang) {
    byLang = new Map();
    mergedCache.set(overrides, byLang);
  }
  const cached = byLang.get(lang);
  if (cached) return cached;
  const merged: Messages = {
    ...base,
    ...(overrides as Partial<Messages>),
    errors: { ...base.errors, ...overrides.errors },
    numberTypes: { ...base.numberTypes, ...overrides.numberTypes },
  };
  byLang.set(lang, merged);
  return merged;
}

/** Replaces `{key}` placeholders. Unknown keys are left untouched. */
export function interpolate(
  template: string,
  params: Record<string, string | number | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

type DisplayNamesLike = { of(code: string): string | undefined };
const displayNamesCache = new Map<string, DisplayNamesLike | null>();

function getDisplayNames(locale: string): DisplayNamesLike | null {
  if (displayNamesCache.has(locale)) return displayNamesCache.get(locale)!;
  let dn: DisplayNamesLike | null = null;
  try {
    const Ctor = (
      Intl as unknown as {
        DisplayNames?: new (
          locales: string[],
          options: { type: 'region'; fallback: 'none' }
        ) => DisplayNamesLike;
      }
    ).DisplayNames;
    if (typeof Ctor === 'function') {
      dn = new Ctor([locale], { type: 'region', fallback: 'none' });
    }
  } catch {
    dn = null;
  }
  displayNamesCache.set(locale, dn);
  return dn;
}

/** @internal test helper */
export function __resetDisplayNamesCache(): void {
  displayNamesCache.clear();
}

/** English name from the embedded table (always available). */
export function getEnglishCountryName(iso2: CountryCode): string {
  return countryNamesEN[iso2] ?? iso2;
}

/**
 * Localized country name. Order: `overrides` → `Intl.DisplayNames` (when the
 * JS engine provides it) → embedded FR/EN tables → English → ISO code.
 */
export function getCountryName(
  iso2: CountryCode,
  locale?: string,
  overrides?: Partial<Record<CountryCode, string>>
): string {
  const override = overrides?.[iso2];
  if (override) return override;
  const lang = languageOf(locale);
  const dn = getDisplayNames(locale ?? DEFAULT_LOCALE);
  if (dn) {
    try {
      const name = dn.of(iso2);
      if (name && name !== iso2) return name;
    } catch {
      // Some engines throw on codes like "AC" or "TA": use the tables.
    }
  }
  return BUNDLED_NAMES[lang]?.[iso2] ?? getEnglishCountryName(iso2);
}
