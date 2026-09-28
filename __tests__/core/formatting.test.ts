import {
  formatAsYouType,
  formatInternationalAsYouType,
  formatPhoneNumber,
  getExampleNumber,
  getPlaceholderMask,
  toE164,
  toInternational,
  toNational,
  toNationalInputDigits,
} from 'react-native-phone-input-field/core';

describe('formatting', () => {
  it('formats as you type', () => {
    expect(formatAsYouType('0197123456', 'BJ')).toBe('01 97 12 34 56');
    expect(formatAsYouType('0612', 'FR')).toBe('06 12');
    expect(formatAsYouType('', 'FR')).toBe('');
    expect(formatInternationalAsYouType('2290197')).toBe('+229 01 97');
    expect(formatInternationalAsYouType('')).toBe('+');
  });

  it('formatPhoneNumber in every format', () => {
    expect(formatPhoneNumber('0197123456', 'BJ', 'NATIONAL')).toBe(
      '01 97 12 34 56'
    );
    expect(formatPhoneNumber('0197123456', 'BJ', 'INTERNATIONAL')).toBe(
      '+229 01 97 12 34 56'
    );
    expect(formatPhoneNumber('0197123456', 'BJ', 'E164')).toBe(
      '+2290197123456'
    );
    expect(formatPhoneNumber('+2290197123456', undefined, 'NATIONAL')).toBe(
      '01 97 12 34 56'
    );
  });

  it('formatPhoneNumber best effort on unparsable input', () => {
    expect(formatPhoneNumber('', 'BJ', 'NATIONAL')).toBe('');
    expect(formatPhoneNumber('+2', undefined, 'E164')).toBe('+2');
    expect(formatPhoneNumber('+2', undefined, 'INTERNATIONAL')).toBe('+2');
    expect(formatPhoneNumber('1', undefined, 'NATIONAL')).toBe('1');
    expect(formatPhoneNumber('1', 'FR', 'NATIONAL')).toBe('1');
    expect(formatPhoneNumber('1', 'FR', 'E164')).toBe('');
  });

  it('toE164 / toNational / toInternational', () => {
    expect(toE164('06 12 34 56 78', 'FR')).toBe('+33612345678');
    expect(toE164('0612', 'FR')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toNational('+33612345678')).toBe('06 12 34 56 78');
    expect(toInternational('0612345678', 'FR')).toBe('+33 6 12 34 56 78');
  });

  it('example numbers and placeholders', () => {
    expect(getExampleNumber('BJ')).toBe('01 95 12 34 56');
    expect(getExampleNumber('BJ', 'MOBILE', 'E164')).toBe('+2290195123456');
    expect(getExampleNumber('BJ', 'MOBILE', 'INTERNATIONAL')).toBe(
      '+229 01 95 12 34 56'
    );
    expect(getExampleNumber('BJ', 'FIXED_LINE' as 'MOBILE')).toBe('');
    expect(getPlaceholderMask('BJ')).toBe('01 •• •• •• ••');
    expect(getPlaceholderMask('FR')).toBe('06 •• •• •• ••');
    expect(getPlaceholderMask('US')).toBe('(201) •••-••••');
    expect(getPlaceholderMask('BJ', 'X')).toBe('01 XX XX XX XX');
  });

  it('restores the trunk prefix for the national input', () => {
    expect(toNationalInputDigits('612345678', '33', 'FR')).toBe('0612345678');
    expect(toNationalInputDigits('0197123456', '229', 'BJ')).toBe('0197123456');
    expect(toNationalInputDigits('61', '33', 'FR')).toBe('61');
    expect(toNationalInputDigits('', '33', 'FR')).toBe('');
  });
});
