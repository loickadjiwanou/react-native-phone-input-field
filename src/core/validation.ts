import {
  AsYouType,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js/core';

import {
  getCountryName,
  getMessages,
  interpolate,
  type Messages,
} from '../i18n';
import type {
  CustomRules,
  CustomValidator,
  DeepPartial,
  NumberType,
  PhoneFieldState,
  PhoneValidationError,
  PhoneValue,
} from '../types';
import { isCountryAllowed } from './countries';
import { evaluateCustomRule, isRulePrefixViable } from './customRules';
import {
  internationalPrefixLength,
  resolveCountryForCallingCode,
  splitCallingCode,
} from './detection';
import { formatAsYouType } from './formatting';
import {
  getCountriesForCallingCode,
  getMetadata,
  getNumberingPlan,
  isSupportedCountryCode,
  metadataHasNumberTypes,
} from './metadata';
import { extractDigits, sanitizePhoneInput } from './normalize';
import {
  extractNationalSignificantNumber,
  isViableForTypes,
  isViableNationalPrefix,
  maxPossibleLength,
  nsnCandidates,
} from './viability';

/** Default country when nothing else is known (spec: Benin). */
export const FALLBACK_COUNTRY: CountryCode = 'BJ';

export const PHONE_VALIDATION_ERRORS: readonly PhoneValidationError[] = [
  'REQUIRED',
  'TOO_SHORT',
  'TOO_LONG',
  'INVALID_COUNTRY',
  'INVALID_NUMBER',
  'NOT_A_NUMBER',
  'WRONG_TYPE',
  'COUNTRY_NOT_ALLOWED',
  'CUSTOM_RULE',
];

export function isPhoneValidationError(
  value: unknown
): value is PhoneValidationError {
  return (
    typeof value === 'string' &&
    (PHONE_VALIDATION_ERRORS as readonly string[]).includes(value)
  );
}

export interface ValidationOptions {
  /** Empty input is an error (`REQUIRED`). Default `false`. */
  required?: boolean;
  /**
   * Accepted number types, e.g. `['MOBILE']` for SMS OTP. `FIXED_LINE_OR_MOBILE`
   * numbers (US, CA…) are accepted for both `MOBILE` and `FIXED_LINE`.
   * Ignored with the `min` metadata (no type information).
   */
  allowedNumberTypes?: readonly NumberType[];
  /** Business rules per country, on top of libphonenumber. */
  customRules?: CustomRules;
  /** Extra synchronous check, run once the number is otherwise valid. */
  customValidator?: CustomValidator;
  /** Only accept numbers from these countries. */
  onlyCountries?: readonly CountryCode[];
  /** Reject numbers from these countries. Default for pure functions: none. */
  excludedCountries?: readonly CountryCode[];
  /**
   * Switch to the number's real country when it differs from `country`
   * (`+33…` typed with BJ selected, or a Canadian number with US selected).
   * Default `true`.
   */
  autoDetectCountry?: boolean;
  /** Language of `errorMessage` (`fr` default, `en`). */
  locale?: string;
  /** Overrides of the bundled messages. */
  messages?: DeepPartial<Messages>;
  /** Overrides of country names used in messages. */
  countryNameOverrides?: Partial<Record<CountryCode, string>>;
}

/** How serious a problem is, independently of when it is displayed. */
export type Severity = 'none' | 'incomplete' | 'invalid';

/** Low-level result of the validation engine. */
export interface PhoneAnalysis {
  /** Country of the number (detected from `+xxx`, or the given one). */
  country: CountryCode;
  callingCode: string;
  /** `country` differs from the country passed in. */
  countryChanged: boolean;
  /**
   * National digits as they should appear in a national input (may contain
   * the trunk prefix): FR `0612345678`.
   */
  nationalDigits: string;
  /**
   * Set when the input is international and must stay as typed: calling code
   * still being typed (`+22`), unknown (`+999`) or not allowed.
   */
  internationalInput: string | null;
  /** National significant number. */
  nationalSignificant: string;
  isEmpty: boolean;
  isPossible: boolean;
  isValid: boolean;
  type?: NumberType;
  e164: string | null;
  national: string;
  international: string;
  error: PhoneValidationError | null;
  severity: Severity;
  /** Message coming from a custom rule / validator, overrides the default. */
  customMessage: string | null;
  /** Country named in the error message when it differs from `country`. */
  messageCountry?: CountryCode;
}

function typeMatches(
  type: NumberType | undefined,
  allowed: readonly NumberType[]
): boolean {
  if (!type) return false;
  if (allowed.includes(type)) return true;
  if (type === 'FIXED_LINE_OR_MOBILE') {
    return allowed.includes('MOBILE') || allowed.includes('FIXED_LINE');
  }
  if (type === 'MOBILE' || type === 'FIXED_LINE') {
    return allowed.includes('FIXED_LINE_OR_MOBILE');
  }
  return false;
}

interface Problem {
  error: PhoneValidationError;
  severity: Exclude<Severity, 'none'>;
  customMessage?: string | null;
}

function emptyAnalysis(
  country: CountryCode,
  options: ValidationOptions,
  overrides: Partial<PhoneAnalysis> = {}
): PhoneAnalysis {
  const required = !!options.required;
  return {
    country,
    callingCode: getNumberingPlan(country).callingCode,
    countryChanged: false,
    nationalDigits: '',
    internationalInput: null,
    nationalSignificant: '',
    isEmpty: true,
    isPossible: false,
    isValid: false,
    e164: null,
    national: '',
    international: '',
    error: required ? 'REQUIRED' : null,
    severity: required ? 'incomplete' : 'none',
    customMessage: null,
    ...overrides,
  };
}

/**
 * Core validation. `country` is the selected country; international input
 * (`+…`, `00…`, the country's own IDD) is detected automatically.
 */
export function analyzePhoneNumber(
  input: string,
  country: CountryCode | undefined,
  options: ValidationOptions = {}
): PhoneAnalysis {
  const selected =
    country && isSupportedCountryCode(country) ? country : undefined;
  const base = selected ?? FALLBACK_COUNTRY;
  const autoDetect = options.autoDetectCountry !== false;
  const allowedFilter = (c: CountryCode) =>
    isCountryAllowed(c, {
      onlyCountries: options.onlyCountries,
      excludedCountries: options.excludedCountries ?? [],
    });

  const { hasPlus, digits, hasInvalidChars } = sanitizePhoneInput(input);

  if (!digits && !hasPlus) {
    if (hasInvalidChars) {
      return emptyAnalysis(base, options, {
        isEmpty: false,
        error: 'NOT_A_NUMBER',
        severity: 'invalid',
      });
    }
    return emptyAnalysis(base, options);
  }

  // 1. International input?
  let internationalDigits: string | null = null;
  if (hasPlus) {
    internationalDigits = digits;
  } else {
    const iddLength = internationalPrefixLength(digits, selected);
    if (
      iddLength > 0 &&
      (!selected || !isViableNationalPrefix(digits, selected))
    ) {
      internationalDigits = digits.slice(iddLength);
    }
  }

  let target: CountryCode = base;
  let nationalDigits = digits;

  if (internationalDigits !== null) {
    const raw = `+${internationalDigits}`;
    const split = splitCallingCode(internationalDigits);
    if (split.status === 'pending') {
      return emptyAnalysis(base, options, {
        isEmpty: false,
        internationalInput: raw,
        international: raw,
        error: 'TOO_SHORT',
        severity: 'incomplete',
      });
    }
    const candidates =
      split.status === 'resolved'
        ? getCountriesForCallingCode(split.callingCode)
        : [];
    if (split.status === 'unknown' || candidates.length === 0) {
      return emptyAnalysis(base, options, {
        isEmpty: false,
        internationalInput: raw,
        international: raw,
        error: 'INVALID_COUNTRY',
        severity: 'invalid',
      });
    }
    const { callingCode, rest } = split as {
      callingCode: string;
      rest: string;
    };
    const sameCodeAsSelected =
      !!selected && getNumberingPlan(selected).callingCode === callingCode;
    if (!autoDetect && selected && !sameCodeAsSelected) {
      // Auto-detection disabled: a foreign calling code is an error.
      return emptyAnalysis(base, options, {
        isEmpty: false,
        internationalInput: raw,
        international: raw,
        error: 'INVALID_COUNTRY',
        severity: 'invalid',
      });
    }
    target =
      !autoDetect && selected
        ? selected
        : (resolveCountryForCallingCode(callingCode, rest, {
            currentCountry: selected,
            isAllowed: allowedFilter,
          }) ?? base);
    if (!allowedFilter(target)) {
      return emptyAnalysis(target, options, {
        isEmpty: false,
        countryChanged: target !== selected,
        internationalInput: raw,
        international: raw,
        nationalSignificant: rest,
        error: 'COUNTRY_NOT_ALLOWED',
        severity: 'invalid',
      });
    }
    nationalDigits = rest;
  } else if (!selected) {
    // National number without a country: impossible to interpret.
    return emptyAnalysis(base, options, {
      isEmpty: false,
      nationalDigits: digits,
      national: digits,
      error: 'INVALID_COUNTRY',
      severity: 'invalid',
    });
  } else if (!allowedFilter(selected)) {
    return emptyAnalysis(selected, options, {
      isEmpty: false,
      nationalDigits: digits,
      national: formatAsYouType(digits, selected),
      error: 'COUNTRY_NOT_ALLOWED',
      severity: 'invalid',
    });
  }

  const result = analyzeNational(
    nationalDigits,
    target,
    selected,
    options,
    autoDetect,
    allowedFilter
  );
  if (hasInvalidChars && result.severity !== 'invalid') {
    result.error = 'NOT_A_NUMBER';
    result.severity = 'invalid';
    result.isValid = false;
  }
  result.countryChanged = result.country !== selected;
  return result;
}

function analyzeNational(
  nationalDigits: string,
  initialCountry: CountryCode,
  selected: CountryCode | undefined,
  options: ValidationOptions,
  autoDetect: boolean,
  allowedFilter: (c: CountryCode) => boolean
): PhoneAnalysis {
  const metadata = getMetadata();
  let country = initialCountry;
  const callingCode = getNumberingPlan(country).callingCode;
  const allowedTypes =
    options.allowedNumberTypes &&
    options.allowedNumberTypes.length > 0 &&
    metadataHasNumberTypes()
      ? options.allowedNumberTypes
      : undefined;

  // Country sharing the calling code that the number belongs to, but which
  // is excluded (e.g. a Guernsey number typed with GB selected).
  let blockedCountry: CountryCode | undefined;
  let parsed: PhoneNumber | undefined = nationalDigits
    ? parsePhoneNumberFromString(nationalDigits, country, metadata)
    : undefined;

  // Same calling code, different country (CA typed with US selected…).
  if (
    parsed?.country &&
    parsed.country !== country &&
    parsed.isValid() &&
    getNumberingPlan(parsed.country).callingCode === callingCode
  ) {
    if (autoDetect && allowedFilter(parsed.country)) {
      country = parsed.country;
    } else {
      // Valid elsewhere, not for the selected country.
      if (!allowedFilter(parsed.country)) blockedCountry = parsed.country;
      parsed = undefined;
    }
  }

  const nsn =
    parsed?.nationalNumber ??
    extractNationalSignificantNumber(nationalDigits, country);
  const lengthResult = nationalDigits
    ? validatePhoneNumberLength(nationalDigits, country, metadata)
    : 'TOO_SHORT';
  const isPossible = lengthResult === undefined;
  const rule = options.customRules?.[country];
  const ruleInput = { nsn, national: nationalDigits };
  const maxLength = maxPossibleLength(country);

  const incompleteOrInvalid = (): Problem => {
    if (!isViableNationalPrefix(nationalDigits, country)) {
      return { error: 'INVALID_NUMBER', severity: 'invalid' };
    }
    if (
      allowedTypes &&
      !isViableForTypes(nationalDigits, country, allowedTypes)
    ) {
      return { error: 'WRONG_TYPE', severity: 'invalid' };
    }
    if (
      rule &&
      !nsnCandidates(nationalDigits, country).some((candidate) =>
        isRulePrefixViable(rule, { nsn: candidate, national: nationalDigits })
      )
    ) {
      return {
        error: 'CUSTOM_RULE',
        severity: 'invalid',
        customMessage: rule.message,
      };
    }
    return { error: 'TOO_SHORT', severity: 'incomplete' };
  };

  let problem: Problem | null = null;
  let isValid = false;
  let type: NumberType | undefined;

  if (rule?.mode === 'override') {
    const verdict = evaluateCustomRule(rule, ruleInput, true);
    if (verdict === 'pass') {
      isValid = true;
      type = (parsed?.getType() as NumberType | undefined) ?? undefined;
    } else if (verdict === 'too_long') {
      problem = { error: 'TOO_LONG', severity: 'invalid' };
    } else if (verdict === 'incomplete') {
      problem = { error: 'TOO_SHORT', severity: 'incomplete' };
    } else {
      problem = {
        error: 'CUSTOM_RULE',
        severity: 'invalid',
        customMessage: rule.message,
      };
    }
  } else if (lengthResult === 'TOO_LONG') {
    problem = { error: 'TOO_LONG', severity: 'invalid' };
  } else if (lengthResult === 'INVALID_COUNTRY') {
    problem = { error: 'INVALID_COUNTRY', severity: 'invalid' };
  } else if (!isPossible) {
    // TOO_SHORT, INVALID_LENGTH (between two possible lengths), NOT_A_NUMBER
    // (too few digits to parse).
    problem =
      lengthResult === 'INVALID_LENGTH' && nsn.length >= maxLength
        ? { error: 'INVALID_NUMBER', severity: 'invalid' }
        : incompleteOrInvalid();
  } else if (blockedCountry) {
    problem = { error: 'COUNTRY_NOT_ALLOWED', severity: 'invalid' };
  } else if (!parsed || !parsed.isValid() || parsed.country !== country) {
    // Possible length but invalid: may still become valid with more digits.
    problem =
      nsn.length < maxLength
        ? incompleteOrInvalid()
        : { error: 'INVALID_NUMBER', severity: 'invalid' };
  } else {
    type = parsed.getType() as NumberType | undefined;
    if (allowedTypes && !typeMatches(type, allowedTypes)) {
      const canGrow =
        nsn.length < maxLength &&
        isViableForTypes(nationalDigits, country, allowedTypes);
      problem = canGrow
        ? { error: 'TOO_SHORT', severity: 'incomplete' }
        : { error: 'WRONG_TYPE', severity: 'invalid' };
    } else if (rule) {
      const national = extractDigits(parsed.formatNational());
      const verdict = evaluateCustomRule(rule, { nsn, national }, true);
      if (verdict === 'pass') isValid = true;
      else if (verdict === 'incomplete')
        problem = { error: 'TOO_SHORT', severity: 'incomplete' };
      else if (verdict === 'too_long')
        problem = { error: 'TOO_LONG', severity: 'invalid' };
      else
        problem = {
          error: 'CUSTOM_RULE',
          severity: 'invalid',
          customMessage: rule.message,
        };
    } else {
      isValid = true;
    }
  }

  const finalCallingCode = getNumberingPlan(country).callingCode;
  const possibleForOutput =
    isValid || (isPossible && rule?.mode !== 'override');
  const e164 = isValid
    ? (parsed?.number ?? `+${finalCallingCode}${nsn}`)
    : possibleForOutput && parsed
      ? parsed.number
      : null;

  let national: string;
  let international: string;
  if (parsed && (isValid || isPossible)) {
    national = parsed.formatNational();
    international = parsed.formatInternational();
  } else {
    national = formatAsYouType(nationalDigits, country);
    international = nsn
      ? new AsYouType(undefined, metadata).input(`+${finalCallingCode}${nsn}`)
      : `+${finalCallingCode}`;
  }

  return {
    country,
    callingCode: finalCallingCode,
    countryChanged: country !== selected,
    nationalDigits,
    internationalInput: null,
    nationalSignificant: nsn,
    isEmpty: false,
    isPossible: isPossible || isValid,
    isValid,
    type,
    e164,
    national,
    international,
    error: problem?.error ?? null,
    severity: problem?.severity ?? 'none',
    customMessage: problem?.customMessage ?? null,
    messageCountry:
      problem?.error === 'COUNTRY_NOT_ALLOWED' ? blockedCountry : undefined,
  };
}

/** Human list of types: `mobile`, `mobile ou fixe`, `a, b ou c`. */
export function describeNumberTypes(
  types: readonly NumberType[] | undefined,
  messages: Messages
): string {
  const labels = [
    ...new Set((types ?? ['MOBILE']).map((t) => messages.numberTypes[t])),
  ];
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} ${messages.or} ${labels[labels.length - 1]}`;
}

/** Translated message for an error code. */
export function getErrorMessage(
  error: PhoneValidationError | null,
  context: {
    country: CountryCode;
    customMessage?: string | null;
    allowedNumberTypes?: readonly NumberType[];
    locale?: string;
    messages?: DeepPartial<Messages>;
    countryNameOverrides?: Partial<Record<CountryCode, string>>;
  }
): string | null {
  if (!error) return null;
  if (context.customMessage) return context.customMessage;
  const messages = getMessages(context.locale, context.messages);
  return interpolate(messages.errors[error], {
    country: getCountryName(
      context.country,
      context.locale,
      context.countryNameOverrides
    ),
    callingCode: getNumberingPlan(context.country).callingCode,
    types: describeNumberTypes(context.allowedNumberTypes, messages),
  });
}

/** State as if the form had just been submitted (used by pure functions). */
export function submittedState(analysis: PhoneAnalysis): PhoneFieldState {
  if (analysis.isValid) return 'valid';
  if (analysis.isEmpty) return analysis.error ? 'invalid' : 'idle';
  return analysis.severity === 'incomplete' ? 'incomplete' : 'invalid';
}

/**
 * Builds a `PhoneValue` and runs `customValidator` when the number is
 * otherwise valid.
 */
export function toPhoneValue(
  analysis: PhoneAnalysis,
  raw: string,
  state: PhoneFieldState,
  options: ValidationOptions,
  showError = true
): PhoneValue {
  let { error, isValid } = analysis;
  let customMessage = analysis.customMessage;
  let finalState = state;

  const build = (): PhoneValue => ({
    raw,
    national: analysis.national,
    international: analysis.international,
    e164: analysis.e164,
    country: analysis.country,
    callingCode: analysis.callingCode,
    isValid,
    isPossible: analysis.isPossible,
    type: analysis.type,
    state: finalState,
    error,
    errorMessage:
      showError && error
        ? getErrorMessage(error, {
            country: analysis.messageCountry ?? analysis.country,
            customMessage,
            allowedNumberTypes: options.allowedNumberTypes,
            locale: options.locale,
            messages: options.messages,
            countryNameOverrides: options.countryNameOverrides,
          })
        : null,
  });

  if (isValid && options.customValidator) {
    const verdict = options.customValidator(build());
    if (verdict) {
      isValid = false;
      error = isPhoneValidationError(verdict) ? verdict : 'CUSTOM_RULE';
      customMessage = isPhoneValidationError(verdict) ? null : verdict;
      if (finalState === 'valid') finalState = 'invalid';
    }
  }
  return build();
}

/**
 * Validates a phone number without any UI (works in Node).
 *
 * @example
 * validatePhoneNumber('+2290197123456').isValid // true
 * validatePhoneNumber('0612345678', 'FR').e164   // '+33612345678'
 */
export function validatePhoneNumber(
  input: string,
  country?: CountryCode,
  options: ValidationOptions = {}
): PhoneValue {
  const analysis = analyzePhoneNumber(input, country, options);
  return toPhoneValue(analysis, input, submittedState(analysis), options);
}

/** Shortcut for `validatePhoneNumber(...).isValid`. */
export function isValidPhoneNumber(
  input: string,
  country?: CountryCode,
  options: ValidationOptions = {}
): boolean {
  return validatePhoneNumber(input, country, options).isValid;
}
