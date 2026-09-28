import {
  detectCountryFromNumber,
  internationalPrefixLength,
  resolveCountryForCallingCode,
  splitCallingCode,
} from 'react-native-phone-input-field/core';

describe('detectCountryFromNumber', () => {
  it.each([
    ['+229 01 97 12 34 56', 'BJ'],
    ['00229 01 97 12 34 56', 'BJ'],
    ['(+33) 6 12 34 56 78', 'FR'],
    ['+33 (0)6.12.34.56.78', 'FR'],
    ['+44 20 7946 0958', 'GB'],
    ['＋２２９０１９７１２３４５６', 'BJ'],
    ['+٢٢٩٠١٩٧١٢٣٤٥٦', 'BJ'],
  ])('%s → %s', (input, expected) => {
    expect(detectCountryFromNumber(input)).toBe(expected);
  });

  it('disambiguates +1 and +7', () => {
    expect(detectCountryFromNumber('+1 416 555 1234')).toBe('CA');
    expect(detectCountryFromNumber('+1 202 555 0123')).toBe('US');
    expect(detectCountryFromNumber('+7 701 123 4567')).toBe('KZ');
    expect(detectCountryFromNumber('+7 912 345 6789')).toBe('RU');
  });

  it('uses the country IDD prefix (011 in the US)', () => {
    expect(detectCountryFromNumber('011 33 6 12 34 56 78', 'US')).toBe('FR');
    expect(internationalPrefixLength('01133', 'US')).toBe(3);
  });

  it('returns null for national or unknown numbers', () => {
    expect(detectCountryFromNumber('0197123456')).toBeNull();
    expect(detectCountryFromNumber('+999 123')).toBeNull();
    expect(detectCountryFromNumber('+2')).toBeNull();
    expect(detectCountryFromNumber('')).toBeNull();
  });
});

describe('splitCallingCode', () => {
  it('splits known codes', () => {
    expect(splitCallingCode('2290197')).toEqual({
      status: 'resolved',
      callingCode: '229',
      rest: '0197',
    });
    expect(splitCallingCode('1416')).toEqual({
      status: 'resolved',
      callingCode: '1',
      rest: '416',
    });
    expect(splitCallingCode('22')).toEqual({ status: 'pending' });
    expect(splitCallingCode('')).toEqual({ status: 'pending' });
    expect(splitCallingCode('999')).toEqual({ status: 'unknown' });
  });
});

describe('internationalPrefixLength', () => {
  it('recognises 00 by default', () => {
    expect(internationalPrefixLength('00229')).toBe(2);
    expect(internationalPrefixLength('0197')).toBe(0);
    expect(internationalPrefixLength('00229', 'BJ')).toBe(2);
  });
});

describe('resolveCountryForCallingCode', () => {
  it('returns null for unknown codes', () => {
    expect(resolveCountryForCallingCode('999', '')).toBeNull();
    expect(resolveCountryForCallingCode('800', '12345678')).toBeNull();
  });

  it('keeps the current country while typing', () => {
    expect(
      resolveCountryForCallingCode('1', '', { currentCountry: 'CA' })
    ).toBe('CA');
    expect(
      resolveCountryForCallingCode('1', '4', { currentCountry: 'JM' })
    ).toBe('JM');
  });

  it('switches when the number clearly belongs elsewhere', () => {
    expect(
      resolveCountryForCallingCode('1', '4165551234', { currentCountry: 'US' })
    ).toBe('CA');
    expect(
      resolveCountryForCallingCode('7', '7011234567', { currentCountry: 'RU' })
    ).toBe('KZ');
  });

  it('falls back on the main country, restricted to allowed ones', () => {
    expect(resolveCountryForCallingCode('1', '')).toBe('US');
    expect(
      resolveCountryForCallingCode('1', '', { isAllowed: (c) => c === 'JM' })
    ).toBe('JM');
    expect(
      resolveCountryForCallingCode('1', '', { isAllowed: () => false })
    ).toBe('US');
    expect(resolveCountryForCallingCode('229', '')).toBe('BJ');
  });
});
