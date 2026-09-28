/** Public pure API (no metadata registration here). */
export {
  analyzePhoneNumber,
  describeNumberTypes,
  FALLBACK_COUNTRY,
  getErrorMessage,
  isPhoneValidationError,
  isValidPhoneNumber,
  PHONE_VALIDATION_ERRORS,
  submittedState,
  toPhoneValue,
  validatePhoneNumber,
  type PhoneAnalysis,
  type Severity,
  type ValidationOptions,
} from './validation';
export {
  formatAsYouType,
  formatInternationalAsYouType,
  formatPhoneNumber,
  getExampleNumber,
  getPlaceholderMask,
  toE164,
  toInternational,
  toNational,
  toNationalInputDigits,
  type PhoneNumberFormat,
} from './formatting';
export {
  parseExternalValue,
  processPhoneInput,
  reformatForCountry,
  type PhoneInputState,
  type ProcessInputOptions,
  type ProcessInputResult,
} from './input';
export {
  detectCountryFromNumber,
  internationalPrefixLength,
  resolveCountryForCallingCode,
  splitCallingCode,
  type CallingCodeSplit,
} from './detection';
export {
  caretAfterDigits,
  countDigitsBefore,
  extractDigits,
  normalizeDigits,
  normalizeSearchText,
  sanitizePhoneInput,
  type SanitizedInput,
} from './normalize';
export {
  BJ_OPERATOR_PREFIXES,
  BJ_OPERATOR_RULE,
  createPrefixRule,
  evaluateCustomRule,
  fullMatch,
  isRulePrefixViable,
  type CustomRuleInput,
  type CustomRuleResult,
} from './customRules';
export {
  COUNTRY_ALIASES,
  DEFAULT_EXCLUDED_COUNTRIES,
  getCountries,
  getCountry,
  getFlagEmoji,
  isCountryAllowed,
  NON_RGI_FLAGS,
  type GetCountriesOptions,
} from './countries';
export { buildSearchIndex, searchCountries } from './search';
export {
  getCountriesForCallingCode,
  getSupportedCountryCodes,
  isSupportedCountryCode,
  metadataHasNumberTypes,
  setPhoneMetadata,
} from './metadata';
export {
  canStartWith,
  compilePattern,
  type CompiledPattern,
} from './prefixMatcher';
export {
  isViableForTypes,
  isViableNationalPrefix,
  maxPossibleLength,
} from './viability';
export {
  DEFAULT_LOCALE,
  getCountryName,
  getMessages,
  interpolate,
  type Messages,
} from '../i18n';
export type {
  Country,
  CountryCode,
  CustomRule,
  CustomRules,
  CustomValidator,
  DeepPartial,
  NumberType,
  PhoneFieldState,
  PhoneValidationError,
  PhoneValue,
} from '../types';
