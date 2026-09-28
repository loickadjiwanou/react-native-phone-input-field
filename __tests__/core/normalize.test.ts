import {
  caretAfterDigits,
  countDigitsBefore,
  extractDigits,
  normalizeDigits,
  normalizeSearchText,
  sanitizePhoneInput,
} from 'react-native-phone-input-field/core';

describe('normalize', () => {
  it('converts Arabic, Persian, Devanagari and fullwidth digits', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normalizeDigits('०१२')).toBe('012');
    expect(normalizeDigits('０１２')).toBe('012');
    expect(normalizeDigits('a1')).toBe('a1');
  });

  it('extracts digits', () => {
    expect(extractDigits('+229 (01) 97-12.34/56')).toBe('2290197123456');
  });

  it('sanitizes input', () => {
    expect(sanitizePhoneInput('(+33) 6 12')).toEqual({
      hasPlus: true,
      digits: '33612',
      hasInvalidChars: false,
    });
    expect(sanitizePhoneInput('‪+229‬ 01')).toEqual({
      hasPlus: true,
      digits: '22901',
      hasInvalidChars: false,
    });
    expect(sanitizePhoneInput('01+2')).toEqual({
      hasPlus: false,
      digits: '012',
      hasInvalidChars: true,
    });
    expect(sanitizePhoneInput('abc')).toEqual({
      hasPlus: false,
      digits: '',
      hasInvalidChars: true,
    });
    expect(sanitizePhoneInput('')).toEqual({
      hasPlus: false,
      digits: '',
      hasInvalidChars: false,
    });
    expect(sanitizePhoneInput('＋33').hasPlus).toBe(true);
  });

  it('normalizes search text', () => {
    expect(normalizeSearchText('Côte d’Ivoire')).toBe('cote divoire');
    expect(normalizeSearchText("cote d'iv")).toBe('cote div');
    expect(normalizeSearchText('  États-Unis ')).toBe('etats unis');
  });

  it('maps caret positions', () => {
    expect(countDigitsBefore('01 97 12', 5)).toBe(4);
    expect(countDigitsBefore('01', 10)).toBe(2);
    expect(caretAfterDigits('01 97 12', 4)).toBe(5);
    expect(caretAfterDigits('01 97 12', 0)).toBe(0);
    expect(caretAfterDigits('+229', 0)).toBe(1);
    expect(caretAfterDigits('01', 9)).toBe(2);
  });
});
