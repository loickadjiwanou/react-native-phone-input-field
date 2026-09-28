import {
  AsYouType,
  getExampleNumber as libGetExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
  type Examples,
} from 'libphonenumber-js/core';
import mobileExamples from 'libphonenumber-js/examples.mobile.json';

import { getMetadata } from './metadata';
import { extractDigits, sanitizePhoneInput } from './normalize';

export type PhoneNumberFormat = 'NATIONAL' | 'INTERNATIONAL' | 'E164';

/**
 * Formats national digits as the user types: BJ `0197123456` →
 * `01 97 12 34 56`, FR `0612` → `06 12`.
 */
export function formatAsYouType(
  nationalDigits: string,
  country: CountryCode
): string {
  if (!nationalDigits) return '';
  return new AsYouType(country, getMetadata()).input(nationalDigits);
}

/** Formats an international number as the user types: `+2290197` → `+229 01 97`. */
export function formatInternationalAsYouType(
  digitsWithCallingCode: string
): string {
  if (!digitsWithCallingCode) return '+';
  return new AsYouType(undefined, getMetadata()).input(
    `+${digitsWithCallingCode}`
  );
}

function parse(input: string, country?: CountryCode) {
  const { hasPlus, digits } = sanitizePhoneInput(input);
  if (!digits) return undefined;
  const text = hasPlus ? `+${digits}` : digits;
  return country
    ? parsePhoneNumberFromString(text, country, getMetadata())
    : parsePhoneNumberFromString(text, getMetadata());
}

/**
 * Formats a phone number. Returns the best effort as-you-type formatting when
 * the number cannot be parsed yet, and `''` for an empty input.
 */
export function formatPhoneNumber(
  input: string,
  country: CountryCode | undefined,
  format: PhoneNumberFormat
): string {
  const parsed = parse(input, country);
  if (parsed) {
    return format === 'E164' ? parsed.number : parsed.format(format);
  }
  const { hasPlus, digits } = sanitizePhoneInput(input);
  if (!digits) return '';
  if (hasPlus) {
    return format === 'E164'
      ? `+${digits}`
      : formatInternationalAsYouType(digits);
  }
  if (!country) return digits;
  return format === 'NATIONAL' ? formatAsYouType(digits, country) : '';
}

/** `+2290197123456`, or `null` when the number is not at least possible. */
export function toE164(input: string, country?: CountryCode): string | null {
  const parsed = parse(input, country);
  return parsed && parsed.isPossible() ? parsed.number : null;
}

/** `01 97 12 34 56`. */
export function toNational(input: string, country?: CountryCode): string {
  return formatPhoneNumber(input, country, 'NATIONAL');
}

/** `+229 01 97 12 34 56`. */
export function toInternational(input: string, country?: CountryCode): string {
  return formatPhoneNumber(input, country, 'INTERNATIONAL');
}

/**
 * Example mobile number for a country, from libphonenumber's metadata.
 * Only mobile examples are bundled by libphonenumber-js; other types return
 * `''`.
 */
export function getExampleNumber(
  iso2: CountryCode,
  type: 'MOBILE' = 'MOBILE',
  format: PhoneNumberFormat = 'NATIONAL'
): string {
  if (type !== 'MOBILE') return '';
  const example = libGetExampleNumber(
    iso2,
    mobileExamples as unknown as Examples,
    getMetadata()
  );
  if (!example) return '';
  return format === 'E164' ? example.number : example.format(format);
}

/**
 * Placeholder derived from the example mobile number: the first group is
 * kept, the other digits are masked. BJ → `01 •• •• •• ••`,
 * FR → `06 •• •• •• ••`, US → `(201) •••-••••`.
 */
export function getPlaceholderMask(iso2: CountryCode, maskChar = '•'): string {
  const example = getExampleNumber(iso2, 'MOBILE', 'NATIONAL');
  if (!example) return '';
  const match = /^\D*\d+/.exec(example);
  const keep = match ? match[0].length : 0;
  return example.slice(0, keep) + example.slice(keep).replace(/\d/g, maskChar);
}

/**
 * National digits to put in the input after an international number has
 * been recognised: `+33 612345678` → `0612345678` (trunk prefix restored so
 * that the national formatting is the familiar one).
 */
export function toNationalInputDigits(
  nationalSignificant: string,
  callingCode: string,
  country: CountryCode
): string {
  if (!nationalSignificant) return '';
  const parsed = parsePhoneNumberFromString(
    `+${callingCode}${nationalSignificant}`,
    getMetadata()
  );
  if (
    parsed &&
    parsed.isPossible() &&
    (parsed.country ?? country) === country
  ) {
    const digits = extractDigits(parsed.formatNational());
    if (digits.endsWith(parsed.nationalNumber)) return digits;
  }
  return nationalSignificant;
}
