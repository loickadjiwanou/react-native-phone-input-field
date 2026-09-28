import type { MetadataJson } from 'libphonenumber-js/core';
import minMetadata from 'libphonenumber-js/metadata.min.json';
import maxMetadata from 'libphonenumber-js/metadata.max.json';

import {
  getCountriesForCallingCode,
  isSupportedCountryCode,
  metadataHasNumberTypes,
  setPhoneMetadata,
  validatePhoneNumber,
} from 'react-native-phone-input-field/core';

import type * as metadataModule from '../../src/core/metadata';

type MetadataModule = typeof metadataModule;

describe('metadata', () => {
  afterEach(() => setPhoneMetadata(maxMetadata as unknown as MetadataJson));

  it('max metadata has number types', () => {
    expect(metadataHasNumberTypes()).toBe(true);
    expect(validatePhoneNumber('+33612345678').type).toBe('MOBILE');
  });

  it('min metadata validates but cannot enforce types', () => {
    setPhoneMetadata(minMetadata as unknown as MetadataJson);
    expect(metadataHasNumberTypes()).toBe(false);
    const value = validatePhoneNumber('+33142685300', undefined, {
      allowedNumberTypes: ['MOBILE'],
    });
    expect(value.isValid).toBe(true);
    expect(value.type).toBeUndefined();
  });

  it('knows calling codes', () => {
    expect(getCountriesForCallingCode('7')).toEqual(['RU', 'KZ']);
    expect(getCountriesForCallingCode('999')).toEqual([]);
    expect(isSupportedCountryCode('BJ')).toBe(true);
    expect(isSupportedCountryCode('ZZ')).toBe(false);
  });

  it('throws a helpful error without metadata', () => {
    jest.isolateModules(() => {
      const m = require('../../src/core/metadata') as MetadataModule;
      expect(() => m.getMetadata()).toThrow(/No phone metadata registered/);
    });
  });
});
