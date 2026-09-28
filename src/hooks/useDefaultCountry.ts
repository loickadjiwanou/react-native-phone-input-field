import { useMemo } from 'react';
import { I18nManager, NativeModules, Platform } from 'react-native';

import { isCountryAllowed } from '../core/countries';
import { isSupportedCountryCode } from '../core/metadata';
import { FALLBACK_COUNTRY } from '../core/validation';
import type { CountryCode } from '../types';

// Metro resolves `require` calls placed lexically inside `try` as optional
// dependencies: the app still bundles when the package is not installed.
declare const require: (id: string) => unknown;

interface ExpoLocalizationLike {
  getLocales?: () => { regionCode?: string | null; languageTag?: string }[];
}

function regionFromLocaleTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const parts = tag.replace('_', '-').split('-');
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const part = parts[i]!;
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return null;
}

function fromExpoLocalization(): string | null {
  try {
    const localization = require('expo-localization') as ExpoLocalizationLike;
    const locales = localization.getLocales?.() ?? [];
    for (const locale of locales) {
      const region =
        locale.regionCode ?? regionFromLocaleTag(locale.languageTag);
      if (region) return region.toUpperCase();
    }
  } catch {
    // expo-localization not installed.
  }
  return null;
}

function fromNativeModules(): string | null {
  try {
    if (Platform.OS === 'ios') {
      const settings = (
        NativeModules.SettingsManager as
          | { settings?: { AppleLocale?: string; AppleLanguages?: string[] } }
          | undefined
      )?.settings;
      return regionFromLocaleTag(
        settings?.AppleLocale ?? settings?.AppleLanguages?.[0]
      );
    }
    const constants = (
      I18nManager as unknown as {
        getConstants?: () => { localeIdentifier?: string };
      }
    ).getConstants?.();
    return regionFromLocaleTag(constants?.localeIdentifier);
  } catch {
    return null;
  }
}

function fromIntl(): string | null {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    return regionFromLocaleTag(tag);
  } catch {
    return null;
  }
}

/**
 * Country of the device, from `expo-localization` when installed, then the
 * native locale, then `Intl`. `null` when unknown.
 */
export function getDeviceCountry(): CountryCode | null {
  for (const source of [fromExpoLocalization, fromNativeModules, fromIntl]) {
    const region = source();
    if (region && isSupportedCountryCode(region)) return region;
  }
  return null;
}

export interface DefaultCountryOptions {
  onlyCountries?: readonly CountryCode[];
  excludedCountries?: readonly CountryCode[];
  preferredCountries?: readonly CountryCode[];
  /** Last resort. Default `'BJ'`. */
  fallbackCountry?: CountryCode;
  /** Use the device locale. Default `true`. */
  detectFromDevice?: boolean;
}

/**
 * Resolves the initial country: `explicit` → device locale → fallback. The
 * result always passes `onlyCountries` / `excludedCountries`.
 */
export function resolveDefaultCountry(
  explicit: CountryCode | undefined,
  options: DefaultCountryOptions = {}
): CountryCode {
  const allowed = (c: CountryCode | null | undefined): c is CountryCode =>
    !!c &&
    isSupportedCountryCode(c) &&
    isCountryAllowed(c, {
      onlyCountries: options.onlyCountries,
      excludedCountries: options.excludedCountries,
    });
  const candidates: (CountryCode | null | undefined)[] = [
    explicit,
    options.detectFromDevice === false ? null : getDeviceCountry(),
    options.fallbackCountry ?? FALLBACK_COUNTRY,
    ...(options.preferredCountries ?? []),
    ...(options.onlyCountries ?? []),
  ];
  for (const c of candidates) if (allowed(c)) return c;
  return options.fallbackCountry ?? FALLBACK_COUNTRY;
}

/** Hook version of `resolveDefaultCountry`, computed once. */
export function useDefaultCountry(
  explicit?: CountryCode,
  options: DefaultCountryOptions = {}
): CountryCode {
  // Computed once: the default country must not change under the user's feet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resolveDefaultCountry(explicit, options), []);
}
