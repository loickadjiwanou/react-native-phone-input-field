import { isValidPhoneNumber as libIsValid } from 'libphonenumber-js/max';
import {
  analyzePhoneNumber,
  describeNumberTypes,
  getErrorMessage,
  getMessages,
  isPhoneValidationError,
  isValidPhoneNumber,
  submittedState,
  toPhoneValue,
  validatePhoneNumber,
} from 'react-native-phone-input-field/core';

describe('validatePhoneNumber: states and errors', () => {
  it('empty input is idle, or REQUIRED when required', () => {
    expect(validatePhoneNumber('', 'BJ')).toMatchObject({
      state: 'idle',
      error: null,
      isValid: false,
    });
    const required = validatePhoneNumber('', 'BJ', { required: true });
    expect(required).toMatchObject({ state: 'invalid', error: 'REQUIRED' });
    expect(required.errorMessage).toBe('Le numéro de téléphone est requis');
    expect(validatePhoneNumber('  ', 'BJ', { required: true }).error).toBe(
      'REQUIRED'
    );
  });

  it('letters are NOT_A_NUMBER', () => {
    expect(validatePhoneNumber('abc', 'BJ')).toMatchObject({
      error: 'NOT_A_NUMBER',
      state: 'invalid',
    });
    expect(validatePhoneNumber('01 97 abc', 'BJ').error).toBe('NOT_A_NUMBER');
  });

  it('a national number without country is INVALID_COUNTRY', () => {
    expect(validatePhoneNumber('0197123456').error).toBe('INVALID_COUNTRY');
  });

  it('unknown or non-geographic calling codes are INVALID_COUNTRY', () => {
    expect(validatePhoneNumber('+999123').error).toBe('INVALID_COUNTRY');
    expect(validatePhoneNumber('+80012345678').error).toBe('INVALID_COUNTRY');
  });

  it('a pending calling code is incomplete', () => {
    expect(validatePhoneNumber('+2')).toMatchObject({
      state: 'incomplete',
      error: 'TOO_SHORT',
    });
    expect(validatePhoneNumber('+')).toMatchObject({ state: 'incomplete' });
  });

  it('a calling code alone is incomplete', () => {
    expect(validatePhoneNumber('+229')).toMatchObject({
      state: 'incomplete',
      error: 'TOO_SHORT',
      country: 'BJ',
    });
  });

  it('flags impossible prefixes immediately (FR 9…, BJ 9…)', () => {
    expect(validatePhoneNumber('06', 'FR').state).toBe('incomplete');
    expect(validatePhoneNumber('00', 'FR').state).toBe('incomplete'); // "00" → international prefix
    expect(validatePhoneNumber('9', 'BJ')).toMatchObject({
      state: 'invalid',
      error: 'INVALID_NUMBER',
    });
    expect(validatePhoneNumber('02', 'BJ').state).toBe('invalid');
  });

  it('TOO_LONG is invalid', () => {
    expect(validatePhoneNumber('06123456789', 'FR').error).toBe('TOO_LONG');
  });

  it('possible length but invalid number is INVALID_NUMBER', () => {
    // US numbers cannot start with 1 after the area code… 555-01xx are valid,
    // but 000 area codes never are.
    expect(validatePhoneNumber('0000000000', 'US').isValid).toBe(false);
    // BJ: 8 digits is a possible length (short services) but not a valid mobile.
    const value = validatePhoneNumber('97123456', 'BJ');
    expect(value).toMatchObject({
      isValid: false,
      isPossible: true,
      error: 'INVALID_NUMBER',
    });
  });

  it('distinguishes INVALID_LENGTH between two possible lengths', () => {
    // BJ accepts 8 (short services) and 10 digits: 9 digits starting with 01 is incomplete.
    expect(validatePhoneNumber('019712345', 'BJ').state).toBe('incomplete');
  });

  it('e164 is null until the number is possible', () => {
    expect(validatePhoneNumber('0612', 'FR').e164).toBeNull();
    expect(validatePhoneNumber('0612345678', 'FR').e164).toBe('+33612345678');
  });

  it('keeps the trunk prefix out of E.164', () => {
    expect(validatePhoneNumber('06 12 34 56 78', 'FR').e164).toBe(
      '+33612345678'
    );
    expect(validatePhoneNumber('6 12 34 56 78', 'FR').e164).toBe(
      '+33612345678'
    );
    expect(validatePhoneNumber('+33 (0)6 12 34 56 78').e164).toBe(
      '+33612345678'
    );
  });

  it('national number valid for a sibling country switches country (US → CA)', () => {
    const value = validatePhoneNumber('4165551234', 'US');
    expect(value).toMatchObject({ isValid: true, country: 'CA' });
    const strict = validatePhoneNumber('4165551234', 'US', {
      autoDetectCountry: false,
    });
    expect(strict.isValid).toBe(false);
    expect(strict.country).toBe('US');
  });

  it('autoDetectCountry=false rejects a foreign calling code', () => {
    const value = validatePhoneNumber('+33612345678', 'BJ', {
      autoDetectCountry: false,
    });
    expect(value).toMatchObject({
      isValid: false,
      error: 'INVALID_COUNTRY',
      country: 'BJ',
    });
    expect(
      isValidPhoneNumber('+2290197123456', 'BJ', { autoDetectCountry: false })
    ).toBe(true);
  });
});

