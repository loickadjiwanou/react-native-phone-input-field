import type { CountryCode } from 'libphonenumber-js/core';
import type { ComponentRef } from 'react';
import type { TextInput, TextInputProps, View } from 'react-native';

export type { CountryCode };

/**
 * Phone number types, as classified by libphonenumber.
 *
 * Note: some countries (e.g. US, CA) do not distinguish mobile from fixed
 * lines; their numbers are classified as `FIXED_LINE_OR_MOBILE`.
 */
export type NumberType =
  | 'MOBILE'
  | 'FIXED_LINE'
  | 'FIXED_LINE_OR_MOBILE'
  | 'PREMIUM_RATE'
  | 'TOLL_FREE'
  | 'SHARED_COST'
  | 'VOIP'
  | 'PERSONAL_NUMBER'
  | 'PAGER'
  | 'UAN'
  | 'VOICEMAIL';

/** Every error code the validation engine can produce. */
export type PhoneValidationError =
  /** Field is empty but `required` is set. */
  | 'REQUIRED'
  /** Plausible start of a number, but not enough digits yet. */
  | 'TOO_SHORT'
  /** More digits than any number of the country can have. */
  | 'TOO_LONG'
  /** Unknown / unsupported international calling code. */
  | 'INVALID_COUNTRY'
  /** Right length but not a valid number (impossible prefix, unassigned range…). */
  | 'INVALID_NUMBER'
  /** The input is not a phone number at all (letters, symbols…). */
  | 'NOT_A_NUMBER'
  /** Valid number, but its type is not in `allowedNumberTypes`. */
  | 'WRONG_TYPE'
  /** The number belongs to a country excluded by `onlyCountries` / `excludedCountries`. */
  | 'COUNTRY_NOT_ALLOWED'
  /** Rejected by a `customRules` entry or by `customValidator`. */
  | 'CUSTOM_RULE';

/**
 * Visual / semantic state of the field.
 *
 * - `idle`: empty (or not yet validated) and not focused.
 * - `focused`: focused, no error to show yet.
 * - `incomplete`: plausible but too short. Shown with the primary color while
 *   typing, and with the error color after blur / submit (see `errorVisible`).
 * - `invalid`: certainly wrong (too long, impossible prefix, wrong type…).
 * - `valid`: valid for the country and every custom rule.
 * - `disabled`: `editable={false}`.
 */
export type PhoneFieldState =
  'idle' | 'focused' | 'incomplete' | 'invalid' | 'valid' | 'disabled';

/** A selectable country. */
export interface Country {
  /** ISO 3166-1 alpha-2 code, e.g. `"BJ"`. */
  iso2: CountryCode;
  /** International calling code without `+`, e.g. `"229"`. */
  callingCode: string;
  /** Localized name, e.g. `"Bénin"`. */
  name: string;
  /** English name, always available (used by search). */
  englishName: string;
  /** Unicode flag emoji, e.g. `"🇧🇯"`. */
  flag: string;
}

/** Full description of the current phone number. */
export interface PhoneValue {
  /** What the user sees in the input. */
  raw: string;
  /** National format, e.g. `"01 97 12 34 56"`. */
  national: string;
  /** International format, e.g. `"+229 01 97 12 34 56"`. */
  international: string;
  /**
   * E.164 format, e.g. `"+2290197123456"`. `null` while the number is not
   * at least *possible* (right length) for the country. Always send this to
   * your backend.
   */
  e164: string | null;
  /** Country the number belongs to (may have been auto-detected). */
  country: CountryCode;
  /** Calling code without `+`, e.g. `"229"`. */
  callingCode: string;
  /** Valid for the country, allowed types, custom rules and custom validator. */
  isValid: boolean;
  /** Has a possible length for the country (says nothing about validity). */
  isPossible: boolean;
  /** Number type once it is valid (`MOBILE`, `FIXED_LINE`…). */
  type?: NumberType;
  /** Field state. For pure functions, computed as if the form was submitted. */
  state: PhoneFieldState;
  /** Error code, or `null`. Present even when not displayed yet. */
  error: PhoneValidationError | null;
  /** Translated error message, or `null`. */
  errorMessage: string | null;
}

/**
 * A business rule that comes **on top of** libphonenumber (default), or
 * replaces it for one country (`mode: 'override'`).
 *
 * Vocabulary (this distinction was the root cause of bug #1 of the legacy
 * `international-phone-numbers.js`):
 * - **National significant number (NSN)**: the digits after the calling code,
 *   *without* the trunk prefix. FR: `612345678`. BJ: `0197123456` (the `01`
 *   is part of the Beninese number, it is not a trunk prefix).
 * - **National number**: what people dial locally, *with* the trunk prefix
 *   when the country has one. FR: `0612345678`. BJ: `0197123456`.
 */
export interface CustomRule {
  /** Tested against the national significant number (digits only). */
  pattern?: RegExp;
  /** Tested against the national number (with trunk prefix, digits only). */
  nationalPattern?: RegExp;
  /** Allowed lengths of the national significant number, e.g. `[10]`. */
  lengths?: number[];
  /** Error message shown when the rule rejects the number. */
  message?: string;
  /** Free text documenting the rule. */
  description?: string;
  /**
   * - `extend` (default): libphonenumber **and** the rule must accept the number.
   * - `override`: only the rule is used for this country.
   */
  mode?: 'extend' | 'override';
}

export type CustomRules = Partial<Record<CountryCode, CustomRule>>;

/** Synchronous extra validation. Return an error code, a message, or `null`. */
export type CustomValidator = (
  value: PhoneValue
) => PhoneValidationError | string | null | undefined;

/** Recursive `Partial`. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/*
 * React Native types derived from props rather than imported by name, so the
 * package type-checks with both the legacy (≤ 0.79) and the generated strict
 * (≥ 0.80) React Native typings.
 */
/** Instance of a `View` (what `ref.current` holds). */
export type ViewRef = ComponentRef<typeof View>;
/** Instance of a `TextInput` (what `ref.current` holds). */
export type TextInputRef = ComponentRef<typeof TextInput>;
/** Event received by `TextInput#onFocus` / `onBlur`. */
export type InputFocusEvent = Parameters<
  NonNullable<TextInputProps['onFocus']>
>[0];
/** Event received by `TextInput#onSelectionChange`. */
export type InputSelectionChangeEvent = Parameters<
  NonNullable<TextInputProps['onSelectionChange']>
>[0];
