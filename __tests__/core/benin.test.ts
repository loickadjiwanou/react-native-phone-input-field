import {
  BJ_OPERATOR_RULE,
  formatAsYouType,
  getPlaceholderMask,
  validatePhoneNumber,
} from 'react-native-phone-input-field/core';

describe('Benin (+229, 10-digit plan since 2024)', () => {
  it('accepts +2290197123456 and 0197123456 with BJ', () => {
    const intl = validatePhoneNumber('+2290197123456');
    expect(intl).toMatchObject({
      isValid: true,
      country: 'BJ',
      callingCode: '229',
      e164: '+2290197123456',
      national: '01 97 12 34 56',
      international: '+229 01 97 12 34 56',
      type: 'MOBILE',
      state: 'valid',
      error: null,
    });
    const national = validatePhoneNumber('0197123456', 'BJ');
    expect(national.isValid).toBe(true);
    expect(national.e164).toBe('+2290197123456');
  });

  it('keeps the leading 01 (part of the number, not a trunk prefix)', () => {
    expect(validatePhoneNumber('0197123456', 'BJ').e164).toBe('+2290197123456');
    expect(formatAsYouType('0197123456', 'BJ')).toBe('01 97 12 34 56');
  });

  it('rejects the old 8-digit format', () => {
    const old = validatePhoneNumber('97123456', 'BJ');
    expect(old.isValid).toBe(false);
    expect(old.state).toBe('invalid');
    expect(validatePhoneNumber('+22997123456').isValid).toBe(false);
  });

  it('flags the old format as soon as the first digit is typed', () => {
    expect(validatePhoneNumber('9', 'BJ').error).toBe('INVALID_NUMBER');
    expect(validatePhoneNumber('97', 'BJ').state).toBe('invalid');
  });

  it('returns TOO_LONG for +22901971234567', () => {
    const value = validatePhoneNumber('+22901971234567');
    expect(value.error).toBe('TOO_LONG');
    expect(value.isValid).toBe(false);
    expect(value.errorMessage).toBe('Numéro trop long pour Bénin');
  });

  it('treats a partial 01… as incomplete, not invalid', () => {
    const value = validatePhoneNumber('01971', 'BJ');
    expect(value.state).toBe('incomplete');
    expect(value.error).toBe('TOO_SHORT');
    expect(value.e164).toBeNull();
  });

  it('builds the placeholder "01 •• •• •• ••"', () => {
    expect(getPlaceholderMask('BJ')).toBe('01 •• •• •• ••');
  });

  it('BJ_OPERATOR_RULE is opt-in and restricts operator blocks', () => {
    const rules = { BJ: BJ_OPERATOR_RULE };
    expect(
      validatePhoneNumber('0197123456', 'BJ', { customRules: rules }).isValid
    ).toBe(true);
    expect(
      validatePhoneNumber('0195123456', 'BJ', { customRules: rules }).isValid
    ).toBe(true);
    // 01 25 … is a valid libphonenumber mobile block but not in the example list.
    expect(validatePhoneNumber('0125123456', 'BJ').isValid).toBe(true);
    const rejected = validatePhoneNumber('0125123456', 'BJ', {
      customRules: rules,
    });
    expect(rejected.error).toBe('CUSTOM_RULE');
    expect(rejected.errorMessage).toBe(BJ_OPERATOR_RULE.message);
    // Early detection while typing.
    expect(
      validatePhoneNumber('0125', 'BJ', { customRules: rules }).error
    ).toBe('CUSTOM_RULE');
  });
});
