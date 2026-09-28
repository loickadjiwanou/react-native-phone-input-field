/**
 * Regression tests for the bugs found in the legacy
 * `international-phone-numbers.js` (spec §1 and §9.1).
 */
import {
  BJ_OPERATOR_RULE,
  DEFAULT_EXCLUDED_COUNTRIES,
  compilePattern,
  detectCountryFromNumber,
  getExampleNumber,
  isValidPhoneNumber,
  validatePhoneNumber,
  type CountryCode,
} from 'react-native-phone-input-field/core';

import { getNumberingPlan } from '../../src/core/metadata';

/** The 36 countries that could never validate (regex included the trunk 0). */
const DEAD_COUNTRIES: CountryCode[] = [
  'EG',
  'IQ',
  'IR',
  'JO',
  'SY',
  'JP',
  'PK',
  'BD',
  'PH',
  'VN',
  'TH',
  'MY',
  'TW',
  'LA',
  'LK',
  'AF',
  'GB',
  'DE',
  'FR',
  'NL',
  'BE',
  'CH',
  'SE',
  'FI',
  'UA',
  'TR',
  'RO',
  'SK',
  'RS',
  'HR',
  'BA',
  'BG',
  'EC',
  'PY',
  'UY',
  'AU',
];

/** Deterministic fixed-line number generated from the metadata pattern. */
function fixedLineSample(country: CountryCode): string {
  const plan = getNumberingPlan(country);
  const pattern = plan.typePattern('FIXED_LINE');
  if (!pattern) throw new Error(`No fixed-line pattern for ${country}`);
  const compiled = compilePattern(pattern);
  if (!compiled) throw new Error(`Unsupported pattern for ${country}`);
  const lengths = [...plan.possibleLengths].sort((a, b) => b - a);
  for (const length of lengths) {
    const nsn = compiled.sample(length);
    if (nsn && isValidPhoneNumber(`+${plan.callingCode}${nsn}`)) {
      return `+${plan.callingCode}${nsn}`;
    }
  }
  throw new Error(`No valid fixed-line sample for ${country}`);
}

describe('bug #1: 36 countries could never be validated', () => {
  it('validates +33612345678 (FR) and +447912345678 (GB)', () => {
    expect(isValidPhoneNumber('+33612345678')).toBe(true);
    expect(isValidPhoneNumber('+447912345678')).toBe(true);
  });

  it.each(DEAD_COUNTRIES)(
    '%s: example mobile number is valid (E.164 and national)',
    (country) => {
      const e164 = getExampleNumber(country, 'MOBILE', 'E164');
      const national = getExampleNumber(country, 'MOBILE', 'NATIONAL');
      expect(e164).toMatch(/^\+\d+$/);

      const international = validatePhoneNumber(e164);
      expect(international.isValid).toBe(true);
      expect(international.country).toBe(country);

      const local = validatePhoneNumber(national, country);
      expect(local.isValid).toBe(true);
      expect(local.e164).toBe(e164);
    }
  );

  it.each(DEAD_COUNTRIES)('%s: a fixed-line number is valid', (country) => {
    const value = validatePhoneNumber(fixedLineSample(country));
    expect(value.isValid).toBe(true);
    expect(value.country).toBe(country);
    expect(['FIXED_LINE', 'FIXED_LINE_OR_MOBILE']).toContain(value.type);
  });

  it.each<[string, CountryCode]>([
    ['01 42 68 53 00', 'FR'],
    ['030 12345678', 'DE'],
    ['020 7946 0958', 'GB'],
    ['03-1234-5678', 'JP'],
    ['02 9876 5432', 'AU'],
    ['020 555 1234', 'NL'],
    ['02 501 02 11', 'BE'],
    ['044 668 18 00', 'CH'],
  ])('real fixed-line number %s (%s) is valid', (number, country) => {
    const value = validatePhoneNumber(number, country);
    expect(value.isValid).toBe(true);
    expect(['FIXED_LINE', 'FIXED_LINE_OR_MOBILE']).toContain(value.type);
  });
});

describe('bug #2: real international numbers were rejected', () => {
  it('validates the Nigerian mobile +234 803 123 4567', () => {
    expect(isValidPhoneNumber('+234 803 123 4567')).toBe(true);
    expect(isValidPhoneNumber('+2348031234567')).toBe(true);
    expect(validatePhoneNumber('+2348031234567').country).toBe('NG');
  });
});

describe('bug #3: incomplete calling code table', () => {
  it.each<[string, CountryCode]>([
    ['+212612345678', 'MA'],
    ['+77011234567', 'KZ'],
    ['+358401234567', 'FI'],
    ['+14165551234', 'CA'],
    ['+61412345678', 'AU'],
    ['+64211234567', 'NZ'],
  ])('%s is valid and detected as %s', (number, country) => {
    const value = validatePhoneNumber(number);
    expect(value.isValid).toBe(true);
    expect(value.country).toBe(country);
    expect(detectCountryFromNumber(number)).toBe(country);
  });
});

