import type { NumberType, PhoneValidationError } from '../types';

/** Languages bundled with the package. */
export type PhoneFieldLang = 'fr' | 'en';

/**
 * Every user-facing string. Placeholders: `{country}` (localized country
 * name), `{callingCode}` (without `+`), `{types}` (allowed number types).
 */
export interface Messages {
  /** Error messages, by error code. */
  errors: Record<PhoneValidationError, string>;
  /** Human labels for number types, used by `{types}` and the helper text. */
  numberTypes: Record<NumberType, string>;
  /** Word joining the last two allowed types: "mobile or fixed line". */
  or: string;
  /** Helper text shown under a valid number, e.g. "Valid number · {type}". */
  validNumber: string;
  validNumberWithType: string;
  /** Modal. */
  modalTitle: string;
  searchPlaceholder: string;
  noResults: string;
  preferredSection: string;
  recentSection: string;
  allSection: string;
  close: string;
  clearSearch: string;
  /** Input. */
  clearInput: string;
  /** Accessibility. */
  countryButtonLabel: string;
  countryButtonHint: string;
  selectCountryLabel: string;
  selectedCountry: string;
  inputLabel: string;
  announceValid: string;
  announceInvalid: string;
  alphabetIndexLabel: string;
}
