import type { CountryCode } from 'libphonenumber-js/core';

import { getCountryName, getEnglishCountryName } from '../i18n';
import type { Country } from '../types';
import {
  getMetadataGeneration,
  getNumberingPlan,
  getSupportedCountryCodes,
  isSupportedCountryCode,
} from './metadata';

/**
 * Countries excluded by default: `EXCLUDED_COUNTRIES` of the legacy
 * `international-phone-numbers.js`. Pass `excludedCountries={[]}` to show
 * every country, or your own list.
 *
 * The legacy list also contained AQ, BV, TF, HM, UM and PN, which have no
 * numbering plan in libphonenumber and therefore never appear anyway.
 */
export const DEFAULT_EXCLUDED_COUNTRIES: readonly CountryCode[] = [
  'SX',
  'PM',
  'TK',
  'MS',
  'NF',
  'GG',
  'JE',
  'IM',
  'AI',
  'AG',
  'BS',
  'BB',
  'BM',
  'VG',
  'KY',
  'DM',
  'GD',
  'KN',
  'LC',
  'VC',
  'TT',
  'TC',
  'VA',
  'BT',
  'EH',
  'XK',
  'PS',
  'AS',
  'IO',
  'SH',
  'SJ',
  'VI',
  'AX',
];

/**
 * ISO2 → regional-indicator flag emoji: `"BJ"` → `"🇧🇯"`. No asset involved.
 */
export function getFlagEmoji(iso2: string): string {
  const code = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    0x1f1e6 + code.charCodeAt(0) - 65,
    0x1f1e6 + code.charCodeAt(1) - 65
  );
}

/**
 * Codes whose flag is not part of the RGI emoji set, and therefore renders
 * as two letters on most platforms. `<Flag />` shows an ISO badge instead.
 */
export const NON_RGI_FLAGS: ReadonlySet<string> = new Set(['XK']);

/** Extra search terms (FR + EN), keyed by ISO2. */
export const COUNTRY_ALIASES: Partial<Record<CountryCode, string[]>> = {
  AE: ['UAE', 'EAU', 'Emirats', 'Emirates', 'Dubai'],
  BA: ['Bosnia'],
  BF: ['Haute-Volta', 'Upper Volta'],
  BJ: ['Dahomey'],
  BO: ['Bolivia'],
  BY: ['Belarus', 'Bielorussie', 'Belorussia'],
  CD: [
    'RDC',
    'DRC',
    'Congo Kinshasa',
    'Republique democratique du Congo',
    'Democratic Republic of the Congo',
    'Zaire',
  ],
  CF: ['RCA', 'Centrafrique', 'CAR'],
  CG: ['Congo Brazzaville', 'Republique du Congo', 'Republic of the Congo'],
  CI: ['Ivory Coast', 'RCI'],
  CV: ['Cape Verde', 'Cap-Vert'],
  CZ: ['Czechia', 'Tchequie', 'Czech Republic'],
  DE: ['Deutschland', 'Allemagne'],
  DO: ['Dominican Republic', 'Republique dominicaine'],
  ES: ['Espana', 'Spain'],
  GB: [
    'UK',
    'Great Britain',
    'Grande-Bretagne',
    'England',
    'Angleterre',
    'Scotland',
    'Ecosse',
    'Wales',
    'Pays de Galles',
    'Northern Ireland',
  ],
  GQ: ['Equatorial Guinea', 'Guinee equatoriale'],
  GR: ['Hellas', 'Grece'],
  KP: ['North Korea', 'Coree du Nord'],
  KR: ['South Korea', 'Coree du Sud', 'Korea'],
  LA: ['Laos'],
  MK: ['Macedonia', 'Macedoine', 'North Macedonia'],
  MM: ['Burma', 'Birmanie'],
  NL: ['Holland', 'Hollande', 'Pays-Bas', 'Netherlands'],
  PS: ['Palestine'],
  RU: ['Russia', 'Russie'],
  SA: ['KSA', 'Saudi', 'Arabie'],
  SZ: ['Swaziland'],
  TL: ['East Timor', 'Timor oriental'],
  TR: ['Turkey', 'Turkiye', 'Turquie'],
  TW: ['Taiwan'],
  TZ: ['Tanzania', 'Tanzanie'],
  US: ['USA', 'United States of America', 'Etats-Unis', 'America', 'Amerique'],
  VA: ['Vatican', 'Holy See', 'Saint-Siege'],
  VE: ['Venezuela'],
  VN: ['Vietnam', 'Viet Nam'],
};