describe('bug #4: shared calling codes', () => {
  it('validates a Canadian number with CA selected', () => {
    expect(isValidPhoneNumber('+14165551234', 'CA')).toBe(true);
    expect(isValidPhoneNumber('4165551234', 'CA')).toBe(true);
  });

  it('detects CA for +1 416 and KZ for +7 701', () => {
    expect(detectCountryFromNumber('+14165551234')).toBe('CA');
    expect(detectCountryFromNumber('+77011234567')).toBe('KZ');
    expect(detectCountryFromNumber('+74951234567')).toBe('RU');
    expect(detectCountryFromNumber('+12025550123')).toBe('US');
  });

  it('detects DO and JM inside +1', () => {
    expect(detectCountryFromNumber('+18092345678')).toBe('DO');
    expect(detectCountryFromNumber('+18762101234')).toBe('JM');
  });

  it('resolves +61 to AU (not CC)', () => {
    const value = validatePhoneNumber('+61412345678');
    expect(value.country).toBe('AU');
    expect(value.isValid).toBe(true);
  });

  it('handles +262 (RE / YT) and +590 (GP / BL / MF)', () => {
    expect(validatePhoneNumber('+262692123456').country).toBe('RE');
    expect(validatePhoneNumber('+262639012345').country).toBe('YT');
    expect(validatePhoneNumber('+590690001234').country).toBe('GP');
    expect(isValidPhoneNumber('+262639012345', 'YT')).toBe(true);
  });

  it('keeps the current country when compatible', () => {
    expect(detectCountryFromNumber('+1', 'CA')).toBe('CA');
    expect(detectCountryFromNumber('+1416', 'CA')).toBe('CA');
    // 7911 1… is a Guernsey range: the leading digits win over the current country.
    expect(detectCountryFromNumber('+44 7911 123456', 'JE')).toBe('GG');
    expect(detectCountryFromNumber('+44 7400 123456', 'JE')).toBe('GB');
    expect(detectCountryFromNumber('+44', 'JE')).toBe('JE');
  });
});

describe('bug #5: wrong hand-written masks', () => {
  it.each<[string, CountryCode, string]>([
    ['015123456789', 'DE', '01512 3456789'],
    ['0241234567', 'GH', '024 123 4567'],
    ['01812345678', 'BD', '01812-345678'],
    ['0197123456', 'BJ', '01 97 12 34 56'],
  ])('formats %s (%s) as %s', (input, country, expected) => {
    expect(validatePhoneNumber(input, country).national).toBe(expected);
  });
});

describe('bug #6: mobile vs fixed line are explicit', () => {
  it('reports the type and enforces allowedNumberTypes', () => {
    expect(validatePhoneNumber('+33612345678').type).toBe('MOBILE');
    expect(validatePhoneNumber('+33142685300').type).toBe('FIXED_LINE');
    const fixed = validatePhoneNumber('+33142685300', undefined, {
      allowedNumberTypes: ['MOBILE'],
    });
    expect(fixed.isValid).toBe(false);
    expect(fixed.error).toBe('WRONG_TYPE');
  });
});

describe('bug #7: Benin 10-digit plan (2024)', () => {
  it('validates +229 01 XX XX XX XX', () => {
    expect(isValidPhoneNumber('+2290197123456')).toBe(true);
    expect(isValidPhoneNumber('0197123456', 'BJ')).toBe(true);
  });
});

describe('usage examples of the legacy file', () => {
  it.each<[string, string | undefined, boolean]>([
    ['+2290167655443', undefined, true],
    ['+2290167655443', 'BJ', true],
    ['0167655443', 'BJ', true],
    ['+33612345678', undefined, true],
    ['+12125551234', undefined, true],
    ['+447912345678', undefined, true],
    ['abc', undefined, false],
    ['+229019999999', undefined, false],
  ])('isValid(%s, %s) → %s', (input, country, expected) => {
    expect(isValidPhoneNumber(input, country as CountryCode | undefined)).toBe(
      expected
    );
  });

  it('"+2290123456789" (invalid operator prefix) is rejected with BJ_OPERATOR_RULE', () => {
    const customRules = { BJ: BJ_OPERATOR_RULE };
    expect(
      isValidPhoneNumber('+2290123456789', undefined, { customRules })
    ).toBe(false);
    expect(
      isValidPhoneNumber('+2290167655443', undefined, { customRules })
    ).toBe(true);
  });

  it('legacy EXCLUDED_COUNTRIES is the default for the UI', () => {
    expect(DEFAULT_EXCLUDED_COUNTRIES).toEqual(
      expect.arrayContaining(['GG', 'JE', 'IM', 'XK', 'EH', 'PS', 'AX'])
    );
    expect(DEFAULT_EXCLUDED_COUNTRIES).toHaveLength(33);
  });
});
