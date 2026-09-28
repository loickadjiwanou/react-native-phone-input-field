import {
  createPrefixRule,
  evaluateCustomRule,
  fullMatch,
  isRulePrefixViable,
  validatePhoneNumber,
  type CustomRule,
} from 'react-native-phone-input-field/core';

describe('custom rules', () => {
  it('fullMatch anchors patterns and ignores g/y flags', () => {
    const re = /01\d/g;
    expect(fullMatch(re, '012')).toBe(true);
    expect(fullMatch(re, '012')).toBe(true); // no lastIndex side effect
    expect(fullMatch(re, 'x012')).toBe(false);
    expect(fullMatch(/1/y, '1')).toBe(true);
  });

  it('evaluateCustomRule', () => {
    const rule: CustomRule = { pattern: /6\d{8}/, lengths: [9] };
    expect(
      evaluateCustomRule(rule, { nsn: '612345678', national: '0612345678' })
    ).toBe('pass');
    expect(
      evaluateCustomRule(rule, { nsn: '712345678', national: '0712345678' })
    ).toBe('fail');
    expect(
      evaluateCustomRule(rule, { nsn: '6123', national: '06123' }, true)
    ).toBe('incomplete');
    expect(
      evaluateCustomRule(rule, { nsn: '6123456789', national: '06123456789' })
    ).toBe('too_long');
    expect(
      evaluateCustomRule(
        { nationalPattern: /06\d{8}/ },
        { nsn: '612345678', national: '0612345678' }
      )
    ).toBe('pass');
    expect(evaluateCustomRule({}, { nsn: '1', national: '1' })).toBe('pass');
  });

  it('isRulePrefixViable', () => {
    expect(
      isRulePrefixViable({ pattern: /6\d+/ }, { nsn: '7', national: '07' })
    ).toBe(false);
    expect(
      isRulePrefixViable(
        { nationalPattern: /06\d+/ },
        { nsn: '7', national: '07' }
      )
    ).toBe(false);
    expect(
      isRulePrefixViable({ lengths: [2] }, { nsn: '123', national: '123' })
    ).toBe(false);
    expect(
      isRulePrefixViable({ pattern: /(?=6)\d+/ }, { nsn: '7', national: '7' })
    ).toBe(true);
  });

  it('createPrefixRule', () => {
    const rule = createPrefixRule({
      prefixes: ['0196', '01 97'],
      lengths: [10],
      message: 'MTN uniquement',
    });
    expect(fullMatch(rule.pattern!, '0197123456')).toBe(true);
    expect(fullMatch(rule.pattern!, '0195123456')).toBe(false);
    expect(rule.message).toBe('MTN uniquement');
  });

  it('extend mode: libphonenumber AND rule', () => {
    const customRules = {
      FR: { pattern: /7\d{8}/, message: 'Seulement les 07' },
    };
    expect(
      validatePhoneNumber('0773123456', 'FR', { customRules }).isValid
    ).toBe(true);
    const rejected = validatePhoneNumber('0612345678', 'FR', { customRules });
    expect(rejected).toMatchObject({
      isValid: false,
      error: 'CUSTOM_RULE',
      errorMessage: 'Seulement les 07',
    });
    expect(validatePhoneNumber('06', 'FR', { customRules }).error).toBe(
      'CUSTOM_RULE'
    );
    expect(validatePhoneNumber('07', 'FR', { customRules }).state).toBe(
      'incomplete'
    );
    // Still libphonenumber-invalid numbers fail.
    expect(
      validatePhoneNumber('0912345678', 'FR', { customRules }).isValid
    ).toBe(false);
  });

  it('extend mode: rule shorter than the plan → TOO_LONG, longer → incomplete', () => {
    const shortRule = { BJ: { lengths: [8] } };
    expect(
      validatePhoneNumber('0197123456', 'BJ', { customRules: shortRule }).error
    ).toBe('TOO_LONG');
    const growRule = { DE: { lengths: [11] } };
    // DE 030 1234567 is valid (10-digit NSN) but the rule wants 11 digits.
    expect(
      validatePhoneNumber('0301234567', 'DE', { customRules: growRule }).state
    ).toBe('incomplete');
  });

  it('override mode replaces libphonenumber for a country', () => {
    const customRules = {
      BJ: {
        pattern: /9\d{7}/,
        lengths: [8],
        mode: 'override' as const,
        message: 'Ancien format uniquement',
      },
    };
    const old = validatePhoneNumber('97123456', 'BJ', { customRules });
    expect(old).toMatchObject({ isValid: true, e164: '+22997123456' });
    expect(validatePhoneNumber('9712', 'BJ', { customRules }).state).toBe(
      'incomplete'
    );
    expect(validatePhoneNumber('971234567', 'BJ', { customRules }).error).toBe(
      'TOO_LONG'
    );
    expect(
      validatePhoneNumber('87123456', 'BJ', { customRules })
    ).toMatchObject({
      error: 'CUSTOM_RULE',
      errorMessage: 'Ancien format uniquement',
    });
  });
});