export interface GetCountriesOptions {
  locale?: string;
  countryNameOverrides?: Partial<Record<CountryCode, string>>;
  /** Only keep these countries. */
  onlyCountries?: readonly CountryCode[];
  /** Remove these countries. Defaults to `DEFAULT_EXCLUDED_COUNTRIES`. */
  excludedCountries?: readonly CountryCode[];
}

/** Whether `iso2` passes the `onlyCountries` / `excludedCountries` filters. */
export function isCountryAllowed(
  iso2: CountryCode,
  options: Pick<GetCountriesOptions, 'onlyCountries' | 'excludedCountries'> = {}
): boolean {
  const { onlyCountries, excludedCountries = DEFAULT_EXCLUDED_COUNTRIES } =
    options;
  if (
    onlyCountries &&
    onlyCountries.length > 0 &&
    !onlyCountries.includes(iso2)
  ) {
    return false;
  }
  return !excludedCountries.includes(iso2);
}

const countryCache = new Map<string, Country>();
let countryCacheGeneration = -1;

function overridesKey(overrides?: Partial<Record<string, string>>): string {
  if (!overrides) return '';
  return Object.keys(overrides)
    .sort()
    .map((k) => `${k}=${overrides[k]}`)
    .join('|');
}

/** One country. Throws on unknown ISO2 codes. */
export function getCountry(
  iso2: CountryCode,
  locale?: string,
  countryNameOverrides?: Partial<Record<CountryCode, string>>
): Country {
  if (countryCacheGeneration !== getMetadataGeneration()) {
    countryCache.clear();
    countryCacheGeneration = getMetadataGeneration();
  }
  const code = iso2.toUpperCase() as CountryCode;
  if (!isSupportedCountryCode(code)) {
    throw new Error(
      `[react-native-phone-input-field] Unknown country code: ${iso2}`
    );
  }
  const key = `${code}|${locale ?? ''}|${overridesKey(countryNameOverrides)}`;
  const cached = countryCache.get(key);
  if (cached) return cached;
  const country: Country = {
    iso2: code,
    callingCode: getNumberingPlan(code).callingCode,
    name: getCountryName(code, locale, countryNameOverrides),
    englishName: getEnglishCountryName(code),
    flag: getFlagEmoji(code),
  };
  countryCache.set(key, country);
  return country;
}

/**
 * Every country known by libphonenumber, filtered, sorted by localized name
 * (locale-aware, accent-insensitive).
 */
export function getCountries(
  localeOrOptions?: string | GetCountriesOptions
): Country[] {
  const options: GetCountriesOptions =
    typeof localeOrOptions === 'string'
      ? { locale: localeOrOptions }
      : (localeOrOptions ?? {});
  const list = getSupportedCountryCodes()
    .filter((code) => isCountryAllowed(code, options))
    .map((code) =>
      getCountry(code, options.locale, options.countryNameOverrides)
    );
  const collator = getCollator(options.locale);
  return list.sort((a, b) => collator(a.name, b.name));
}

function getCollator(locale?: string): (a: string, b: string) => number {
  try {
    const c = new Intl.Collator(locale ?? 'fr', { sensitivity: 'base' });
    return (a, b) => c.compare(a, b);
  } catch {
    return (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  }
}
