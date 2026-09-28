import {
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js/core';

import { internationalPrefixLength } from './detection';
import {
  formatAsYouType,
  formatInternationalAsYouType,
  toNationalInputDigits,
} from './formatting';
import { getMetadata } from './metadata';
import {
  caretAfterDigits,
  countDigitsBefore,
  normalizeDigits,
  sanitizePhoneInput,
} from './normalize';
import { analyzePhoneNumber, type ValidationOptions } from './validation';

/**
 * Pure text-editing logic of the phone input: formatting as you type, caret
 * preservation, separator deletion, paste / autofill of international
 * numbers, length limit. The React hook only wires it to a `TextInput`.
 */

export interface PhoneInputState {
  /** Text currently displayed in the input. */
  text: string;
  /** Selected country. */
  country: CountryCode;
}

export interface ProcessInputOptions extends Pick<
  ValidationOptions,
  'onlyCountries' | 'excludedCountries' | 'autoDetectCountry' | 'customRules'
> {
  /**
   * Refuse digits that would make the number longer than any number of the
   * country. Default `true`. Disable it to let users see the `TOO_LONG` error.
   */
  limitMaxLength?: boolean;
}

export interface ProcessInputResult {
  /** Formatted text to display. */
  text: string;
  /** Country after the edit (may have been detected from `+xxx`). */
  country: CountryCode;
  /** Where to put the caret in `text`. */
  caret: number;
  /** The edit was refused (length limit); `text` is the previous text. */
  rejected: boolean;
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

interface NormalizedEdit {
  /** Text after applying the user's intent. */
  working: string;
  /** Number of digits before the caret in `working`. */
  caretDigits: number;
  /** Digits added by the edit (0 for deletions). */
  insertedDigits: number;
}

/**
 * Figures out what the user meant. Deleting a separator (space, dash,
 * parenthesis) with backspace deletes the digit before it, as users expect.
 */
function normalizeEdit(prev: string, rawNext: string): NormalizedEdit {
  const next = normalizeDigits(rawNext);
  let prefix = 0;
  const minLength = Math.min(prev.length, next.length);
  while (prefix < minLength && prev[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < minLength - prefix &&
    prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const removed = prev.slice(prefix, prev.length - suffix);
  const inserted = next.slice(prefix, next.length - suffix);

  const removedOnlySeparators =
    removed.length > 0 && inserted.length === 0 && !/[\d+]/.test(removed);
  if (removedOnlySeparators) {
    // Backspace on a separator → remove the previous digit.
    let j = prefix - 1;
    while (j >= 0 && !isDigit(prev[j])) j -= 1;
    if (j >= 0) {
      return {
        working: prev.slice(0, j) + prev.slice(j + 1),
        caretDigits: countDigitsBefore(prev, j),
        insertedDigits: 0,
      };
    }
  }
  const caretPos = next.length - suffix;
  return {
    working: next,
    caretDigits: countDigitsBefore(next, caretPos),
    insertedDigits: countDigitsBefore(inserted, inserted.length),
  };
}

function isTooLong(
  digits: string,
  country: CountryCode,
  options: ProcessInputOptions
): boolean {
  if (!digits) return false;
  const rule = options.customRules?.[country];
  if (rule?.mode === 'override' && rule.lengths?.length) {
    return digits.length > Math.max(...rule.lengths) + 1;
  }
  return (
    validatePhoneNumberLength(digits, country, getMetadata()) === 'TOO_LONG'
  );
}

/**
 * Applies a `TextInput` change.
 *
 * @example
 * processPhoneInput({ text: '01 97 12', country: 'BJ' }, '01 97 123')
 * // → { text: '01 97 12 3', caret: 10, country: 'BJ', rejected: false }
 */
export function processPhoneInput(
  prev: PhoneInputState,
  nextText: string,
  options: ProcessInputOptions = {}
): ProcessInputResult {
  const { country } = prev;
  if (nextText === prev.text) {
    return {
      text: prev.text,
      country,
      caret: prev.text.length,
      rejected: false,
    };
  }
  const edit = normalizeEdit(prev.text, nextText);
  const { hasPlus, digits } = sanitizePhoneInput(edit.working);

  const analysis =
    digits || hasPlus
      ? analyzePhoneNumber(edit.working, country, {
          onlyCountries: options.onlyCountries,
          excludedCountries: options.excludedCountries,
          autoDetectCountry: options.autoDetectCountry,
          customRules: options.customRules,
        })
      : null;

  // International input that must stay as typed: "+22", "+999…", or a
  // country that is not allowed.
  if (analysis?.internationalInput != null) {
    const intlDigits = analysis.internationalInput.slice(1);
    const text = formatInternationalAsYouType(intlDigits);
    const iddLength = hasPlus ? 0 : internationalPrefixLength(digits, country);
    const caretDigits = Math.max(0, edit.caretDigits - iddLength);
    return {
      text,
      country,
      caret: caretAfterDigits(text, caretDigits),
      rejected: false,
    };
  }

  // International input resolved to a country: keep only the national part.
  const wasInternational =
    hasPlus || (analysis !== null && analysis.nationalDigits !== digits);
  if (analysis && wasInternational) {
    const target = analysis.country;
    const nationalDigits = toNationalInputDigits(
      analysis.nationalDigits,
      analysis.callingCode,
      target
    );
    const text = formatAsYouType(nationalDigits, target);
    return { text, country: target, caret: text.length, rejected: false };
  }

  // National input.
  let nationalDigits = digits;
  let target = analysis?.country ?? country;
  if (
    options.limitMaxLength !== false &&
    isTooLong(nationalDigits, target, options)
  ) {
    const prevDigits = sanitizePhoneInput(prev.text).digits;
    const prevWasTooLong = isTooLong(prevDigits, country, options);
    if (!prevWasTooLong && edit.insertedDigits <= 1) {
      return {
        text: prev.text,
        country,
        caret: caretAfterDigits(prev.text, Math.max(0, edit.caretDigits - 1)),
        rejected: true,
      };
    }
    // Paste / autofill: keep the longest acceptable prefix.
    while (nationalDigits && isTooLong(nationalDigits, target, options)) {
      nationalDigits = nationalDigits.slice(0, -1);
    }
    target = country;
  }
  const text = formatAsYouType(nationalDigits, target);
  return {
    text,
    country: target,
    caret: caretAfterDigits(
      text,
      Math.min(edit.caretDigits, nationalDigits.length)
    ),
    rejected: false,
  };
}

/**
 * Parses an external value (`value` / `defaultValue` / `ref.setValue`):
 * E.164 (`+2290197123456`), international with separators, or national
 * digits for `country`.
 */
export function parseExternalValue(
  value: string | null | undefined,
  country: CountryCode,
  options: ProcessInputOptions = {}
): { text: string; country: CountryCode } {
  if (!value) return { text: '', country };
  const result = processPhoneInput({ text: '', country }, value, {
    ...options,
    limitMaxLength: false,
  });
  return { text: result.text, country: result.country };
}

/**
 * Re-formats the current text for another country (country picker), without
 * losing what was typed.
 */
export function reformatForCountry(text: string, country: CountryCode): string {
  const { hasPlus, digits } = sanitizePhoneInput(text);
  if (hasPlus) return formatInternationalAsYouType(digits);
  return formatAsYouType(digits, country);
}
