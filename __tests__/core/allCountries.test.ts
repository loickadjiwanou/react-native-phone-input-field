/** Spec §9.3: loop on every country known by the metadata. */
import { isValidPhoneNumber as libIsValid } from 'libphonenumber-js/max';
import {
  getExampleNumber,
  getSupportedCountryCodes,
  validatePhoneNumber,
  type CountryCode,
} from 'react-native-phone-input-field/core';

const countries = getSupportedCountryCodes();

/**
 * Variable-length numbering plans: removing one digit or adding two can yield
 * another *genuinely valid* number (e.g. Austrian mobiles have 10 to 13
 * digits). For these, our verdict must equal libphonenumber's.
 */
const VARIABLE_LENGTH: CountryCode[] = [
  'AT',
  'AX',
  'EE',
  'FI',
  'ID',
  'KR',
  'NZ',
  'RS',
  'TK',
];

describe('every country', () => {
  it('knows about 245 countries', () => {
    expect(countries.length).toBeGreaterThanOrEqual(240);
  });

  const withExample = countries.filter((c) =>
    getExampleNumber(c, 'MOBILE', 'E164')
  );

  it('has an example mobile number for (almost) every country', () => {
    expect(withExample.length).toBeGreaterThanOrEqual(countries.length - 5);
  });

  it.each(withExample)(
    '%s: example mobile is valid, -1 digit is not, +2 digits is not',
    (country) => {
      const e164 = getExampleNumber(country, 'MOBILE', 'E164');
      const valid = validatePhoneNumber(e164);
      expect(valid.isValid).toBe(true);
      expect(valid.error).toBeNull();

      const national = getExampleNumber(country, 'MOBILE', 'NATIONAL');
      expect(validatePhoneNumber(national, country).isValid).toBe(true);

      const shorter = validatePhoneNumber(e164.slice(0, -1));
      const longer = validatePhoneNumber(`${e164}00`);

      if (VARIABLE_LENGTH.includes(country)) {
        expect(shorter.isValid).toBe(libIsValid(e164.slice(0, -1)));
        expect(longer.isValid).toBe(libIsValid(`${e164}00`));
        return;
      }
      expect(shorter.isValid).toBe(false);
      expect(['TOO_SHORT', 'INVALID_NUMBER']).toContain(shorter.error);
      expect(longer.isValid).toBe(false);
      expect(longer.error).not.toBeNull();
    }
  );
});
