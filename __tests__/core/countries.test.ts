import {
  buildSearchIndex,
  DEFAULT_EXCLUDED_COUNTRIES,
  getCountries,
  getCountry,
  getCountryName,
  getFlagEmoji,
  isCountryAllowed,
  searchCountries,
} from 'react-native-phone-input-field/core';

import { __resetDisplayNamesCache } from '../../src/i18n';

function setDisplayNames(value: unknown) {
  Object.defineProperty(Intl, 'DisplayNames', {
    value,
    configurable: true,
    writable: true,
  });
  __resetDisplayNamesCache();
}

describe('countries', () => {
  it('getCountry', () => {
    expect(getCountry('BJ', 'fr')).toEqual({
      iso2: 'BJ',
      callingCode: '229',
      name: 'Bénin',
      englishName: 'Benin',
      flag: '🇧🇯',
    });
    expect(getCountry('BJ', 'en').name).toBe('Benin');
    expect(getCountry('bj' as never, 'fr').iso2).toBe('BJ');
    expect(getCountry('BJ', 'fr', { BJ: 'Benin Republic' }).name).toBe(
      'Benin Republic'
    );
    expect(() => getCountry('ZZ' as never)).toThrow(/Unknown country/);
    expect(getCountry('BJ', 'fr')).toBe(getCountry('BJ', 'fr'));
  });

  it('getCountries sorts by localized name and filters', () => {
    const fr = getCountries('fr');
    expect(fr[0]!.iso2).toBe('AF'); // Afghanistan
    expect(fr.some((c) => c.iso2 === 'GG')).toBe(false); // legacy EXCLUDED_COUNTRIES
    expect(fr.some((c) => c.iso2 === 'XK')).toBe(false);
    const idx = (code: string) => fr.findIndex((c) => c.iso2 === code);
    expect(idx('EG')).toBeLessThan(idx('ES')); // Égypte < Espagne (accents ignored)
    expect(
      getCountries({ excludedCountries: [] }).some((c) => c.iso2 === 'AC')
    ).toBe(true);
    expect(
      getCountries({ onlyCountries: ['BJ', 'TG'] }).map((c) => c.iso2)
    ).toEqual(['BJ', 'TG']);
    expect(getCountries().length).toBeGreaterThan(200);
  });

  it('isCountryAllowed', () => {
    expect(isCountryAllowed('BJ')).toBe(true);
    expect(isCountryAllowed(DEFAULT_EXCLUDED_COUNTRIES[0]!)).toBe(false);
    expect(isCountryAllowed('FR', { onlyCountries: ['BJ'] })).toBe(false);
    expect(isCountryAllowed('FR', { onlyCountries: [] })).toBe(true);
  });

  it('flag emoji', () => {
    expect(getFlagEmoji('bj')).toBe('🇧🇯');
    expect(getFlagEmoji('FR')).toBe('🇫🇷');
    expect(getFlagEmoji('001')).toBe('');
  });

  it('country names fall back on embedded tables without Intl.DisplayNames', () => {
    const original = Intl.DisplayNames;
    try {
      // Simulate an engine without DisplayNames (older Hermes).
      setDisplayNames(undefined);
      expect(getCountryName('CI', 'fr')).toBe('Côte d’Ivoire');
      expect(getCountryName('DE', 'en')).toBe('Germany');
      expect(getCountryName('DE', 'de')).toBe('Germany'); // unknown language → English
    } finally {
      setDisplayNames(original);
    }
    expect(getCountryName('DE', 'de')).toBe('Deutschland');
  });

  it('country names survive a throwing DisplayNames', () => {
    const original = Intl.DisplayNames;
    try {
      setDisplayNames(function () {
        return {
          of: () => {
            throw new Error('nope');
          },
        };
      });
      expect(getCountryName('BJ', 'fr')).toBe('Bénin');
      setDisplayNames(function () {
        throw new Error('unsupported');
      });
      expect(getCountryName('BJ', 'en')).toBe('Benin');
    } finally {
      setDisplayNames(original);
    }
  });
});

describe('searchCountries', () => {
  const index = buildSearchIndex(getCountries('fr'));
  const search = (q: string) => searchCountries(index, q).map((c) => c.iso2);

  it('ignores accents and case', () => {
    expect(search("cote d'iv")[0]).toBe('CI');
    expect(search('COTE')[0]).toBe('CI');
    expect(search('bénin')[0]).toBe('BJ');
    expect(search('etats')).toContain('US');
  });

  it('matches calling codes in every form', () => {
    for (const q of ['229', '+229', '00229', '+ 229'])
      expect(search(q)[0]).toBe('BJ');
    const one = search('+1');
    expect(one[0]).toBe('US');
    expect(one).toContain('CA');
    expect(search('22')).toContain('BJ'); // calling code prefix
    expect(search('+12')).toEqual([]); // no calling code starts with 12
  });

  it('matches ISO codes and aliases', () => {
    expect(search('bj')[0]).toBe('BJ');
    expect(search('USA')[0]).toBe('US');
    expect(search('uk')[0]).toBe('GB');
    expect(search('RDC')[0]).toBe('CD');
    expect(search('dahomey')).toEqual(['BJ']);
    expect(search('germany')[0]).toBe('DE'); // English name
  });

  it('orders exact, then word start, then substring', () => {
    const results = search('guinee');
    // "Guinée" (exact) first, then "Guinée équatoriale" / "Guinée-Bissau" (start), then "Papouasie-Nouvelle-Guinée" (word start)…
    expect(results[0]).toBe('GN');
    expect(results.indexOf('GQ')).toBeGreaterThan(0);
    const niger = search('niger');
    expect(niger[0]).toBe('NE');
    expect(niger.indexOf('NG')).toBeGreaterThan(0);
    const substring = search('ande');
    expect(substring.length).toBeGreaterThan(0);
  });

  it('returns everything for an empty query and nothing for nonsense', () => {
    expect(searchCountries(index, '  ').length).toBe(index.length);
    expect(searchCountries(index, '’').length).toBe(index.length);
    expect(search('zzzzzz')).toEqual([]);
  });
});
