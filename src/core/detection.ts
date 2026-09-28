import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/core';

import {
  getCountriesForCallingCode,
  getMetadata,
  getNumberingPlan,
  isKnownCallingCode,
} from './metadata';
import { sanitizePhoneInput } from './normalize';
import { compilePattern } from './prefixMatcher';
import { isViableNationalPrefix } from './viability';

export type CallingCodeSplit =
  | { status: 'resolved'; callingCode: string; rest: string }
  /** Not enough digits yet to know the calling code (`+2`, `+22`). */
  | { status: 'pending' }
  /** No calling code can start with these digits (`+999`). */
  | { status: 'unknown' };

/**
 * Splits `33612345678` into calling code `33` and the rest. Calling codes
 * form a prefix code (ITU E.164), so the first match is the only one.
 */
export function splitCallingCode(digits: string): CallingCodeSplit {
  for (let len = 1; len <= 3 && len <= digits.length; len += 1) {
    const candidate = digits.slice(0, len);
    if (isKnownCallingCode(candidate)) {
      return {
        status: 'resolved',
        callingCode: candidate,
        rest: digits.slice(len),
      };
    }
  }
  return digits.length < 3 ? { status: 'pending' } : { status: 'unknown' };
}

/**
 * Length of the international dialling prefix at the start of `digits`
 * (`00`, or the country's own IDD such as `011` for the US), or 0.
 */
export function internationalPrefixLength(
  digits: string,
  country?: CountryCode
): number {
  if (country) {
    const idd = getNumberingPlan(country).IDDPrefix;
    const compiled = idd ? compilePattern(idd) : null;
    if (compiled) {
      for (let len = 1; len <= Math.min(5, digits.length); len += 1) {
        if (compiled.matches(digits.slice(0, len))) return len;
      }
    }
  }
  return digits.startsWith('00') ? 2 : 0;
}

export interface ResolveCountryOptions {
  /** Currently selected country: kept when compatible with the number. */
  currentCountry?: CountryCode;
  /** Restricts the candidates (e.g. `onlyCountries`). */
  isAllowed?: (country: CountryCode) => boolean;
}

/**
 * Picks the country for a calling code shared by several countries
 * (`+1`, `+7`, `+44`, `+262`, `+590`, `+599`…):
 * 1. the current country if the number is valid for it, or not complete
 *    enough to belong to a specific other country;
 * 2. the country libphonenumber derives from the leading digits
 *    (`+1 416…` → CA, `+7 701…` → KZ);
 * 3. the main country of the calling code (US for `+1`).
 * Allowed countries are always preferred.
 */
export function resolveCountryForCallingCode(
  callingCode: string,
  nationalSignificant: string,
  options: ResolveCountryOptions = {}
): CountryCode | null {
  const all = getCountriesForCallingCode(callingCode);
  if (all.length === 0) return null;
  const { currentCountry, isAllowed } = options;
  const allowed = isAllowed ? all.filter(isAllowed) : all;
  const candidates = allowed.length > 0 ? allowed : all;
  if (candidates.length === 1) return candidates[0]!;

  const parsed = nationalSignificant
    ? parsePhoneNumberFromString(
        `+${callingCode}${nationalSignificant}`,
        getMetadata()
      )
    : undefined;
  const parsedCountry =
    parsed?.country && candidates.includes(parsed.country)
      ? parsed.country
      : undefined;

  if (currentCountry && candidates.includes(currentCountry)) {
    if (!parsedCountry || parsedCountry === currentCountry)
      return currentCountry;
    // The number clearly belongs to another country of the same plan.
    if (parsed?.isValid()) return parsedCountry;
    if (isViableNationalPrefix(nationalSignificant, currentCountry)) {
      return currentCountry;
    }
    return parsedCountry;
  }
  return parsedCountry ?? candidates[0]!;
}

/**
 * Detects the country of an international number: `+229 01…`, `00229…`,
 * `(+33) 6 12…`. Returns `null` for national numbers or unknown codes.
 *
 * @param currentCountry kept when the number is compatible with it, and used
 * to recognise its own international prefix (e.g. `011` in the US).
 */
export function detectCountryFromNumber(
  input: string,
  currentCountry?: CountryCode
): CountryCode | null {
  const { hasPlus, digits } = sanitizePhoneInput(input);
  let international: string | null = null;
  if (hasPlus) {
    international = digits;
  } else {
    const iddLength = internationalPrefixLength(digits, currentCountry);
    if (iddLength > 0) international = digits.slice(iddLength);
  }
  if (international === null) return null;
  const split = splitCallingCode(international);
  if (split.status !== 'resolved') return null;
  return resolveCountryForCallingCode(split.callingCode, split.rest, {
    currentCountry,
  });
}
