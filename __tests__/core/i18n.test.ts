import { getMessages, interpolate, languageOf } from '../../src/i18n';

describe('i18n', () => {
  it('languageOf', () => {
    expect(languageOf('fr-BJ')).toBe('fr');
    expect(languageOf('EN_us')).toBe('en');
    expect(languageOf(undefined)).toBe('fr');
  });

  it('getMessages defaults to FR, falls back to EN for other languages', () => {
    expect(getMessages().modalTitle).toBe('Sélectionnez un pays');
    expect(getMessages('en').modalTitle).toBe('Select a country');
    expect(getMessages('de').modalTitle).toBe('Select a country');
  });

  it('merges overrides deeply and caches the result', () => {
    const overrides = { modalTitle: 'Pays', errors: { REQUIRED: 'Requis' } };
    const merged = getMessages('fr', overrides);
    expect(merged.modalTitle).toBe('Pays');
    expect(merged.errors.REQUIRED).toBe('Requis');
    expect(merged.errors.TOO_LONG).toBe('Numéro trop long pour {country}');
    expect(getMessages('fr', overrides)).toBe(merged);
    expect(getMessages('en', overrides).close).toBe('Close');
  });

  it('interpolate', () => {
    expect(interpolate('{a} {b} {c}', { a: 1, b: 'x' })).toBe('1 x {c}');
  });
});