describe('allowedNumberTypes', () => {
  it('accepts mobiles and rejects fixed lines for MOBILE', () => {
    const opts = { allowedNumberTypes: ['MOBILE'] as const };
    expect(
      isValidPhoneNumber('0612345678', 'FR', { allowedNumberTypes: ['MOBILE'] })
    ).toBe(true);
    const fixed = validatePhoneNumber('0142685300', 'FR', {
      allowedNumberTypes: [...opts.allowedNumberTypes],
    });
    expect(fixed.error).toBe('WRONG_TYPE');
    expect(fixed.errorMessage).toBe('Veuillez saisir un numéro mobile');
  });

  it('flags a fixed-line prefix while typing when only mobiles are allowed', () => {
    const value = validatePhoneNumber('01', 'FR', {
      allowedNumberTypes: ['MOBILE'],
    });
    expect(value).toMatchObject({ state: 'invalid', error: 'WRONG_TYPE' });
    expect(
      validatePhoneNumber('06', 'FR', { allowedNumberTypes: ['MOBILE'] }).state
    ).toBe('incomplete');
  });

  it('FIXED_LINE_OR_MOBILE numbers (US) pass MOBILE and FIXED_LINE', () => {
    expect(
      isValidPhoneNumber('+12015550123', undefined, {
        allowedNumberTypes: ['MOBILE'],
      })
    ).toBe(true);
    expect(
      isValidPhoneNumber('+12015550123', undefined, {
        allowedNumberTypes: ['FIXED_LINE'],
      })
    ).toBe(true);
    expect(
      validatePhoneNumber('20155', 'US', { allowedNumberTypes: ['MOBILE'] })
        .state
    ).toBe('incomplete');
  });

  it('FIXED_LINE_OR_MOBILE accepts both mobile and fixed', () => {
    const opts = { allowedNumberTypes: ['FIXED_LINE_OR_MOBILE' as const] };
    expect(isValidPhoneNumber('0612345678', 'FR', opts)).toBe(true);
    expect(isValidPhoneNumber('0142685300', 'FR', opts)).toBe(true);
    expect(validatePhoneNumber('0800123456', 'FR', opts).error).toBe(
      'WRONG_TYPE'
    );
  });

  it('other types', () => {
    expect(
      isValidPhoneNumber('0800123456', 'FR', {
        allowedNumberTypes: ['TOLL_FREE'],
      })
    ).toBe(true);
    expect(
      validatePhoneNumber('0612345678', 'FR', {
        allowedNumberTypes: ['TOLL_FREE'],
      }).error
    ).toBe('WRONG_TYPE');
  });

  it('describes allowed types in messages', () => {
    const fr = getMessages('fr');
    expect(describeNumberTypes(['MOBILE'], fr)).toBe('mobile');
    expect(describeNumberTypes(['MOBILE', 'FIXED_LINE'], fr)).toBe(
      'mobile ou fixe'
    );
    expect(describeNumberTypes(['MOBILE', 'FIXED_LINE', 'VOIP'], fr)).toBe(
      'mobile, fixe ou VoIP'
    );
    expect(describeNumberTypes(undefined, getMessages('en'))).toBe('mobile');
    expect(describeNumberTypes([], fr)).toBe('');
  });
});

