import {
  Metadata,
  getCountries as libGetCountries,
  type CountryCode,
  type MetadataJson,
} from 'libphonenumber-js/core';

/**
 * The package reads libphonenumber metadata through this module so that the
 * entry point decides which set is bundled:
 * - `react-native-phone-input-field` and `react-native-phone-input-field/core` register
 *   the **max** metadata (needed to tell mobile from fixed lines);
 * - `react-native-phone-input-field/min` registers the lighter **min** metadata
 *   (no number types: `allowedNumberTypes` cannot be enforced).
 */
let current: MetadataJson | null = null;
let generation = 0;
let countriesCache: CountryCode[] | null = null;
let hasTypesCache: boolean | null = null;
let callingCodesCache: Map<string, CountryCode[]> | null = null;

/** Registers the libphonenumber metadata used by the whole package. */
export function setPhoneMetadata(metadata: MetadataJson): void {
  if (metadata === current) return;
  current = metadata;
  generation += 1;
  countriesCache = null;
  hasTypesCache = null;
  callingCodesCache = null;
}

export function getMetadata(): MetadataJson {
  if (!current) {
    throw new Error(
      '[react-native-phone-input-field] No phone metadata registered. Import the package from "react-native-phone-input-field", "react-native-phone-input-field/min" or "react-native-phone-input-field/core".'
    );
  }
  return current;
}

/** Incremented every time the metadata changes; used to invalidate caches. */
export function getMetadataGeneration(): number {
  return generation;
}

/** All ISO2 codes known by the metadata (≈245). */
export function getSupportedCountryCodes(): CountryCode[] {
  if (!countriesCache) countriesCache = libGetCountries(getMetadata());
  return countriesCache;
}

export function isSupportedCountryCode(code: string): code is CountryCode {
  return getSupportedCountryCodes().includes(code as CountryCode);
}

/**
 * Countries sharing a calling code, main country first.
 * `"1"` → `['US', 'AG', …, 'CA', …]`; unknown or non-geographic → `[]`.
 */
export function getCountriesForCallingCode(callingCode: string): CountryCode[] {
  if (!callingCodesCache) {
    callingCodesCache = new Map();
    const raw = getMetadata().country_calling_codes as Record<string, string[]>;
    for (const code of Object.keys(raw)) {
      const list = (raw[code] ?? []).filter(isSupportedCountryCode);
      callingCodesCache.set(code, list);
    }
  }
  return callingCodesCache.get(callingCode) ?? [];
}

/** Whether `callingCode` exists at all (including non-geographic `+800`…). */
export function isKnownCallingCode(callingCode: string): boolean {
  const raw = getMetadata().country_calling_codes as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(raw, callingCode);
}

export interface NumberingPlanInfo {
  callingCode: string;
  nationalPrefix: string | undefined;
  IDDPrefix: string;
  possibleLengths: number[];
  nationalNumberPattern: string;
  /** Pattern of a given type, `undefined` if absent or with min metadata. */
  typePattern(type: string): string | undefined;
}

interface RuntimeNumberingPlan {
  callingCode(): string;
  nationalPrefix(): string | undefined;
  IDDPrefix(): string;
  possibleLengths(): number[];
  nationalNumberPattern(): string;
  type(type: string): { pattern(): string } | undefined;
}

const planCache = new Map<string, NumberingPlanInfo>();
let planCacheGeneration = -1;

export function getNumberingPlan(country: CountryCode): NumberingPlanInfo {
  if (planCacheGeneration !== generation) {
    planCache.clear();
    planCacheGeneration = generation;
  }
  const cached = planCache.get(country);
  if (cached) return cached;

  const metadata = new Metadata(getMetadata());
  metadata.selectNumberingPlan(country);
  // The runtime NumberingPlan exposes more than its published typings.
  const plan = metadata.numberingPlan as unknown as
    RuntimeNumberingPlan | undefined;
  if (!plan) throw new Error(`Unknown country: ${country}`);

  const info: NumberingPlanInfo = {
    callingCode: plan.callingCode(),
    nationalPrefix: plan.nationalPrefix() || undefined,
    IDDPrefix: plan.IDDPrefix(),
    possibleLengths: plan.possibleLengths(),
    nationalNumberPattern: plan.nationalNumberPattern(),
    typePattern(type: string) {
      const t = plan.type(type);
      return t ? t.pattern() || undefined : undefined;
    },
  };
  planCache.set(country, info);
  return info;
}

/**
 * `true` when the registered metadata contains number types
 * (i.e. the **max** or **full** set).
 */
export function metadataHasNumberTypes(): boolean {
  if (hasTypesCache === null) {
    const probe = getSupportedCountryCodes().includes('FR' as CountryCode)
      ? ('FR' as CountryCode)
      : getSupportedCountryCodes()[0];
    hasTypesCache = probe
      ? getNumberingPlan(probe).typePattern('FIXED_LINE') !== undefined ||
        getNumberingPlan(probe).typePattern('MOBILE') !== undefined
      : false;
  }
  return hasTypesCache;
}