describe('onlyCountries / excludedCountries', () => {
  it('COUNTRY_NOT_ALLOWED for a detected excluded country', () => {
    const value = validatePhoneNumber('+33612345678', 'BJ', {
      onlyCountries: ['BJ', 'TG'],
    });
    expect(value).toMatchObject({
      isValid: false,
      error: 'COUNTRY_NOT_ALLOWED',
      country: 'FR',
    });
    expect(value.errorMessage).toBe(
      'Les numéros de ce pays (France) ne sont pas acceptés'
    );
    expect(
      validatePhoneNumber('+33612345678', 'BJ', { excludedCountries: ['FR'] })
        .error
    ).toBe('COUNTRY_NOT_ALLOWED');
  });

  it('COUNTRY_NOT_ALLOWED for a national number of an excluded selected country', () => {
    expect(
      validatePhoneNumber('0612345678', 'FR', { excludedCountries: ['FR'] })
        .error
    ).toBe('COUNTRY_NOT_ALLOWED');
  });

  it('prefers an allowed country among those sharing a calling code', () => {
    expect(
      validatePhoneNumber('+1', undefined, { onlyCountries: ['CA'] }).country
    ).toBe('CA');
    const ca = analyzePhoneNumber('+1416', undefined, {
      onlyCountries: ['CA'],
    });
    expect(ca.country).toBe('CA');
  });

  it('names the excluded country sharing the calling code', () => {
    const gg = validatePhoneNumber('07911 123456', 'GB', {
      excludedCountries: ['GG'],
    });
    expect(gg).toMatchObject({
      isValid: false,
      error: 'COUNTRY_NOT_ALLOWED',
      country: 'GB',
    });
    expect(gg.errorMessage).toBe(
      'Les numéros de ce pays (Guernesey) ne sont pas acceptés'
    );
    const bs = validatePhoneNumber('2423573000', 'US', {
      excludedCountries: ['BS'],
    });
    expect(bs.error).toBe('COUNTRY_NOT_ALLOWED');
    expect(
      isValidPhoneNumber('07400 123456', 'GB', { excludedCountries: ['GG'] })
    ).toBe(true);
  });

  it('pure functions exclude nothing by default', () => {
    expect(isValidPhoneNumber('+247 6000')).toBe(libIsValid('+2476000'));
  });
});

describe('customValidator', () => {
  it('can reject with a code or a message', () => {
    const byCode = validatePhoneNumber('0612345678', 'FR', {
      customValidator: () => 'WRONG_TYPE',
    });
    expect(byCode).toMatchObject({
      isValid: false,
      error: 'WRONG_TYPE',
      state: 'invalid',
    });
    const byMessage = validatePhoneNumber('0612345678', 'FR', {
      customValidator: (v) =>
        v.e164 === '+33612345678' ? 'Numéro déjà utilisé' : null,
    });
    expect(byMessage).toMatchObject({
      isValid: false,
      error: 'CUSTOM_RULE',
      errorMessage: 'Numéro déjà utilisé',
    });
    expect(
      isValidPhoneNumber('0612345678', 'FR', { customValidator: () => null })
    ).toBe(true);
  });

  it('is not called for invalid numbers', () => {
    const spy = jest.fn(() => null);
    validatePhoneNumber('0612', 'FR', { customValidator: spy });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('messages', () => {
  it('translates to English', () => {
    expect(
      validatePhoneNumber('06123456789', 'FR', { locale: 'en' }).errorMessage
    ).toBe('Number too long for France');
    expect(
      validatePhoneNumber('0142685300', 'FR', {
        locale: 'en-GB',
        allowedNumberTypes: ['MOBILE'],
      }).errorMessage
    ).toBe('Please enter a mobile number');
  });

  it('accepts overrides and country name overrides', () => {
    const value = validatePhoneNumber('06123456789', 'FR', {
      messages: {
        errors: { TOO_LONG: 'Trop long ({country}, +{callingCode})' },
      },
      countryNameOverrides: { FR: 'la France' },
    });
    expect(value.errorMessage).toBe('Trop long (la France, +33)');
  });

  it('getErrorMessage handles null and custom messages', () => {
    expect(getErrorMessage(null, { country: 'FR' })).toBeNull();
    expect(
      getErrorMessage('CUSTOM_RULE', { country: 'FR', customMessage: 'Nope' })
    ).toBe('Nope');
  });

  it('toPhoneValue can hide the message', () => {
    const analysis = analyzePhoneNumber('06123456789', 'FR');
    expect(
      toPhoneValue(analysis, 'x', submittedState(analysis), {}, false)
        .errorMessage
    ).toBeNull();
  });
});

describe('helpers', () => {
  it('isPhoneValidationError', () => {
    expect(isPhoneValidationError('TOO_SHORT')).toBe(true);
    expect(isPhoneValidationError('Nope')).toBe(false);
    expect(isPhoneValidationError(3)).toBe(false);
  });

  it('submittedState', () => {
    expect(submittedState(analyzePhoneNumber('', 'FR'))).toBe('idle');
    expect(
      submittedState(analyzePhoneNumber('', 'FR', { required: true }))
    ).toBe('invalid');
    expect(submittedState(analyzePhoneNumber('0612345678', 'FR'))).toBe(
      'valid'
    );
    expect(submittedState(analyzePhoneNumber('0612', 'FR'))).toBe('incomplete');
  });

  it('ignores unsupported country codes', () => {
    expect(validatePhoneNumber('0612345678', 'ZZ' as never).error).toBe(
      'INVALID_COUNTRY'
    );
  });
});
